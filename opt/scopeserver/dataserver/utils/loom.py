import numpy as np
import json
import zlib
import base64
from methodtools import lru_cache
import pandas as pd
import time
import hashlib
import functools
from collections import Counter
from pathlib import Path
from typing import Tuple, Dict, Any, Union, List, Set, Optional
from loompy.loompy import LoomConnection
from typing_extensions import TypedDict
from google.protobuf.internal.containers import RepeatedScalarFieldContainer

from scopeserver.dataserver.utils import data_file_handler as dfh
from scopeserver.dataserver.utils import search_space as ss
from scopeserver.dataserver.modules.gserver import s_pb2
from scopeserver.dataserver.utils import constant
from scopeserver.dataserver.utils.annotation import Annotation

import logging

logger = logging.getLogger(__name__)

Cluster = TypedDict(
    "Cluster",
    {
        "id": int,
        "description": str,
    },
)

Clusters = List[Cluster]

Clustering = TypedDict(
    "Clustering", {"id": int, "group": str, "name": str, "clusters": Clusters, "clusterMarkerMetrics": Any}
)


class Loom:
    def __init__(
        self,
        file_path: Path,
        abs_file_path: Path,
        loom_connection: LoomConnection,
        loom_file_handler,
    ):
        self.lfh = loom_file_handler
        self.file_path = file_path
        self.abs_file_path = abs_file_path
        self.loom_connection = loom_connection
        self.dfh = dfh.DataFileHandler()

        logger.info(f"New Loom object created for {file_path}")
        # Metrics
        self.nUMI = None
        self.species, self.gene_mappings = self.infer_species()
        self.ss_pickle_name = self.abs_file_path.with_suffix(".ss_pkl")
        self.ss = ss.load_ss(self)

    def get_connection(self):
        return self.loom_connection

    def get_file_path(self) -> Path:
        return self.file_path

    def get_abs_file_path(self) -> Path:
        return self.abs_file_path

    def get_global_attribute_by_name(self, name):
        if name not in self.loom_connection.attrs.keys():
            raise AttributeError("The global attribute {0} does not exist in the .loom file.".format(name))
        return self.loom_connection.attrs[name]

    @staticmethod
    def clean_file_attr(file_attr):
        fa = file_attr
        if type(file_attr) == np.ndarray:
            fa = file_attr[0]
        try:
            fa = fa.decode("utf-8")
        except AttributeError:
            pass
        return fa

    @staticmethod
    def dfToNamedMatrix(df: pd.DataFrame) -> np.ndarray:
        arr_ip = [tuple(i) for i in df.values]
        dtyp = np.dtype(list(zip(df.dtypes.index, df.dtypes)))
        arr = np.array(arr_ip, dtype=dtyp)
        return arr

    def get_cell_ids(self) -> np.ndarray:
        return self.loom_connection.ca["CellID"]

    #############
    # Meta Data #
    #############

    @staticmethod
    def decompress_meta(meta):
        try:
            meta = meta.decode("ascii")
            return json.loads(zlib.decompress(base64.b64decode(meta)))
        except AttributeError:
            return json.loads(zlib.decompress(base64.b64decode(meta.encode("ascii"))).decode("ascii"))

    def update_metadata(self, meta):
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r+")
        orig_metaJson = self.get_meta_data()
        self.loom_connection.attrs["MetaData"] = json.dumps(meta)
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r")
        new_metaJson = self.get_meta_data()
        return orig_metaJson != new_metaJson

    def rename_annotation(self, clustering_id: int, cluster_id: int, new_annotation_name: str) -> bool:
        logger.info("Changing annotation name for {0}".format(self.get_abs_file_path()))

        metaJson = self.get_meta_data()

        for n, clustering in enumerate(metaJson["clusterings"]):
            if clustering["id"] == clustering_id:
                clustering_n = n
        for n, cluster in enumerate(metaJson["clusterings"][clustering_n]["clusters"]):
            if cluster["id"] == cluster_id:
                cluster_n = n

        metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["description"] = new_annotation_name
        self.update_metadata(metaJson)

        self.ss = ss.update(self, update="clusterings")

        if (
            self.get_meta_data()["clusterings"][clustering_n]["clusters"][cluster_n]["description"]
            == new_annotation_name
        ):
            logger.debug("Success")
            return True
        else:
            logger.debug("Failure")
            return False

    def confirm_orcid_uuid(self, orcid_id: str, orcid_scope_uuid: str) -> bool:
        self.dfh.read_ORCID_db()
        return self.dfh.confirm_orcid_uuid(orcid_id, orcid_scope_uuid)

    def add_collab_annotation(self, request, secret: str) -> Tuple[bool, str]:
        logger.info("Adding collaborative annotation for {0}".format(self.get_abs_file_path()))

        metaJson = self.get_meta_data()

        cell_type_annotation: Dict[str, Any] = {
            "data": {
                "curator_name": request.annoData.curator_name,
                "curator_id": request.annoData.curator_id,
                "timestamp": request.annoData.timestamp,
                "obo_id": request.annoData.obo_id,
                "ols_iri": request.annoData.ols_iri,
                "annotation_label": request.annoData.annotation_label,
                "markers": [request.annoData.markers]
                if type(request.annoData.markers) == str
                else list(request.annoData.markers),
                "publication": request.annoData.publication,
                "comment": request.annoData.comment,
            }
        }

        hash_data = json.dumps(cell_type_annotation["data"]) + secret
        data_hash = hashlib.sha256(hash_data.encode()).hexdigest()
        cell_type_annotation["validate_hash"] = data_hash

        hash_data = json.dumps(cell_type_annotation["data"]) + request.orcidInfo.orcidID + secret
        user_hash = hashlib.sha256(hash_data.encode()).hexdigest()

        cell_type_annotation["votes"] = {
            "votes_for": {
                "total": 1,
                "voters": [
                    {
                        "voter_name": request.orcidInfo.orcidName,
                        "voter_id": request.orcidInfo.orcidID,
                        "voter_hash": user_hash,
                    }
                ],
            },
            "votes_against": {"total": 0, "voters": []},
        }

        for n, clustering in enumerate(metaJson["clusterings"]):
            if clustering["id"] == request.clusteringID:
                clustering_n = n
        for n, cluster in enumerate(metaJson["clusterings"][clustering_n]["clusters"]):
            if cluster["id"] == request.clusterID:
                cluster_n = n

        if "cell_type_annotation" in metaJson["clusterings"][clustering_n]["clusters"][cluster_n].keys():
            current_annos = [
                f"{x['data']['annotation_label']}__{x['data']['obo_id']}".casefold()
                for x in metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"]
            ]
            if f"{request.annoData.annotation_label}__{request.annoData.obo_id}".casefold() in current_annos:
                return (False, "Annotation already exists with obo_id or label")
            metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"].append(
                cell_type_annotation
            )
        else:
            metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"] = [
                cell_type_annotation
            ]

        self.update_metadata(metaJson)

        self.ss = ss.update(self, update="cluster_annotations")

        if (
            cell_type_annotation
            in self.get_meta_data()["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"]
        ):
            logger.debug("Success")
            return (True, "")
        else:
            logger.debug("Failure")
            return (False, "Metadata was not correct after re-reading file")

    def annotation_vote(self, request, secret: str) -> Tuple[bool, str]:
        logger.info("Adding vote annotation for {0}".format(self.get_abs_file_path()))

        metaJson = self.get_meta_data()

        for n, clustering in enumerate(metaJson["clusterings"]):
            if clustering["id"] == request.clusteringID:
                clustering_n = n
        for n, cluster in enumerate(metaJson["clusterings"][clustering_n]["clusters"]):
            if cluster["id"] == request.clusterID:
                cluster_n = n

        request_data = {
            "curator_name": request.annoData.curator_name,
            "curator_id": request.annoData.curator_id,
            "timestamp": request.annoData.timestamp,
            "obo_id": request.annoData.obo_id,
            "ols_iri": request.annoData.ols_iri,
            "annotation_label": request.annoData.annotation_label,
            "markers": [request.annoData.markers]
            if type(request.annoData.markers) == str
            else list(request.annoData.markers),
            "publication": request.annoData.publication,
            "comment": request.annoData.comment,
        }

        for n, cell_type_annotation in enumerate(
            metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"]
        ):
            if cell_type_annotation["data"] == request_data:
                logger.debug("Changing votes")
                hash_data = json.dumps(cell_type_annotation["data"]) + request.orcidInfo.orcidID + secret
                user_hash = hashlib.sha256(hash_data.encode()).hexdigest()
                vote_data = {
                    "voter_name": request.orcidInfo.orcidName,
                    "voter_id": request.orcidInfo.orcidID,
                    "voter_hash": user_hash,
                }

                present = None
                vote_direction = f"votes_{request.direction}"
                for i in ["votes_for", "votes_against"]:
                    for idx, vote in enumerate(
                        metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"][n][
                            "votes"
                        ][i]["voters"]
                    ):
                        if request.orcidInfo.orcidID == vote["voter_id"]:
                            present = i
                            vote_idx = idx
                            break

                if present:
                    del metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"][n][
                        "votes"
                    ][present]["voters"][vote_idx]
                    metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"][n]["votes"][
                        present
                    ]["total"] -= 1
                if vote_direction != present:
                    metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"][n]["votes"][
                        vote_direction
                    ]["voters"].append(vote_data)
                    metaJson["clusterings"][clustering_n]["clusters"][cluster_n]["cell_type_annotation"][n]["votes"][
                        vote_direction
                    ]["total"] += 1
                check_data = metaJson
                break
        else:
            logger.error("Could not find cell type annotation to change vote")
            return (False, "Could not find cell type annotation to change vote")

        try:
            self.update_metadata(metaJson)
        except OSError as e:
            logger.error(e)
            return (False, "Couldn't write metadata!")

        if check_data == self.get_meta_data():
            logger.debug("Success")
            return (True, "")
        else:
            logger.debug("Failure")
            return (False, "Metadata was not correct after re-reading file")

    @staticmethod
    def create_clusters_meta(cluster_ids: RepeatedScalarFieldContainer) -> Tuple[List[Cluster], Dict[str, int]]:
        try:
            unannotated_ids = set((int(c) for c in cluster_ids))
            clusters_list = [str(c) for c in sorted(unannotated_ids)]
            annotated = False
        except ValueError:
            clusters_list = sorted(set((c for c in cluster_ids)))
            annotated = True

        clusters: List[Cluster] = []
        cluster_mapping = {}
        for cluster_id, cluster_name in enumerate(clusters_list):
            clusters.append(
                {"id": cluster_id, "description": cluster_name if annotated else f"Unannotated Cluster {cluster_name}"}
            )
            cluster_mapping[str(cluster_name)] = cluster_id

        return clusters, cluster_mapping

    @staticmethod
    def create_new_clustering_meta(
        metaJson: dict, request: s_pb2.AddNewClusteringRequest
    ) -> Tuple[Clustering, Dict[str, int]]:

        new_clustering_id = max([int(x["id"]) for x in metaJson["clusterings"]]) + 1
        new_clustering_name = f"{request.clusterInfo.clusteringName}"

        clusters, cluster_mapping = Loom.create_clusters_meta(request.clusterInfo.clusterIDs)

        cluster_meta: Clustering = {
            "id": new_clustering_id,
            "group": f"{request.orcidInfo.orcidID} ({request.orcidInfo.orcidName})",
            "name": new_clustering_name,
            "clusters": clusters,
            "clusterMarkerMetrics": [],
        }

        return cluster_meta, cluster_mapping

    def get_cells_overlap(
        self, cluster_info: s_pb2.NewClusterInfo, cluster_mapping: Dict[str, int]
    ) -> Tuple[List[int], List[int], Set[str]]:
        chosen_cells = []
        new_cluster_ids = []
        missing_cells = set()

        cellIDs = list(self.get_cell_ids())

        for cell, cluster in zip(cluster_info.cellIDs, cluster_info.clusterIDs):
            try:
                chosen_cells.append(cellIDs.index(cell))
                new_cluster_ids.append(cluster_mapping[cluster])
            except ValueError:
                missing_cells.add(cell)

        return chosen_cells, new_cluster_ids, missing_cells

    def add_user_clustering(self, request) -> Tuple[bool, str]:
        logger.info("Adding user clustering for {0}".format(self.get_abs_file_path()))

        metaJson = self.get_meta_data()

        new_clustering_meta, cluster_mapping = Loom.create_new_clustering_meta(metaJson, request)

        if new_clustering_meta["name"] in (x["name"] for x in metaJson["clusterings"]):
            logger.error(f"Clustering name {new_clustering_meta['name']} already exists in {self.abs_file_path}")
            return (False, "That clustering name already exists in this file. Please choose another name.")

        metaJson["clusterings"].append(new_clustering_meta)

        chosen_cells, new_cluster_ids, missing_cells = self.get_cells_overlap(request.clusterInfo, cluster_mapping)

        if len(chosen_cells) == 0:
            return (False, "No cells matched this dataset")

        clusterings = pd.DataFrame(self.loom_connection.ca.Clusterings)
        clusterings[str(new_clustering_meta["id"])] = -1
        clusterings.loc[chosen_cells, str(new_clustering_meta["id"])] = new_cluster_ids

        new_clusterings = Loom.dfToNamedMatrix(clusterings)

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r+")
        loom = self.loom_connection
        loom.ca.Clusterings = new_clusterings
        loom.attrs["MetaData"] = json.dumps(metaJson)
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r")

        self.ss = ss.update(self, update="clusterings")

        if new_clustering_meta["id"] in self.loom_connection.ca.Clusterings.dtype.names:
            logger.debug("Success")
            return (True, "Success")
        else:
            logger.debug("Failure")
            return (False, "Updated clusterings do not exist in file. Write error.")

    def get_cluster_overlaps(self, cell_idxs: List[int]) -> List[Dict[str, Union[int, float, str]]]:
        """Calculate clusters overlapped by provided cell indices

        Args:
            cell_idxs (list[int]): A list of cell indices within the loom file

        Returns:
            list[dict]: A list containing a dict with the overlaps information
        """

        metadata = self.get_meta_data()
        cluster_overlap_data = []
        if not self.has_md_clusterings():
            return []
        for clustering_meta in metadata["clusterings"]:
            clustering_name = clustering_meta["name"]
            clustering_id = clustering_meta["id"]
            clustering = self.get_clustering_by_id(clustering_id)
            counts: Counter = Counter(clustering[cell_idxs])
            all_counts: Counter = Counter(clustering)
            for cluster_id in counts:
                if cluster_id == -1:
                    continue
                cluster_name = self.get_meta_data_cluster_by_clustering_id_and_cluster_id(
                    clustering_id, cluster_id, ""
                )["description"]
                cluster_overlap_data.append(
                    {
                        "clustering_name": clustering_name,
                        "cluster_name": cluster_name,
                        "n_cells": counts[cluster_id],
                        "cells_in_cluster": (counts[cluster_id] / len(cell_idxs)) * 100,
                        "cluster_in_cells": (counts[cluster_id] / all_counts[cluster_id]) * 100,
                    }
                )
        return cluster_overlap_data

    def set_hierarchy(self, L1: str, L2: str, L3: str) -> bool:
        logger.info("Changing hierarchy name for {0}".format(self.get_abs_file_path()))

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r+")
        loom = self.loom_connection
        attrs = self.loom_connection.attrs

        attrs["SCopeTreeL1"] = L1
        attrs["SCopeTreeL2"] = L2
        attrs["SCopeTreeL3"] = L3

        loom.attrs = attrs
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r")
        loom = self.loom_connection
        newAttrs = self.loom_connection.attrs

        if newAttrs["SCopeTreeL1"] == L1 and newAttrs["SCopeTreeL2"] == L2 and newAttrs["SCopeTreeL3"] == L3:
            logger.debug("Success")
            return True
        else:
            logger.debug("Failure")
            return False

    def generate_meta_data(self) -> None:
        # Designed to generate metadata from linnarson loom files
        logger.info("Making metadata for {0}".format(self.get_abs_file_path()))
        metaJson = {}

        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r+")
        loom = self.loom_connection
        col_attrs = loom.ca.keys()

        # Embeddings
        # Find PCA / tSNE - Catch all 0's ERROR

        embeddings_id = 1
        embeddings_default = False
        if ("_tSNE1" in col_attrs and "_tSNE2" in col_attrs) or ("_X" in col_attrs and "_Y" in col_attrs):
            metaJson["embeddings"] = [{"id": -1, "name": "Default (_tSNE1/_tSNE2 or _X/_Y)"}]
            embeddings_default = True
        else:
            metaJson["embeddings"] = []

        Embeddings_X = pd.DataFrame()
        Embeddings_Y = pd.DataFrame()

        for col in col_attrs:
            cf_col = col.casefold()
            if len(loom.ca[col].shape) < 2:
                continue
            if cf_col in ["tsne", "umap", "pca"] and loom.ca[col].shape[1] >= 2:
                if not embeddings_default:
                    metaJson["embeddings"].append({"id": -1, "name": col})
                    loom.ca["Embedding"] = Loom.dfToNamedMatrix(pd.DataFrame(loom.ca[col][:, :2], columns=["_X", "_Y"]))
                    embeddings_default = True
                else:
                    metaJson["embeddings"].append({"id": embeddings_id, "name": col})
                    Embeddings_X[str(embeddings_id)] = loom.ca[col][:, 0]
                    Embeddings_Y[str(embeddings_id)] = loom.ca[col][:, 1]
                    embeddings_id += 1
        if Embeddings_X.shape != (0, 0):
            loom.ca["Embeddings_X"] = Loom.dfToNamedMatrix(Embeddings_X)
            loom.ca["Embeddings_Y"] = Loom.dfToNamedMatrix(Embeddings_Y)

        # Annotations - What goes here?
        metaJson["annotations"] = []
        for anno in ["Age", "ClusterName", "Sex", "Species", "Strain", "Tissue"]:
            if anno in loom.ca.keys():
                logger.info("\tAnnotation: {0} in loom".format(anno))
                if len(set(loom.ca[anno])) != loom.shape[1] and len(set(loom.ca[anno])) > 0:
                    metaJson["annotations"].append({"name": anno, "values": sorted(list(set(loom.ca[anno])))})
                    logger.debug(f"\t\tValues: {sorted(list(set(loom.ca[anno])))}")

        logger.debug(f'\tFinal Annotations for {self.file_path} - {metaJson["annotations"]}')

        # Clusterings - Anything with cluster in name?
        metaJson["clusterings"] = []
        if "Clusters" in loom.ca.keys() and "ClusterName" in loom.ca.keys():
            logger.debug(f"\tDetected clusterings in loom file. Adding metadata.")
            clusters_set = set(zip(loom.ca["Clusters"], loom.ca["ClusterName"]))
            clusters = [{"id": int(x[0]), "description": x[1]} for x in clusters_set]
            clusterDF = pd.DataFrame(columns=["0"], index=[x for x in range(loom.shape[1])])
            clusterDF["0"] = [int(x) for x in loom.ca["Clusters"]]
            loom.ca["Clusterings"] = Loom.dfToNamedMatrix(clusterDF)
            metaJson["clusterings"].append(
                {"id": 0, "group": "Interpreted", "name": "Clusters + ClusterName", "clusters": clusters}
            )
        logger.debug(f'\tFinal Clusterings for {self.file_path} - {metaJson["clusterings"]}')

        loom.attrs["MetaData"] = json.dumps(metaJson)
        self.loom_connection = self.lfh.change_loom_mode(self.file_path, mode="r")
        self.ss = ss.build(self)

    def get_file_metadata(self):
        """Summarize in a dict what feature data the loom file contains.

        Returns:
            dict: A dictionary defining whether the current implemented features in SCope are available for the loom file with the given loom_file_path.

        """
        loom = self.loom_connection
        # Global attribute: 0
        # Row attribute: 1
        # Column attributeL 2
        attr_margins = [2, 2, 2, 2, 0]
        # Order matters
        attr_names = [
            (
                "RegulonsAUC",
                "MotifRegulonsAUC",
                "TrackRegulonsAUC",
            ),
            ("Clusterings",),
            ("Embeddings_X",),
            ("GeneSets",),
            ("MetaData",),
        ]
        attr_keys = [("RegulonsAUC",), ("Clusterings",), ("ExtraEmbeddings",), ("GeneSets",), ("GlobalMeta",)]

        def loom_attr_exists(x):
            tmp = {}
            idx = attr_names.index(x)
            margin = attr_margins[idx]
            ha = False
            if margin == 0 and any(i in loom.attrs.keys() for i in x):
                ha = True
            elif margin == 1 and any(i in loom.ra.keys() for i in x):
                ha = True
            elif margin == 2 and any(i in loom.ca.keys() for i in x):
                ha = True
            tmp["has{0}".format(attr_keys[idx][0])] = ha
            return tmp

        md = map(loom_attr_exists, attr_names)
        meta = {k: v for d in md for k, v in d.items()}
        meta["species"], _ = self.infer_species()
        return meta

    def get_meta_data_annotation_by_name(self, name):
        md_annotations = self.get_meta_data_by_key(key="annotations")
        md_annotation = list(filter(lambda x: x["name"] == name, md_annotations))
        if len(md_annotation) > 1:
            raise ValueError("Multiple annotations matches the given name: {0}".format(name))
        return md_annotation[0]

    def get_meta_data_cluster_by_clustering_id_and_cluster_id(
        self, clustering_id: int, cluster_id: int, secret: str = None
    ):
        md_clustering = self.get_meta_data_clustering_by_id(clustering_id, secret=secret)
        md_cluster = list(filter(lambda x: x["id"] == cluster_id, md_clustering["clusters"]))
        if len(md_cluster) == 0:
            raise ValueError("The cluster with the given id {0} does not exist.".format(cluster_id))
        if len(md_cluster) > 1:
            raise ValueError("Multiple clusters matches the given id: {0}".format(cluster_id))
        return md_cluster[0]

    @lru_cache(maxsize=1024)
    def get_meta_data_clustering_by_id(self, id: int, secret: str = None):
        md_clusterings = self.get_meta_data_by_key(key="clusterings", secret=secret)
        md_clustering = list(filter(lambda x: x["id"] == id, md_clusterings))
        if len(md_clustering) > 1:
            raise ValueError("Multiple clusterings matches the given id: {0}".format(id))
        return md_clustering[0]

    @staticmethod
    def protoize_cell_type_annotation(md, secret: str):
        ctas = md["cell_type_annotation"]
        md["cell_type_annotation"] = []
        for cta in ctas:
            hash_data = json.dumps(cta["data"]) + secret
            data_hash = hashlib.sha256(hash_data.encode()).hexdigest()

            votes: Dict[str, Any] = {
                "votes_for": {"total": 0, "voters": []},
                "votes_against": {"total": 0, "voters": []},
            }

            for i in votes.keys():
                for v in cta["votes"][i]["voters"]:
                    hash_data = json.dumps(cta["data"]) + v["voter_id"] + secret
                    user_hash = hashlib.sha256(hash_data.encode()).hexdigest()
                    v["voter_hash"] = True if user_hash == v["voter_hash"] else False
                    votes[i]["voters"].append(s_pb2.CollabAnnoVoter(**v))
                    votes[i]["total"] += 1
                votes[i] = s_pb2.CollabAnnoVotes(**votes[i])

            cta_proto = s_pb2.CellTypeAnnotation(
                data=s_pb2.CollabAnnoData(**cta["data"]),
                validate_hash=True if data_hash == cta["validate_hash"] else False,
                votes_for=votes["votes_for"],
                votes_against=votes["votes_against"],
            )
            md["cell_type_annotation"].append(cta_proto)
        return md

    def get_meta_data_by_key(self, key, secret=None):
        meta_data = self.get_meta_data()
        if key in meta_data.keys():
            md = meta_data[key]
            if key == "embeddings":
                for e in md:  # Fix for malformed embeddings json (R problem)
                    e["id"] = int(e["id"])
            if key == "clusterings":
                for n, clustering in enumerate(md.copy()):
                    for m, cluster in enumerate(clustering["clusters"]):
                        if "cell_type_annotation" in cluster.keys():
                            md[n]["clusters"][m] = self.protoize_cell_type_annotation(cluster, secret=secret)
            return md
        return []

    @staticmethod
    def has_md_metrics_(meta_data) -> bool:
        return "metrics" in meta_data

    def has_md_metrics(self) -> bool:
        if self.has_meta_data():
            return self.has_md_metrics_(meta_data=self.get_meta_data())
        return False

    @staticmethod
    def has_md_annotations_(meta_data) -> bool:
        return "annotations" in meta_data

    def has_md_annotations(self) -> bool:
        if self.has_meta_data():
            return self.has_md_annotations_(meta_data=self.get_meta_data())
        return False

    @staticmethod
    def has_md_clusterings_(meta_data) -> bool:
        return "clusterings" in meta_data

    def has_md_clusterings(self) -> bool:
        if self.has_meta_data():
            return self.has_md_clusterings_(meta_data=self.get_meta_data())
        return False

    def has_meta_data(self) -> bool:
        return "MetaData" in self.loom_connection.attrs.keys()

    def get_meta_data(self):
        md = self.loom_connection.attrs.MetaData
        if type(md) is np.ndarray:
            md = self.loom_connection.attrs.MetaData[0]
        try:
            return json.loads(md)
        except json.decoder.JSONDecodeError:
            return Loom.decompress_meta(meta=md)

    def get_nb_cells(self) -> int:
        return self.loom_connection.shape[1]

    @lru_cache(maxsize=1)
    def get_genes(self) -> np.ndarray:
        return self.loom_connection.ra.Gene.astype(str)

    @lru_cache(maxsize=32)
    def infer_species(self) -> Tuple[str, Dict[str, str]]:
        genes = set(self.get_genes())
        maxPerc = 0.0
        maxSpecies = ""
        mappings = {"dmel": self.dfh.dmel_mappings}
        for species in mappings.keys():
            intersect = genes.intersection(mappings[species].keys())
            if (len(intersect) / len(genes)) > maxPerc:
                maxPerc = len(intersect) / len(genes)
                maxSpecies = species
        if maxPerc < 0.5:
            return "Unknown", {}
        return maxSpecies, mappings[maxSpecies]

    def get_anno_cells(self, annotations: List[Annotation], logic: str = "OR"):
        loom = self.loom_connection
        cell_indices = []
        for anno in annotations:
            anno_name = anno.name
            for annotation_value in anno.values:
                anno_set = set()
                if anno_name.startswith("Clustering_"):
                    clustering_id = str(anno_name.split("_")[1])
                    for x in np.where(loom.ca.Clusterings[clustering_id] == annotation_value)[0]:
                        anno_set.add(x)
                else:
                    for x in np.where(loom.ca[anno_name].astype(str) == str(annotation_value))[0]:
                        anno_set.add(x)
                cell_indices.append(anno_set)
        if logic not in ["AND", "OR"]:
            logic = "OR"
        if logic == "AND":
            return sorted(list(set.intersection(*cell_indices)))
        elif logic == "OR":
            return sorted(list(set.union(*cell_indices)))

    @lru_cache(maxsize=8)
    def get_gene_names(self) -> Dict[str, str]:
        genes = self.get_genes()
        conversion: Dict[str, str] = {}
        _, geneMappings = self.infer_species()

        if len(geneMappings) == 0:
            return conversion

        for gene in genes:
            gene = str(gene)
            try:
                if geneMappings[gene] != gene:
                    conversion[geneMappings[gene]] = gene
            except KeyError:
                logger.error("Gene: {0} is not in the mapping table!".format(gene))
        return conversion

    ##############
    # Expression #
    ##############

    def get_nUMI(self) -> np.ndarray:
        if self.nUMI is not None:
            return self.nUMI
        if self.has_ca_attr(name="nUMI"):
            return self.loom_connection.ca.nUMI
        if self.has_ca_attr(name="n_counts"):
            return self.loom_connection.ca.n_counts
        # Compute nUMI on the fly
        # TODO: Add case here for large files. Sum across 1mio rows takes a very long time to compute
        # Possibly faster fix totals = ds.map([np.sum], axis=1)[0]

        calc_nUMI_start_time = time.time()
        self.nUMI = self.loom_connection.map([np.sum], axis=1)[0]
        logger.debug("{0:.5f} seconds elapsed (calculating nUMI) ---".format(time.time() - calc_nUMI_start_time))
        return self.nUMI

    def get_gene_expression_by_gene_symbol(self, gene_symbol: str) -> np.ndarray:
        return self.loom_connection[self.get_genes() == gene_symbol, :][0]

    def get_gene_expression(
        self,
        gene_symbol: str,
        log_transform: bool = True,
        cpm_normalise: bool = False,
        annotation: Optional[List[Annotation]] = None,
        logic: str = "OR",
    ) -> Tuple[np.ndarray, list]:
        if gene_symbol not in set(self.get_genes()):
            try:
                gene_symbol = self.get_gene_names()[gene_symbol]
            except KeyError:
                # No gene is present, likely ATAC data, return 0's
                cell_indices = list(range(self.get_nb_cells()))
                gene_expr = np.zeros(self.get_nb_cells())
                return gene_expr, cell_indices

        logger.debug("Debug: getting expression of {0} ...".format(gene_symbol))
        gene_expr = self.get_gene_expression_by_gene_symbol(gene_symbol=gene_symbol)
        if cpm_normalise:
            logger.debug("Debug: CPM normalising gene expression...")
            gene_expr = (gene_expr / self.get_nUMI()) * constant.COUNTS_PER_MILLION
        if log_transform:
            logger.debug("Debug: log-transforming gene expression...")
            gene_expr = np.log2(gene_expr + 1)
        if annotation is not None:
            cell_indices = self.get_anno_cells(annotations=annotation, logic=logic)
            gene_expr = gene_expr[cell_indices]
        else:
            cell_indices = list(range(self.get_nb_cells()))
        return gene_expr, cell_indices

    ############
    # Regulons #
    ############

    def has_motif_and_track_regulons(self) -> bool:
        return self.has_motif_regulons() and self.has_track_regulons()

    def has_legacy_regulons(self) -> bool:
        return "Regulons" in self.loom_connection.ra.keys()

    def has_motif_regulons(self) -> bool:
        return "MotifRegulons" in self.loom_connection.ra.keys()

    def has_track_regulons(self) -> bool:
        return "TrackRegulons" in self.loom_connection.ra.keys()

    def get_regulon_genes(self, regulon: str) -> np.ndarray:
        try:
            if "MotifRegulons" in self.loom_connection.ra and "motif" in regulon.lower():
                return self.get_genes()[self.loom_connection.ra.MotifRegulons[regulon] == 1]
            elif "TrackRegulons" in self.loom_connection.ra and "track" in regulon.lower():
                return self.get_genes()[self.loom_connection.ra.TrackRegulons[regulon] == 1]
            else:
                return self.get_genes()[self.loom_connection.ra.Regulons[regulon] == 1]
        except Exception as err:
            logger.error(err)
            return []

    def has_regulons_AUC(self) -> bool:
        return self.has_legacy_regulons() or self.has_motif_regulons() or self.has_track_regulons()

    def get_regulons_AUC(self, regulon_type: str):
        loom = self.loom_connection
        if "MotifRegulonsAUC" in self.loom_connection.ca and regulon_type == "motif":
            regulon_names = loom.ca.MotifRegulonsAUC.dtype.names
            loom.ca.MotifRegulonsAUC.dtype.names = [regulon_name.replace(" ", "_") for regulon_name in regulon_names]
            return loom.ca.MotifRegulonsAUC
        if "TrackRegulonsAUC" in self.loom_connection.ca and regulon_type == "track":
            regulon_names = loom.ca.TrackRegulonsAUC.dtype.names
            loom.ca.TrackRegulonsAUC.dtype.names = [regulon_name.replace(" ", "_") for regulon_name in regulon_names]
            return loom.ca.TrackRegulonsAUC
        if "RegulonsAUC" in self.loom_connection.ca and regulon_type == "legacy":
            regulon_names = loom.ca.RegulonsAUC.dtype.names
            loom.ca.RegulonsAUC.dtype.names = [regulon_name.replace(" ", "_") for regulon_name in regulon_names]
            return loom.ca.RegulonsAUC
        raise IndexError(
            f"AUC values were requested but not found.\n\tLoom: {self.file_path}\n\tRegulon type requested: {regulon_type}\n\tColumn attributes present: {self.loom_connection.ca.keys()}"
        )

    def get_auc_values(
        self, regulon: str, annotation: Optional[List[Annotation]] = None, logic: str = "OR"
    ) -> Tuple[np.ndarray, list]:
        logger.debug("Getting AUC values for {0} ...".format(regulon))
        cellIndices = list(range(self.get_nb_cells()))
        # Get the regulon type
        if regulon in self.get_regulons_AUC(regulon_type="motif").dtype.names:
            regulon_type = "motif"
        elif regulon in self.get_regulons_AUC(regulon_type="track").dtype.names:
            regulon_type = "track"
        elif regulon in self.get_regulons_AUC(regulon_type="legacy").dtype.names:
            regulon_type = "legacy"
        else:
            return np.empty((0, 0)), cellIndices

        if regulon in self.get_regulons_AUC(regulon_type=regulon_type).dtype.names:
            vals = self.get_regulons_AUC(regulon_type=regulon_type)[regulon]
            if annotation is not None:
                cellIndices = self.get_anno_cells(annotations=annotation, logic=logic)
                vals = vals[cellIndices]
            return vals, cellIndices
        return np.empty((0, 0)), cellIndices

    def get_regulon_target_gene_metric(self, regulon: str, metric_accessor: str):
        regulon_type = ""
        if regulon in self.get_regulons_AUC(regulon_type="motif").dtype.names:
            regulon_type = "motif"
        elif regulon in self.get_regulons_AUC(regulon_type="track").dtype.names:
            regulon_type = "track"
        loom_attribute = self.loom_connection.row_attrs[f"{regulon_type.capitalize()}Regulon{metric_accessor}"]
        if str(regulon) in loom_attribute.dtype.names:
            regulon = str(regulon)
        else:
            regulon = str(regulon).replace("_", "")
        regulon_target_gene_metric = loom_attribute[regulon]
        # Return only the target genes for the given regulon
        return regulon_target_gene_metric[
            self.loom_connection.row_attrs[f"{regulon_type.capitalize()}Regulons"][regulon] == 1
        ]

    ##############
    # Embeddings #
    ##############

    def get_coordinates(
        self, coordinatesID: int = -1, annotation: Optional[List[Annotation]] = None, logic: str = "OR"
    ):
        loom = self.loom_connection
        if coordinatesID == -1:
            try:
                embedding = loom.ca["Embedding"]
                x = embedding["_X"]
                y = embedding["_Y"]
            except AttributeError:
                try:
                    x = loom.ca["_tSNE1"]
                    y = loom.ca["_tSNE2"]
                    if len(set(x)) == 1 or len(set(y)) == 1:
                        raise AttributeError
                except AttributeError:
                    try:
                        x = loom.ca["_X"]
                        y = loom.ca["_Y"]
                        if len(set(x)) == 1 or len(set(y)) == 1:
                            raise AttributeError
                    except AttributeError:
                        x = [n for n in range(len(loom.shape[1]))]
                        y = [n for n in range(len(loom.shape[1]))]
        else:
            x = loom.ca.Embeddings_X[str(coordinatesID)]
            y = loom.ca.Embeddings_Y[str(coordinatesID)]
        if annotation is not None:
            cellIndices = self.get_anno_cells(annotations=annotation, logic=logic)
            x = x[cellIndices]
            y = y[cellIndices]
        else:
            cellIndices = list(range(self.get_nb_cells()))
        return {"x": x, "y": -y, "cellIndices": cellIndices}

    ##############
    # Annotation #
    ##############

    def has_ca_attr(self, name: str) -> bool:
        return name in self.loom_connection.ca.keys()

    def get_ca_attr_by_name(self, name: str):
        if self.has_ca_attr(name=name):
            return self.loom_connection.ca[name]
        raise ValueError("The given annotation {0} does not exists in the .loom.".format(name))

    def has_region_gene_links(self) -> bool:
        return "linkedGene" in self.loom_connection.ra.keys()

    ##########
    # Metric #
    ##########

    def get_metric(
        self,
        metric_name: str,
        log_transform: bool = True,
        cpm_normalise: bool = False,
        annotation: Optional[List[Annotation]] = None,
        logic: str = "OR",
    ):
        if not self.has_ca_attr(name=metric_name):
            raise ValueError("The metric {0} does not exist in the current active loom".format(metric_name))
        logger.debug("getting metric {0}...".format(metric_name))
        metric_vals = self.get_ca_attr_by_name(name=metric_name)
        if cpm_normalise:
            logger.debug("CPM normalising gene expression...")
            metric_vals = metric_vals / self.get_nUMI()
        if log_transform:
            logger.debug("log-transforming gene expression...")
            metric_vals = np.log2(metric_vals + 1)
        if annotation is not None:
            cell_indices = self.get_anno_cells(annotations=annotation, logic=logic)
            metric_vals = metric_vals[cell_indices]
        else:
            cell_indices = list(range(self.get_nb_cells()))
        return metric_vals, cell_indices

    ###############
    # Clusterings #
    ###############

    def get_clustering_by_id(self, clustering_id: int):
        return self.loom_connection.ca.Clusterings[str(clustering_id)]

    # def get_cluster_IDs(self, loom_file_path, clustering_id):
    #     loom = self.lfh.get_loom_connection(loom_file_path)
    #     return loom.ca.Clusterings[str(clustering_id)]

    def has_cluster_markers(self, clustering_id: int):
        return "ClusterMarkers_{0}".format(clustering_id) in self.loom_connection.ra.keys()

    def get_cluster_marker_genes_mask(self, clustering_id: int, cluster_id: int):
        return self.loom_connection.ra["ClusterMarkers_{0}".format(clustering_id)][str(cluster_id)] == 1

    def get_cluster_marker_genes(self, clustering_id: int, cluster_id: int):
        try:
            return self.get_genes()[
                self.get_cluster_marker_genes_mask(clustering_id=clustering_id, cluster_id=cluster_id)
            ]
        except Exception as err:
            logger.error(err)
            return []

    def get_cluster_marker_metrics(self, clustering_id: int, cluster_id: int, metric_accessor: str):
        marker_mask = self.loom_connection.ra["ClusterMarkers_{0}".format(clustering_id)][str(cluster_id)] == 1
        cluster_marker_metric = self.loom_connection.row_attrs[
            "ClusterMarkers_{0}_{1}".format(clustering_id, metric_accessor)
        ][str(cluster_id)][marker_mask]
        cluster_marker_metric_df = pd.DataFrame(
            cluster_marker_metric, index=self.get_genes()[marker_mask], columns=[metric_accessor]
        )
        return cluster_marker_metric_df

    def get_cluster_marker_table(self, clustering_id: int, cluster_id: int, secret: str) -> pd.DataFrame:
        def create_cluster_marker_metric(metric):
            return self.get_cluster_marker_metrics(
                clustering_id=clustering_id, cluster_id=cluster_id, metric_accessor=metric["accessor"]
            )

        md_clustering = self.get_meta_data_clustering_by_id(id=clustering_id, secret=secret)
        md_cmm = md_clustering["clusterMarkerMetrics"]
        cluster_marker_table = functools.reduce(
            lambda left, right: pd.merge(left, right, left_index=True, right_index=True, how="outer"),
            [create_cluster_marker_metric(x) for x in md_cmm],
        )
        # Keep only non-zeros elements
        nonan_marker_mask = cluster_marker_table.apply(lambda x: functools.reduce(np.logical_and, ~np.isnan(x)), axis=1)
        return cluster_marker_table[nonan_marker_mask]
