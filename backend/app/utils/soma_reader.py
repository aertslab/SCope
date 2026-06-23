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

import json
import logging
import os
from typing import Any, Dict, List, Optional

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
        # Densify to the array's DECLARED shape, not the max stored index. A COO
        # table omits zeros, so a trailing all-zero column (or an all-zero last
        # cell) would otherwise shrink the array: that both misaligns cells
        # against the full-length feature columns AND makes the column count
        # disagree with the n_dims that load_metadata reports from .shape —
        # desyncing the embedding-dimension contract the 3D viewer relies on.
        try:
            shp = arr.shape
            nrows = int(shp[0])
            ncols = int(shp[1]) if len(shp) > 1 else 1
        except Exception:  # noqa: BLE001
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

    # Enrich each embedding with its dimensionality (a cheap obsm shape lookup —
    # shape is metadata, no bulk read) so the viewer can offer a 3D mode and
    # dimension pickers for embeddings that store >= 3 dimensions.
    try:
        exp = soma_cache.open_soma(path)
        obsm = _measurement(exp).obsm
        keys = list(obsm.keys())
        for e in meta["embeddings"]:
            if not isinstance(e, dict) or not e.get("name"):
                continue
            key = _resolve_obsm_key(keys, e["name"])
            n = 2
            if key is not None:
                try:
                    shp = obsm[key].shape
                    n = int(shp[1]) if len(shp) > 1 else 1
                except Exception:  # noqa: BLE001
                    n = 2
            e["n_dims"] = n
    except Exception:  # noqa: BLE001
        logger.exception("Failed to determine embedding dims for %s", path)

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


def read_embedding(path: str, name: str, dims: Optional[List[int]] = None) -> Optional[bytes]:
    """Read an embedding from obsm → interleaved float32 bytes.

    ``dims`` selects which stored dimensions (column indices) to return, in order
    — e.g. ``[0, 1, 2]`` for a 3D plot. Out-of-range indices are dropped; if none
    remain valid (or ``dims`` is ``None``) the first two dimensions are returned
    (the 2D default). The frontend learns each embedding's dimensionality from
    ``/metadata`` (``n_dims``) and only requests valid indices.
    """
    exp = soma_cache.open_soma(path)
    try:
        obsm = _measurement(exp).obsm
        keys = list(obsm.keys())
        key = _resolve_obsm_key(keys, name)
        if key is None:
            logger.warning("embedding %r not found in obsm keys %s (%s)", name, keys, path)
            return None
        data = np.asarray(_obsm_to_numpy(obsm[key]))  # (n_obs, dims)
        n_available = data.shape[1] if data.ndim > 1 else 1
        sel = [d for d in (dims or []) if 0 <= d < n_available]
        if not sel:
            sel = list(range(min(2, n_available)))
        out = np.ascontiguousarray(data[:, sel], dtype=np.float32)
        return out.tobytes()
    except Exception:  # noqa: BLE001
        logger.exception("Failed reading embedding %s from %s", name, path)
        return None


# Relevance ranking, mirroring SCope v1 (search.py:match_result_cost): lower is
# a better match. An exact hit beats a case-insensitive hit beats a prefix/suffix
# beats a substring, so e.g. searching "TH" surfaces the gene "TH" first instead
# of burying it in an alphabetical list of "TH..."-containing names.
_NO_MATCH = 1 << 30


def _match_cost(term: str, result: str) -> int:
    if term == result:
        return 0
    tl, rl = term.casefold(), result.casefold()
    if tl == rl:
        return 1
    if result.startswith(term) or result.endswith(term):
        return 2
    if rl.startswith(tl) or rl.endswith(tl):
        return 3
    if term in result:
        return 4
    if tl in rl:
        return 5
    return _NO_MATCH


# Genes/regulons/clusterings are the primary plotting targets, so on an equal
# match quality they rank above plain annotations/metrics/categories (a
# tiebreaker only — match quality is always the primary sort key, so exact
# matches win regardless of type).
_TYPE_COST = {"gene": 0, "regulon": 0, "clustering": 0, "annotation": 1, "metric": 1, "category": 1}

