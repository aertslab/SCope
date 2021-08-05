from concurrent import futures
import time
import grpc
import loompy as lp
from loompy import timestamp
from loompy import _version
import os
import numpy as np
import shutil
import json
import uuid
import datetime

from typing import DefaultDict, Set, List, Dict, Any
from collections import defaultdict
from itertools import compress
from pathlib import Path

import scope_grpc_pb2
import scope_grpc_pb2_grpc
from scopeserver.dataserver.utils import sys_utils as su
from scopeserver.dataserver.utils import loom_file_handler as lfh
from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import cell_color_by_features as ccbf
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils import data
from scopeserver.dataserver.utils import proto
from scopeserver.dataserver.utils.search import get_search_results, CategorisedMatches
from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.labels import label_annotation, label_all_clusters
from scopeserver.dataserver.utils.annotation import Annotation

import logging

logger = logging.getLogger(__name__)


class SCope(scope_grpc_pb2_grpc.MainServicer):

    app_name = "SCope"
    app_author = "Aertslab"

    orcid_active = False

    def __init__(self, config: Dict[str, str]):

        self.config = config

        self.dfh = dfh.DataFileHandler()
        self.lfh = lfh.LoomFileHandler()

        self.dfh.set_global_data()
        self.lfh.set_global_data()
        self.dfh.read_UUID_db()
        self.dfh.read_ORCID_db()

        self.check_ORCID_connection()

    def update_global_data(self) -> None:
        self.dfh.set_global_data()
        self.lfh.set_global_data()

    def check_ORCID_connection(self) -> None:
        # TODO: Remove
        self.orcid_active = False

    def getORCIDStatus(self, request, context):
        # TODO: Remove
        return scope_grpc_pb2.getORCIDStatusReply(active=self.orcid_active)

    def getORCID(self, request, context):
        # TODO: Remove
        return scope_grpc_pb2.getORCIDReply(orcid_scope_uuid="null", name="null", orcid_id="null", success=False)

    def getVmax(self, request, context):
        v_max = np.zeros(3)
        max_v_max = np.zeros(3)

        for n, feature in enumerate(request.feature):
            f_v_max = 0
            f_max_v_max = 0
            if feature != "":
                for loomFilePath in request.loomFilePath:
                    l_v_max = 0
                    l_max_v_max = 0
                    loom = self.lfh.get_loom(loom_file_path=Path(loomFilePath))
                    if request.featureType[n] == "gene":
                        vals = loom.get_gene_expression(
                            gene_symbol=feature,
                            log_transform=request.hasLogTransform,
                            cpm_normalise=request.hasCpmTransform,
                        )
                        l_v_max, l_max_v_max = data.get_99_and_100_percentiles(vals)
                    if request.featureType[n] == "regulon":
                        vals, _ = loom.get_auc_values(regulon=feature)
                        l_v_max, l_max_v_max = data.get_99_and_100_percentiles(vals)
                    if request.featureType[n] == "metric":
                        vals, _ = loom.get_metric(
                            metric_name=feature,
                            log_transform=request.hasLogTransform,
                            cpm_normalise=request.hasCpmTransform,
                        )
                        l_v_max, l_max_v_max = data.get_99_and_100_percentiles(vals)
                    if l_v_max > f_v_max:
                        f_v_max = l_v_max
                if l_max_v_max > f_max_v_max:
                    f_max_v_max = l_max_v_max
            v_max[n] = f_v_max
            max_v_max[n] = f_max_v_max
        return scope_grpc_pb2.VmaxReply(vmax=v_max, maxVmax=max_v_max)

    def getCellColorByFeatures(self, request, context):
        start_time = time.time()
        try:
            loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        except ValueError:
            return

        cell_color_by_features = ccbf.CellColorByFeatures(loom=loom)

        if len(request.annotation) > 0:
            annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
        else:
            annotations = None

        for n, feature in enumerate(request.feature):
            if request.featureType[n] == "gene":
                cell_color_by_features.setGeneFeature(request=request, feature=feature, n=n)
            elif request.featureType[n] == "regulon":
                cell_color_by_features.setRegulonFeature(request=request, feature=feature, n=n)
            elif request.featureType[n] == "annotation":
                cell_color_by_features.setAnnotationFeature(
                    feature=feature, annotations=annotations, logic=request.logic
                )
                return cell_color_by_features.getReply()
            elif request.featureType[n] == "metric":
                cell_color_by_features.setMetricFeature(request=request, feature=feature, n=n)
            elif request.featureType[n].startswith("Clustering: "):
                cell_color_by_features.setClusteringFeature(request=request, feature=feature, n=n)
                if cell_color_by_features.hasReply():
                    return cell_color_by_features.getReply()
            else:
                cell_color_by_features.addEmptyFeature()

        logger.debug("{0:.5f} seconds elapsed getting colours ---".format(time.time() - start_time))
        return scope_grpc_pb2.CellColorByFeaturesReply(
            color=None,
            compressedColor=cell_color_by_features.get_compressed_hex_vec(),
            hasAddCompressionLayer=True,
            vmax=cell_color_by_features.get_v_max(),
            maxVmax=cell_color_by_features.get_max_v_max(),
            cellIndices=cell_color_by_features.get_cell_indices(),
        )

    def getFeatureLabels(self, request, context):
        try:
            loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        except ValueError:
            return

        label_extract = label_all_clusters if request.feature.startswith("Clustering:") else label_annotation

        labels = [
            scope_grpc_pb2.FeatureLabelReply.FeatureLabel(
                label=label.label,
                colour=label.colour,
                coordinate=scope_grpc_pb2.Coordinate(x=label.coordinate.x, y=label.coordinate.y),
            )
            for label in label_extract(loom, request.embedding, request.feature)
        ]

        return scope_grpc_pb2.FeatureLabelReply(labels=labels)

    def getCellAUCValuesByFeatures(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        vals, _ = loom.get_auc_values(regulon=request.feature[0])
        return scope_grpc_pb2.CellAUCValuesByFeaturesReply(value=vals)

    def getNextCluster(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        clustering_meta = loom.get_meta_data_clustering_by_id(request.clusteringID)
        max_cluster = max([int(x["id"]) for x in clustering_meta["clusters"]])
        min_cluster = min([int(x["id"]) for x in clustering_meta["clusters"]])

        if request.direction == "next":
            next_clusterID = request.clusterID + 1
        elif request.direction == "previous":
            next_clusterID = request.clusterID - 1

        if next_clusterID > max_cluster:
            next_clusterID = min_cluster
        elif next_clusterID < min_cluster:
            next_clusterID = max_cluster

        try:
            cluster_metadata = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(
                request.clusteringID, next_clusterID
            )
        except ValueError:
            cluster_metadata = loom.get_meta_data_cluster_by_clustering_id_and_cluster_id(
                request.clusteringID, request.clusterID
            )

        search_results: List[CategorisedMatches] = [
            result
            for result in get_search_results(cluster_metadata["description"], "all", loom)
            if result.category == f"Clustering: {clustering_meta['name']}"
        ]

        return scope_grpc_pb2.FeatureReply(
            features=[
                scope_grpc_pb2.FeatureReply.Feature(
                    category=feature.category,
                    results=[
                        scope_grpc_pb2.FeatureReply.Feature.Match(title=match.feature, description=match.description)
                        for match in feature.matches
                    ],
                )
                for feature in search_results
            ]
        )

    def getCellMetaData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        cell_indices = request.cellIndices
        if len(cell_indices) == 0:
            cell_indices = list(range(loom.get_nb_cells()))

        cell_clusters = []
        for clustering_id in request.clusterings:
            if clustering_id != "":
                cell_clusters.append(loom.get_clustering_by_id(clustering_id=clustering_id)[cell_indices])
        gene_exp = []
        for gene in request.selectedGenes:
            if gene != "":
                vals = loom.get_gene_expression(
                    gene_symbol=gene, log_transform=request.hasLogTransform, cpm_normalise=request.hasCpmTransform
                )
                gene_exp.append(vals[cell_indices])
        auc_vals = []
        for regulon in request.selectedRegulons:
            if regulon != "":
                vals, _ = loom.get_auc_values(regulon=regulon)
                auc_vals.append(vals[[cell_indices]])
        annotations = []
        for anno in request.annotations:
            if anno != "":
                annotations.append(loom.get_ca_attr_by_name(name=anno)[cell_indices].astype(str))

        return scope_grpc_pb2.CellMetaDataReply(
            clusterIDs=[scope_grpc_pb2.CellClusters(clusters=x) for x in cell_clusters],
            geneExpression=[scope_grpc_pb2.FeatureValues(features=x) for x in gene_exp],
            aucValues=[scope_grpc_pb2.FeatureValues(features=x) for x in auc_vals],
            annotations=[scope_grpc_pb2.CellAnnotations(annotations=x) for x in annotations],
        )

    def getFeatures(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        features = get_search_results(request.query, request.filter, loom)
        return scope_grpc_pb2.FeatureReply(
            features=[
                scope_grpc_pb2.FeatureReply.Feature(
                    category=feature.category,
                    results=[
                        scope_grpc_pb2.FeatureReply.Feature.Match(title=match.feature, description=match.description)
                        for match in feature.matches
                    ],
                )
                for feature in features
            ]
        )

    def getCoordinates(self, request, context):
        # request content
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))

        if len(request.annotation) > 0:
            annotations = [Annotation(name=ann.name, values=ann.values) for ann in request.annotation]
        else:
            annotations = None

        c = loom.get_coordinates(coordinatesID=request.coordinatesID, annotation=annotations, logic=request.logic)
        return scope_grpc_pb2.CoordinatesReply(x=c["x"], y=c["y"], cellIndices=c["cellIndices"])

    def setAnnotationName(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        success = loom.rename_annotation(request.clusteringID, request.clusterID, request.newAnnoName)
        return scope_grpc_pb2.SetAnnotationNameReply(success=success)

    def setLoomHierarchy(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        success = loom.set_hierarchy(request.newHierarchy_L1, request.newHierarchy_L2, request.newHierarchy_L3)
        return scope_grpc_pb2.SetLoomHierarchyReply(success=success)

    def setColabAnnotationData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        if not self.dfh.confirm_orcid_uuid(request.orcidInfo.orcidID, request.orcidInfo.orcidUUID):
            return scope_grpc_pb2.setColabAnnotationDataReply(success=False, message="Could not confirm user!")
        success, message = loom.add_collab_annotation(request, self.config["SECRET"])
        return scope_grpc_pb2.setColabAnnotationDataReply(success=success, message=message)

    def addNewClustering(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        if not self.dfh.confirm_orcid_uuid(request.orcidInfo.orcidID, request.orcidInfo.orcidUUID):
            return scope_grpc_pb2.AddNewClusteringReply(success=False, message="Could not confirm user!")
        success, message = loom.add_user_clustering(request)
        return scope_grpc_pb2.AddNewClusteringReply(success=success, message=message)

    def voteAnnotation(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        if not self.dfh.confirm_orcid_uuid(request.orcidInfo.orcidID, request.orcidInfo.orcidUUID):
            return scope_grpc_pb2.voteAnnotationReply(success=False, message="Could not confirm user!")
        success, message = loom.annotation_vote(request, self.config["SECRET"])
        return scope_grpc_pb2.voteAnnotationReply(success=success, message=message)

    def getClusterOverlaps(self, request, context):
        """Get overlapping clusters of the requested cellIDs and return formatted protobuf object."""
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        cluster_overlap_data = loom.get_cluster_overlaps(request.cellIndices)
        return scope_grpc_pb2.ClusterOverlaps(
            clusterOverlaps=[scope_grpc_pb2.ClusterOverlaps.ClusterOverlap(**x) for x in cluster_overlap_data]
        )

    def getRegulonMetaData(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        regulon_genes = None
        autoThresholds = None
        defaultThreshold = None
        motifName = None
        regulon_genes = loom.get_regulon_genes(regulon=request.regulon)

        if len(regulon_genes) == 0:
            logger.error("Something is wrong in the loom file: no regulon found!")

        meta_data = loom.get_meta_data()
        if "regulonThresholds" in meta_data:
            for regulon in meta_data["regulonThresholds"]:
                if regulon["regulon"] == request.regulon:
                    autoThresholds = []
                    for threshold in regulon["allThresholds"].keys():
                        autoThresholds.append({"name": threshold, "threshold": regulon["allThresholds"][threshold]})
                    defaultThreshold = regulon["defaultThresholdName"]
                    try:
                        motifName = os.path.basename(regulon["motifData"])
                    except Exception as e:
                        logger.error(f"Exception raised {e}")
                        motifName = None
                    break

        # min_gene_occurrence_mask = regulon_marker_metrics >= meta_data["regulonSettings"]["min_regulon_gene_occurrence"]
        # # Filter the regulon genes by threshold
        # regulon_genes = regulon_genes[min_gene_occurrence_mask]

        if "regulonSettings" in meta_data:
            metrics = [
                {"accessor": "GeneOccurrences", "name": "Occurrence", "description": "Regulon Target Gene Occurrence"}
            ]

            def get_regulon_marker_metric(regulon_metric):
                return {
                    regulon_metric["accessor"]: loom.get_regulon_target_gene_metric(
                        regulon=request.regulon, metric_accessor=regulon_metric["accessor"]
                    )
                }

            regulon_marker_metrics_dict = {
                k: v for e in list(map(get_regulon_marker_metric, metrics)) for k, v in e.items()
            }
            # Create the mask based on threshold
            mask = (
                regulon_marker_metrics_dict["GeneOccurrences"]
                >= meta_data["regulonSettings"]["min_regulon_gene_occurrence"]
            )
            # Filter the regulon genes by threshold
            regulon_genes = regulon_genes[mask]
            regulon_marker_metrics = list(
                map(
                    lambda metric: scope_grpc_pb2.RegulonGenesMetric(
                        accessor=metric["accessor"],
                        name=metric["name"],
                        description=metric["description"],
                        values=regulon_marker_metrics_dict[metric["accessor"]][mask],
                    ),
                    metrics,
                )
            )
        else:
            regulon_marker_metrics = None

        regulon = {
            "genes": regulon_genes,
            "autoThresholds": autoThresholds,
            "defaultThreshold": defaultThreshold,
            "motifName": motifName,
            "metrics": regulon_marker_metrics,
        }

        return scope_grpc_pb2.RegulonMetaDataReply(regulonMeta=regulon)

    def getMarkerGenes(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        # Check if cluster markers for the given clustering are present in the loom
        if not loom.has_cluster_markers(clustering_id=request.clusteringID):
            logger.info("No markers for clustering {0} present in active loom.".format(request.clusteringID))
            return scope_grpc_pb2.MarkerGenesReply(genes=[], metrics=[])

        # Filter the MD clusterings by ID
        md_clustering = loom.get_meta_data_clustering_by_id(id=request.clusteringID)
        cluster_marker_metrics = None

        if "clusterMarkerMetrics" in md_clustering.keys():
            md_cmm = md_clustering["clusterMarkerMetrics"]

            cluster_marker_metrics = loom.get_cluster_marker_table(
                clustering_id=request.clusteringID, cluster_id=request.clusterID
            )

        metrics = [proto.protoize_cluster_marker_metric(x, cluster_marker_metrics) for x in md_cmm]
        return scope_grpc_pb2.MarkerGenesReply(genes=cluster_marker_metrics.index, metrics=metrics)

    def getMyLooms(self, request, context):
        my_looms = []
        update = False
        userDir = dfh.DataFileHandler.get_data_dir_path_by_file_type("Loom", UUID=request.UUID)
        if not os.path.isdir(userDir):
            for i in ["Loom", "GeneSet", "LoomAUCellRankings"]:
                os.mkdir(os.path.join(self.dfh.get_data_dirs()[i]["path"], request.UUID))

        self.update_global_data()

        loomsToProcess = sorted(self.lfh.get_global_looms()) + sorted(
            [os.path.join(request.UUID, x) for x in os.listdir(userDir)]
        )

        if request.loomFile:
            if request.loomFile in loomsToProcess:
                loomsToProcess = [request.loomFile]
                update = True
            else:
                logger.error("User requested a loom file wich is not available")

        for f in loomsToProcess:
            try:
                if f.endswith(".loom"):
                    with open(self.lfh.get_loom_absolute_file_path(f), "r") as fh:
                        loomSize = os.fstat(fh.fileno())[6]
                    loom = self.lfh.get_loom(loom_file_path=Path(f))
                    if loom is None:
                        continue
                    file_meta = loom.get_file_metadata()
                    if not file_meta["hasGlobalMeta"]:
                        try:
                            loom.generate_meta_data()
                            file_meta = loom.get_file_metadata()
                        except Exception as e:
                            logger.error("Failed to make metadata!")
                            logger.error(e)

                    try:
                        L1 = loom.get_global_attribute_by_name(name="SCopeTreeL1")
                        L2 = loom.get_global_attribute_by_name(name="SCopeTreeL2")
                        L3 = loom.get_global_attribute_by_name(name="SCopeTreeL3")
                    except AttributeError:
                        L1 = "Uncategorized"
                        L2 = L3 = ""
                    my_looms.append(
                        scope_grpc_pb2.MyLoom(
                            loomFilePath=f,
                            loomDisplayName=os.path.splitext(os.path.basename(f))[0],
                            loomSize=loomSize,
                            cellMetaData=scope_grpc_pb2.CellMetaData(
                                annotations=loom.get_meta_data_by_key(key="annotations"),
                                embeddings=loom.get_meta_data_by_key(key="embeddings"),
                                clusterings=proto.protoize_cell_type_annotation(
                                    loom.get_meta_data_by_key(key="clusterings"), secret=self.config["SECRET"]
                                ),
                            ),
                            fileMetaData=file_meta,
                            loomHeierarchy=scope_grpc_pb2.LoomHeierarchy(L1=L1, L2=L2, L3=L3),
                        )
                    )
            except ValueError as ve:
                logger.error(f"Serious error processing active loom files: {ve}")
        self.dfh.update_UUID_db()

        return scope_grpc_pb2.MyLoomsReply(myLooms=my_looms, update=update)

    def getUUID(self, request, context):
        newUUID = str(uuid.uuid4())

        logger.info(f"IP {request.ip} connected to SCope. Passing new UUID {newUUID}.")
        self.dfh.get_uuid_log().write(
            "{0} :: {1} :: New UUID ({2}) assigned.\n".format(
                time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()), request.ip, newUUID
            )
        )
        self.dfh.get_uuid_log().flush()
        self.dfh.get_current_UUIDs()[newUUID] = [time.time(), "rw"]  # New sessions are rw
        return scope_grpc_pb2.UUIDReply(UUID=newUUID)

    def getRemainingUUIDTime(
        self, request, context
    ):  # TODO: his function will be called a lot more often, we should reduce what it does.
        curUUIDSet = set(list(self.dfh.get_current_UUIDs().keys()))
        for uid in curUUIDSet:
            timeRemaining = int(dfh._UUID_TIMEOUT - (time.time() - self.dfh.get_current_UUIDs()[uid][0]))
            if timeRemaining < 0:
                logger.info("Removing folders of expired UUID: {0}".format(uid))
                del self.dfh.get_current_UUIDs()[uid]
                for i in ["Loom", "GeneSet", "LoomAUCellRankings"]:
                    if os.path.exists(os.path.join(self.dfh.get_data_dirs()[i]["path"], uid)):
                        shutil.rmtree(os.path.join(self.dfh.get_data_dirs()[i]["path"], uid))
        uid = request.UUID
        if uid in self.dfh.get_current_UUIDs().keys():
            logger.info(f"IP {request.ip} connected to SCope. Using UUID {uid} from frontend.")
            startTime = self.dfh.get_current_UUIDs()[uid][0]
            timeRemaining = int(dfh._UUID_TIMEOUT - (time.time() - startTime))
            self.dfh.get_uuid_log().write(
                "{0} :: {1} :: Old UUID ({2}) connected :: Time Remaining - {3}.\n".format(
                    time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()), request.ip, uid, timeRemaining
                )
            )
            self.dfh.get_uuid_log().flush()
        else:
            logger.info(f"IP {request.ip} connected to SCope. Using UUID {uid} from frontend.")
            try:
                uuid.UUID(uid)
            except (KeyError, AttributeError):
                old_uid = uid
                uid = str(uuid.uuid4())
                logger.error(f"UUID {old_uid} is malformed. Passing new UUID {uid}")
            self.dfh.get_uuid_log().write(
                "{0} :: {1} :: New UUID ({2}) assigned.\n".format(
                    time.strftime("%Y-%m-%d__%H-%M-%S", time.localtime()), request.ip, uid
                )
            )
            self.dfh.get_uuid_log().flush()
            self.dfh.get_current_UUIDs()[uid] = [time.time(), "rw"]
            timeRemaining = int(dfh._UUID_TIMEOUT)

        self.dfh.active_session_check()
        if request.mouseEvents >= constant.MOUSE_EVENTS_THRESHOLD:
            self.dfh.reset_active_session_timeout(uid)

        sessionsLimitReached = False

        if (
            len(self.dfh.get_active_sessions().keys()) >= constant.ACTIVE_SESSIONS_LIMIT
            and uid not in self.dfh.get_permanent_UUIDs()
            and uid not in self.dfh.get_active_sessions().keys()
        ):
            sessionsLimitReached = True
            logger.warning(
                f"Maximum number of concurrent active sessions ({constant.ACTIVE_SESSIONS_LIMIT}) reached. IP {request.ip} will not be able to access SCope."
            )

        if uid not in self.dfh.get_active_sessions().keys() and not sessionsLimitReached:
            self.dfh.reset_active_session_timeout(uid)

        sessionMode = self.dfh.get_current_UUIDs()[uid][1]
        return scope_grpc_pb2.RemainingUUIDTimeReply(
            UUID=uid, timeRemaining=timeRemaining, sessionsLimitReached=sessionsLimitReached, sessionMode=sessionMode
        )

    def translateLassoSelection(self, request, context):
        src_loom = self.lfh.get_loom(loom_file_path=Path(request.srcLoomFilePath))
        dest_loom = self.lfh.get_loom(loom_file_path=Path(request.destLoomFilePath))
        src_cell_ids = [src_loom.get_cell_ids()[i] for i in request.cellIndices]
        src_fast_index = set(src_cell_ids)
        dest_mask = [x in src_fast_index for x in dest_loom.get_cell_ids()]
        dest_cell_indices = list(compress(range(len(dest_mask)), dest_mask))
        return scope_grpc_pb2.TranslateLassoSelectionReply(cellIndices=dest_cell_indices)

    def getCellIDs(self, request, context):
        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        cell_ids = loom.get_cell_ids()
        slctd_cell_ids = [cell_ids[i] for i in request.cellIndices]
        return scope_grpc_pb2.CellIDsReply(cellIds=slctd_cell_ids)

    def deleteUserFile(self, request, context):
        self.dfh.update_UUID_db()
        success = False
        basename = os.path.basename(request.filePath)
        finalPath = os.path.join(self.dfh.get_data_dirs()[request.fileType]["path"], request.UUID, basename)
        if self.dfh.current_UUIDs[request.UUID][1] == "rw":
            if os.path.isfile(finalPath) and (basename.endswith(".loom") or basename.endswith(".txt")):
                try:
                    if basename.endswith(".loom"):
                        abs_file_path = self.lfh.drop_loom(request.filePath)
                        try:
                            os.remove(abs_file_path.with_suffix(".ss_pkl"))

                        except OSError as err:
                            logger.error(f"Could not delete search space pickle from {request.filePath}. {err}")
                    try:
                        os.remove(finalPath)
                    except OSError as err:
                        logger.error(f"Couldn't delete {finalPath}. {err}")
                    success = True
                    logger.info(f"File {request.filePath} deleted at request of user with UUID {request.UUID}.")

                except Exception as e:
                    logger.error(f"OS Error, couldn't remove file: {finalPath}")
                    logger.error(e)
        else:
            logger.error(f"UUID: {request.UUID} is read-only, but requested to delete file {finalPath}")
        return scope_grpc_pb2.DeleteUserFileReply(deletedSuccessfully=success)

    def downloadSubLoom(self, request, context):
        start_time = time.time()

        loom = self.lfh.get_loom(loom_file_path=Path(request.loomFilePath))
        loom_connection = loom.get_connection()
        meta_data = loom.get_meta_data()

        file_name = request.loomFilePath
        # Check if not a public loom file
        if "/" in request.loomFilePath:
            loom_name = request.loomFilePath.split("/")
            file_name = loom_name[1].split(".")[0]

        if request.featureType == "clusterings":
            a = list(filter(lambda x: x["name"] == request.featureName, meta_data["clusterings"]))
            b = list(filter(lambda x: x["description"] == request.featureValue, a[0]["clusters"]))[0]
            cells = loom_connection.ca["Clusterings"][str(a[0]["id"])] == b["id"]
            logger.debug("Number of cells in {0}: {1}".format(request.featureValue, np.sum(cells)))
            sub_loom_file_name = file_name + "_Sub_" + request.featureValue.replace(" ", "_").replace("/", "_")
        elif request.featureType == "cellSelection":
            cells = np.full(loom.get_nb_cells(), False)
            cells[request.cellIndices] = True
            logger.debug(f"Number of cells in selection: {len(request.cellIndices)}")
            sub_loom_file_name = (
                f"{file_name}_CellSelection_{request.featureValue}_{datetime.datetime.now().strftime('%y%m%d_%H%M')}"
            )
        else:
            logger.error("This feature is currently not implemented.")
            return

        if not os.path.exists(os.path.join(self.dfh.get_data_dirs()["Loom"]["path"], "tmp")):
            os.mkdir(os.path.join(self.dfh.get_data_dirs()["Loom"]["path"], "tmp"))
        sub_loom_file_path = os.path.join(self.dfh.get_data_dirs()["Loom"]["path"], "tmp", sub_loom_file_name + ".loom")
        # Check if the file already exists
        if os.path.exists(path=sub_loom_file_path):
            os.remove(path=sub_loom_file_path)
        # Create new file attributes
        sub_loom_file_attrs = dict()
        sub_loom_file_attrs["title"] = sub_loom_file_name
        sub_loom_file_attrs["CreationDate"] = timestamp()
        sub_loom_file_attrs["LOOM_SPEC_VERSION"] = _version.__version__
        if "title" in loom_connection.attrs:
            sub_loom_file_attrs[
                "note"
            ] = f"This loom is a subset of {Loom.clean_file_attr(file_attr=loom_connection.attrs['title'])} loom file"
        else:
            sub_loom_file_attrs["note"] = f"This loom is a subset of {request.loomFilePath} loom file"
        sub_loom_file_attrs["MetaData"] = Loom.clean_file_attr(file_attr=loom_connection.attrs["MetaData"])
        # - Use scan to subset cells (much faster than naive subsetting): avoid to load everything into memory
        # - Loompy bug: loompy.create_append works but generate a file much bigger than its parent
        #      So prepare all the data and create the loom afterwards
        logger.debug("Subsetting {0} cluster from the active .loom...".format(request.featureValue))
        processed = 0
        tot_cells = loom.get_nb_cells()
        yield scope_grpc_pb2.DownloadSubLoomReply(
            loomFilePath="",
            loomFileSize=0,
            progress=scope_grpc_pb2.Progress(value=0.01, status="Sub Loom creation started!"),
            isDone=False,
        )
        sub_matrices = []
        for (idx, _, view) in loom_connection.scan(items=cells, axis=1, batch_size=5120):
            sub_matrices.append(view[:, :])
            # Send the progress
            processed = idx / tot_cells
            yield scope_grpc_pb2.DownloadSubLoomReply(
                loomFilePath="",
                loomFileSize=0,
                progress=scope_grpc_pb2.Progress(value=processed, status="Sub Loom Created!"),
                isDone=False,
            )
        yield scope_grpc_pb2.DownloadSubLoomReply(
            loomFilePath="",
            loomFileSize=0,
            progress=scope_grpc_pb2.Progress(value=0.99, status="Sub Loom Created!"),
            isDone=False,
        )
        sub_matrix = np.concatenate(sub_matrices, axis=1)
        logger.debug("Creating {0} sub .loom...".format(request.featureValue))
        lp.create(
            sub_loom_file_path,
            sub_matrix,
            row_attrs=loom_connection.ra,
            col_attrs=loom_connection.ca[cells],
            file_attrs=sub_loom_file_attrs,
        )
        del sub_matrix
        with open(sub_loom_file_path, "r") as fh:
            loom_file_size = os.fstat(fh.fileno())[6]
        logger.debug("{0:.5f} seconds elapsed making loom ---".format(time.time() - start_time))

        yield scope_grpc_pb2.DownloadSubLoomReply(
            loomFilePath=sub_loom_file_path,
            loomFileSize=loom_file_size,
            progress=scope_grpc_pb2.Progress(value=1.0, status="Sub Loom Created!"),
            isDone=True,
        )


def serve(run_event, config: Dict[str, Any]) -> None:
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[("grpc.max_send_message_length", -1), ("grpc.max_receive_message_length", -1)],
    )
    scope = SCope(config=config)
    scope_grpc_pb2_grpc.add_MainServicer_to_server(scope, server)
    server.add_insecure_port("[::]:{0}".format(config["RPC_PORT"]))
    server.start()

    # Let the main process know that GServer has started.
    su.send_msg("GServer", "SIGSTART")

    while run_event.is_set():
        time.sleep(0.1)

    for loom in scope.lfh.active_looms.values():
        loom.get_connection().close()

    # Write UUIDs to file here
    scope.dfh.get_uuid_log().close()
    scope.dfh.update_UUID_db()
    server.stop(0)
