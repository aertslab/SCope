import shutil
import os
from typing import Any, List, Optional, cast, MutableMapping
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
import zarr
import json
import numpy as np
from uuid import UUID
from fastapi.responses import JSONResponse, Response

from app.api import deps
from app.models.user import User
from app.models.dataset import Dataset
from app.models.data_file import DataFile
from app.models.project import Project, ProjectVisibility, ProjectShare, project_dataset
from app.models.group import GroupMember
from app.schemas.dataset import Dataset as DatasetSchema, DatasetCreate, DatasetUpdate
from app.worker import process_dataset
from app.core.security import verify_password
from app.services.permissions import get_user_project_permission

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

async def check_dataset_access(
    dataset_id: UUID,
    db: AsyncSession,
    user: Optional[User],
    password: Optional[str] = None
) -> Dataset:
    # Fetch dataset with projects
    query = select(Dataset).options(
        selectinload(Dataset.projects)
    ).where(Dataset.id == dataset_id)
    
    result = await db.execute(query)
    dataset = result.scalars().first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # 1. Owner/Superuser
    if user:
        if dataset.owner_id == user.id or user.is_superuser:
            return dataset
            
    # 2. Check Projects
    # We need to check if ANY of the projects this dataset belongs to is accessible to the user
    
    # Optimization: If we have many projects, this might be slow. 
    # But usually a dataset is in few projects.
    
    accessible = False
    password_match = False
    has_password_project = False
    
    for project in dataset.projects:
        # Check explicit permissions using the service
        # We only need VIEW access to see the dataset
        user_perm = await get_user_project_permission(project, user, db)
        if user_perm:
            accessible = True
            break

        # Public
        if project.visibility == ProjectVisibility.PUBLIC:
            accessible = True
            break
            
        # Password
        if project.visibility == ProjectVisibility.PASSWORD:
            has_password_project = True
            if password and project.password_hash:
                if verify_password(password, project.password_hash):
                    password_match = True
                    # We don't break immediately, as we might find a public/shared one later which is better (no password needed)
                    # But if we finish loop and only have password_match, we allow.
    
    if accessible:
        return dataset
        
    if password_match:
        return dataset
        
    if not user:
        if has_password_project:
             raise HTTPException(status_code=403, detail="Password required")
        raise HTTPException(status_code=401, detail="Authentication required")
        
    if has_password_project:
         raise HTTPException(status_code=403, detail="Password required")

    raise HTTPException(status_code=403, detail="Not enough permissions")

