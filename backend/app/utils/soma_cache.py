"""Per-dataset TileDB-SOMA access helpers — the SOMA analogue of zarr_cache.py.

Caches the open ``Experiment`` handle and the cheap JSON sidecars
(gene_index / metadata / regulons) the converter writes. ``tiledbsoma`` is
imported lazily so importing this module never requires the native package.

SOMA Experiment handles hold open file descriptors / TileDB contexts, so unlike
the stateless zarr handles they are explicitly ``.close()``-d on eviction.
"""
from __future__ import annotations

import json
import os
from collections import OrderedDict
from threading import Lock
from typing import Any, Dict, Optional

MEASUREMENT_NAME = "RNA"

_HANDLE_MAX = 16
_handles: "OrderedDict[str, Any]" = OrderedDict()
_handles_lock = Lock()

_GENE_INDEX_CACHE: Dict[str, Optional[Dict[str, int]]] = {}
_METADATA_CACHE: Dict[str, Optional[dict]] = {}
_REGULON_CACHE: Dict[str, Optional[Dict[str, int]]] = {}


def open_soma(path: str):
    """Return a cached read-only Experiment handle, evicting LRU + closing it."""
    import tiledbsoma  # lazy

    with _handles_lock:
        handle = _handles.get(path)
        if handle is not None:
            _handles.move_to_end(path)
            return handle
        handle = tiledbsoma.Experiment.open(path, "r")
        _handles[path] = handle
        while len(_handles) > _HANDLE_MAX:
            _, evicted = _handles.popitem(last=False)
            try:
                evicted.close()
            except Exception:  # noqa: BLE001
                pass
        return handle


def _load_json_sidecar(path: str, name: str) -> Optional[dict]:
    sidecar = os.path.join(path, name)
    if not os.path.exists(sidecar):
        return None
    try:
        with open(sidecar, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return None


def load_gene_index(path: str) -> Optional[Dict[str, int]]:
    """Return the {gene_name: soma_joinid} map written at conversion time."""
    if path not in _GENE_INDEX_CACHE:
        _GENE_INDEX_CACHE[path] = _load_json_sidecar(path, "gene_index.json")  # type: ignore[assignment]
    return _GENE_INDEX_CACHE[path]


def load_metadata(path: str) -> Optional[dict]:
    """Return the SCope MetaData blob (embeddings/clusterings) sidecar."""
    if path not in _METADATA_CACHE:
        _METADATA_CACHE[path] = _load_json_sidecar(path, "metadata.json")
    return _METADATA_CACHE[path]


def load_regulon_index(path: str) -> Optional[Dict[str, int]]:
    """Return the {regulon_name: column_index} map (obsm RegulonsAUC)."""
    if path not in _REGULON_CACHE:
        _REGULON_CACHE[path] = _load_json_sidecar(path, "regulons.json")  # type: ignore[assignment]
    return _REGULON_CACHE[path]


def find_gene_index(path: str, gene: str) -> int:
    idx = load_gene_index(path)
    if idx is None:
        return -1
    return idx.get(gene, -1)


def invalidate(path: str) -> None:
    """Drop cached handles + sidecars for a path (on reconvert/delete)."""
    with _handles_lock:
        handle = _handles.pop(path, None)
        if handle is not None:
            try:
                handle.close()
            except Exception:  # noqa: BLE001
                pass
    _GENE_INDEX_CACHE.pop(path, None)
    _METADATA_CACHE.pop(path, None)
    _REGULON_CACHE.pop(path, None)
    # Notify the expression-bytes cache in the datasets endpoint.
    try:
        from app.api.v1.endpoints import datasets as _datasets

        _datasets._invalidate_expression_cache(path)
    except Exception:  # noqa: BLE001
        pass
