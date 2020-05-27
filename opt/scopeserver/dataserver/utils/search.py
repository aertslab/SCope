import logging

from typing import Dict, Tuple, List
from collections import OrderedDict
from contextlib import suppress

from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.search_space import SearchSpace
from scopeserver.dataserver.utils import data_file_handler as dfh

logger = logging.getLogger(__name__)

# casefold feature, original feature, feature type
SearchMatch = Tuple[str, str, str]

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


class Searcher:
    def __init__(self, search_term: str, loom: Loom, data_hash_secret: str):
        self.original_search_term = search_term
        self.search_term = search_term
        self.casefold_term = search_term.casefold()
        self.loom = loom
        self.cross_species_identity: Dict[str, float] = dict()
        self.determine_cross_species(search_term)
        self.data_hash_secret = data_hash_secret

        self.dfh = dfh.DataFileHandler()

    def set_search_space(self, search_space: SearchSpace) -> None:
        self.search_space = search_space

    def set_cross_species(self, species: str) -> None:
        self.cross_species = species

    def determine_cross_species(self, search_term: str) -> None:
        if search_term.startswith("hsap\\"):
            self.set_search_space(self.loom.hsap_ss)
            self.set_cross_species("hsap")
            self.search_term = search_term[5:]
            self.casefold_term = self.search_term.casefold()
        elif search_term.startswith("mmus\\"):
            self.set_search_space(self.loom.mmus_ss)
            self.set_cross_species("mmus")
            self.search_term = search_term[5:]
            self.casefold_term = self.search_term.casefold()
        else:
            self.set_search_space(self.loom.ss)
            self.set_cross_species("")

    def find_matches(self) -> List[SearchMatch]:
        """
        Search for matches in the search space.

        Find keys in the search space where the search term matches (casefolded)
        the searchable element. Return the match, the matches category and relationship.
        """

        if len(self.casefold_term) == 1:
            matches = [x for x in self.search_space.keys() if self.casefold_term == x[0]]
        else:
            matches = [x for x in self.search_space.keys() if self.casefold_term in x[0]]

        match_results = []

        for match in matches:
            if isinstance(self.search_space[match], list):
                for element in self.search_space[match]:
                    match_results.append((match, (match[1], element, match[2])))
            else:
                match_results.append((match, (match[1], self.search_space[match], match[2])))

        perfect_match: List[SearchMatch] = []
        good_match: List[SearchMatch] = []
        bad_match: List[SearchMatch] = []

        for match_result in match_results:
            # This contains the full match, it's category and their relationship
            match, result = match_result

            if match[1] == self.search_term or match[0] == self.casefold_term:
                perfect_match.append(result)
                continue
            if (
                match[1].startswith(self.search_term)
                or match[1].endswith(self.search_term)
                or match[0].startswith(self.casefold_term)
                or match[0].endswith(self.casefold_term)
            ):
                good_match.append(result)
                continue
            if self.search_term in match[0]:
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

    def aggregate_matches(self, matches: List[SearchMatch]) -> Dict[Tuple[str, str], List[str]]:
        """
        Collapse matches based on returned element.

        match[0]: Match from search space
        match[1]: Category of match
        match[2]: Relationship
        """

        aggregated_matches: Dict[Tuple[str, str], List[str]] = OrderedDict()

        if self.cross_species == "":
            for match in matches:
                key = (match[1], match[2])
                if key not in aggregated_matches.keys():
                    aggregated_matches[key] = [match[0]]
                else:
                    aggregated_matches[key].append(match[0])

        elif self.cross_species == "hsap":
            for match in matches:
                key = (match[1], match[2])
                for droso_gene in self.dfh.hsap_to_dmel_mappings[match[0]]:
                    if key not in aggregated_matches.keys():
                        aggregated_matches[key] = [droso_gene[0]]
                    else:
                        aggregated_matches[key].append(droso_gene[0])
                    self.cross_species_identity[match[0]] = droso_gene[1]

        elif self.cross_species == "mmus":
            for match in matches:
                key = (match[1], match[2])
                for droso_gene in self.dfh.mmus_to_dmel_mappings[self.search_space[match]]:
                    if key not in aggregated_matches.keys():
                        aggregated_matches[key] = [droso_gene[0]]
                    else:
                        aggregated_matches[key].append(droso_gene[0])
                    self.cross_species_identity[match[0]] = droso_gene[1]

        return aggregated_matches

    def create_feature_description(
        self, aggregated_matches: Dict[Tuple[str, str], List[str]], features: Dict[Tuple[str, str], str]
    ) -> Dict[Tuple[str, str], str]:
        """
        Generate descriptions for final results.

        Some matches translate into something other than the term searched for. For example,
        searching for a gene that is a marker of a cluster, will result in the searched gene
        being translated into the name of the cluster that it is a marker of.
        """

        descriptions: Dict[Tuple[str, str], str] = {}

        for k, v in aggregated_matches.items():
            if self.cross_species != "":
                species_name = constant.SPECIES_MAP[self.cross_species]["short"]
                identity_perc = self.cross_species_identity[k[0]]
                descriptions[k] = f"Orthologue of {k[0]}, {identity_perc:.2f}% identity ({species_name} -> Drosophila)"
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

    def get_final_feature_and_type(self, aggregated_matches: Dict[Tuple[str, str], List[str]]):
        """
        Determine final features and types.

        Build the lists needed to correctly associate each match with its final category.
        """
        features: Dict[Tuple[str, str], str] = {}
        feature_types: Dict[Tuple[str, str], str] = {}

        for k, v in aggregated_matches.items():
            print(k, v)
            try:
                category = DEFINED_SEARCH_TYPES[k[1]]["final_category"]
            except KeyError:
                category = k[1]

            if category == "cluster_category":
                clustering_id = int(k[0].split("_")[0])
                cluster_id = int(k[0].split("_")[1])
                clustering_name = self.loom.get_meta_data_clustering_by_id(clustering_id, secret=self.data_hash_secret)[
                    "name"
                ]
                cluster = self.loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(
                    clustering_id, cluster_id, secret=self.data_hash_secret
                )
                features[k] = cluster["description"]
                feature_types[k] = f"Clustering: {clustering_name}"
            else:
                features[k] = k[0]
                feature_types[k] = category

        return features, feature_types

    def get_results(self) -> Dict[str, List[str]]:
        """
        Get all results for this search.
        """
        matches = self.find_matches()
        aggregate_matches = self.aggregate_matches(matches)
        features, feature_types = self.get_final_feature_and_type(aggregate_matches)
        descriptions = self.create_feature_description(aggregate_matches, features)

        final_res = {
            "feature": [features[k] for k in aggregate_matches.keys()],
            "featureType": [feature_types[k] for k in aggregate_matches.keys()],
            "featureDescription": [descriptions[k] for k in aggregate_matches.keys()],
        }

        return final_res
