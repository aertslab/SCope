import logging

from typing import Dict, NamedTuple, Tuple, List, Optional, Type, Union
from collections import OrderedDict
from contextlib import suppress
from scopeserver.dataserver.utils import data_file_handler
from scopeserver.dataserver.utils.constant import Species

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.search_space import SearchSpace

logger = logging.getLogger(__name__)

# casefold feature, original feature, feature type
SearchMatch = NamedTuple("SearchResult", [("original_feature", str), ("resolved_feature", str), ("feature_type", str)])


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


def find_matches(search_term: str, search_space: SearchSpace) -> List[SearchMatch]:
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
        matches = [x for x in search_space if casefold_term == x[0]]
    else:
        matches = [x for x in search_space if casefold_term in x[0]]

    logger.debug(f"Found {len(matches)} unique results")

    # match_result tuple:
    # [0]: key from search_space
    # [1]: Tuple:
    #    [0]: name of feature (i.e. A gene name)
    #    [1]: resolved feature (i.e. A cluster in the case of a marker gene)
    #    [2]: type of the feature (e.g. Gene, Cluster)

    match_results = []

    for match in matches:
        if isinstance(search_space[match], list):
            for element in search_space[match]:
                match_results.append((match, (match[1], element, match[2])))
        else:
            match_results.append((match, (match[1], search_space[match], match[2])))

    perfect_match: List[SearchMatch] = []
    good_match: List[SearchMatch] = []
    bad_match: List[SearchMatch] = []

    for match_result in match_results:
        # This contains the full match, its category and their relationship
        match, result = match_result

        if match[1] == search_term or match[0] == casefold_term:
            perfect_match.append(result)
            continue
        if (
            match[1].startswith(search_term)
            or match[1].endswith(search_term)
            or match[0].startswith(casefold_term)
            or match[0].endswith(casefold_term)
        ):
            good_match.append(result)
            continue
        if search_term in match[0]:
            bad_match.append(result)
            continue

    def sort_matches(match: SearchMatch) -> str:
        return match[0]

    final_matches = (
        sorted(perfect_match, key=sort_matches)
        + sorted(good_match, key=sort_matches)
        + sorted(bad_match, key=sort_matches)
    )

    return final_matches


def aggregate_matches(matches: List[SearchMatch]) -> Dict[Tuple[str, str], List[str]]:
    """
    Collapse matches based on returned element.

    match[0]: Key of the match from the search space
    match[1]: Category of match
    match[2]: Relationship

    Args:
        matches (List[SearchMatch]): The sorted matches from the search space
        search_space (SearchSpace): The appropriate search space

    Returns:
        Dict[Tuple[str, str], List[str]]: Search matches aggregated by feature and feature type
    """

    aggregated_matches: Dict[Tuple[str, str], List[str]] = OrderedDict()
    for match in matches:
        key = (match[1], match[2])
        if key not in aggregated_matches.keys():
            aggregated_matches[key] = [match[0]]
        else:
            aggregated_matches[key].append(match[0])

    return aggregated_matches


def create_feature_description(
    aggregated_matches: Dict[Tuple[str, str], List[str]], features: Dict[Tuple[str, str], str],
) -> Dict[Tuple[str, str], str]:
    """
    Generate descriptions for final results.

    Some matches translate into something other than the term searched for. For example,
    searching for a gene that is a marker of a cluster, will result in the searched gene
    being translated into the name of the cluster that it is a marker of.

    Args:
        aggregated_matches (Dict[Tuple[str, str], List[str]]): Results aggregated by final term
        features (Dict[Tuple[str, str], str]): A list of features corresponding to the aggregated matches

    Returns:
        Dict[Tuple[str, str], str]: The final descriptions to send to the user
    """

    descriptions: Dict[Tuple[str, str], str] = {}

    for k, v in aggregated_matches.items():
        synonyms = v.copy()
        with suppress(ValueError):
            synonyms.remove(k[0])
        if k[1] == "gene" and len(synonyms) > 0:
            descriptions[k] = f"Synonyms: {', '.join(synonyms)}"
        elif k[1] in DEFINED_SEARCH_TYPES:
            if DEFINED_SEARCH_TYPES[k[1]]["final_category"] == "cluster_category":
                is_cluster = True
                category_name = features[k]
            else:
                is_cluster = False
                category_name = k[0]
            if len(v) > 1:
                if k[0][-1] == "s" and not is_cluster:
                    category_name += "es"
                elif not is_cluster:
                    category_name += "s"
                descriptions[
                    k
                ] = f"{','.join(v[:-1])} and {v[-1]} {DEFINED_SEARCH_TYPES[k[1]]['join_text_multiple']} {category_name}"
            elif len(v) == 1:
                descriptions[k] = f"{v[0]} {DEFINED_SEARCH_TYPES[k[1]]['join_text_single']} {category_name}"
        else:
            descriptions[k] = ""

    return descriptions


def get_final_feature_and_type(
    loom: Loom, aggregated_matches: Dict[Tuple[str, str], List[str]], data_hash_secret: str
) -> Tuple[Dict[Tuple[str, str], str], Dict[Tuple[str, str], str]]:
    """
    Determine final features and types.

    Build the lists needed to correctly associate each match with its final category.

    Args:
        loom (Loom): Loom object
        aggregated_matches (Dict[Tuple[str, str], List[str]]): Aggregated matches from aggregate_matches
        data_hash_secret (str): Secret used to hash annotations on clusters

    Returns:
        Tuple[Dict[Tuple[str, str], str], Dict[Tuple[str, str], str]]: Features and Feature types
    """

    features: Dict[Tuple[str, str], str] = {}
    feature_types: Dict[Tuple[str, str], str] = {}

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

    matches = find_matches(search_term, loom.ss)
    aggregated_matches = aggregate_matches(matches)
    features, feature_types = get_final_feature_and_type(loom, aggregated_matches, data_hash_secret)
    descriptions = create_feature_description(aggregated_matches, features)

    final_res = {
        "feature": [features[k] for k in aggregated_matches],
        "featureType": [feature_types[k] for k in aggregated_matches],
        "featureDescription": [descriptions[k] for k in aggregated_matches],
    }

    return final_res
