"""Loom / AnnData / CSV → TileDB-SOMA converter.

TileDB-SOMA (the CZI CELLxGENE Census format) stores the expression matrix as a
sparse ``SparseNDArray`` and supports efficient random access along BOTH axes,
which is what lets SCope scale to 10s of millions of cells / 100s of GB. Unlike
the legacy zarr converter, **sparse inputs are never densified** — that was the
fatal flaw at scale (a 10M × 30k dense float32 matrix is ~1.2 TB).

This module is intentionally import-light: ``tiledbsoma`` (a heavy native
package) is imported lazily inside the functions so the rest of the backend —
and the entire legacy zarr serving path — keeps working even where it isn't
installed.

Layout written:

    <output>.soma/                 # a SOMA Experiment
      ms/RNA/X/data               # sparse expression (obs × var)
      ms/RNA/var, obs             # gene / cell metadata
      ms/RNA/obsm/X_<emb>         # embeddings
      gene_index.json             # {gene_name: soma_joinid} sidecar (O(1) lookup)
      metadata.json               # SCope MetaData blob (embeddings/clusterings)
      regulons.json               # {regulon_name: column_index} for obsm regulon AUC

The two JSON sidecars mirror the zarr converter's approach: they make
name→index resolution and metadata reads cheap and avoid depending on SOMA's
``uns`` round-trip semantics.

NOTE: the SOMA serving/conversion path requires a verification pass against a
running ``tiledbsoma`` with real data before being enabled in production. It is
additive — existing zarr datasets are unaffected (see ``converted_format``).
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
from typing import Awaitable, Callable, Optional

import numpy as np

logger = logging.getLogger(__name__)

StatusCB = Callable[[str, Optional[str]], Awaitable[None]]

MEASUREMENT_NAME = "RNA"


async def _emit(cb: Optional[StatusCB], label: str) -> None:
    if cb is not None:
        await cb(f"processing ({label})", None)


def _parse_metadata_blob(md) -> dict:
    """Parse a SCope ``uns['MetaData']`` blob into a dict.

    Handles the several shapes it shows up as: a JSON str/bytes, a 1-element
    numpy array wrapping the string (common in h5ad/loom exports), and the
    legacy base64+zlib-compressed encoding.
    """
    import base64
    import zlib

    if md is None:
        return {}
    # AnnData/loom often store the blob as a 0-d or 1-element ndarray.
    if isinstance(md, np.ndarray):
        if md.size == 0:
            return {}
        md = md.reshape(-1)[0]
    if isinstance(md, bytes):
        try:
            md = md.decode("utf-8")
        except Exception:  # noqa: BLE001
            return {}
    if not isinstance(md, str):
        md = str(md)
    try:
        return json.loads(md)
    except Exception:  # noqa: BLE001
        try:
            return json.loads(zlib.decompress(base64.b64decode(md.encode("ascii"))))
        except Exception:  # noqa: BLE001
            logger.warning("Could not parse MetaData blob (len=%s)", len(md) if md else 0)
            return {}


def _write_sidecars(soma_uri: str, var_names, meta_json: Optional[dict], regulons: Optional[dict]) -> None:
    """Persist gene/metadata/regulon sidecars inside the SOMA store directory.

    ``from_anndata``/``from_h5ad`` assign ``soma_joinid`` = row position in var
    order, so a gene's column coordinate in X equals its position in var_names.
    """
    if var_names is not None:
        names = [v.decode() if isinstance(v, bytes) else str(v) for v in list(var_names)]
        mapping = {name: i for i, name in enumerate(names)}
        with open(os.path.join(soma_uri, "gene_index.json"), "w", encoding="utf-8") as fh:
            json.dump(mapping, fh)
    with open(os.path.join(soma_uri, "metadata.json"), "w", encoding="utf-8") as fh:
        json.dump(meta_json or {}, fh)
    if regulons:
        with open(os.path.join(soma_uri, "regulons.json"), "w", encoding="utf-8") as fh:
            json.dump(regulons, fh)


def _prep_output(output_path: str) -> None:
    if os.path.exists(output_path):
        shutil.rmtree(output_path, ignore_errors=True)


def _ingest_anndata(adata, output_path: str) -> None:
    """Ingest an in-memory/backed AnnData into a SOMA Experiment (sparse X)."""
    import tiledbsoma.io  # lazy: heavy native dep

    tiledbsoma.io.from_anndata(
        output_path,
        adata,
        measurement_name=MEASUREMENT_NAME,
    )


# Values per obsm write block (~32 MB of float32).
_OBSM_BLOCK_VALUES = 8_000_000


def _write_obsm_columnwise(output_path: str, obsm: dict) -> None:
    """Write each obsm layer as a DenseNDArray tiled one column wide.

    ``from_anndata`` writes obsm as a cell-major SparseNDArray, so reading the
    2-3 columns the viewer plots scans the whole layer (seconds for a wide
    latent space). Column-major tiles make a column read touch only that
    column. Layers are written in column blocks, so an h5py Dataset can be
    passed and streamed from disk instead of loaded.
    """
    import pyarrow as pa
    import tiledbsoma

    with tiledbsoma.Experiment.open(output_path, mode="w") as exp:
        ms = exp.ms[MEASUREMENT_NAME]
        coll = ms["obsm"] if "obsm" in ms else ms.add_new_collection("obsm")
        for key, src in obsm.items():
            try:
                n, m = (int(s) for s in src.shape)
                dtype = np.dtype(src.dtype)
                cfg = {"tiledb": {"create": {
                    "cell_order": "col-major",
                    "tile_order": "col-major",
                    "dims": {"soma_dim_0": {"tile": max(1, min(n, 1 << 20))}, "soma_dim_1": {"tile": 1}},
                }}}
                with coll.add_new_dense_ndarray(
                    key, type=pa.from_numpy_dtype(dtype), shape=(n, m), platform_config=cfg
                ) as arr:
                    step = max(1, _OBSM_BLOCK_VALUES // max(n, 1))
                    for c0 in range(0, m, step):
                        c1 = min(c0 + step, m)
                        block = np.ascontiguousarray(src[:, c0:c1], dtype=dtype)
                        arr.write((slice(0, n - 1), slice(c0, c1 - 1)), pa.Tensor.from_numpy(block))
            except Exception:  # noqa: BLE001
                logger.warning("Skipping obsm layer %r", key)


async def convert_h5ad_to_soma(
    file_path: str,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Ingest an .h5ad into a SOMA Experiment OUT-OF-CORE.

    ``tiledbsoma.io.from_h5ad``/``from_anndata`` — and even ``read_h5ad(backed=
    'r')`` — pull the matrix (and, for backed mode, obs/obsm/OBSP) into RAM,
    which OOMs on large files (an 80 GB+ h5ad with ~10^9 nonzeros killed the
    worker before it logged a thing). Instead, never load X (or obsp):

      1. read only the small parts (obs/var/uns) with ``anndata.read_elem``;
      2. write the full SOMA structure via ``from_anndata`` on a *skeleton* whose
         X is EMPTY — reusing the normal ingest for obs/var/schema (so the
         store is exactly the layout the reader expects) and creating the X
         ``SparseNDArray`` at the full (n_obs, n_var) shape;
      3. stream the real X from disk into that array in row-blocks via
         ``anndata.sparse_dataset`` (lazy on-disk slicing) or h5py for a dense X.

    obsm is written separately, column-tiled (``_write_obsm_columnwise``).
    Peak memory ≈ obs + one block, not the whole matrix.
    """
    import anndata
    import h5py
    import tiledbsoma
    import tiledbsoma.io  # lazy
    from scipy import sparse

    try:  # anndata >= 0.11 canonical location; fall back for older installs
        from anndata.io import read_elem, sparse_dataset
    except Exception:  # noqa: BLE001
        from anndata.experimental import read_elem, sparse_dataset

    await _emit(status_callback, "reading h5ad header")
    _prep_output(output_path)

    with h5py.File(file_path, "r") as f:
        obs = read_elem(f["obs"])
        var = read_elem(f["var"])
        n_obs, n_var = int(obs.shape[0]), int(var.shape[0])
        var_names = np.asarray(var.index)

        uns = {}
        if "uns" in f:
            try:
                uns = read_elem(f["uns"]) or {}
            except Exception:  # noqa: BLE001
                uns = {}
        meta_json = _parse_metadata_blob(uns.get("MetaData") if isinstance(uns, dict) else None)

        # Embeddings only: obsm. We deliberately SKIP obsp (n×n neighbour graphs),
        # varm, raw and layers — they're unused by the viewer and `obsp` in
        # particular is what made the backed read blow up. Dense layers stay
        # on disk and are streamed by _write_obsm_columnwise.
        obsm = {}
        if "obsm" in f:
            for key in f["obsm"].keys():
                try:
                    node = f["obsm"][key]
                    val = node if isinstance(node, h5py.Dataset) else np.asarray(read_elem(node))
                    if val.ndim == 2 and val.shape[0] == n_obs:
                        obsm[key] = val
                    else:
                        logger.warning("Skipping obsm layer %r with shape %s", key, val.shape)
                except Exception:  # noqa: BLE001
                    logger.warning("Skipping obsm layer %r", key)

        # 1) Structure via empty-X skeleton.
        await _emit(status_callback, "writing structure")
        skeleton = anndata.AnnData(
            X=sparse.csr_matrix((n_obs, n_var), dtype=np.float32),
            obs=obs,
            var=var,
        )
        if isinstance(uns, dict):
            try:
                skeleton.uns = dict(uns)
            except Exception:  # noqa: BLE001
                logger.warning("Could not carry uns into the SOMA store; continuing")
        tiledbsoma.io.from_anndata(output_path, skeleton, measurement_name=MEASUREMENT_NAME)
        del skeleton, obs, var, uns
        await _emit(status_callback, "writing embeddings")
        _write_obsm_columnwise(output_path, obsm)
        del obsm

        # 2) Stream X from disk in row-blocks.
        with tiledbsoma.Experiment.open(output_path) as exp:
            x_uri = exp.ms[MEASUREMENT_NAME].X["data"].uri

        if n_obs and n_var:
            xnode = f["X"]
            await _emit(status_callback, "ingesting matrix")
            if isinstance(xnode, h5py.Group):
                # Sparse (csr/csc) — lazy on-disk row slicing.
                xds = sparse_dataset(xnode)
                nnz = int(f["X"]["data"].shape[0])
                avg = max(1, nnz // max(n_obs, 1))
                block_rows = max(1, min(n_obs, 8_000_000 // avg))  # ~8M nnz/block

                def _src(r0, r1, _xds=xds):
                    return _xds[r0:r1]
            else:
                # Dense — cap each block's footprint at ~256 MiB.
                block_rows = max(1, min(n_obs, (256 * 1024 * 1024) // (max(n_var, 1) * 4)))

                def _src(r0, r1, _x=xnode):
                    return np.asarray(_x[r0:r1])

            import pyarrow as pa
            with tiledbsoma.open(x_uri, mode="w") as x_arr:
                for r0 in range(0, n_obs, block_rows):
                    r1 = min(r0 + block_rows, n_obs)
                    coo = sparse.coo_matrix(_src(r0, r1))
                    if coo.nnz:
                        x_arr.write(
                            pa.table({
                                "soma_dim_0": pa.array(coo.row.astype(np.int64) + r0),
                                "soma_dim_1": pa.array(coo.col.astype(np.int64)),
                                "soma_data": pa.array(coo.data.astype(np.float32)),
                            })
                        )
                    del coo
                    await _emit(status_callback, f"ingesting matrix ({r1}/{n_obs} cells)")

    await _emit(status_callback, "finalizing")
    _write_sidecars(output_path, var_names, meta_json, None)


async def convert_csv_to_soma(
    file_path: str,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Convert a (small) CSV expression matrix into a SOMA Experiment."""
    import anndata
    from scipy import sparse

    await _emit(status_callback, "reading csv")
    _prep_output(output_path)
    adata = anndata.read_csv(file_path)
    # Keep memory bounded for downstream ingest; CSR is fine for SOMA.
    if not sparse.issparse(adata.X):
        adata.X = sparse.csr_matrix(adata.X)
    await _emit(status_callback, "ingesting matrix")
    _ingest_anndata(adata, output_path)
    await _emit(status_callback, "finalizing")
    _write_sidecars(output_path, np.asarray(adata.var_names), dict(adata.uns) if adata.uns else {}, None)


async def convert_loom_to_soma(
    file_path: str,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Convert a SCope-format loom into a SOMA Experiment.

    Reuses the loom metadata extractor (embeddings → obsm, clusterings → obs,
    SCope MetaData) and ingests the expression matrix sparsely. The matrix is
    materialized as CSR before ingest; extremely large looms should be
    pre-converted to .h5ad (which from_h5ad streams out-of-core).
    """
    import anndata
    import loompy  # type: ignore
    from scipy import sparse

    from app.utils.loom_converter import _extract_loom_metadata, sanitize_key

    await _emit(status_callback, "extracting metadata")
    _prep_output(output_path)

    with loompy.connect(file_path, mode="r", validate=False) as ds:
        obs, var, uns, obsm_data, varm_data, meta_json = _extract_loom_metadata(ds)

        # Loom is (genes, cells); transpose into (cells, genes) sparse CSR.
        await _emit(status_callback, "reading matrix")
        n_genes, n_cells = ds.shape
        # Build X sparsely in gene-blocks rather than densifying the whole
        # matrix: a 400k×30k float32 dense array is ~48 GB and OOMs. We cap each
        # dense temp at ~256 MiB and accumulate sparse CSC blocks, so peak
        # memory is roughly the final sparse size + one block. (For datasets in
        # the 10s-of-millions-of-cells range, prefer .h5ad input — from_h5ad
        # streams fully out-of-core.)
        target_bytes = 256 * 1024 * 1024
        block_genes = max(1, min(n_genes, target_bytes // (max(n_cells, 1) * 4)))
        blocks = []
        for g0 in range(0, n_genes, block_genes):
            g1 = min(g0 + block_genes, n_genes)
            dense = np.ascontiguousarray(ds[g0:g1, :]).astype(np.float32, copy=False)
            # (block_genes, n_cells) → (n_cells, block_genes), sparse.
            blocks.append(sparse.csc_matrix(dense.T))
            del dense
            await _emit(status_callback, f"reading matrix ({g1}/{n_genes} genes)")
        x = (
            sparse.hstack(blocks, format="csr")
            if blocks
            else sparse.csr_matrix((n_cells, 0), dtype=np.float32)
        )
        del blocks

        # Pull regulon AUC matrices out of obsm into a dense 2D array + name map,
        # since SOMA obsm arrays are positional (no structured-array names).
        regulons: dict[str, int] = {}
        regulon_block = None
        for key in list(obsm_data.keys()):
            if key in ("RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"):
                df = obsm_data.pop(key)
                cols = list(df.columns)
                base = len(regulons)
                for i, c in enumerate(cols):
                    regulons[str(c)] = base + i
                block = df.to_numpy().astype(np.float32, copy=False)
                regulon_block = block if regulon_block is None else np.hstack([regulon_block, block])

        adata = anndata.AnnData(X=x, obs=obs, var=var, uns=uns)
        obsm = {k: np.asarray(v) for k, v in obsm_data.items()}
        if regulon_block is not None:
            obsm["RegulonsAUC"] = regulon_block

    await _emit(status_callback, "ingesting matrix")
    _ingest_anndata(adata, output_path)
    _write_obsm_columnwise(output_path, obsm)
    await _emit(status_callback, "finalizing")
    _write_sidecars(output_path, np.asarray(var.index), meta_json, regulons or None)


async def convert_to_soma(
    file_path: str,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Dispatch by extension to the appropriate SOMA converter."""
    lower = file_path.lower()
    if lower.endswith(".loom"):
        logger.info("Converting loom -> SOMA: %s", file_path)
        await convert_loom_to_soma(file_path, output_path, status_callback)
    elif lower.endswith(".h5ad"):
        logger.info("Converting h5ad -> SOMA: %s", file_path)
        await convert_h5ad_to_soma(file_path, output_path, status_callback)
    elif lower.endswith(".csv"):
        logger.info("Converting csv -> SOMA: %s", file_path)
        await convert_csv_to_soma(file_path, output_path, status_callback)
    else:
        raise ValueError(f"Unsupported file format for SOMA conversion: {file_path}")


# Export row blocks are sized to hold about this many values, so peak memory
# is one block regardless of dataset size.
_EXPORT_BLOCK_VALUES = 8_000_000


def _block_rows(n_rows: int, values_per_row: int) -> int:
    return max(1, min(max(n_rows, 1), _EXPORT_BLOCK_VALUES // max(1, values_per_row)))


def _read_coo_rows(arr, r0: int, r1: int):
    """(rows relative to r0, cols, data) of rows [r0, r1) of a SparseNDArray."""
    tbl = arr.read((slice(r0, r1 - 1),)).tables().concat()  # doubly inclusive
    return (
        tbl["soma_dim_0"].to_numpy() - r0,
        tbl["soma_dim_1"].to_numpy(),
        tbl["soma_data"].to_numpy(),
    )


def _soma_dtype(arr) -> np.dtype:
    return np.dtype(arr.schema.field("soma_data").type.to_pandas_dtype())


def _export_sparse(arr, group, key: str, n_rows: int, n_cols: int) -> None:
    """Stream a SparseNDArray into ``group[key]`` as CSR, one row block at a time."""
    from scipy import sparse

    try:  # anndata >= 0.11 canonical location; fall back for older installs
        from anndata.io import sparse_dataset, write_elem
    except Exception:  # noqa: BLE001
        from anndata.experimental import sparse_dataset, write_elem

    dtype = _soma_dtype(arr)
    step = _block_rows(n_rows, int(arr.nnz) // max(n_rows, 1))
    # Explicit chunks: h5py sizes them from the empty initial datasets (1-1024
    # values), and millions of tiny chunks make the appends slow and memory-hungry.
    write_elem(
        group, key, sparse.csr_matrix((0, n_cols), dtype=dtype),
        dataset_kwargs={"chunks": (1 << 20,)},
    )
    ds = sparse_dataset(group[key])
    for r0 in range(0, n_rows, step):
        r1 = min(r0 + step, n_rows)
        rows, cols, data = _read_coo_rows(arr, r0, r1)
        ds.append(sparse.csr_matrix((data, (rows, cols)), shape=(r1 - r0, n_cols), dtype=dtype))


def _export_dense(arr, group, key: str, n_rows: int, n_cols: int) -> None:
    """Stream an obsm/varm layer (dense or sparse in SOMA) into a dense
    ``group[key]``: sparse layers one row block at a time, dense layers (tiled
    one column wide, see ``_write_obsm_columnwise``) one column block at a time."""
    dtype = _soma_dtype(arr)
    is_sparse = "sparse" in str(arr.soma_type).lower()
    # Column blocks need chunks of the same width: writing them into a
    # contiguous (row-major) dataset is ~5x slower than the read.
    step = _block_rows(n_rows, n_cols) if is_sparse else _block_rows(n_cols, n_rows)
    chunks = None if is_sparse or not (n_rows and n_cols) else (min(n_rows, 1 << 16), step)
    ds = group.create_dataset(key, shape=(n_rows, n_cols), dtype=dtype, chunks=chunks)
    ds.attrs["encoding-type"] = "array"
    ds.attrs["encoding-version"] = "0.2.0"
    if is_sparse:
        for r0 in range(0, n_rows, step):
            r1 = min(r0 + step, n_rows)
            block = np.zeros((r1 - r0, n_cols), dtype=dtype)
            rows, cols, data = _read_coo_rows(arr, r0, r1)
            block[rows, cols] = data
            ds[r0:r1] = block
    else:
        for c0 in range(0, n_cols, step):
            c1 = min(c0 + step, n_cols)
            res = arr.read((slice(0, n_rows - 1), slice(c0, c1 - 1)), result_order="column-major")
            ds[:, c0:c1] = res.to_numpy().T  # column-major results are (cols, rows)


def export_soma_to_h5ad(soma_path: str, out_path: str) -> str:
    """Write a SOMA Experiment back to an .h5ad file (round-trip export).

    ``tiledbsoma.io.to_anndata`` holds X, every obsm and obsp in memory at
    once — several times the store's on-disk size. Instead, write obs/var/uns
    through anndata, then stream X, obsm/varm and obsp/varp into the file in
    row blocks, so peak memory is obs/var plus one block. The output matches
    ``to_anndata``: X from the "data" layer as CSR, dense obsm/varm, CSR
    obsp/varp.
    """
    import anndata
    import h5py

    from app.utils import soma_cache
    # Private tiledbsoma helpers, so obs/var indexes and uns are restored
    # exactly as ``to_anndata`` restores them.
    from tiledbsoma.io.outgest import _extract_uns, _read_dataframe, _resolve_futures

    exp = soma_cache.open_soma(soma_path)
    ms = exp.ms[MEASUREMENT_NAME]
    obs = _read_dataframe(exp.obs, None, "obs_id")
    var = _read_dataframe(ms.var, None, "var_id")
    uns = _resolve_futures(_extract_uns(ms["uns"]), deep=True) if "uns" in ms else {}
    n_obs, n_var = len(obs), len(var)
    anndata.AnnData(obs=obs, var=var, uns=uns).write_h5ad(out_path)
    del obs, var, uns

    with h5py.File(out_path, "r+") as f:
        if "data" in ms.X:
            _export_sparse(ms.X["data"], f, "X", n_obs, n_var)
        for coll, n_rows in (("obsm", n_obs), ("varm", n_var)):
            if coll in ms:
                for key, arr in ms[coll].items():
                    _export_dense(arr, f[coll], key, n_rows, int(arr.shape[1]))
        for coll, n in (("obsp", n_obs), ("varp", n_var)):
            if coll in ms:
                for key, arr in ms[coll].items():
                    _export_sparse(arr, f[coll], key, n, n)
    return out_path
