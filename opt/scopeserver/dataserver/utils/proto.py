"""
Functions for converting various objects to proto formatted objects
"""

import json
import hashlib

from typing import Dict, Any
from pandas import DataFrame

from scopeserver.dataserver.modules.gserver import s_pb2


def protoize_cell_type_annotation(clusterings_metadata, secret: str):
    """
    Confirm hashes of, and convert cell type annotations in the provided clusterings metadata
    dictionary into protobuf objects.
    """
    for n, clustering in enumerate(clusterings_metadata.copy()):
        for m, cluster in enumerate(clustering["clusters"]):
            if "cell_type_annotation" in cluster:
                proto_cell_type_annotations = []
                ctas = cluster["cell_type_annotation"]
                for cta in ctas:
                    hash_data = json.dumps(cta["data"]) + secret
                    data_hash = hashlib.sha256(hash_data.encode()).hexdigest()

                    votes: Dict[str, Any] = {
                        "votes_for": {"total": 0, "voters": []},
                        "votes_against": {"total": 0, "voters": []},
                    }

                    for i in votes:
                        for v in cta["votes"][i]["voters"]:
                            hash_data = json.dumps(cta["data"]) + v["voter_id"] + secret
                            user_hash = hashlib.sha256(hash_data.encode()).hexdigest()
                            v["voter_hash"] = user_hash == v["voter_hash"]
                            votes[i]["voters"].append(s_pb2.CollabAnnoVoter(**v))
                            votes[i]["total"] += 1
                        votes[i] = s_pb2.CollabAnnoVotes(**votes[i])

                    cta_proto = s_pb2.CellTypeAnnotation(
                        data=s_pb2.CollabAnnoData(**cta["data"]),
                        validate_hash=data_hash == cta["validate_hash"],
                        votes_for=votes["votes_for"],
                        votes_against=votes["votes_against"],
                    )
                    proto_cell_type_annotations.append(cta_proto)
                clusterings_metadata[n]["clusters"][m]["cell_type_annotation"] = proto_cell_type_annotations
    return clusterings_metadata


def protoize_cluster_marker_metric(metric: Dict, cluster_marker_metrics: DataFrame):
    """
    Convert provided cluster marker metric into protobuf objects.
    """
    return s_pb2.MarkerGenesMetric(
        accessor=metric["accessor"],
        name=metric["name"],
        description=metric["description"],
        values=cluster_marker_metrics[metric["accessor"]],
    )
