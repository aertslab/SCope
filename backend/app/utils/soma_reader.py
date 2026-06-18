"""Read helpers that serve a TileDB-SOMA dataset with the SAME response bytes
as the legacy zarr endpoints, so the frontend needs no changes.

Every function returns either raw little-endian float32 bytes (expression /
embeddings / continuous features) or a plain JSON-able value (categorical
features / clusterings), matching ``datasets.py``'s existing contracts.

``tiledbsoma`` is imported lazily. These functions run inside a threadpool
(``run_in_threadpool``) from the async endpoints.

VERIFICATION PENDING: exercise against a real tiledbsoma store + the round-trip
test before enabling the SOMA path in production. The dual-read dispatch keeps
all existing (zarr) datasets fully unaffected until then.
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional

import numpy as np

from app.utils import soma_cache

logger = logging.getLogger(__name__)

MEASUREMENT_NAME = "RNA"

# obsm layers that are NOT embeddings (so they don't show up as plottable
# embeddings in the viewer).
_REGULON_OBSM_KEYS = {"RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"}


def _n_obs(exp) -> int:
    """Number of cells, from the obs dataframe domain."""
    try:
        return int(exp.obs.count)
    except Exception:  # noqa: BLE001
        tbl = exp.obs.read(column_names=["soma_joinid"]).concat()
        return int(len(tbl))


def _measurement(exp):
    return exp.ms[MEASUREMENT_NAME]


def _sanitize(name: str) -> str:
    """Path-safe embedding name. The converter sanitizes obsm keys the same way
    (slashes break both the URL path and the SOMA key), so this keeps display
    names, obsm keys, and request paths in sync."""
    return name.replace("/", "_") if isinstance(name, str) else name


def _obsm_keys(exp) -> List[str]:
    """List the measurement obsm layer names (embeddings live here)."""
    try:
        obsm = _measurement(exp).obsm
        return list(obsm.keys())
    except Exception:  # noqa: BLE001
        return []


def _obsm_to_numpy(arr) -> np.ndarray:
    """Read an obsm layer into a 2-D ndarray, handling dense OR sparse storage
    and the differing read APIs (DenseNDArray.read() → Arrow Tensor;
    SparseNDArray.read().tables() → COO)."""
    soma_type = str(getattr(arr, "soma_type", "")).lower()
    if "sparse" in soma_type:
        tbl = arr.read().tables().concat()
        rows = tbl["soma_dim_0"].to_numpy()
        cols = tbl["soma_dim_1"].to_numpy()
        vals = np.asarray(tbl["soma_data"].to_numpy(), dtype=np.float32)
        nrows = int(rows.max()) + 1 if rows.size else 0
        ncols = int(cols.max()) + 1 if cols.size else 0
        out = np.zeros((nrows, ncols), dtype=np.float32)
        if rows.size:
            out[rows, cols] = vals
        return out
    # Dense: read() returns a pyarrow.Tensor (preferred), else an ndarray-ish.
    try:
        res = arr.read()
    except TypeError:
        # Some versions require explicit full coords for a dense read.
        res = arr.read((slice(None), slice(None)))
    if hasattr(res, "to_numpy"):
        return np.asarray(res.to_numpy())
    return np.asarray(res)


def load_metadata(path: str) -> dict:
    """SCope MetaData enriched with embeddings discovered from ``obsm``.

    A generic AnnData/h5ad has no SCope ``uns.MetaData`` blob, so the embeddings
    list (which the viewer needs to pick something to plot) would be empty.
    We synthesize an entry for every obsm ``X_<name>`` array and merge it with
    any SCope-provided embeddings, deduped by name. The embedding ``name`` is the
    obsm key without the ``X_`` prefix, which is exactly what ``read_embedding``
    re-prepends — so ``/embedding/<name>`` resolves back to ``obsm["X_<name>"]``.
    """
    meta = dict(soma_cache.load_metadata(path) or {})

    # Sidecar embeddings (from the SCope MetaData blob) are authoritative when
    # present. Normalize names to be path-safe ("/" → "_") so they survive the
    # URL and match the obsm keys (which were sanitized the same way).
    sidecar = [e for e in (meta.get("embeddings") or []) if isinstance(e, dict) and e.get("name")]
    obsm_keys: List[str] = []
    if sidecar:
        meta["embeddings"] = [{**e, "name": _sanitize(e["name"])} for e in sidecar]
    else:
        # No SCope MetaData (e.g. a generic h5ad): synthesize embeddings from
        # the obsm layers, treating every layer except regulon AUC matrices as a
        # plottable embedding (with or without the scanpy "X_" prefix).
        discovered: List[dict] = []
        try:
            exp = soma_cache.open_soma(path)
            obsm_keys = _obsm_keys(exp)
            seen: set = set()
            for key in obsm_keys:
                if key in _REGULON_OBSM_KEYS:
                    continue
                name = key[2:] if key.startswith("X_") else key
                if name in seen:
                    continue
                seen.add(name)
                discovered.append({"id": name, "name": name})
        except Exception:  # noqa: BLE001
            logger.exception("Failed to enumerate obsm embeddings for %s", path)
        meta["embeddings"] = discovered

    final = [e.get("name") for e in (meta.get("embeddings") or []) if isinstance(e, dict)]
    logger.info(
        "metadata for %s: sidecar=%s obsm_keys=%s -> embeddings=%s",
        path, bool(sidecar), obsm_keys, final,
    )
    return meta


def describe(path: str) -> dict:
    """Introspect a converted SOMA store + its sidecars for diagnostics."""
    meta = soma_cache.load_metadata(path) or {}
    gi = soma_cache.load_gene_index(path) or {}
    reg = soma_cache.load_regulon_index(path) or {}
    info: dict = {
        "path": path,
        "sidecar": {
            "metadata_keys": sorted(meta.keys()),
            "embeddings": [
                e.get("name") for e in (meta.get("embeddings") or []) if isinstance(e, dict)
            ],
            "clusterings": [
                c.get("name") for c in (meta.get("clusterings") or []) if isinstance(c, dict)
            ],
            "gene_index_size": len(gi),
            "regulons": len(reg),
        },
        "store": {},
    }
    store = info["store"]
    try:
        exp = soma_cache.open_soma(path)
    except Exception as e:  # noqa: BLE001
        store["open_error"] = repr(e)
        return info
    try:
        store["measurements"] = list(exp.ms.keys())
    except Exception as e:  # noqa: BLE001
        store["measurements_error"] = repr(e)
    store["obsm_keys"] = _obsm_keys(exp)
    try:
        store["obs_columns"] = [f.name for f in exp.obs.schema]
    except Exception as e:  # noqa: BLE001
        store["obs_columns_error"] = repr(e)
    try:
        store["n_obs"] = _n_obs(exp)
    except Exception as e:  # noqa: BLE001
        store["n_obs_error"] = repr(e)
    try:
        store["X_layers"] = list(_measurement(exp).X.keys())
    except Exception as e:  # noqa: BLE001
        store["X_error"] = repr(e)
    try:
        store["var_count"] = int(_measurement(exp).var.count)
    except Exception as e:  # noqa: BLE001
        store["var_error"] = repr(e)
    # The resolved embedding list the viewer will actually receive, and a live
    # read-test of each so we can see exactly which (if any) fail and why.
    embeddings = [
        e.get("name") for e in (load_metadata(path).get("embeddings") or []) if isinstance(e, dict)
    ]
    store["resolved_embeddings"] = embeddings
    reads = {}
    for name in embeddings:
        try:
            payload = read_embedding(path, name)
            reads[name] = {"ok": payload is not None, "bytes": len(payload) if payload else 0}
        except Exception as e:  # noqa: BLE001
            reads[name] = {"ok": False, "error": repr(e)}
    store["embedding_read_test"] = reads
    return info


def read_expression_column(path: str, joinid: int) -> bytes:
    """Read one gene column across all cells → dense float32 bytes (len n_obs)."""
    exp = soma_cache.open_soma(path)
    n = _n_obs(exp)
    x = _measurement(exp).X["data"]
    tbl = x.read((slice(None), int(joinid))).tables().concat()
    rows = tbl["soma_dim_0"].to_numpy()
    vals = tbl["soma_data"].to_numpy().astype(np.float32, copy=False)
    dense = np.zeros(n, dtype=np.float32)
    dense[rows] = vals
    return dense.tobytes()


def read_regulon(path: str, name: str) -> Optional[bytes]:
    """Read a regulon AUC column from obsm RegulonsAUC by name → float32 bytes."""
    regulons = soma_cache.load_regulon_index(path)
    if not regulons or name not in regulons:
        return None
    col = regulons[name]
    exp = soma_cache.open_soma(path)
    try:
        arr = _measurement(exp).obsm["RegulonsAUC"]
        data = _obsm_to_numpy(arr)  # (n_obs, n_regulons)
        return np.ascontiguousarray(data[:, col], dtype=np.float32).tobytes()
    except Exception:  # noqa: BLE001
        logger.exception("Failed reading regulon %s from %s", name, path)
        return None


def _resolve_obsm_key(keys: List[str], name: str) -> Optional[str]:
    """Map an embedding display name back to its obsm layer key.

    Handles prefixed (``X_umap``) and unprefixed (``umap``) storage, and the
    slash→underscore sanitization applied to keys at conversion time.
    """
    san = _sanitize(name)
    for cand in (f"X_{name}", name, f"X_{san}", san):
        if cand in keys:
            return cand
    for k in keys:
        if k.startswith("X_") and k[2:] in (name, san):
            return k
    return None


def read_embedding(path: str, name: str) -> Optional[bytes]:
    """Read an embedding from obsm → interleaved float32 X,Y bytes."""
    exp = soma_cache.open_soma(path)
    try:
        obsm = _measurement(exp).obsm
        keys = list(obsm.keys())
        key = _resolve_obsm_key(keys, name)
        if key is None:
            logger.warning("embedding %r not found in obsm keys %s (%s)", name, keys, path)
            return None
        data = _obsm_to_numpy(obsm[key])  # (n_obs, dims)
        data = np.ascontiguousarray(np.asarray(data)[:, :2], dtype=np.float32)
        return data.tobytes()
    except Exception:  # noqa: BLE001
        logger.exception("Failed reading embedding %s from %s", name, path)
        return None


def search_genes(path: str, query: str, limit: int) -> List[str]:
    idx = soma_cache.load_gene_index(path) or {}
    names = list(idx.keys())
    regulons = soma_cache.load_regulon_index(path) or {}
    pool = names + list(regulons.keys())
    if query:
        q = query.lower()
        matches = [g for g in pool if q in g.lower()]
    else:
        matches = pool
    return matches[:limit]


def list_features(path: str) -> List[dict]:
    """Enumerate obs columns (categorical/continuous) + clusterings from metadata."""
    exp = soma_cache.open_soma(path)
    features: List[dict] = []
    ignored = {"soma_joinid", "obs_id", "_index"}
    try:
        schema = exp.obs.schema  # pyarrow schema
        for field in schema:
            name = field.name
            if name in ignored or name.startswith("__"):
                continue
            import pyarrow as pa  # lazy

            is_cat = pa.types.is_dictionary(field.type) or pa.types.is_string(field.type) or pa.types.is_large_string(field.type)
            features.append({"name": name, "type": "categorical" if is_cat else "continuous"})
    except Exception:  # noqa: BLE001
        logger.exception("Failed listing obs features for %s", path)

    meta = soma_cache.load_metadata(path) or {}
    for c in meta.get("clusterings", []) or []:
        features.append({"name": f"Clustering: {c['name']}", "type": "categorical"})
    return features


def _read_obs_column(exp, name: str) -> np.ndarray:
    # Via pandas so dictionary-encoded (categorical) columns decode to their
    # label values rather than integer codes.
    tbl = exp.obs.read(column_names=[name]).concat()
    return tbl.column(name).to_pandas().to_numpy()


def read_feature(path: str, feature: str):
    """Return a feature's values, matching datasets.py /feature contracts.

    Float32 bytes for numeric/continuous columns; a JSON list for categorical /
    clustering columns.
    """
    from fastapi import HTTPException
    from fastapi.responses import Response

    exp = soma_cache.open_soma(path)

    def numeric_response(values: np.ndarray) -> Response:
        return Response(
            content=np.ascontiguousarray(values, dtype=np.float32).tobytes(),
            media_type="application/octet-stream",
        )

    # Library size: first matching numeric obs column.
    if feature == "__library_size__":
        for key in ("n_counts", "total_counts", "TotalUMI", "nCount_RNA", "n_genes", "nUMI"):
            try:
                vals = _read_obs_column(exp, key)
                return numeric_response(vals)
            except Exception:  # noqa: BLE001
                continue
        raise HTTPException(status_code=404, detail="Library size not found in dataset")

    if feature.startswith("Regulon: "):
        payload = read_regulon(path, feature.replace("Regulon: ", ""))
        if payload is None:
            raise HTTPException(status_code=404, detail="Regulon not found")
        return Response(content=payload, media_type="application/octet-stream")

    if feature.startswith("Clustering: "):
        name = feature.replace("Clustering: ", "")
        try:
            vals = _read_obs_column(exp, name)
            return [None if v is None else str(v) for v in vals.tolist()]
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=404, detail=f"Clustering not found: {e}")

    # Gene expression by name.
    gi = soma_cache.find_gene_index(path, feature)
    if gi != -1:
        return numeric_response(np.frombuffer(read_expression_column(path, gi), dtype=np.float32))

    # Plain obs column.
    try:
        vals = _read_obs_column(exp, feature)
    except Exception:
        raise HTTPException(status_code=404, detail="Feature not found")
    if np.issubdtype(vals.dtype, np.number):
        return numeric_response(vals)
    return [None if v is None else str(v) for v in vals.tolist()]


def list_categories(path: str, feature: str, limit: int = 2000) -> List[str]:
    """Unique category labels for a categorical obs column (or ``Clustering:``).

    A cheap autocomplete source for the viewer's filter builder: it returns the
    sorted, de-duplicated, non-null labels instead of the full per-cell column,
    so listing categories costs a column read + a hashed unique rather than
    shipping millions of strings. Numeric columns have no categories ⇒ ``[]``.
    """
    from fastapi import HTTPException
    import pandas as pd  # lazy

    exp = soma_cache.open_soma(path)
    name = feature[len("Clustering: "):] if feature.startswith("Clustering: ") else feature
    try:
        vals = _read_obs_column(exp, name)
    except Exception:
        raise HTTPException(status_code=404, detail="Feature not found")

    if np.issubdtype(vals.dtype, np.number):
        return []

    # pandas .unique() is a C-level hash pass — fast even at millions of rows.
    uniques = pd.Series(vals).dropna().unique()
    labels = sorted({str(u) for u in uniques.tolist()})
    return labels[:limit]
