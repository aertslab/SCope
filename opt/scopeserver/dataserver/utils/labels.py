"""
Generate labels for feature queries.
"""

from typing import List, NamedTuple, Iterator, Tuple, Generator, Iterable
import logging
from itertools import groupby

import numpy as np
import re

from scopeserver.dataserver.utils import constant
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
    values = loom.get_meta_data_annotation_by_name(name=feature)["values"]
    all_annotations = loom.get_ca_attr_by_name(name=feature)
    colours = uniq((constant.BIG_COLOR_LIST[values.index(i)] for i in all_annotations))

    annotations = uniq(loom.get_ca_attr_by_name(name=feature))

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, annotation in enumerate(annotations):
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
            clusteringID = str(clustering["id"])
            clustering_meta = loom.get_meta_data_clustering_by_id(int(clusteringID))
            cluster_dict = {}
            for cluster_meta in clustering_meta["clusters"]:
                if "cell_type_annotation" in cluster_meta:
                    top_voted = {}
                    top_votes = 0
                    for cta in cluster_meta["cell_type_annotation"]:
                        total_votes = int(len(cta["votes"]["votes_for"]["voters"])) - int(
                            len(cta["votes"]["votes_against"]["voters"])
                        )
                        if total_votes > top_votes:
                            top_voted = cta
                            top_votes = total_votes
                    if top_voted != {}:
                        cluster_dict[
                            int(cluster_meta["id"])
                        ] = f'{top_voted["data"]["annotation_label"]}\n({top_voted["data"]["obo_id"]})'
                    else:
                        cluster_dict[int(cluster_meta["id"])] = cluster_meta["description"]
                else:
                    cluster_dict[int(cluster_meta["id"])] = cluster_meta["description"]

    label_set = set()
    for i in uniq(loom.get_clustering_by_id(clusteringID)):
        if i == -1:
            label_set.add((i, 'Unclustered', "XX" * 3))
            continue
        label_set.add((i, cluster_dict[i], constant.BIG_COLOR_LIST[i % len(constant.BIG_COLOR_LIST)]))

    cluster_ids, clusters, colours = zip(*label_set)

    def labels() -> Generator[FeatureLabel, None, None]:
        for i, cluster in enumerate(clusters):
            coords = loom.get_coordinates(
                coordinatesID=embedding, clustering=clusteringID, cluster=cluster_ids[i])

            yield FeatureLabel(
                label=cluster,
                colour=colours[i],
                coordinate=Coordinate(x=np.mean(coords["x"]), y=np.mean(coords["y"])),
            )

    return [label for label in labels()]