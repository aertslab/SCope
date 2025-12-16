import loompy # type: ignore
import anndata # type: ignore
import numpy as np
import pandas as pd
import json
import zlib
import base64
import os
import logging
import zarr
from numcodecs import Blosc
from typing import Callable, Optional, Awaitable, Tuple

logger = logging.getLogger(__name__)

def calculate_chunk_sizes(n_rows: int, n_cols: int, dtype: np.dtype, target_chunk_bytes: int = 1024 * 1024) -> Tuple[int, int]:
    """
    Calculate chunk sizes optimized for column access (gene access).
    Returns (row_chunk_size, col_chunk_size).
    """
    itemsize = dtype.itemsize
    # We want chunks to span all rows (cells) for a small set of columns (genes).
    cell_chunk_size = 10_000
    
    bytes_per_col_chunk = cell_chunk_size * itemsize
    # Ensure at least 1 column per chunk
    col_chunk_size = max(1, int(target_chunk_bytes // bytes_per_col_chunk))
    
    return cell_chunk_size, col_chunk_size

async def write_chunked_matrix_to_zarr(
    store: zarr.Group,
    key: str,
    source_matrix,
    shape: Tuple[int, int],
    dtype: np.dtype,
    chunk_sizes: Tuple[int, int],
    is_source_transposed: bool = False,
    status_callback: Optional[Callable[[str, Optional[str]], Awaitable[None]]] = None
) -> None:
    """
    Write a matrix to Zarr in chunks.
    """
    n_cells, n_genes = shape
    cell_chunk_size, gene_chunk_size = chunk_sizes
    
    logger.info(f"Creating array {key} with shape {shape} and chunks {chunk_sizes}")

    x_array = store.create_array(
        key, 
        shape=(n_cells, n_genes), 
        chunks=(cell_chunk_size, gene_chunk_size), 
        dtype=dtype,
        compressor=Blosc(cname='zstd', clevel=3, shuffle=Blosc.BITSHUFFLE)
    )
    
    total_chunks = (n_genes + gene_chunk_size - 1) // gene_chunk_size
    
    for i in range(0, n_genes, gene_chunk_size):
        end = min(i + gene_chunk_size, n_genes)
        
        if is_source_transposed:
            # Source is (genes, cells)
            chunk = source_matrix[i:end, :]
            x_array[:, i:end] = chunk.T
        else:
            # Source is (cells, genes)
            chunk = source_matrix[:, i:end]
            if hasattr(chunk, "toarray"):
                chunk = chunk.toarray()
            x_array[:, i:end] = chunk
            
        if status_callback:
            current_chunk = i // gene_chunk_size + 1
            percent = int((current_chunk / total_chunks) * 100)
            if percent % 5 == 0:
                await status_callback(f"processing (converting matrix: {percent}%)", None)

async def convert_anndata_to_zarr(
    adata: anndata.AnnData,
    output_path: str,
    status_callback: Optional[Callable[[str, Optional[str]], Awaitable[None]]] = None
) -> None:
    """
    Convert AnnData to Zarr with optimized chunking.
    """
    logger.info(f"Converting AnnData to Zarr at {output_path}")
    
    if status_callback:
        await status_callback("processing (starting)", None)
        
    if status_callback:
        await status_callback("processing (writing metadata)", None)

    # Create skeleton without X to setup structure
    adata_skeleton = anndata.AnnData(
        obs=adata.obs, 
        var=adata.var, 
        uns=adata.uns, 
        obsm=adata.obsm, 
        varm=adata.varm
    )
    adata_skeleton.write_zarr(output_path)
    
    if status_callback:
        await status_callback("processing (converting matrix)", None)
        
    store = zarr.open(output_path, mode='r+')
    
    n_cells, n_genes = adata.shape
    dtype = adata.X.dtype if hasattr(adata.X, 'dtype') else np.float32
    
    chunk_sizes = calculate_chunk_sizes(n_cells, n_genes, dtype)
    
    await write_chunked_matrix_to_zarr(
        store=store,
        key="X",
        source_matrix=adata.X,
        shape=(n_cells, n_genes),
        dtype=dtype,
        chunk_sizes=chunk_sizes,
        is_source_transposed=False,
        status_callback=status_callback
    )
    
    zarr.consolidate_metadata(output_path)
    logger.info(f"Successfully converted AnnData to {output_path}")

async def convert_loom_to_zarr(
    file_path: str, 
    output_path: str, 
    chunk_size: int = 1000,
    status_callback: Optional[Callable[[str, Optional[str]], Awaitable[None]]] = None
) -> None:
    """
    Convert a SCope-compatible loom file to Zarr, writing incrementally to avoid high memory usage.
    """
    logger.info(f"Converting {file_path} to Zarr using batched converter")
    
    if status_callback:
        await status_callback("processing (starting)", None)

    with loompy.connect(file_path, mode='r', validate=False) as ds:
        if status_callback:
            await status_callback("processing (extracting metadata)", None)

        # Gather metadata first (same logic as before)
        
        # 2. Read Cell Attributes (obs)
        obs_data = {}
        obsm_data = {}
        if 'CellID' in ds.ca:
            obs_index = ds.ca['CellID'].astype(str)
        else:
            obs_index = np.arange(ds.shape[1]).astype(str)
            
        for key in ds.ca.keys():
            if key == 'CellID': continue
            attr = ds.ca[key]
            if hasattr(attr, 'dtype') and attr.dtype.names:
                obsm_data[sanitize_key(key)] = pd.DataFrame(attr, index=obs_index)
            elif len(attr.shape) == 1:
                obs_data[sanitize_key(key)] = attr
        
        obs = pd.DataFrame(obs_data, index=obs_index)
        
        # 3. Read Gene Attributes (var)
        var_data = {}
        varm_data = {}
        if 'Gene' in ds.ra:
            var_index = ds.ra['Gene'].astype(str)
        else:
            var_index = np.arange(ds.shape[0]).astype(str)
            
        for key in ds.ra.keys():
            if key == 'Gene': continue
            attr = ds.ra[key]
            if hasattr(attr, 'dtype') and attr.dtype.names:
                varm_data[sanitize_key(key)] = pd.DataFrame(attr, index=var_index)
            elif len(attr.shape) == 1:
                var_data[sanitize_key(key)] = attr
                
        var = pd.DataFrame(var_data, index=var_index)
        
        # 4. Parse Metadata (uns)
        meta_json = {}
        if 'MetaData' in ds.attrs:
            md = ds.attrs['MetaData']
            if isinstance(md, np.ndarray): md = md[0]
            try:
                if isinstance(md, bytes):
                    md = md.decode('utf-8')
                meta_json = json.loads(md)
            except json.JSONDecodeError:
                try:
                    if isinstance(md, str):
                        md_bytes = md.encode('ascii')
                    else:
                        md_bytes = md
                    meta_json = json.loads(zlib.decompress(base64.b64decode(md_bytes)))
                except Exception as e:
                    logger.error(f"Failed to decode metadata: {e}")

        uns = {'MetaData': json.dumps(meta_json)}

        # 5. Handle Embeddings (obsm)
        if 'embeddings' in meta_json:
            for emb in meta_json['embeddings']:
                eid = str(emb['id'])
                name = emb['name']
                key = f"X_{sanitize_key(name)}"
                
                coords = None
                if eid == "-1":
                    if "Embedding" in ds.ca:
                         emb_arr = ds.ca["Embedding"]
                         if '_X' in emb_arr.dtype.names and '_Y' in emb_arr.dtype.names:
                             coords = np.column_stack((emb_arr['_X'], emb_arr['_Y']))
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
                    obsm_data[key] = coords

        # 6. Handle Clusterings (obs)
        if 'clusterings' in meta_json:
            for cl in meta_json['clusterings']:
                cid = str(cl['id'])
                name = cl['name']
                if "Clusterings" in ds.ca and cid in ds.ca["Clusterings"].dtype.names:
                    cluster_indices = ds.ca["Clusterings"][cid]
                    cluster_map = {c['id']: c['description'] for c in cl['clusters']}
                    labels = [cluster_map.get(i, str(i)) for i in cluster_indices]
                    obs[sanitize_key(name)] = labels

        # Create initial AnnData without X to setup the Zarr store structure
        
        if status_callback:
            await status_callback("processing (initializing zarr store)", None)

        adata_skeleton = anndata.AnnData(obs=obs, var=var, uns=uns)
        for key, val in obsm_data.items():
            adata_skeleton.obsm[key] = val
        for key, val in varm_data.items():
            adata_skeleton.varm[key] = val
            
        adata_skeleton.write_zarr(output_path)
        
        if status_callback:
            await status_callback("processing (converting matrix)", None)

        # Now open the Zarr store and write X
        store = zarr.open(output_path, mode='r+')
        
        # Loom is (genes, cells), AnnData/Zarr should be (cells, genes)
        n_genes, n_cells = ds.shape
        dtype = ds[0:1, 0:1].dtype
        
        chunk_sizes = calculate_chunk_sizes(n_cells, n_genes, dtype)
        
        await write_chunked_matrix_to_zarr(
            store=store,
            key="X",
            source_matrix=ds,
            shape=(n_cells, n_genes),
            dtype=dtype,
            chunk_sizes=chunk_sizes,
            is_source_transposed=True,
            status_callback=status_callback
        )
    
    # Consolidate metadata to ensure X and all other arrays are correctly indexed
    # This fixes the "X not found in consolidated metadata" error
    zarr.consolidate_metadata(output_path)
                    
    logger.info(f"Successfully converted {file_path} to {output_path}")


def sanitize_key(key: str) -> str:
    """Replace forward slashes with underscores to avoid Zarr group issues."""
    return key.replace('/', '_')
