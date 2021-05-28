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
    """A 2D coordinate."""

    x: float
    y: float


class FeatureLabel(NamedTuple):
    """A label with a colour and position."""

    label: str
    colour: str
    coordinate: Coordinate


def label_annotation(loom: Loom, embedding: int, feature: str) -> List[FeatureLabel]:
    """
    Extract and group cells based on annotation. Place labels for each annotation
    at the barycentre of the cell cluster.
    """
    values = loom.get_meta_data_annotation_by_name(name=feature)["values"]
    colours = to_colours(range(len(values)))

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, annotation in enumerate(values):
            coords = loom.get_coordinates(
                coordinatesID=embedding, annotation=[Annotation(name=feature, values=[annotation])]
            )

            yield FeatureLabel(
                label=annotation,
                colour=colours[i],
                coordinate=Coordinate(x=float(np.mean(coords["x"])), y=float(np.mean(coords["y"]))),
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
    for i in uniq(loom.get_clustering_by_id(int(clustering_id))):
        if i == -1:
            label_set.add((i, "Unclustered", "XX" * 3))
            continue
        label_set.add((i, cluster_names_dict[i], constant.BIG_COLOR_LIST[i % len(constant.BIG_COLOR_LIST)]))

    cluster_ids, clusters, colours = zip(*label_set)

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, cluster in enumerate(clusters):
            coords = loom.get_coordinates(
                coordinatesID=embedding, cluster_info=(int(clustering_id), int(cluster_ids[i]))
            )

            yield FeatureLabel(
                label=cluster,
                colour=colours[i],
                coordinate=Coordinate(x=float(np.mean(coords["x"])), y=float(np.mean(coords["y"]))),
            )

    return [label for label in labels()]
