"""
Generate labels for feature queries.
"""

from typing import List, NamedTuple, Generator
import logging

import re
import numpy as np


from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.constant import to_colours
from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.annotation import Annotation
from scopeserver.dataserver.utils.data import uniq

logger = logging.getLogger(__name__)


class Coordinate(NamedTuple):
    """ A 2D coordinate. """

    x: float
    y: float


class FeatureLabel(NamedTuple):
    """ A label with a colour and position. """

    label: str
    colour: str
    coordinate: Coordinate


def label_annotation(loom: Loom, embedding: int, feature: str) -> List[FeatureLabel]:
    """
    Extract and group cells based on annotation. Place labels for each annotation
    at the barycentre of the cell cluster.
    """
    md_annotation = loom.get_meta_data_annotation_by_name(name=feature)
    values = md_annotation["values"]
    colours = to_colours(range(len(values)), color_list=md_annotation["colors"] if "colors" in md_annotation else None)

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, annotation in enumerate(values):
            coords = loom.get_coordinates(
                coordinatesID=embedding, annotation=[Annotation(name=feature, values=[annotation])]
            )

            yield FeatureLabel(
                label=annotation,
                colour=colours[i],
                coordinate=Coordinate(x=np.mean(coords["x"]), y=np.mean(coords["y"])),
            )

    return [label for label in labels()]


def label_all_clusters(loom: Loom, embedding: int, feature: str) -> List[FeatureLabel]:
    """
    Extract and group cells based on clustering. Place labels for each cluster
    at the barycentre of the cluster.
    """
    meta_data = loom.get_meta_data()
    for clustering in meta_data["clusterings"]:
        if clustering["name"] == re.sub("^Clustering: ", "", feature):
            clustering_id = str(clustering["id"])
            cluster_names_dict = loom.get_cluster_names(int(clustering_id))

    label_set = set()

    md_clustering = loom.get_meta_data_clustering_by_id(int(clustering_id))
    colour_list = (
        [color[1:] if color.startswith("#") else color for color in md_clustering["clusterColors"]]
        if "clusterColors" in md_clustering
        else constant.BIG_COLOR_LIST
    )
    if len(cluster_names_dict.keys()) > len(colour_list):
        logger.warning(f"Not enough custom colors defined. Falling back to BIG_COLOR_LIST")
        colour_list = constant.BIG_COLOR_LIST

    for i in uniq(loom.get_clustering_by_id(int(clustering_id))):
        if i == -1:
            label_set.add((i, "Unclustered", "XX" * 3))
            continue
        label_set.add((i, cluster_names_dict[i], colour_list[i % len(colour_list)]))

    cluster_ids, clusters, colours = zip(*label_set)

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, cluster in enumerate(clusters):
            coords = loom.get_coordinates(
                coordinatesID=embedding, cluster_info=(int(clustering_id), int(cluster_ids[i]))
            )

            yield FeatureLabel(
                label=cluster,
                colour=colours[i],
                coordinate=Coordinate(x=np.mean(coords["x"]), y=np.mean(coords["y"])),
            )

    return [label for label in labels()]