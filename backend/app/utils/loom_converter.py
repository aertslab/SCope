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
from typing import Callable, Optional, Awaitable

logger = logging.getLogger(__name__)

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
        
        # Create X array in Zarr
        # Using chunks=(chunk_size, n_genes) means we chunk by cells, which is good for analysis
        # ds.dtype is not available on LoomConnection, so we infer it from a small slice
        dtype = ds[0:1, 0:1].dtype
        x_array = store.create_dataset(
            "X", 
            shape=(n_cells, n_genes), 
            chunks=(chunk_size, n_genes), 
            dtype=dtype,
            compressor=Blosc(cname='zstd', clevel=3, shuffle=Blosc.BITSHUFFLE)
        )
        
        # Iterate and write chunks
        # We iterate over cells (columns in Loom)
        total_chunks = (n_cells + chunk_size - 1) // chunk_size
        
        for i in range(0, n_cells, chunk_size):
            end = min(i + chunk_size, n_cells)
            
            # Read chunk from Loom: all genes, cells i:end
            # Loom shape is (genes, cells)
            # We want (cells, genes) for Zarr
            chunk = ds[:, i:end].T 
            
            # Write to Zarr
            x_array[i:end, :] = chunk
            
            # Update status
            if status_callback:
                current_chunk = i // chunk_size + 1
                percent = int((current_chunk / total_chunks) * 100)
                # Only update every 5% or so to avoid spamming DB
                if percent % 5 == 0:
                    await status_callback(f"processing (converting matrix: {percent}%)", None)
    
    # Consolidate metadata to ensure X and all other arrays are correctly indexed
    # This fixes the "X not found in consolidated metadata" error
    zarr.consolidate_metadata(output_path)
                    
    logger.info(f"Successfully converted {file_path} to {output_path}")


def convert_loom_to_anndata(file_path: str) -> anndata.AnnData:
    """
    Convert a SCope-compatible loom file to AnnData.
    Kept for backward compatibility or small files if needed.
    """
    logger.info(f"Converting {file_path} to AnnData using custom converter")
    
    with loompy.connect(file_path, mode='r', validate=False) as ds:
        # 1. Read Expression Matrix (X)
        # Try to read as sparse if possible, otherwise dense
        try:
            logger.info("Attempting to read expression matrix as sparse...")
            # loompy stores (genes, cells), we want (cells, genes)
            # ds.sparse() returns scipy.sparse.coo_matrix
            X = ds.sparse().T.tocsr()
        except Exception as e:
            logger.warning(f"Failed to read as sparse, falling back to dense: {e}")
            X = ds[:, :].T # (cells, genes)
        
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
            # Handle structured arrays (numpy arrays with named dtypes)
            if hasattr(attr, 'dtype') and attr.dtype.names:
                # Store in obsm
                # This preserves raw data for Clusterings, Embeddings, etc.
                # Specific handlers later might add more processed versions (e.g. labels for clusters)
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
            # Handle structured arrays (numpy arrays with named dtypes)
            # This specifically handles Marker Gene tables (e.g. ClusterMarkers_N)
            if hasattr(attr, 'dtype') and attr.dtype.names:
                varm_data[sanitize_key(key)] = pd.DataFrame(attr, index=var_index)
            elif len(attr.shape) == 1:
                var_data[sanitize_key(key)] = attr
                
        var = pd.DataFrame(var_data, index=var_index)
        
        # Create AnnData
        adata = anndata.AnnData(X=X, obs=obs, var=var)
        
        # Assign structured arrays to obsm/varm
        for key, df in obsm_data.items():
            adata.obsm[key] = df
            
        for key, df in varm_data.items():
            adata.varm[key] = df
        
        # 4. Parse Metadata
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
                    # Try decompressing
                    # It might be base64 encoded zlib compressed
                    # The old code: json.loads(zlib.decompress(base64.b64decode(meta)))
                    if isinstance(md, str):
                        md_bytes = md.encode('ascii')
                    else:
                        md_bytes = md
                    meta_json = json.loads(zlib.decompress(base64.b64decode(md_bytes)))
                except Exception as e:
                    logger.error(f"Failed to decode metadata: {e}")

        adata.uns['MetaData'] = json.dumps(meta_json)

        # 5. Handle Embeddings
        if 'embeddings' in meta_json:
            for emb in meta_json['embeddings']:
                eid = str(emb['id'])
                name = emb['name']
                key = f"X_{sanitize_key(name)}"
                
                coords = None
                if eid == "-1":
                    # Default embedding
                    if "Embedding" in ds.ca:
                         # Structured array with _X and _Y
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
                    adata.obsm[key] = coords
                    # Also add to uns for easy access if needed
                    # adata.uns[f"embedding_{name}"] = {'id': eid}

        # 6. Handle Clusterings
        if 'clusterings' in meta_json:
            for cl in meta_json['clusterings']:
                cid = str(cl['id'])
                name = cl['name']
                if "Clusterings" in ds.ca and cid in ds.ca["Clusterings"].dtype.names:
                    cluster_indices = ds.ca["Clusterings"][cid]
                    
                    # Map cluster IDs to names
                    cluster_map = {c['id']: c['description'] for c in cl['clusters']}
                    
                    # Create labels
                    labels = [cluster_map.get(i, str(i)) for i in cluster_indices]
                    
                    adata.obs[sanitize_key(name)] = labels
                    
        # 7. Handle Regulons (AUC)
        # RegulonsAUC, MotifRegulonsAUC, TrackRegulonsAUC are structured arrays in ca
        for reg_type in ["RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"]:
            if reg_type in ds.ca:
                reg_data = ds.ca[reg_type]
                for name in reg_data.dtype.names:
                    pass
                    


        return adata

def sanitize_key(key: str) -> str:
    """Replace forward slashes with underscores to avoid Zarr group issues."""
    return key.replace('/', '_')
