import logging

from typing import Dict, NamedTuple, Tuple, List, Optional, Type, Union
from collections import OrderedDict, defaultdict
from contextlib import suppress
from scopeserver.dataserver.utils import data_file_handler
from scopeserver.dataserver.utils.constant import Species

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.search_space import SSKey, SearchSpaceDict

logger = logging.getLogger(__name__)


class SearchMatch(NamedTuple):
    original_feature: str
    resolved_feature: str
    feature_type: str


class MatchResult(NamedTuple):
    search_space_match: SSKey
    result: str


class ResultTypePair(NamedTuple):
    result: str
    feature_type: str


DEFINED_SEARCH_TYPES = {
    "region_gene_link": {
        "final_category": "gene",
        "join_text_single": "is linked to",
        "join_text_multiple": "are linked to",
    },
    "regulon_target": {
        "final_category": "regulon",
        "join_text_single": "is targeted by",
        "join_text_multiple": "are targeted by",
    },
    "annotation_category": {"final_category": "annotation", "join_text_single": "is a", "join_text_multiple": "are"},
    "marker_gene": {
        "final_category": "cluster_category",
        "join_text_single": "is a marker of",
        "join_text_multiple": "are markers of",
    },
    "cluster_annotation": {
        "final_category": "cluster_category",
        "join_text_single": "is a suggested annotation of",
        "join_text_multiple": "are suggested annotations of",
    },
}


def match_result_cost(term: str, result: str) -> Optional[int]:
    if term == result:
        return 0
    if term.casefold() == result.casefold():
        return 1
    if result.startswith(term) or result.endswith(term):
        return 2
    if result.casefold().startswith(term.casefold()) or result.casefold().endswith(term.casefold()):
        return 3
    if term in result:
        return 4
    if term.casefold() in result.casefold():
        return 5
    return None


def sort_results(search_term: str, results: List[MatchResult]) -> List[MatchResult]:
    costs = [(match_result_cost(search_term, match.element), match, result) for match, result in results]
    sorted_costs = sorted(
        [(cost, match, result) for cost, match, result in costs if cost is not None], key=lambda cost: cost[0]
    )
    return [MatchResult(match, result) for _, match, result in sorted_costs]


def find_matches(search_term: str, search_space: SearchSpaceDict) -> List[MatchResult]:
    """
    Search for matches in the search space.

    Find keys in the search space where the search term matches (casefolded)
    the searchable element. Return the match, the matches category and relationship.

    Args:
        search_term (str): Term the user typed
        search_space (SearchSpace): Search space from loom object

    Returns:
        List[SearchMatch]: A sorted list of the matches to the users search term
    """

    casefold_term = search_term.casefold()

    if len(casefold_term) == 1:
        matches = (x for x in search_space if casefold_term == x.element.casefold())
    else:
        matches = (x for x in search_space if casefold_term in x.element.casefold())

    match_results: List[MatchResult] = []

    for ss_match in matches:
        for element in search_space[ss_match]:
            match_results.append(MatchResult(ss_match, element))
    return sort_results(search_term, match_results)


def aggregate_matches(matches: List[MatchResult]) -> Dict[ResultTypePair, List[str]]:
    """
    Collapse matches based on returned element.

    match[0]: Key of the match from the search space
    match[1]: Category of match
    match[2]: Relationship

    Args:
        matches (List[SearchMatch]): The sorted matches from the search space
        search_space (SearchSpace): The appropriate search space

    Returns:
        Dict[ResultTypePair, List[str]]: Search matches aggregated by feature and feature type
    """

    aggregated_matches: Dict[ResultTypePair, List[str]] = OrderedDict()
    for match in matches:
        key = ResultTypePair(match.result, match.search_space_match.element_type)
        if key not in aggregated_matches.keys():
            aggregated_matches[key] = [match.search_space_match.element]
        else:
            aggregated_matches[key].append(match.search_space_match.element)

    return aggregated_matches


