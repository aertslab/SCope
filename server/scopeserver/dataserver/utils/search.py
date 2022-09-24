from typing import Dict, NamedTuple, Tuple, List
import sys
import logging
import operator
from collections import OrderedDict, defaultdict
from contextlib import suppress
from itertools import groupby

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.search_space import SSKey, SearchSpaceDict

logger = logging.getLogger(__name__)


class Match(NamedTuple):
    feature: str
    description: str


class CategorisedMatches(NamedTuple):
    category: str
    matches: List[Match]


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


def match_result_cost(
    term: str,
    result: str,
) -> int:
    term_cost: int = sys.maxsize

    if term == result:
        term_cost = 0
    elif term.casefold() == result.casefold():
        term_cost = 1
    elif result.startswith(term) or result.endswith(term):
        term_cost = 2
    elif result.casefold().startswith(term.casefold()) or result.casefold().endswith(term.casefold()):
        term_cost = 3
    elif term in result:
        term_cost = 4
    elif term.casefold() in result.casefold():
        term_cost = 5
    return term_cost


def match_result_type_cost(result_type: str) -> int:
    if result_type in ["gene", "regulon"] or result_type.startswith("Clustering:"):
        type_cost = 0
    else:
        type_cost = 1
    return type_cost


def sort_results(search_term: str, results: List[MatchResult]) -> List[MatchResult]:
    costs = [
        ((match_result_type_cost(match.element_type), match_result_cost(search_term, match.element)), match, result)
        for match, result in results
    ]
    sorted_costs = sorted(list(costs), key=operator.itemgetter(0))
    return [MatchResult(match, result) for _, match, result in sorted_costs]


def find_matches(search_term: str, search_space: SearchSpaceDict) -> List[MatchResult]:
    """
    Search for matches in the search space.

    Find keys in the search space where the search term matches (casefolded)
    the searchable element. Return the match, the matches category and relationship.

    Args:
        search_term: Term the user typed
        search_space: Search space from loom object

    Returns:
        A sorted list of the matches to the users search term
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
        matches: The sorted matches from the search space

    Returns:
        Search matches aggregated by feature and feature type
    """

    aggregated_matches: Dict[ResultTypePair, List[str]] = OrderedDict()
    for match in matches:
        key = ResultTypePair(match.result, match.search_space_match.element_type)
        if key not in aggregated_matches:
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
        aggregated_matches: Results aggregated by final term
        features: A list of features corresponding to the aggregated matches

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
            category_name = features[k]
            category_type = feature_types[k]
            desc_key = ResultTypePair(category_name, category_type)
            features[desc_key] = features[k]
            feature_types[desc_key] = feature_types[k]
            is_cluster = DEFINED_SEARCH_TYPES[k[1]]["final_category"] == "cluster_category"
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

    final_descriptions = {k: ", ".join([x for x in v if x != ""]) for (k, v) in descriptions.items()}

    return final_descriptions, features, feature_types


def get_final_feature_and_type(
    loom: Loom, aggregated_matches: Dict[ResultTypePair, List[str]]
) -> Tuple[Dict[ResultTypePair, str], Dict[ResultTypePair, str]]:
    """
    Determine final features and types.

    Build the lists needed to correctly associate each match with its final category.

    Args:
        loom: Loom object
        aggregated_matches: Aggregated matches from aggregate_matches

    Returns:
        Features and Feature types
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
            clustering_name = loom.get_meta_data_clustering_by_id(clustering_id)["name"]
            cluster = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(clustering_id, cluster_id)
            features[k] = cluster["description"]
            feature_types[k] = f"Clustering: {clustering_name}"
        else:
            features[k] = k[0]
            feature_types[k] = category

    return features, feature_types


def get_search_results(search_term: str, category: str, loom: Loom) -> List[CategorisedMatches]:
    """Take a user search term and a loom file and extract the results to display to the user

    Args:
        search_term: Search term from the user
        category: The type of results to search for
        loom: Loom file to be searched
        data_hash_secret: Secret used to hash annotations

    Returns:
        A list of categorised (by feature type) results
    """

    def category_key(result: Dict[str, str]) -> str:
        return result["category"]

    matches = find_matches(search_term, loom.ss.search_space_dict)
    aggregated_matches = aggregate_matches(matches)
    features, feature_types = get_final_feature_and_type(loom, aggregated_matches)
    descriptions, features, feature_types = create_feature_description(aggregated_matches, features, feature_types)

    aggregated = sorted(
        [
            {"feature": features[key], "category": feature_types[key], "description": descriptions[key]}
            for key in aggregated_matches
            if all([key in features, key in feature_types, key in descriptions])
        ],
        key=category_key,
    )

    grouped: Dict[str, List[Match]] = {
        key: [Match(feature=el["feature"], description=el["description"]) for el in group]
        for key, group in groupby(aggregated, key=category_key)
    }

    if category == "all":
        return [CategorisedMatches(category=key, matches=group) for key, group in grouped.items()]
    if category in grouped:
        return [CategorisedMatches(category=category, matches=grouped[category])]
    return []
