"""
Functions for converting various objects to proto formatted objects
"""

import json
import hashlib

from typing import Dict, Any

from scopeserver.dataserver.modules.gserver import s_pb2

def protoize_cell_type_annotation(md, secret: str):
        for n, clustering in enumerate(md.copy()):
            for m, cluster in enumerate(clustering["clusters"]):
                if "cell_type_annotation" in cluster.keys():
                    proto_cell_type_annotations = []
                    ctas = cluster["cell_type_annotation"]
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
                        proto_cell_type_annotations.append(cta_proto)
                    md[n]["clusters"][m]["cell_type_annotation"] = proto_cell_type_annotations
        return md

def protoize_cluster_marker_metric(metric, cluster_marker_metrics):
    return s_pb2.MarkerGenesMetric(
        accessor=metric["accessor"],
        name=metric["name"],
        description=metric["description"],
        values=cluster_marker_metrics[metric["accessor"]],
    )