@router.get("/", response_model=List[DatasetSchema])
async def read_datasets(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve datasets.
    """
    if current_user.is_superuser:
        result = await db.execute(select(Dataset).offset(skip).limit(limit))
    else:
        result = await db.execute(select(Dataset).where(Dataset.owner_id == current_user.id).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/check_hash")
async def check_hash(
    hash: str = Form(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Check if a file with the given hash already exists.
    """
    result = await db.execute(select(DataFile).where(DataFile.file_hash == hash))
    data_file = result.scalars().first()
    if data_file:
        return {"exists": True, "id": data_file.id}
    return {"exists": False}

@router.post("/", response_model=DatasetSchema)
async def create_dataset(
    *,
    db: AsyncSession = Depends(deps.get_db),
    name: str = Form(...),
    description: str = Form(None),
    file_type: str = Form(...),
    file_hash: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new dataset. 
    If file_hash exists, link to it.
    If not, upload file and create DataFile.
    """
    # Check if DataFile exists
    result = await db.execute(select(DataFile).where(DataFile.file_hash == file_hash))
    data_file = result.scalars().first()

    if data_file:
        # Check if user already has this dataset
        existing_link = await db.execute(
            select(Dataset).where(
                Dataset.owner_id == current_user.id,
                Dataset.data_file_id == data_file.id
            )
        )
        if existing_link.scalars().first():
             raise HTTPException(status_code=400, detail="You have already uploaded this dataset.")

        # Link to existing
        dataset = Dataset(
            name=name,
            description=description,
            file_type=file_type,
            owner_id=current_user.id,
            data_file_id=data_file.id,
            # Copy status/paths for legacy compatibility/API response
            status=data_file.status,
            file_path=data_file.file_path,
            file_size=data_file.file_size,
            converted_path=data_file.converted_path,
            converted_size=data_file.converted_size
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)
        return dataset
    
    # New Upload
    if not file:
        raise HTTPException(status_code=400, detail="File required for new upload")

    file_location = f"{UPLOAD_DIR}/{file_hash}.{file_type}" # Use hash for filename to avoid collisions
    
    # If file exists on disk but not in DB (orphan), overwrite or reuse?
    # Safer to overwrite or just use it.
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    # Calculate file size
    file_size = os.path.getsize(file_location)

    # Create DataFile
    data_file = DataFile(
        file_hash=file_hash,
        file_path=file_location,
        file_size=file_size,
        status="pending"
    )
    db.add(data_file)
    await db.commit()
    await db.refresh(data_file)

    # Create Dataset
    dataset = Dataset(
        name=name,
        description=description,
        file_type=file_type,
        owner_id=current_user.id,
        data_file_id=data_file.id,
        status="pending",
        file_path=file_location,
        file_size=file_size
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # Trigger background task
    # We pass dataset.id, but the worker should update DataFile too?
    # The worker updates Dataset.status. We need to update DataFile.status too.
    # For now, let's update the worker to handle this, OR just rely on Dataset status for the user.
    # Ideally, worker should update DataFile, and we sync Dataset status?
    # Or worker updates Dataset, and we have a trigger?
    # Let's update worker to be aware of DataFile if possible, or just update Dataset for now.
    # Actually, if multiple Datasets point to same DataFile, and one triggers processing, 
    # the others should see the update.
    # So the worker should update DataFile, and Datasets should read from DataFile.
    # But for now, to minimize changes, let's just process.
    process_dataset.delay(dataset.id, file_location)
    
    return dataset

@router.get("/{dataset_id}", response_model=DatasetSchema)
async def read_dataset(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get dataset by ID.
    """
    return await check_dataset_access(dataset_id, db, current_user, x_project_password)

@router.put("/{dataset_id}", response_model=DatasetSchema)
async def update_dataset(
    dataset_id: UUID,
    dataset_in: DatasetUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update dataset.
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Check permissions (superuser or owner)
    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    update_data = dataset_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)

    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return dataset

@router.get("/{dataset_id}/usage")
async def get_dataset_usage(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get usage information for a dataset (projects it belongs to).
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id).options(selectinload(Dataset.projects)))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    usage = []
    for project in dataset.projects:
        usage.append({
            "id": project.id,
            "name": project.name,
            "visibility": project.visibility
        })
    return usage

@router.delete("/{dataset_id}", response_model=DatasetSchema)
async def delete_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete dataset.
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    data_file_id = dataset.data_file_id
    
    # Delete the dataset record first
    await db.delete(dataset)
    await db.commit()

    # Check if we should delete the physical file
    if data_file_id:
        # Check if any other datasets use this file
        ref_count_res = await db.execute(select(func.count(Dataset.id)).where(Dataset.data_file_id == data_file_id))
        ref_count = ref_count_res.scalar()
        
        if ref_count == 0:
            # No more references, delete DataFile and physical files
            df_res = await db.execute(select(DataFile).where(DataFile.id == data_file_id))
            data_file = df_res.scalars().first()
            
            if data_file:
                if data_file.file_path and os.path.exists(data_file.file_path):
                    try:
                        os.remove(data_file.file_path)
                    except Exception as e:
                        print(f"Error deleting file {data_file.file_path}: {e}")
                
                if data_file.converted_path and os.path.exists(data_file.converted_path):
                    try:
                        if os.path.isdir(data_file.converted_path):
                            shutil.rmtree(data_file.converted_path)
                        else:
                            os.remove(data_file.converted_path)
                    except Exception as e:
                        print(f"Error deleting converted file {data_file.converted_path}: {e}")
                
                await db.delete(data_file)
                await db.commit()
    else:
        # Legacy deletion (no DataFile linked)
        if dataset.file_path and os.path.exists(dataset.file_path):
            try:
                os.remove(dataset.file_path)
            except Exception as e:
                print(f"Error deleting file {dataset.file_path}: {e}")
                
        if dataset.converted_path and os.path.exists(dataset.converted_path):
            try:
                if os.path.isdir(dataset.converted_path):
                    shutil.rmtree(dataset.converted_path)
                else:
                    os.remove(dataset.converted_path)
            except Exception as e:
                print(f"Error deleting converted file {dataset.converted_path}: {e}")

    return dataset

@router.get("/{dataset_id}/metadata")
async def get_dataset_metadata(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get dataset metadata.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
        
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
        
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        if 'uns' in z:
            uns_group = z['uns']
            if isinstance(uns_group, zarr.Group) and 'MetaData' in uns_group:
                # It might be stored as a string or bytes
                metadata_arr = cast(zarr.Array, uns_group['MetaData'])
                md = metadata_arr[()]
                if isinstance(md, bytes):
                    md = md.decode('utf-8')
                
                # Ensure md is string for json.loads
                if not isinstance(md, str):
                    md = str(md)
                    
                # It was double serialized in loom_converter?
                # adata.uns['MetaData'] = json.dumps(meta_json)
                # So md is a JSON string.
                return json.loads(md)
        
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading metadata: {str(e)}")

@router.get("/{dataset_id}/embedding/{embedding_name}")
async def get_dataset_embedding(
    dataset_id: UUID,
    embedding_name: str,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get dataset embedding coordinates.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
        
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        key = f"X_{embedding_name}"
        
        if 'obsm' in cast(MutableMapping, z):
            obsm_obj = z['obsm']
            if isinstance(obsm_obj, zarr.Group):
                # Cast to Any to satisfy mypy for 'in' operator
                obsm_map: Any = obsm_obj
                if key in obsm_map:
                    embedding_arr = cast(zarr.Array, obsm_map[key])
                    data = cast(np.ndarray, embedding_arr[:])
                    
                    # Ensure float32 for frontend compatibility and size reduction
                    if data.dtype != np.float32:
                        data = data.astype(np.float32)

                    # Return binary data for performance
                    return Response(content=data.tobytes(), media_type="application/octet-stream")
        
        raise HTTPException(status_code=404, detail=f"Embedding {embedding_name} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading embedding: {str(e)}")

@router.get("/{dataset_id}/genes")
async def search_genes(
    dataset_id: UUID,
    query: str = "",
    limit: int = 10,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Search for genes in the dataset.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
    
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        var_obj: Any = z['var'] if 'var' in cast(MutableMapping, z) else None
        if var_obj is not None and '_index' in var_obj:
            var_group = cast(zarr.Group, var_obj)
            index_arr = cast(zarr.Array, var_group['_index'])
            # Read all genes. For 30k, it's fine.
            all_genes = cast(np.ndarray, index_arr[:])
            # Convert to string if bytes
            if all_genes.dtype.kind == 'S' or all_genes.dtype.kind == 'U':
                 all_genes = all_genes.astype(str)
            
            # Filter
            if query:
                # Case insensitive search
                query = query.lower()
                matches = [g for g in all_genes if query in g.lower()]
            else:
                matches = all_genes.tolist()
            
            # Search in Regulons (obsm)
            if 'obsm' in cast(MutableMapping, z):
                obsm_group = z['obsm']
                if isinstance(obsm_group, zarr.Group):
                    for reg_key in ["RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"]:
                        if reg_key in obsm_group:
                            try:
                                obj = obsm_group[reg_key]
                                reg_names = []
                                
                                if isinstance(obj, zarr.Array) and hasattr(obj.dtype, 'names') and obj.dtype.names:
                                    reg_names = obj.dtype.names
                                elif isinstance(obj, zarr.Group):
                                    reg_names = [k for k in obj.keys() if k != '_index' and not k.startswith('__')]
                                    
                                if reg_names:
                                    if query:
                                        matches.extend([r for r in reg_names if query in r.lower()])
                                    else:
                                        matches.extend(reg_names)
                            except Exception as e:
                                print(f"Error searching regulons in {reg_key}: {e}")

            return matches[:limit]
        else:
            return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching genes: {str(e)}")

@router.get("/{dataset_id}/features")
async def get_features(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    List available cell features (obs columns) with their types.
    Returns list of {name: str, type: str}.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
    
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        features = []
        
        # 1. Standard obs columns
        if 'obs' in cast(MutableMapping, z):
            obs_group = cast(zarr.Group, z['obs'])
            keys = list(obs_group.keys())
            ignored_keys = {'_index', 'Clusterings', 'RegulonsAUC', 'Embedding', 'Embeddings_X', 'Embeddings_Y'}
            
            for k in keys:
                if k in ignored_keys or k.startswith('__'):
                    continue
                
                obj = obs_group[k]
                ftype = 'continuous' # Default
                
                if isinstance(obj, zarr.Group):
                    if 'codes' in obj and 'categories' in obj:
                        ftype = 'categorical'
                elif hasattr(obj, 'dtype'):
                    # It's an Array
                    arr = cast(zarr.Array, obj)
                    if arr.dtype.kind in ('S', 'U', 'O'):
                        ftype = 'categorical'
                
                features.append({"name": k, "type": ftype})
            
            # 3. Regulons - REMOVED to prevent pollution. Now accessible via gene search.

        # 2. Clusterings from MetaData
        if 'uns' in cast(MutableMapping, z):
            uns_obj = z['uns']
            if isinstance(uns_obj, zarr.Group):
                uns_map: Any = uns_obj
                if 'MetaData' in uns_map:
                    try:
                        metadata_arr = cast(zarr.Array, uns_map['MetaData'])
                        md = metadata_arr[()]
                        if isinstance(md, bytes):
                            md = md.decode('utf-8')
                        
                        if not isinstance(md, str):
                            md = str(md)

                        meta_json = json.loads(md)
                        
                        if 'clusterings' in meta_json:
                            for c in meta_json['clusterings']:
                                features.append({"name": f"Clustering: {c['name']}", "type": "categorical"})
                    except Exception as e:
                        print(f"Error parsing MetaData for clusterings: {e}")
                
        return features
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing features: {str(e)}")

@router.get("/{dataset_id}/expression/{gene}")
async def get_gene_expression(
    dataset_id: UUID,
    gene: str,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get expression values for a specific gene.
    Returns binary float32 array.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
    
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        var_obj: Any = z['var'] if 'var' in cast(MutableMapping, z) else None
        if var_obj is not None and '_index' in var_obj:
            var_group = cast(zarr.Group, var_obj)
            index_arr = cast(zarr.Array, var_group['_index'])
            all_genes = cast(np.ndarray, index_arr[:])
            if all_genes.dtype.kind == 'S' or all_genes.dtype.kind == 'U':
                 all_genes = all_genes.astype(str)
            
            # Find index
            # np.where returns tuple
            indices = np.where(all_genes == gene)[0]
            if len(indices) > 0:
                idx = indices[0]
                
                # Read from X
                # X is (cells, genes)
                # We want column idx
                # This reads all chunks intersecting the column
                x_arr = cast(zarr.Array, z['X'])
                expression = cast(np.ndarray, x_arr[:, idx])
                
                # Ensure float32
                expression = expression.astype(np.float32)
                
                return Response(content=expression.tobytes(), media_type="application/octet-stream")

        # If not found in genes, try to find in Regulons (obsm)
        if 'obsm' in cast(MutableMapping, z):
            obsm_group = z['obsm']
            if isinstance(obsm_group, zarr.Group):
                for reg_key in ["RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"]:
                    if reg_key in obsm_group:
                        try:
                            obj = obsm_group[reg_key]
                            
                            # Case 1: Structured Array
                            if isinstance(obj, zarr.Array):
                                if hasattr(obj.dtype, 'names') and gene in obj.dtype.names:
                                    # Found it!
                                    expression = obj[gene]
                                    expression = expression.astype(np.float32)
                                    return Response(content=expression.tobytes(), media_type="application/octet-stream")
                            
                            # Case 2: Group (DataFrame-like)
                            elif isinstance(obj, zarr.Group):
                                if gene in obj:
                                    expression = obj[gene][:]
                                    expression = expression.astype(np.float32)
                                    return Response(content=expression.tobytes(), media_type="application/octet-stream")

                        except Exception as e:
                            print(f"Error reading regulon {gene} from {reg_key}: {e}")

        raise HTTPException(status_code=404, detail="Gene or Regulon not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading expression: {str(e)}")

@router.get("/{dataset_id}/feature/{feature}")
async def get_feature_values(
    dataset_id: UUID,
    feature: str,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get values for a specific feature (obs column).
    Returns JSON list (handles strings and numbers).
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
    
    try:
        z = cast(zarr.Group, zarr.open(dataset.converted_path, mode='r'))
        
        # Handle Library Size
        if feature == "__library_size__":
            if 'obs' in cast(MutableMapping, z):
                obs = z['obs']
                # Common keys for library size
                keys_to_check = ['n_counts', 'total_counts', 'TotalUMI', 'nCount_RNA', 'n_genes']
                
                # Case 1: obs is a group (columns are datasets)
                if isinstance(obs, zarr.Group):
                    for key in keys_to_check:
                        if key in obs:
                            lib_size_arr = cast(zarr.Array, obs[key])
                            lib_size = cast(np.ndarray, lib_size_arr[:])
                            return lib_size.tolist()
                
                # Case 2: obs is an array (structured array)
                elif isinstance(obs, zarr.Array):
                    if obs.dtype.names:
                        for key in keys_to_check:
                            if key in obs.dtype.names:
                                # obs is a zarr array, we need to read it to numpy to access fields by name
                                # or use structured array slicing if zarr supports it (it doesn't for fields directly)
                                obs_data = cast(np.ndarray, obs[:])
                                lib_size = cast(np.ndarray, obs_data[key])
                                return lib_size.tolist()
            
            raise HTTPException(status_code=404, detail="Library size not found in dataset")

        # Handle Regulons
        if feature.startswith("Regulon: "):
            regulon_name = feature.replace("Regulon: ", "")
            if 'obs' in cast(MutableMapping, z):
                obs_group = z['obs']
                if isinstance(obs_group, zarr.Group) and 'RegulonsAUC' in cast(MutableMapping, obs_group):
                    regulons_arr = cast(zarr.Array, obs_group['RegulonsAUC'])
                    if regulons_arr.dtype.names and regulon_name in regulons_arr.dtype.names:
                        # Read all data then access field
                        regulons_data = cast(np.ndarray, regulons_arr[:])
                        values = cast(np.ndarray, regulons_data[regulon_name])
                        return values.tolist()
                    else:
                        raise HTTPException(status_code=404, detail=f"Regulon {regulon_name} not found")
            
            raise HTTPException(status_code=404, detail="Regulons data not found")

        # Handle Clusterings
        if feature.startswith("Clustering: "):
            clustering_name = feature.replace("Clustering: ", "")
            
            if 'uns' in cast(MutableMapping, z):
                uns_obj = z['uns']
                if isinstance(uns_obj, zarr.Group):
                    uns_map = cast(MutableMapping, uns_obj)
                    if 'MetaData' in uns_map:
                        metadata_arr = cast(zarr.Array, uns_map['MetaData'])
                        md = metadata_arr[()]
                        if isinstance(md, bytes):
                            md = md.decode('utf-8')
                        
                        if not isinstance(md, str):
                            md = str(md)

                        meta_json = json.loads(md)
                        
                        # Find clustering ID
                        clustering_id = None
                        clusters_map = {}
                        
                        if 'clusterings' in meta_json:
                            for c in meta_json['clusterings']:
                                if c['name'] == clustering_name:
                                    clustering_id = str(c['id'])
                                    # Create map id -> description
                                    for cluster in c['clusters']:
                                        clusters_map[cluster['id']] = cluster['description']
                                    break
                        
                        if clustering_id is not None and 'obs' in cast(MutableMapping, z):
                            obs_group = z['obs']
                            if isinstance(obs_group, zarr.Group) and 'Clusterings' in cast(MutableMapping, obs_group):
                                # Access the specific field in the structured array
                                # z['obs']['Clusterings'] is a Zarr array with compound dtype
                                # We can access fields by name
                                clusterings_arr = cast(zarr.Array, obs_group['Clusterings'])
                                
                                if clusterings_arr.dtype.names and clustering_id in clusterings_arr.dtype.names:
                                    # Read the data for this field
                                    # This returns a numpy array of integers
                                    clusterings_data = cast(np.ndarray, clusterings_arr[:])
                                    codes = cast(np.ndarray, clusterings_data[clustering_id])
                                    
                                    # Map to descriptions
                                    # Handle potential missing values if any (though usually clusterings are complete)
                                    # Using a list comprehension or numpy map
                                    
                                    # Convert map to array for fast lookup if keys are contiguous integers
                                    # But keys might not be contiguous or start at 0 (though they usually do)
                                    # Safer to use a lookup function or map
                                    
                                    # Optimization: if max id is small, use array lookup
                                    max_id = codes.max()
                                    if max_id < len(clusters_map) + 100: # Heuristic
                                        # Create lookup array
                                        lookup = np.empty(max_id + 1, dtype=object)
                                        for k, v in clusters_map.items():
                                            if k <= max_id:
                                                lookup[k] = v
                                        
                                        # Handle codes that might be out of range or missing in map
                                        # We'll assume data is consistent with metadata
                                        values = lookup[codes]
                                        
                                        # Replace None with empty string or "Unknown"
                                        # values[values == None] = "Unknown" 
                                        # (numpy object array comparison is tricky with None)
                                        
                                        return [v if v is not None else "Unknown" for v in values]
                                    else:
                                        # Fallback to slow map
                                        return [clusters_map.get(c, "Unknown") for c in codes]
                                else:
                                    raise HTTPException(status_code=404, detail=f"Clustering ID {clustering_id} not found in data")
                            else:
                                raise HTTPException(status_code=404, detail="Clustering data not found")
                        else:
                            raise HTTPException(status_code=404, detail="Clustering data not found")
                    else:
                        raise HTTPException(status_code=404, detail="Metadata not found")
                else:
                    raise HTTPException(status_code=404, detail="Metadata not found")
            else:
                 raise HTTPException(status_code=404, detail="Metadata not found")

        # Handle Genes
        # Check if it's a gene (in var/index or var/Gene)
        # We need to find the index of the gene
        gene_index = -1
        
        if 'var' in cast(MutableMapping, z):
            var_group = z['var']
            if isinstance(var_group, zarr.Group):
                # Try standard index first (usually _index)
                # But AnnData usually stores index in .zattrs['_index']
                # Or we can look for 'index' or 'Gene' arrays
                
                var_index_name = 'index' # Default
                # Check if .zattrs exists in store (it's a key in the store)
                if hasattr(var_group.store, '__contains__') and '.zattrs' in var_group.store: 
                    # We can check attrs
                    if '_index' in var_group.attrs:
                        var_index_name = cast(str, var_group.attrs['_index'])
                elif isinstance(var_group.store, dict) and '.zattrs' in var_group.store:
                     if '_index' in var_group.attrs:
                        var_index_name = cast(str, var_group.attrs['_index'])
                
                if var_index_name in var_group:
                    var_index = cast(zarr.Array, var_group[var_index_name])
                    # This might be slow if we read all genes. 
                    # Optimization: Check if we can search without loading everything?
                    # Zarr doesn't support search. We have to load.
                    # But 'var' is usually small enough (20k-30k strings)
                    
                    genes = cast(np.ndarray, var_index[:])
                    # Handle bytes if necessary
                    if genes.dtype.kind == 'S':
                        genes = genes.astype(str)
                        
                    # Find index
                    # np.where returns a tuple
                    matches = np.where(genes == feature)[0]
                    if len(matches) > 0:
                        gene_index = matches[0]
                
                # If not found in index, try 'Gene' column if it exists (SCope convention sometimes)
                if gene_index == -1 and 'Gene' in var_group:
                    gene_col = cast(zarr.Array, var_group['Gene'])
                    genes = cast(np.ndarray, gene_col[:])
                    if genes.dtype.kind == 'S':
                        genes = genes.astype(str)
                    matches = np.where(genes == feature)[0]
                    if len(matches) > 0:
                        gene_index = matches[0]

        if gene_index != -1:
            # Get expression data
            # Usually in X, but X can be a group (CSC/CSR) or array
            if 'X' in cast(MutableMapping, z):
                x_obj = z['X']
                if isinstance(x_obj, zarr.Array):
                    # Dense array
                    # Shape is (n_obs, n_vars)
                    # We want all obs for one var: [:, gene_index]
                    return cast(np.ndarray, x_obj[:, gene_index]).tolist()
                elif isinstance(x_obj, zarr.Group):
                    # Sparse matrix (CSC or CSR)
                    # AnnData stores sparse matrices as groups with data, indices, indptr
                    # We need to know the format.
                    # Usually 'encoding-type' in attrs
                    encoding = x_obj.attrs.get('encoding-type')
                    if encoding == 'csc_matrix':
                        # Compressed Sparse Column
                        # Efficient for column slicing (getting a gene)
                        # data, indices, indptr
                        # We need to reconstruct the column
                        
                        # This is complex to do efficiently with Zarr without loading too much
                        # But for a single column, it's doable if we know the range in data/indices
                        
                        indptr = cast(zarr.Array, x_obj['indptr'])
                        # Range for column i is indptr[i] to indptr[i+1]
                        # indptr[i] returns a numpy scalar, we need to convert to int
                        # Cast to Any first to avoid mypy errors about .item() on int/float union
                        start = int(cast(Any, indptr[gene_index]).item())
                        end = int(cast(Any, indptr[gene_index+1]).item())
                        
                        data = cast(zarr.Array, x_obj['data'])
                        indices = cast(zarr.Array, x_obj['indices'])
                        
                        col_data = cast(np.ndarray, data[start:end])
                        col_indices = cast(np.ndarray, indices[start:end])
                        
                        # Create full array of zeros
                        n_obs = z.attrs['n_obs'] if 'n_obs' in z.attrs else 0
                        # Fallback for n_obs
                        if n_obs == 0 and 'obs' in cast(MutableMapping, z):
                             obs_group = z['obs']
                             if isinstance(obs_group, zarr.Group) and 'index' in obs_group:
                                 n_obs = cast(zarr.Array, obs_group['index']).shape[0]
                        
                        res = np.zeros(cast(int, n_obs), dtype=np.float64)
                        res[col_indices] = col_data
                        return res.tolist()
                        
                    elif encoding == 'csr_matrix':
                        # Compressed Sparse Row
                        # Inefficient for column slicing
                        # We have to scan all rows? That's too slow.
                        # Or maybe we can just load it if it fits in memory? No.
                        
                        # For now, raise error or implement slow scan?
                        # Or maybe we can use scipy if we can load chunks?
                        
                        # Let's try to load the whole matrix if it's not too huge?
                        # No, that defeats the purpose.
                        
                        # If it's CSR, getting a column is hard.
                        # We might have to iterate over chunks.
                        
                        raise HTTPException(status_code=501, detail="CSR matrix slicing for genes not yet optimized")
                    else:
                         # Try to guess or handle legacy formats
                         if 'data' in x_obj and 'indices' in x_obj and 'indptr' in x_obj:
                             # Assume CSC if not specified? Or check shape?
                             # Usually AnnData uses CSR for X.
                             # If it is CSR, we are in trouble for speed.
                             pass
                         pass

        # Handle regular features
        if 'obs' in cast(MutableMapping, z):
            obs_obj = z['obs']
            if isinstance(obs_obj, zarr.Group):
                obs_map = cast(MutableMapping, obs_obj)
                if feature in obs_map:
                    obj = obs_map[feature]
                    
                    if isinstance(obj, zarr.Group):
                        # Handle categorical (AnnData format)
                        if 'codes' in cast(MutableMapping, obj) and 'categories' in cast(MutableMapping, obj):
                            codes_arr = cast(zarr.Array, obj['codes'])
                            cats_arr = cast(zarr.Array, obj['categories'])
                            codes = cast(np.ndarray, codes_arr[:])
                            cats = cast(np.ndarray, cats_arr[:])
                            
                            # Decode categories if bytes
                            if cats.dtype.kind == 'S':
                                cats = cats.astype(str)
                            
                            # Map codes to categories
                            if codes.min() >= 0:
                                values = cats[codes]
                                return values.tolist()
                            else:
                                # Handle missing values (-1)
                                res = np.empty(codes.shape, dtype=object)
                                mask = codes >= 0
                                res[mask] = cats[codes[mask]]
                                # res[~mask] = None # Implicitly None for object array if not set? No, it's uninitialized or None.
                                # Actually np.empty(dtype=object) initializes to None usually? No, it's uninitialized (garbage).
                                # We should set it to None explicitly.
                                res[~mask] = cast(Any, None)
                                return res.tolist()
                        else:
                            # Return empty or error for unknown group types
                            return []
                    else:
                        # Regular Array
                        arr = cast(zarr.Array, obj)
                        values = cast(np.ndarray, arr[:])
                        # If bytes, decode
                        if values.dtype.kind == 'S':
                            values = values.astype(str)
                        
                        return values.tolist()
                else:
                    raise HTTPException(status_code=404, detail="Feature not found")
            else:
                raise HTTPException(status_code=404, detail="Feature not found")
        else:
            raise HTTPException(status_code=404, detail="Feature not found")
    except Exception as e:
        # Log the full error for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading feature: {str(e)}")
