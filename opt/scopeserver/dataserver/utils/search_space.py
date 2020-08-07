import functools
import re
from typing import Any, Dict, NamedTuple, Optional, Tuple, Union

from scopeserver.dataserver.utils import data_file_handler as dfh
import logging

logger = logging.getLogger(__name__)

CURRENT_SS_VERISON = 0

SearchSpaceKey = NamedTuple("SearchSpaceKey", [("casefold_element", str), ("element", str), ("element_type", str)])


class SearchSpace(dict):

    """
    SearchSpace class is used to build the search space that contain all the queryable elements:
    - Genes
    - Clusterings (inferred from e.g.: Seurat, ...)
    - Regulons (inferred from SCENIC)
    - Annotations
    - Metrics
    """

    def __init__(self, loom) -> None:
        dict.__init__(self)
        self.loom = loom
        self.search_space_version: int = CURRENT_SS_VERISON
        self.species: str
        self.gene_mappings: Dict[str, str]
        self.species, self.gene_mappings = loom.infer_species()
        self.dfh: Optional[dfh.DataFileHandler] = dfh.DataFileHandler()

    def add_element(self, element: str, element_type: str) -> None:
        if element_type == "gene" and len(self.gene_mappings) > 0:
            if self.gene_mappings[element] != element:
                self[(f"{element}".casefold(), element, element_type)] = [self.gene_mappings[element]]
            else:
                self[(element.casefold(), element, element_type)] = element
        else:
            self[(element.casefold(), element, element_type)] = [element]

    def add_elements(self, elements: Any, element_type: Any) -> None:
        for element in elements:
            self.add_element(element=element, element_type=element_type)

    def build(self):
        if self.loom.has_meta_data():
            self.meta_data = self.loom.get_meta_data()
        # Add genes to the search space
        self.add_genes()
        # Add clusterings to the search space if present in .loom
        if self.loom.has_md_clusterings():
            self.add_clusterings()
        # Add regulons to the search space if present in .loom
        if self.loom.has_regulons_AUC():
            self.add_regulons()
        # Add annotations to the search space if present in .loom
        if self.loom.has_md_annotations():
            self.add_annotations()
        # Add metrics to the search space if present in .loom
        if self.loom.has_md_metrics():
            self.add_metrics()
        if self.loom.has_region_gene_links():
            self.add_markers(element_type="region_gene_link")
        return self

    def add_genes(self) -> None:
        # Add genes to search space
        if len(self.gene_mappings) > 0:
            genes = set(self.loom.get_genes())
            shrink_mappings = set(
                [x for x in self.dfh.dmel_mappings.keys() if x in genes or self.dfh.dmel_mappings[x] in genes]
            )
            self.add_elements(elements=shrink_mappings, element_type="gene")
        else:
            self.add_elements(elements=self.loom.get_genes(), element_type="gene")

    def add_clusterings(self) -> None:
        for clustering in self.meta_data["clusterings"]:
            all_clusters = ["All Clusters"]
            for cluster in clustering["clusters"]:
                all_clusters.append(cluster["description"])
            self.add_elements(elements=all_clusters, element_type="Clustering: {0}".format(clustering["name"]))
        self.add_markers(element_type="marker_gene")
        self.add_cluster_annotations()

    def add_cluster_annotations(self) -> None:
        for clustering in self.meta_data["clusterings"]:
            clusteringID = int(clustering["id"])
            element_type = "cluster_annotation"
            for cluster in clustering["clusters"]:
                clusterID = cluster["id"]
                annotations = cluster.get("cell_type_annotation")
                if not annotations:
                    continue
                annotations = [f'{an["data"]["annotation_label"]} ({an["data"]["obo_id"]})' for an in annotations]
                for annotation in annotations:
                    if (annotation.casefold(), annotation, element_type) in self.keys():
                        self[(annotation.casefold(), annotation, element_type)].append(f"{clusteringID}_{clusterID}")
                    else:
                        self[(annotation.casefold(), annotation, element_type)] = [f"{clusteringID}_{clusterID}"]

    def add_regulons(self) -> None:
        if self.loom.has_motif_and_track_regulons():
            self.add_elements(
                elements=self.loom.get_regulons_AUC(regulon_type="motif").dtype.names
                + self.loom.get_regulons_AUC(regulon_type="track").dtype.names,
                element_type="regulon",
            )
        else:
            self.add_elements(elements=self.loom.get_regulons_AUC().dtype.names, element_type="regulon")
        self.add_markers(element_type="regulon_target")

    def add_markers(self, element_type="regulon_target") -> None:
        loom = self.loom.loom_connection
        if element_type == "regulon_target":
            if self.loom.has_motif_and_track_regulons():
                regulons = list(
                    self.loom.get_regulons_AUC(regulon_type="motif").dtype.names
                    + self.loom.get_regulons_AUC(regulon_type="track").dtype.names
                )
            else:
                regulons = list(loom.ca.RegulonsAUC.dtype.names)

            for regulon in regulons:
                genes = self.loom.get_regulon_genes(regulon=regulon)
                for gene in genes:
                    if (gene.casefold(), gene, element_type) in self.keys():
                        self[(gene.casefold(), gene, element_type)].append(regulon)
                    else:
                        self[(gene.casefold(), gene, element_type)] = [regulon]
        if element_type == "marker_gene":
            searchable_clustering_ids = [
                x.split("_")[-1] for x in loom.ra.keys() if bool(re.search("ClusterMarkers_[0-9]+$", x))
            ]
            for clustering in searchable_clustering_ids:
                clustering = int(clustering)
                for cluster in range(len(self.meta_data["clusterings"][clustering]["clusters"])):
                    genes = self.loom.get_cluster_marker_genes(clustering, cluster)
                    for gene in genes:
                        if (gene.casefold(), gene, element_type) in self.keys():
                            self[(gene.casefold(), gene, element_type)].append(f"{clustering}_{cluster}")
                        else:
                            self[(gene.casefold(), gene, element_type)] = [f"{clustering}_{cluster}"]
        if element_type == "region_gene_link":
            for n, region in enumerate(self.loom.get_genes()):
                gene = self.loom.loom_connection.ra.linkedGene[n]
                if gene != "":
                    if (gene.casefold(), gene, element_type) in self.keys():
                        self[(gene.casefold(), gene, element_type)].append(region)
                    else:
                        self[(gene.casefold(), gene, element_type)] = [region]

    def add_annotations(self) -> None:
        annotations = []
        for annotation in self.meta_data["annotations"]:
            annotations.append(annotation["name"])
            for category in annotation["values"]:
                key = (category.casefold(), category, "annotation_category")
                if key in self:
                    self[key].append(annotation["name"])
                else:
                    self[key] = [annotation["name"]]
        self.add_elements(elements=annotations, element_type="annotation")

    def add_metrics(self) -> None:
        metrics = []
        for metric in self.meta_data["metrics"]:
            metrics.append(metric["name"])
        self.add_elements(elements=metrics, element_type="metric")
