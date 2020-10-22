from typing import List, Optional
import re
import itertools
import time
import sys

import numpy as np
import zlib

from scopeserver.dataserver.modules.gserver import s_pb2
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils import data
from scopeserver.dataserver.utils.annotation import Annotation
import logging

logger = logging.getLogger(__name__)

RGB_COLORS: int = 255 * 255 * 255


class CellColorByFeatures:
    def __init__(self, loom):
        self.loom = loom
        self.meta_data = loom.get_meta_data()
        self.n_cells = loom.get_nb_cells()
        self.features = []
        self.hex_vec = []
        self.v_max = np.zeros(3)
        self.max_v_max = np.zeros(3)
        self.cell_indices = list(range(self.n_cells))
        self.reply = None

    @staticmethod
    def compress_str_array(str_arr):
        logger.debug("Compressing colour data... ")
        str_array_size = sys.getsizeof(str_arr)
        str_array_joint = bytes("".join(str_arr), "utf-8")
        str_array_joint_compressed = zlib.compress(str_array_joint, 1)
        str_array_joint_compressed_size = sys.getsizeof(str_array_joint_compressed)
        savings_percent = 1 - str_array_joint_compressed_size / str_array_size
        logger.debug("Saving " + "{:.2%} of space".format(savings_percent))
        return str_array_joint_compressed

    def get_features(self):
        return self.features

    def get_hex_vec(self):
        for _ in itertools.repeat(None, 3 - len(self.features)):
            self.addEmptyFeature()
        if len(self.features) > 0 and len(self.hex_vec) == 0:
            self.hex_vec = [
                "XXXXXX" if r == g == b == 0 else "{0:02x}{1:02x}{2:02x}".format(int(r), int(g), int(b))
                for r, g, b in zip(self.features[0], self.features[1], self.features[2])
            ]
        return self.hex_vec

    def get_compressed_hex_vec(self):
        comp_start_time = time.time()
        hex_vec_compressed = CellColorByFeatures.compress_str_array(str_arr=self.get_hex_vec())
        logger.debug("{0:.5f} seconds elapsed (compression) ---".format(time.time() - comp_start_time))
        return hex_vec_compressed

    def get_v_max(self):
        return self.v_max

    def get_max_v_max(self):
        return self.max_v_max

    def get_cell_indices(self):
        return self.cell_indices

    @staticmethod
    def normalise_vals(vals: np.ndarray, v_max: int, v_min: int) -> np.ndarray:
        if len(vals[vals != 0]) == 0:
            return vals
        if v_max <= np.amin(vals[vals != 0]):
            vals[vals != 0] = constant.UPPER_LIMIT_RGB
            return vals
        clipped = np.clip(vals[vals != 0], v_min, v_max)
        vals_min = np.amin(clipped)
        non_zeros_scaled = (constant.UPPER_LIMIT_RGB - constant.LOWER_LIMIT_RGB) * (
            (clipped - vals_min) / (v_max - vals_min)
        ) + (constant.LOWER_LIMIT_RGB + 1)

        if np.isnan(np.dot(non_zeros_scaled, non_zeros_scaled)):
            non_zeros_scaled = np.nan_to_num(non_zeros_scaled, 1)

        vals[vals != 0] = np.clip(non_zeros_scaled, 0, constant.UPPER_LIMIT_RGB)
        return vals

    def setGeneFeature(self, request, feature, n):
        if feature != "":
            if len(request.annotation) > 0:
                annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
            else:
                annotations = None

            vals, self.cellIndices = self.loom.get_gene_expression(
                gene_symbol=feature,
                log_transform=request.hasLogTransform,
                cpm_normalise=request.hasCpmTransform,
                annotation=annotations,
                logic=request.logic,
            )
            if request.vmax[n] != 0.0:
                self.v_max[n] = request.vmax[n]
            else:
                self.v_max[n], self.max_v_max[n] = data.get_99_and_100_percentiles(vals)

            vals = CellColorByFeatures.normalise_vals(vals, self.v_max[n], request.vmin[n])
            self.features.append(vals)
        else:
            self.features.append(np.zeros(self.n_cells))

    def setRegulonFeature(self, request, feature, n):
        if feature != "":
            if len(request.annotation) > 0:
                annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
            else:
                annotations = None

            vals, self.cellIndices = self.loom.get_auc_values(
                regulon=feature, annotation=annotations, logic=request.logic
            )
            if request.vmax[n] != 0.0:
                self.v_max[n] = request.vmax[n]
            else:
                self.v_max[n], self.max_v_max[n] = data.get_99_and_100_percentiles(vals)
            if request.scaleThresholded:
                vals = np.array([auc if auc >= request.threshold[n] else 0 for auc in vals])

                vals = CellColorByFeatures.normalise_vals(vals, self.v_max[n], request.vmin[n])
                self.features.append(vals)
            else:
                self.features.append([constant.UPPER_LIMIT_RGB if auc >= request.threshold[n] else 0 for auc in vals])
        else:
            self.features.append(np.zeros(self.n_cells))

    def setAnnotationFeature(self, feature: str, annotations: Optional[List[Annotation]] = None, logic: str = "OR"):
        md_annotation_values = self.loom.get_meta_data_annotation_by_name(name=feature)["values"]
        ca_annotation = self.loom.get_ca_attr_by_name(name=feature)
        ca_annotation_as_int = list(map(lambda x: md_annotation_values.index(str(x)), ca_annotation))
        num_annotations = max(ca_annotation_as_int)
        if num_annotations <= len(constant.BIG_COLOR_LIST):
            self.hex_vec = list(map(lambda x: constant.BIG_COLOR_LIST[x], ca_annotation_as_int))
        else:
            raise ValueError("The annotation {0} has too many unique values.".format(feature))
        # Set the reply

        if annotations is not None:
            cellIndices = self.loom.get_anno_cells(annotations=annotations, logic=logic)
            self.hex_vec = np.array(self.hex_vec)[cellIndices]

        reply = s_pb2.CellColorByFeaturesReply(
            color=self.hex_vec,
            vmax=self.v_max,
            legend=s_pb2.ColorLegend(
                values=md_annotation_values, colors=constant.BIG_COLOR_LIST[: len(md_annotation_values)]
            ),
        )
        self.setReply(reply=reply)

    def setMetricFeature(self, request, feature, n):
        if feature != "":
            if len(request.annotation) > 0:
                annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
            else:
                annotations = None

            vals, self.cell_indices = self.loom.get_metric(
                metric_name=feature,
                log_transform=request.hasLogTransform,
                cpm_normalise=request.hasCpmTransform,
                annotation=annotations,
                logic=request.logic,
            )
            if request.vmax[n] != 0.0:
                self.v_max[n] = request.vmax[n]
            else:
                self.v_max[n], self.max_v_max[n] = data.get_99_and_100_percentiles(vals)

            vals = CellColorByFeatures.normalise_vals(vals, self.v_max[n], request.vmin[n])
            self.features.append(vals)
        else:
            self.features.append(np.zeros(self.n_cells))

    def setClusteringFeature(self, request, feature, n, secret=None):
        clusteringID = None
        clusterID = None
        logger.debug("Getting clustering: {0}".format(request.feature[n]))
        for clustering in self.meta_data["clusterings"]:
            if clustering["name"] == re.sub("^Clustering: ", "", request.featureType[n]):
                clusteringID = str(clustering["id"])
                if request.feature[n] == "All Clusters":
                    numClusters = max(self.loom.get_clustering_by_id(clusteringID))
                    legend = set()
                    clustering_meta = self.loom.get_meta_data_clustering_by_id(int(clusteringID), secret=secret)
                    cluster_dict = {int(x["id"]): x["description"] for x in clustering_meta["clusters"]}
                    for i in self.loom.get_clustering_by_id(clusteringID):
                        if i == -1:
                            self.hex_vec.append("XX" * 3)
                            continue
                        colour = constant.BIG_COLOR_LIST[i % len(constant.BIG_COLOR_LIST)]
                        self.hex_vec.append(colour)
                        legend.add((cluster_dict[i], colour))
                    values, colors = zip(*legend)
                    self.legend = s_pb2.ColorLegend(values=values, colors=colors)

                    if len(request.annotation) > 0:
                        annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
                        cellIndices = self.loom.get_anno_cells(annotations=annotations, logic=request.logic)
                        self.hex_vec = np.array(self.hex_vec)[cellIndices]

                    # Set the reply and break the for loop
                    reply = s_pb2.CellColorByFeaturesReply(color=self.hex_vec, vmax=self.v_max, legend=self.legend)
                    self.setReply(reply=reply)
                    break
                else:
                    for cluster in clustering["clusters"]:
                        if request.feature[n] == cluster["description"]:
                            clusterID = int(cluster["id"])

        if clusteringID is None and clusterID is None and len(request.feature[n]) > 0:
            error_message = "The cluster '{0}' does not exist in the current active .loom. Clear the query to continue with SCope.".format(
                request.feature[n]
            )
            self.setReply(
                s_pb2.CellColorByFeaturesReply(error=s_pb2.ErrorReply(type="Value Error", message=error_message))
            )

        if clusteringID is not None and clusterID is not None:
            clusterIndices = self.loom.get_clustering_by_id(clusteringID) == clusterID
            clusterCol = np.array([constant.UPPER_LIMIT_RGB if x else 0 for x in clusterIndices])
            if len(request.annotation) > 0:
                annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
                cellIndices = self.loom.get_anno_cells(annotations=annotations, logic=request.logic)
                clusterCol = clusterCol[cellIndices]
            self.features.append(clusterCol)

    def addEmptyFeature(self):
        self.features.append([constant.LOWER_LIMIT_RGB for n in range(self.n_cells)])

    def hasReply(self):
        if self.reply is not None:
            return True
        else:
            return False

    def setReply(self, reply):
        self.reply = reply

    def getReply(self):
        return self.reply
