"""Loom / AnnData → Zarr converter optimized for gene-column random access.

Storage layout (Zarr v3 with sharding):

    <output>.zarr/
      X                  # shape=(n_cells, n_genes), float32, chunks=(n_cells, 1),
                         # shards=(n_cells, SHARD_GENES). One *chunk* per gene
                         # column → reading expression for one gene is exactly
                         # one decompress; the surrounding *shard* groups
                         # SHARD_GENES chunks into a single file so we don't
                         # explode the inode count on a 30k-gene dataset.
      var/_index         # gene names (string array)
      obs/_index         # cell barcodes
      obsm/X_<name>      # embeddings
      uns/MetaData       # serialized SCope metadata (string)
      gene_index.json    # cached {gene_name: column_index} map (O(1) lookups
                         # without scanning var/_index on every request)

Why this beats the previous layout:

The old converter used ``chunks=(10_000, ~26)`` (rectangular).  For a 100k-cell
dataset the X array has ⌈n_cells / 10000⌉ row-chunks.  Writing one
gene-block touched **every** row-chunk in the array, which forced Zarr to
read-decompress-merge-recompress each row-chunk on every gene-block write —
i.e. each row-chunk ended up rewritten ``n_genes / gene_block`` times.
Ingestion was O(n_cells * n_genes^2 / gene_block) instead of O(n_cells *
n_genes), with the constant factor multiplied by zstd compression on every
overlapping write.

With the new layout each chunk is written exactly once: read a gene-block from
the source, write it column-by-column.  The shard layer keeps the file count
sane.  Column reads at query time become a single chunk fetch, so
``/expression/{gene}`` is also faster.

Sparse fast path: if an h5ad input is already a sparse CSC matrix we copy
``data``/``indices``/``indptr`` directly into a zarr group.  No densification,
no recompression of zeros — typically 5-20× smaller than dense float32 and
correspondingly faster to write.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import zlib
from typing import Any, Awaitable, Callable, Optional, Tuple

import anndata  # type: ignore
import loompy  # type: ignore
import numpy as np
import pandas as pd
import zarr
from numcodecs import Blosc
from scipy import sparse  # type: ignore

logger = logging.getLogger(__name__)

StatusCB = Callable[[str, Optional[str]], Awaitable[None]]

# ---- Tunables --------------------------------------------------------------

# Target on-disk shard size (uncompressed). 64 MiB keeps shards small enough to
# read selectively but large enough that we don't end up with thousands of
# files.  Real on-disk size after zstd is typically 5-15 MiB for scRNA-seq.
TARGET_SHARD_BYTES = 64 * 1024 * 1024

# Maximum number of cells in a single chunk along the row axis.  We prefer
# chunks=(n_cells, 1) so a gene read is one decompress, but for very large
# datasets we cap row-chunk size so a single chunk fits comfortably in memory
# during decode (~256 KiB at f32).
MAX_CELLS_PER_CHUNK = 65_536

# How many genes to read+write per source-side iteration.  Larger blocks
# amortize source-side I/O overhead (loom HDF5 chunk reads, sparse slicing)
# at the cost of holding (n_cells * GENE_BLOCK * 4) bytes in memory.
GENE_BLOCK = 1024


# ---- Helpers --------------------------------------------------------------

def sanitize_key(key: str) -> str:
    """Replace forward slashes with underscores (Zarr group separator)."""
    return key.replace("/", "_")


def _percent_emitter(status_callback: Optional[StatusCB]) -> Callable[[int, str], Awaitable[None]]:
    """Return an async fn that throttles status updates to integer-percent boundaries.

    The DB update fired by ``status_callback`` is comparatively expensive
    (acquire connection, SELECT, UPDATE, COMMIT) so we don't want to issue it
    on every chunk write.  Throttling to once per integer percent keeps
    progress smooth without flooding Postgres.
    """
    last_seen = -1

    async def emit(percent: int, label: str) -> None:
        nonlocal last_seen
        if status_callback is None or percent <= last_seen:
            return
        last_seen = percent
        await status_callback(f"processing ({label}: {percent}%)", None)

    return emit


def _choose_chunk_shape(n_cells: int) -> Tuple[int, int]:
    """Per-gene chunking, capped to keep individual chunks reasonable."""
    return (min(n_cells, MAX_CELLS_PER_CHUNK), 1)


def _choose_shard_shape(n_cells: int, n_genes: int, itemsize: int) -> Tuple[int, int]:
    """Group ~TARGET_SHARD_BYTES worth of column chunks into a shard."""
    cells_per_chunk = min(n_cells, MAX_CELLS_PER_CHUNK)
    bytes_per_chunk = cells_per_chunk * itemsize
    genes_per_shard = max(1, TARGET_SHARD_BYTES // bytes_per_chunk)
    genes_per_shard = min(genes_per_shard, n_genes)
    # Shard along cells = full row extent so the shard is a contiguous stripe
    # of full-column chunks.
    return (cells_per_chunk, genes_per_shard)


def _create_x_array(
    root: zarr.Group, n_cells: int, n_genes: int, dtype: np.dtype
) -> zarr.Array:
    """Create the X array with sharded per-gene chunks.

    Falls back to non-sharded chunks if the installed zarr build doesn't
    support sharding — gives older deployments a chance to keep working.
    """
    chunks = _choose_chunk_shape(n_cells)
    shards = _choose_shard_shape(n_cells, n_genes, np.dtype(dtype).itemsize)
    compressor = Blosc(cname="zstd", clevel=3, shuffle=Blosc.BITSHUFFLE)

    # Remove any pre-existing X (e.g. an empty stub written by anndata's
    # write_zarr for a skeleton AnnData).  We're about to define X explicitly.
    try:
        del root["X"]
    except KeyError:
        pass

    try:
        return root.create_array(
            "X",
            shape=(n_cells, n_genes),
            chunks=chunks,
            shards=shards,
            dtype=dtype,
            compressors=[compressor],
        )
    except TypeError:
        # Older Zarr without sharding: fall back to a wider chunk so we still
        # avoid the rewrite-amplification problem (the chunk spans all cells).
        logger.warning(
            "zarr build lacks sharding support; falling back to non-sharded chunks"
        )
        chunk_genes = max(1, shards[1])
        return root.create_array(
            "X",
            shape=(n_cells, n_genes),
            chunks=(n_cells, chunk_genes),
            dtype=dtype,
            compressors=[compressor],
        )


def _write_gene_index(output_path: str, gene_names: np.ndarray) -> None:
    """Persist a gene→column-index map alongside the zarr store.

    The JSON file lives inside the store directory so it can be served
    without opening zarr metadata.  It's redundant with var/_index but lets
    the API skip the var-read + ``np.where`` scan on every gene query.
    """
    if gene_names.dtype.kind == "S":
        gene_names = gene_names.astype(str)
    mapping = {str(g): i for i, g in enumerate(gene_names.tolist())}
    sidecar = os.path.join(output_path, "gene_index.json")
    with open(sidecar, "w", encoding="utf-8") as fh:
        json.dump(mapping, fh)


# ---- Dense matrix writer --------------------------------------------------

async def _write_dense_matrix(
    x_array: zarr.Array,
    fetch_block: Callable[[int, int], np.ndarray],
    n_cells: int,
    n_genes: int,
    status_callback: Optional[StatusCB] = None,
    label: str = "converting matrix",
) -> None:
    """Stream a dense matrix into ``x_array`` block-by-block.

    ``fetch_block(start, end)`` must return a ``(n_cells, end-start)`` ndarray
    in cells × genes orientation (already transposed from any source-side
    layout).  We do the column write here so the source loader can pick its
    own natural read direction.
    """
    emit = _percent_emitter(status_callback)
    target_dtype = x_array.dtype

    for start in range(0, n_genes, GENE_BLOCK):
        end = min(start + GENE_BLOCK, n_genes)
        block = fetch_block(start, end)
        if block.dtype != target_dtype:
            block = block.astype(target_dtype, copy=False)
        # Write the (cells, gene_block) slab directly. With chunks=(n_cells, 1)
        # this writes (end-start) chunks, each in full and exactly once. With
        # sharding all those chunks land in the same shard file.
        x_array[:, start:end] = block
        await emit(int(end / n_genes * 100), label)


# ---- Sparse fast path -----------------------------------------------------

def _write_sparse_csc(root: zarr.Group, X: sparse.csc_matrix) -> None:
    """Persist a CSC sparse matrix in the AnnData-on-zarr layout.

    AnnData reads back groups that match this exact layout (encoding-type =
    csc_matrix), so subsequent h5ad export round-trips correctly.
    """
    try:
        del root["X"]
    except KeyError:
        pass

    g = root.create_group("X")
    g.attrs["encoding-type"] = "csc_matrix"
    g.attrs["encoding-version"] = "0.1.0"
    g.attrs["shape"] = list(X.shape)
    compressor = Blosc(cname="zstd", clevel=3, shuffle=Blosc.SHUFFLE)
    # Copy the three CSC arrays directly. No densification, no per-column
    # iteration — this is just a typed memcpy through compression.
    for name, arr in (("data", X.data), ("indices", X.indices), ("indptr", X.indptr)):
        g.create_array(
            name,
            shape=arr.shape,
            chunks=(min(arr.shape[0], 1 << 20),),
            dtype=arr.dtype,
            compressors=[compressor],
        )[:] = arr


# ---- Public entry points --------------------------------------------------

async def convert_anndata_to_zarr(
    adata: anndata.AnnData,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Convert an AnnData (possibly backed) to the zarr layout described above."""
    logger.info("Converting AnnData to Zarr at %s", output_path)
    if status_callback:
        await status_callback("processing (writing metadata)", None)

    if os.path.exists(output_path):
        shutil.rmtree(output_path)

    skeleton = anndata.AnnData(
        obs=adata.obs, var=adata.var, uns=adata.uns,
        obsm=adata.obsm, varm=adata.varm,
    )
    skeleton.write_zarr(output_path)

    root = zarr.open(output_path, mode="r+")

    n_cells, n_genes = adata.shape
    X = adata.X

    # CSC fast path: if the source already has CSC X we just persist it
    # verbatim. AnnData re-reads this group on subsequent h5ad export.
    if sparse.issparse(X) and isinstance(X, sparse.csc_matrix):
        if status_callback:
            await status_callback("processing (writing sparse matrix)", None)
        _write_sparse_csc(root, X)
    else:
        dtype = np.dtype("float32")
        x_array = _create_x_array(root, n_cells, n_genes, dtype)

        if sparse.issparse(X):
            X_csc = X.tocsc(copy=False)  # one-off conversion for column access

            def fetch(s: int, e: int) -> np.ndarray:
                return X_csc[:, s:e].toarray()
        elif hasattr(X, "shape") and hasattr(X, "__getitem__"):
            # Dense ndarray or h5py-backed dataset.
            def fetch(s: int, e: int) -> np.ndarray:
                return np.asarray(X[:, s:e])
        else:
            raise TypeError(f"Unsupported X type: {type(X)!r}")

        await _write_dense_matrix(x_array, fetch, n_cells, n_genes, status_callback)

    var_index = np.asarray(adata.var_names)
    _write_gene_index(output_path, var_index)

    zarr.consolidate_metadata(output_path)
    logger.info("Successfully converted AnnData to %s", output_path)


