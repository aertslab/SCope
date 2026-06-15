"""Per-dataset Zarr access helpers with light caching.

The viewer hammers a small set of endpoints (``/expression/{gene}``,
``/feature/{feature}``, ``/embedding/{name}``) and each request currently
re-opens the Zarr store and re-reads ``var/_index`` to translate a gene name
to a column index.  For a 30k-gene dataset that's an extra ~30k-string read
plus an O(n) ``np.where`` scan on every keystroke of the gene-search bar.

We cache two cheap, immutable artefacts per dataset path:

* the open ``zarr.Group`` handle (no I/O cost to keep around — Zarr stores
  are stateless once opened);
* the ``gene_index.json`` sidecar produced by the converter, parsed once.

Eviction is by simple LRU on path; the caches are process-local, which is
fine because Celery workers don't share state with the API process anyway and
each Uvicorn worker has its own copy.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Dict, Optional

import numpy as np
import zarr


@lru_cache(maxsize=64)
def open_zarr(path: str) -> zarr.Group:
    """Cached read-only handle to a dataset's zarr store."""
    return zarr.open(path, mode="r")


@lru_cache(maxsize=64)
def load_gene_index(path: str) -> Optional[Dict[str, int]]:
    """Return the precomputed gene→column-index map, or ``None`` if absent.

    Older datasets (converted before the sharded layout) won't have this
    sidecar; callers must fall back to scanning ``var/_index``.
    """
    sidecar = os.path.join(path, "gene_index.json")
    if not os.path.exists(sidecar):
        return None
    with open(sidecar, "r", encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=64)
def load_metadata(path: str) -> Optional[dict]:
    """Return the parsed ``uns/MetaData`` JSON blob, or ``None`` if absent.

    The blob is small (a few KB even on big datasets) but historically was
    re-decoded and re-parsed on every ``/feature`` and ``/features`` request.
    """
    z = open_zarr(path)
    uns = z.get("uns") if hasattr(z, "get") else None
    if not isinstance(uns, zarr.Group) or "MetaData" not in uns:
        return None
    try:
        md = uns["MetaData"][()]
    except Exception:
        return None
    if isinstance(md, bytes):
        md = md.decode("utf-8")
    if not isinstance(md, str):
        md = str(md)
    try:
        return json.loads(md)
    except json.JSONDecodeError:
        return None


def find_gene_index(path: str, gene: str) -> int:
    """Resolve ``gene`` → column index, preferring the sidecar.

    Returns ``-1`` if the gene isn't in the dataset.
    """
    cached = load_gene_index(path)
    if cached is not None:
        return cached.get(gene, -1)

    # Fallback for legacy stores: read var/_index and scan.
    z = open_zarr(path)
    var = z.get("var")
    if var is None or "_index" not in var:
        return -1
    arr = var["_index"][:]
    if arr.dtype.kind == "S":
        arr = arr.astype(str)
    matches = np.where(arr == gene)[0]
    return int(matches[0]) if len(matches) else -1


def invalidate(path: str) -> None:
    """Drop cached handles for a path (call on dataset deletion/reconvert)."""
    open_zarr.cache_clear()
    load_gene_index.cache_clear()
    load_metadata.cache_clear()
    # Notify the expression-bytes cache living in the datasets endpoint, if
    # it has been imported. The local import avoids a circular dependency
    # (datasets.py already imports from this module).
    try:
        from app.api.v1.endpoints import datasets as _datasets

        _datasets._invalidate_expression_cache(path)
    except Exception:
        pass
