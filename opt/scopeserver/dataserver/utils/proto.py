"""
Functions for converting various objects to proto formatted objects
"""

import json
import hashlib

from typing import Dict, Any
from pandas import DataFrame

from scopeserver.dataserver.modules.gserver import s_pb2


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