def _extract_loom_metadata(ds: loompy.LoomConnection) -> Tuple[
    pd.DataFrame, pd.DataFrame, dict, dict, dict, dict
]:
    """Read non-X tables out of a SCope-format loom file.

    Returned tuple: (obs, var, uns, obsm, varm, meta_json).  ``uns`` is a
    JSON-string-serialized blob (for backward compatibility with the old
    converter); ``meta_json`` is the parsed dict for downstream lookups.
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


async def convert_loom_to_zarr(
    file_path: str,
    output_path: str,
    status_callback: Optional[StatusCB] = None,
) -> None:
    """Convert a SCope-format loom file to the optimized zarr layout."""
    logger.info("Converting %s to Zarr (sharded layout)", file_path)
    if status_callback:
        await status_callback("processing (starting)", None)

    # If a partial output remains from a failed previous run, scrap it.
    # Without this, anndata's write_zarr will happily merge into the existing
    # store and we'll end up with stale arrays.
    if os.path.exists(output_path):
        shutil.rmtree(output_path)

    with loompy.connect(file_path, mode="r", validate=False) as ds:
        if status_callback:
            await status_callback("processing (extracting metadata)", None)

        obs, var, uns, obsm_data, varm_data, _ = _extract_loom_metadata(ds)

        if status_callback:
            await status_callback("processing (initializing zarr store)", None)

        skeleton = anndata.AnnData(obs=obs, var=var, uns=uns)
        for k, v in obsm_data.items():
            skeleton.obsm[k] = v
        for k, v in varm_data.items():
            skeleton.varm[k] = v
        skeleton.write_zarr(output_path)

        root = zarr.open(output_path, mode="r+")

        # Loom is (genes, cells); we want X in (cells, genes) orientation.
        n_genes, n_cells = ds.shape
        # Sample dtype without reading the full first row.
        dtype = np.dtype(ds[0:1, 0:1].dtype)
        # Always store float32 — frontend consumes float32, and many loom
        # files are written as float64 unnecessarily.
        if dtype.kind == "f":
            dtype = np.dtype("float32")

        x_array = _create_x_array(root, n_cells, n_genes, dtype)

        # Loom HDF5 is most efficient when reading contiguous gene rows.
        def fetch(s: int, e: int) -> np.ndarray:
            # ds[s:e, :] is (gene_block, n_cells); transpose into the orientation
            # zarr expects.
            block = ds[s:e, :]
            return np.ascontiguousarray(block.T)

        await _write_dense_matrix(
            x_array, fetch, n_cells, n_genes, status_callback
        )

        var_index = np.asarray(var.index)
        _write_gene_index(output_path, var_index)

    zarr.consolidate_metadata(output_path)
    logger.info("Successfully converted %s to %s", file_path, output_path)
