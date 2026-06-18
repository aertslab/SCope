"""SCope-format loom metadata extraction.

The expression matrix itself is ingested into TileDB-SOMA by ``soma_converter``;
this module only pulls the *non-X* tables out of a SCope-format loom file —
cell/gene metadata, embeddings, clusterings, regulons, and the serialized SCope
``MetaData`` blob — and shapes them into the AnnData-style structures
(obs/var/uns/obsm/varm) that the SOMA ingester consumes.

(The legacy Zarr writer that used to live here has been removed: TileDB-SOMA is
now the sole storage format.)
"""
from __future__ import annotations

import base64
import json
import logging
import zlib
from typing import Tuple

import loompy  # type: ignore
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def sanitize_key(key: str) -> str:
    """Replace forward slashes with underscores (group-path separator)."""
    return key.replace("/", "_")


def _extract_loom_metadata(ds: loompy.LoomConnection) -> Tuple[
    pd.DataFrame, pd.DataFrame, dict, dict, dict, dict
]:
    """Read non-X tables out of a SCope-format loom file.

    Returned tuple: (obs, var, uns, obsm, varm, meta_json). ``uns`` carries a
    JSON-string-serialized MetaData blob; ``meta_json`` is the parsed dict.
    """
    # 1. obs / obsm
    obs_data: dict = {}
    obsm_data: dict = {}
    if "CellID" in ds.ca:
        obs_index = ds.ca["CellID"].astype(str)
    else:
        obs_index = np.arange(ds.shape[1]).astype(str)

    for key in ds.ca.keys():
        if key == "CellID":
            continue
        attr = ds.ca[key]
        if hasattr(attr, "dtype") and attr.dtype.names:
            obsm_data[sanitize_key(key)] = pd.DataFrame(attr, index=obs_index)
        elif len(attr.shape) == 1:
            obs_data[sanitize_key(key)] = attr

    obs = pd.DataFrame(obs_data, index=obs_index)

    # 2. var / varm
    var_data: dict = {}
    varm_data: dict = {}
    if "Gene" in ds.ra:
        var_index = ds.ra["Gene"].astype(str)
    else:
        var_index = np.arange(ds.shape[0]).astype(str)

    for key in ds.ra.keys():
        if key == "Gene":
            continue
        attr = ds.ra[key]
        if hasattr(attr, "dtype") and attr.dtype.names:
            varm_data[sanitize_key(key)] = pd.DataFrame(attr, index=var_index)
        elif len(attr.shape) == 1:
            var_data[sanitize_key(key)] = attr

    var = pd.DataFrame(var_data, index=var_index)

    # 3. uns / SCope MetaData
    meta_json: dict = {}
    if "MetaData" in ds.attrs:
        md = ds.attrs["MetaData"]
        if isinstance(md, np.ndarray):
            md = md[0]
        try:
            if isinstance(md, bytes):
                md = md.decode("utf-8")
            meta_json = json.loads(md)
        except json.JSONDecodeError:
            try:
                md_bytes = md.encode("ascii") if isinstance(md, str) else md
                meta_json = json.loads(zlib.decompress(base64.b64decode(md_bytes)))
            except Exception:  # noqa: BLE001
                logger.exception("Failed to decode MetaData attribute")

    uns = {"MetaData": json.dumps(meta_json)}

    # 4. SCope embeddings → obsm
    if "embeddings" in meta_json:
        for emb in meta_json["embeddings"]:
            eid = str(emb["id"])
            name = emb["name"]
            key = f"X_{sanitize_key(name)}"
            coords = None
            if eid == "-1":
                if "Embedding" in ds.ca:
                    emb_arr = ds.ca["Embedding"]
                    if "_X" in emb_arr.dtype.names and "_Y" in emb_arr.dtype.names:
                        coords = np.column_stack((emb_arr["_X"], emb_arr["_Y"]))
                elif "_tSNE1" in ds.ca and "_tSNE2" in ds.ca:
                    coords = np.column_stack((ds.ca["_tSNE1"], ds.ca["_tSNE2"]))
                elif "_X" in ds.ca and "_Y" in ds.ca:
                    coords = np.column_stack((ds.ca["_X"], ds.ca["_Y"]))
            else:
                if "Embeddings_X" in ds.ca and "Embeddings_Y" in ds.ca:
                    if eid in ds.ca["Embeddings_X"].dtype.names:
                        x = ds.ca["Embeddings_X"][eid]
                        y = ds.ca["Embeddings_Y"][eid]
                        coords = np.column_stack((x, y))
            if coords is not None:
                obsm_data[key] = coords.astype(np.float32, copy=False)

    # 5. SCope clusterings → obs columns
    if "clusterings" in meta_json:
        for cl in meta_json["clusterings"]:
            cid = str(cl["id"])
            name = cl["name"]
            if "Clusterings" in ds.ca and cid in ds.ca["Clusterings"].dtype.names:
                cluster_indices = ds.ca["Clusterings"][cid]
                cluster_map = {c["id"]: c["description"] for c in cl["clusters"]}
                labels = [cluster_map.get(i, str(i)) for i in cluster_indices]
                obs[sanitize_key(name)] = labels

    return obs, var, uns, obsm_data, varm_data, meta_json