def create_feature_description(
    aggregated_matches: Dict[ResultTypePair, List[str]],
    features: Dict[ResultTypePair, str],
    feature_types: Dict[ResultTypePair, str],
) -> Tuple[Dict[ResultTypePair, str], Dict[ResultTypePair, str], Dict[ResultTypePair, str]]:
    """
    Generate descriptions for final results.

    Some matches translate into something other than the term searched for. For example,
    searching for a gene that is a marker of a cluster, will result in the searched gene
    being translated into the name of the cluster that it is a marker of.

    Args:
        aggregated_matches (Dict[ResultTypePair, List[str]]): Results aggregated by final term
        features (Dict[ResultTypePair, str]): A list of features corresponding to the aggregated matches

    Returns:
        final_descriptions: The final descriptions to send to the user
        features: Updated features
        feature_types: Updated feature types
    """

    descriptions: Dict[ResultTypePair, List[str]] = defaultdict(lambda: [])

    for k, v in aggregated_matches.items():
        desc_key = k
        synonyms = v.copy()
        with suppress(ValueError):
            synonyms.remove(k[0])
        if k[1] == "gene" and len(synonyms) > 0:
            descriptions[k].append(f"Synonyms: {', '.join(synonyms)}")
        elif k[1] in DEFINED_SEARCH_TYPES:
            if DEFINED_SEARCH_TYPES[k[1]]["final_category"] == "cluster_category":
                is_cluster = True
                category_name = features[k]
                category_type = feature_types[k]
                desc_key = ResultTypePair(category_name, category_type)
                features[desc_key] = features[k]
                feature_types[desc_key] = feature_types[k]
            else:
                is_cluster = False
                category_name = k[0]
            if len(v) > 1:
                if k[0][-1] == "s" and not is_cluster:
                    category_name += "es"
                elif not is_cluster:
                    category_name += "s"
                descriptions[desc_key].append(
                    f"{','.join(v[:-1])} and {v[-1]} {DEFINED_SEARCH_TYPES[k[1]]['join_text_multiple']} {category_name}"
                )
            elif len(v) == 1:
                descriptions[desc_key].append(
                    f"{v[0]} {DEFINED_SEARCH_TYPES[k[1]]['join_text_single']} {category_name}"
                )
        else:
            if len(descriptions[desc_key]) == 0:
                descriptions[desc_key] = [""]

    final_descriptions = {k: ", ".join(v) for (k, v) in descriptions.items()}

    return final_descriptions, features, feature_types


def get_final_feature_and_type(
    loom: Loom, aggregated_matches: Dict[ResultTypePair, List[str]], data_hash_secret: str
) -> Tuple[Dict[ResultTypePair, str], Dict[ResultTypePair, str]]:
    """
    Determine final features and types.

    Build the lists needed to correctly associate each match with its final category.

    Args:
        loom (Loom): Loom object
        aggregated_matches (Dict[ResultTypePair, List[str]]): Aggregated matches from aggregate_matches
        data_hash_secret (str): Secret used to hash annotations on clusters

    Returns:
        Tuple[Dict[ResultTypePair, str], Dict[ResultTypePair, str]]: Features and Feature types
    """

    features: Dict[ResultTypePair, str] = {}
    feature_types: Dict[ResultTypePair, str] = {}

    for k in aggregated_matches:
        try:
            category = DEFINED_SEARCH_TYPES[k[1]]["final_category"]
        except KeyError:
            category = k[1]

        if category == "cluster_category":
            clustering_id = int(k[0].split("_")[0])
            cluster_id = int(k[0].split("_")[1])
            clustering_name = loom.get_meta_data_clustering_by_id(clustering_id, secret=data_hash_secret)["name"]
            cluster = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(
                clustering_id, cluster_id, secret=data_hash_secret
            )
            features[k] = cluster["description"]
            feature_types[k] = f"Clustering: {clustering_name}"
        else:
            features[k] = k[0]
            feature_types[k] = category

    return features, feature_types


def get_search_results(search_term: str, loom: Loom, data_hash_secret: str) -> Dict[str, List[str]]:
    """Take a user search term and a loom file and extract the results to display to the user

    Args:
        search_term (str): Search term from the user
        loom (Loom): Loom file to be searched
        data_hash_secret (str): Secret used to hash annotations
        data_file_handler (DataFileHandler): The data file handler object from the Gserver

    Returns:
        Dict[str, List[str]]: A dict of the compiled results
    """

    matches = find_matches(search_term, loom.ss.search_space_dict)
    aggregated_matches = aggregate_matches(matches)
    features, feature_types = get_final_feature_and_type(loom, aggregated_matches, data_hash_secret)
    descriptions, features, feature_types = create_feature_description(aggregated_matches, features, feature_types)

    final_res = {
        "feature": [features[k] for k in descriptions],
        "featureType": [feature_types[k] for k in descriptions],
        "featureDescription": [descriptions[k] for k in descriptions],
    }

    return final_res