# Per-feature cap on category VALUES added to the search space. A categorical
# column with more distinct values than this (cell barcodes, sample IDs, …) is
# almost certainly an identifier, not a useful search target, so it contributes
# only its feature name — not every value. Keeps the space small.
MAX_CATEGORY_VALUES = 500

# Building the full search space enumerates category values, which means reading
# each categorical obs column — too slow to redo on every debounced keystroke.
# Cache it per path (in-memory) AND persist it to a JSON sidecar in the store so
# it survives restarts and only the very first build per dataset is slow. The
# worker also pre-builds it at conversion time so users normally never wait.
# Cleared (memory + sidecar) on reconvert via soma_cache.invalidate.
_SEARCH_SPACE_CACHE: Dict[str, List[dict]] = {}
SEARCH_SPACE_SIDECAR = "search_space.json"
_SS_VERSION = 1


def _load_search_space_sidecar(path: str) -> Optional[List[dict]]:
    p = os.path.join(path, SEARCH_SPACE_SIDECAR)
    if not os.path.exists(p):
        return None
    try:
        with open(p, "r", encoding="utf-8") as fh:
            blob = json.load(fh)
        if isinstance(blob, dict) and blob.get("version") == _SS_VERSION and isinstance(blob.get("elements"), list):
            return blob["elements"]
    except Exception:  # noqa: BLE001
        logger.exception("Failed reading search space sidecar for %s", path)
    return None


def _write_search_space_sidecar(path: str, elements: List[dict]) -> None:
    try:
        p = os.path.join(path, SEARCH_SPACE_SIDECAR)
        tmp = f"{p}.{os.getpid()}.tmp"  # write-then-rename so readers never see a partial file
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"version": _SS_VERSION, "elements": elements}, fh)
        os.replace(tmp, p)
    except Exception:  # noqa: BLE001
        logger.exception("Failed writing search space sidecar for %s", path)


def search_genes(path: str, query: str, limit: int) -> List[str]:
    """Ranked gene (+regulon) name search. Returns names ordered by relevance."""
    idx = soma_cache.load_gene_index(path) or {}
    regulons = soma_cache.load_regulon_index(path) or {}
    pool = list(idx.keys()) + list(regulons.keys())
    if not query:
        return pool[:limit]
    scored = []
    for g in pool:
        c = _match_cost(query, g)
        if c < _NO_MATCH:
            scored.append((c, g))
    scored.sort(key=lambda t: (t[0], t[1].casefold()))
    return [g for _, g in scored[:limit]]


def _search_category_labels(path: str, feature: str, cap: int) -> Optional[List[str]]:
    """Capped, stringified unique labels of a categorical/clustering feature, for
    the search space. Returns ``None`` when the column has more than ``cap``
    distinct values (an identifier-like column — skip indexing its values).

    Unlike ``list_categories`` (which serves the filter builder and returns ``[]``
    for numeric columns), this:
      * checks the distinct COUNT *before* the expensive stringify+sort, so a
        high-cardinality column doesn't pay to materialise/sort millions of
        strings only to be discarded by the cap; and
      * stringifies numeric values too, so a numeric-coded clustering (e.g. an
        integer ``leiden`` column from a non-loom ingest) is indexed with the
        same "7"-style labels ``read_feature`` returns and the legend displays.
    """
    import pandas as pd  # lazy

    exp = soma_cache.open_soma(path)
    name = feature[len("Clustering: "):] if feature.startswith("Clustering: ") else feature
    try:
        vals = _read_obs_column(exp, name)
    except Exception:  # noqa: BLE001
        return None
    s = pd.Series(vals).dropna()
    if s.empty:
        return []
    # .unique() is a single C-level hash pass and does NOT sort — so checking the
    # count here is cheap even for an ID column with millions of distinct values.
    uniques = s.unique()
    if len(uniques) > cap:
        return None
    return sorted({str(u) for u in uniques.tolist()})


def _build_search_space(path: str) -> List[dict]:
    """Enumerate every searchable element with a type tag.

    Pools genes, regulons, obs feature names (annotations, metrics, clusterings)
    AND the category VALUES of each categorical feature — so searching e.g.
    "male" surfaces the "Sex" feature it belongs to. Enumerating category values
    reads each categorical column, so the result is cached (``get_search_space``).

    Each element carries:
      - ``name``: the routable identifier the frontend acts on (clusterings keep
        their ``"Clustering: "`` prefix so /feature resolves them; for a category
        value it is the value itself, e.g. "male");
      - ``type``: gene/regulon/clustering/annotation/metric/category;
      - ``match``: the string the query is scored against — the *bare* name with
        any display prefix stripped, so e.g. searching "leiden" exact-matches the
        clustering "Clustering: leiden" instead of being demoted to a substring;
      - ``feature`` (category elements only): the parent feature to colour by
        when the category is selected (e.g. "Sex", or "Clustering: leiden").

    Dedup is keyed on ``(name, type, feature)`` so a metric that happens to share
    a gene symbol — or the same value across two features — still surfaces under
    each rather than being silently shadowed.
    """
    elements: List[dict] = []
    seen = set()

    def add(name: str, etype: str, match: Optional[str] = None, feature: Optional[str] = None) -> None:
        key = (name, etype, feature)
        if name and key not in seen:
            seen.add(key)
            el = {"name": name, "type": etype, "match": match or name}
            if feature is not None:
                el["feature"] = feature
            elements.append(el)

    for g in (soma_cache.load_gene_index(path) or {}):
        add(g, "gene")
    for r in (soma_cache.load_regulon_index(path) or {}):
        add(r, "regulon")
    for f in list_features(path):
        name = f["name"]
        is_categorical = False
        if name.startswith("Clustering: "):
            add(name, "clustering", match=name[len("Clustering: "):])
            is_categorical = True
        elif f["type"] == "categorical":
            add(name, "annotation")
            is_categorical = True
        else:
            add(name, "metric")
        # Index this feature's category values too (capped — high-cardinality
        # identifier columns return None and are skipped). Uses a search-specific
        # helper so numeric-coded clusterings are still indexed and the cap is
        # applied before any costly stringify+sort.
        if is_categorical:
            cats = _search_category_labels(path, name, MAX_CATEGORY_VALUES)
            if cats:
                for c in cats:
                    add(c, "category", feature=name)
    return elements


def get_search_space(path: str) -> List[dict]:
    """Return the search space: in-memory cache → on-disk sidecar → build+persist."""
    ss = _SEARCH_SPACE_CACHE.get(path)
    if ss is not None:
        return ss
    ss = _load_search_space_sidecar(path)
    if ss is None:
        ss = _build_search_space(path)
        _write_search_space_sidecar(path, ss)
        logger.info("Built + persisted search space for %s: %d elements", path, len(ss))
    _SEARCH_SPACE_CACHE[path] = ss
    return ss


def clear_search_space_cache(path: str) -> None:
    _SEARCH_SPACE_CACHE.pop(path, None)
    # Drop the persisted sidecar too so a reconvert rebuilds from fresh data.
    try:
        p = os.path.join(path, SEARCH_SPACE_SIDECAR)
        if os.path.exists(p):
            os.remove(p)
    except Exception:  # noqa: BLE001
        pass


def search(path: str, query: str, limit: int = 50) -> List[dict]:
    """Generalised, relevance-ordered search across all plottable element types.

    Returns ``[{"name", "type", "feature"?}]`` ordered so the best matches (exact
    first) come first regardless of type. ``feature`` is present only for
    ``category`` results (the parent feature to colour by). Empty query ⇒ ``[]``
    (use ``list_features`` to browse).
    """
    if not query:
        return []
    scored = []
    for el in get_search_space(path):
        c = _match_cost(query, el["match"])
        if c < _NO_MATCH:
            scored.append((c, _TYPE_COST.get(el["type"], 1), el))
    scored.sort(key=lambda t: (t[0], t[1], t[2]["match"].casefold()))
    out = []
    for _, _, el in scored[:limit]:
        r = {"name": el["name"], "type": el["type"]}
        if "feature" in el:
            r["feature"] = el["feature"]
        out.append(r)
    return out


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
