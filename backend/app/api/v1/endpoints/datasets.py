import shutil
import os
import logging
import threading
from collections import OrderedDict
from typing import Any, List, Optional, cast, MutableMapping
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
import zarr
import json
import numpy as np
from uuid import UUID
from fastapi.responses import JSONResponse, Response, FileResponse

from app.api import deps
from app.models.user import User
from app.models.dataset import Dataset
from app.models.data_file import DataFile
from app.models.project import Project, ProjectVisibility, ProjectShare, project_dataset
from app.models.group import GroupMember
from app.schemas.dataset import Dataset as DatasetSchema, DatasetCreate, DatasetUpdate
from app.worker import process_dataset
from app.core.config import settings
from app.core.security import verify_password_async
from app.services.permissions import get_user_project_permission
from app.services.audit import record_audit
from app.utils.zarr_cache import find_gene_index, load_gene_index, load_metadata, open_zarr
from app.utils import zarr_cache

router = APIRouter()

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"


# ---------------------------------------------------------------------------
# Hot-path cache for gene expression columns.
#
# The viewer hammers /expression/{gene} every time the user picks a gene; for
# a 60k-cell × 30k-gene zarr store each request decompresses a column-shard
# off disk which can take 1-3s the first time. Once decoded the bytes are
# tiny (n_cells × 4) and immutable until the dataset is reconverted, so a
# small process-local LRU pays for itself within the first repeat click.
#
# Capacity is in *bytes*, not entries, so a workspace with one giant dataset
# doesn't blow memory while another with many small ones still gets good
# coverage.
# ---------------------------------------------------------------------------
_EXPRESSION_CACHE_MAX_BYTES = 128 * 1024 * 1024  # 128 MiB
_expression_cache: "OrderedDict[tuple[str, int], bytes]" = OrderedDict()
_expression_cache_bytes = 0
_expression_cache_lock = threading.Lock()


def _expression_cache_get(key: tuple[str, int]) -> Optional[bytes]:
    with _expression_cache_lock:
        payload = _expression_cache.get(key)
        if payload is not None:
            _expression_cache.move_to_end(key)
        return payload


def _expression_cache_put(key: tuple[str, int], payload: bytes) -> None:
    global _expression_cache_bytes
    size = len(payload)
    if size > _EXPRESSION_CACHE_MAX_BYTES:
        return
    with _expression_cache_lock:
        if key in _expression_cache:
            _expression_cache_bytes -= len(_expression_cache.pop(key))
        _expression_cache[key] = payload
        _expression_cache_bytes += size
        while _expression_cache_bytes > _EXPRESSION_CACHE_MAX_BYTES and _expression_cache:
            _, evicted = _expression_cache.popitem(last=False)
            _expression_cache_bytes -= len(evicted)


def _invalidate_expression_cache(prefix: Optional[str] = None) -> None:
    """Drop cached expression bytes for one path (or all of them)."""
    global _expression_cache_bytes
    with _expression_cache_lock:
        if prefix is None:
            _expression_cache.clear()
            _expression_cache_bytes = 0
            return
        for key in [k for k in _expression_cache if k[0] == prefix]:
            _expression_cache_bytes -= len(_expression_cache.pop(key))


def _read_expression_column(path: str, idx: int) -> bytes:
    """Decompress one column of X off disk. Runs in a threadpool."""
    cached = _expression_cache_get((path, idx))
    if cached is not None:
        return cached
    z = cast(zarr.Group, open_zarr(path))
    x_arr = cast(zarr.Array, z["X"])
    column = cast(np.ndarray, x_arr[:, idx])
    if column.dtype != np.float32:
        column = column.astype(np.float32, copy=False)
    payload = column.tobytes()
    _expression_cache_put((path, idx), payload)
    return payload


def _read_regulon_expression(path: str, gene: str) -> Optional[bytes]:
    """Threadpool-safe lookup for AUC values stored under obsm/Regulons*."""
    z = cast(zarr.Group, open_zarr(path))
    obsm_group = z.get("obsm") if isinstance(z, MutableMapping) else None  # type: ignore[arg-type]
    if not isinstance(obsm_group, zarr.Group):
        return None
    for reg_key in ("RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"):
        if reg_key not in obsm_group:
            continue
        try:
            obj = obsm_group[reg_key]
            if isinstance(obj, zarr.Array):
                if hasattr(obj.dtype, "names") and gene in (obj.dtype.names or ()):
                    arr = np.asarray(obj[gene]).astype(np.float32, copy=False)
                    return arr.tobytes()
            elif isinstance(obj, zarr.Group) and gene in obj:
                arr = np.asarray(obj[gene][:]).astype(np.float32, copy=False)
                return arr.tobytes()
        except Exception:
            logger.exception("Error reading regulon %s from %s", gene, reg_key)
    return None

if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# 1 MiB per chunk: large enough that asyncio overhead is negligible, small
# enough to enforce the size limit promptly without holding much memory.
UPLOAD_CHUNK_SIZE = 1024 * 1024


ALLOWED_FILE_TYPES = {"loom", "h5ad", "csv"}


async def _stream_upload_to_disk(
    file: UploadFile,
    destination: str,
    max_bytes: int,
) -> int:
    """Stream `file` to `destination` in chunks. Returns total bytes written.

    Aborts (raising 413) if the cumulative size exceeds `max_bytes`. Cleans up
    the partial file on failure.
    """
    total = 0
    try:
        async with aiofiles.open(destination, "wb") as out:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Upload exceeds maximum allowed size of {max_bytes} bytes",
                    )
                await out.write(chunk)
    except Exception:
        # Best-effort cleanup of the partial file.
        try:
            if os.path.exists(destination):
                os.remove(destination)
        except OSError:
            pass
        raise
    return total

async def check_dataset_access(
    dataset_id: UUID,
    db: AsyncSession,
    user: Optional[User],
    password: Optional[str] = None
) -> Dataset:
    # Fetch dataset with projects
    query = select(Dataset).options(
        selectinload(Dataset.projects)
    ).where(Dataset.id == dataset_id, Dataset.deleted_at.is_(None))
    
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
                if await verify_password_async(password, project.password_hash):
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
        result = await db.execute(
            select(Dataset)
            .where(Dataset.deleted_at.is_(None))
            .offset(skip)
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(Dataset)
            .where(
                Dataset.owner_id == current_user.id,
                Dataset.deleted_at.is_(None),
            )
            .offset(skip)
            .limit(limit)
        )
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

    if file_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file_type. Allowed: {sorted(ALLOWED_FILE_TYPES)}",
        )

    file_location = f"{UPLOAD_DIR}/{file_hash}.{file_type}" # Use hash for filename to avoid collisions

    # Stream to disk in chunks; enforce MAX_UPLOAD_BYTES; clean up on failure.
    file_size = await _stream_upload_to_disk(
        file, file_location, settings.MAX_UPLOAD_BYTES
    )

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


@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Stream the original uploaded file back to the caller.

    Reuses ``check_dataset_access`` so anyone allowed to view the dataset
    (owner, sharee, public/password-protected project) can also download it.
    The file is served as an ``attachment`` so browsers prompt to save rather
    than rendering. The on-disk filename is the content hash, so we substitute
    the user-friendly ``dataset.name`` for the download.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)

    file_path = dataset.file_path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Original file is no longer available on disk",
        )

    # Build a safe download filename from the dataset's display name and the
    # known file_type extension. Strip path separators / trailing dots that
    # could let a renamed dataset escape the attachment hint.
    safe_stem = (dataset.name or "dataset").strip().replace("/", "_").replace("\\", "_")
    safe_stem = safe_stem.strip(". ") or "dataset"
    suggested = f"{safe_stem}.{dataset.file_type}"

    return FileResponse(
        path=file_path,
        filename=suggested,
        media_type="application/octet-stream",
    )


@router.post("/{dataset_id}/replace", response_model=DatasetSchema)
async def replace_dataset_file(
    dataset_id: UUID,
    file_hash: str = Form(...),
    file: UploadFile = File(...),
    file_type: Optional[str] = Form(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Replace the underlying file of an existing dataset and re-trigger conversion.

    Only the dataset owner (or a superuser) may replace. This preserves the
    dataset row, its id, all project links and shares — only the bytes change.

    Implementation notes:
    - We never mutate a shared ``DataFile`` in place; that row may back other
      users' datasets via hash deduplication. Instead we rebind this dataset
      to a fresh (or already-existing) ``DataFile``.
    - If the previous DataFile becomes orphaned (zero referencing datasets),
      its physical files and converted store are cleaned up here. Restoring
      from trash on a different dataset that shared the hash is unaffected.
    - Status flips back to ``pending`` and a new conversion is enqueued.
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if dataset.deleted_at is not None:
        raise HTTPException(
            status_code=400,
            detail="Cannot replace a trashed dataset; restore it first",
        )

    effective_type = (file_type or dataset.file_type or "").lower()
    if effective_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file_type. Allowed: {sorted(ALLOWED_FILE_TYPES)}",
        )

    old_data_file_id = dataset.data_file_id
    old_converted_path = dataset.converted_path

    # Look for an existing DataFile with this hash so re-uploads of an already
    # known blob short-circuit the upload + reconversion.
    existing_res = await db.execute(
        select(DataFile).where(DataFile.file_hash == file_hash)
    )
    existing = existing_res.scalars().first()

    if existing:
        # Drain the upload stream so the client's request body is consumed,
        # but discard the bytes — we already have them on disk.
        try:
            while await file.read(UPLOAD_CHUNK_SIZE):
                pass
        except Exception:
            pass

        new_data_file = existing
        new_file_path = existing.file_path
        new_file_size = existing.file_size
        new_status = existing.status
        new_converted_path = existing.converted_path
        new_converted_size = existing.converted_size
        trigger_processing = existing.status not in {"completed", "ready"}
    else:
        new_file_location = f"{UPLOAD_DIR}/{file_hash}.{effective_type}"
        new_file_size = await _stream_upload_to_disk(
            file, new_file_location, settings.MAX_UPLOAD_BYTES
        )
        new_data_file = DataFile(
            file_hash=file_hash,
            file_path=new_file_location,
            file_size=new_file_size,
            status="pending",
        )
        db.add(new_data_file)
        await db.commit()
        await db.refresh(new_data_file)
        new_file_path = new_file_location
        new_status = "pending"
        new_converted_path = None
        new_converted_size = 0
        trigger_processing = True

    # Rebind this dataset to the new DataFile.
    dataset.data_file_id = new_data_file.id
    dataset.file_type = effective_type
    dataset.file_path = new_file_path
    dataset.file_size = new_file_size
    dataset.status = new_status
    dataset.failure_reason = None
    dataset.converted_path = new_converted_path
    dataset.converted_size = new_converted_size
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # Garbage-collect the previous DataFile if nothing else references it.
    if old_data_file_id and old_data_file_id != new_data_file.id:
        ref_res = await db.execute(
            select(func.count(Dataset.id)).where(Dataset.data_file_id == old_data_file_id)
        )
        if (ref_res.scalar() or 0) == 0:
            old_df_res = await db.execute(
                select(DataFile).where(DataFile.id == old_data_file_id)
            )
            old_df = old_df_res.scalars().first()
            if old_df:
                if old_df.file_path and os.path.exists(old_df.file_path):
                    try:
                        os.remove(old_df.file_path)
                    except Exception:
                        logger.exception("Error removing old file %s", old_df.file_path)
                if old_df.converted_path and os.path.exists(old_df.converted_path):
                    try:
                        if os.path.isdir(old_df.converted_path):
                            shutil.rmtree(old_df.converted_path)
                        else:
                            os.remove(old_df.converted_path)
                    except Exception:
                        logger.exception(
                            "Error removing old converted store %s",
                            old_df.converted_path,
                        )
                await db.delete(old_df)
                await db.commit()
        if old_converted_path:
            zarr_cache.invalidate(old_converted_path)

    if trigger_processing:
        process_dataset.delay(dataset.id, new_file_path)

    return dataset


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

@router.get("/trash", response_model=List[DatasetSchema])
async def list_trashed_datasets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List the current user's soft-deleted datasets, newest deletions first.

    Mounted before the parameterized routes so the literal "trash" path is not
    swallowed by ``/{dataset_id}``.
    """
    base = select(Dataset).where(Dataset.deleted_at.is_not(None))
    if not current_user.is_superuser:
        base = base.where(Dataset.owner_id == current_user.id)
    result = await db.execute(base.order_by(Dataset.deleted_at.desc()))
    return result.scalars().all()


@router.delete("/{dataset_id}", response_model=DatasetSchema)
async def delete_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Soft-delete a dataset.

    Sets ``deleted_at`` and hides the dataset from default queries. The
    physical files and any DataFile reference are kept until ``/purge`` is
    called or the trash is emptied — restoring is fast because nothing on
    disk has been touched.
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    if dataset.deleted_at is not None:
        # Already trashed — idempotent.
        return dataset

    from datetime import datetime, timezone as _tz
    dataset.deleted_at = datetime.now(_tz.utc)  # type: ignore[assignment]
    db.add(dataset)
    await record_audit(
        db,
        actor=current_user,
        action="dataset.trash",
        resource_type="dataset",
        resource_id=dataset.id,
        extra={"name": dataset.name},
    )
    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.post("/{dataset_id}/restore", response_model=DatasetSchema)
async def restore_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Restore a soft-deleted dataset back into the user's active list."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if dataset.deleted_at is None:
        return dataset
    dataset.deleted_at = None  # type: ignore[assignment]
    db.add(dataset)
    await record_audit(
        db,
        actor=current_user,
        action="dataset.restore",
        resource_type="dataset",
        resource_id=dataset.id,
        extra={"name": dataset.name},
    )
    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.delete("/{dataset_id}/purge", response_model=DatasetSchema)
async def purge_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Permanently delete a dataset and its physical files.

    The dataset must already be in the trash (``deleted_at`` set). This is
    the irreversible step — once the row and files are gone, nothing can be
    restored.
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not current_user.is_superuser and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if dataset.deleted_at is None:
        raise HTTPException(
            status_code=400,
            detail="Dataset must be in the trash before it can be purged",
        )

    data_file_id = dataset.data_file_id

    # Capture file paths up-front; we still need them after the row is deleted.
    legacy_file_path = dataset.file_path
    legacy_converted_path = dataset.converted_path
    purged_name = dataset.name
    purged_id = dataset.id

    await db.delete(dataset)
    await record_audit(
        db,
        actor=current_user,
        action="dataset.purge",
        resource_type="dataset",
        resource_id=purged_id,
        extra={"name": purged_name},
    )
    await db.commit()

    if data_file_id:
        ref_count_res = await db.execute(
            select(func.count(Dataset.id)).where(Dataset.data_file_id == data_file_id)
        )
        ref_count = ref_count_res.scalar()
        if ref_count == 0:
            df_res = await db.execute(select(DataFile).where(DataFile.id == data_file_id))
            data_file = df_res.scalars().first()
            if data_file:
                if data_file.file_path and os.path.exists(data_file.file_path):
                    try:
                        os.remove(data_file.file_path)
                    except Exception:
                        logger.exception("Error deleting file %s", data_file.file_path)
                if data_file.converted_path and os.path.exists(data_file.converted_path):
                    try:
                        if os.path.isdir(data_file.converted_path):
                            shutil.rmtree(data_file.converted_path)
                        else:
                            os.remove(data_file.converted_path)
                    except Exception:
                        logger.exception(
                            "Error deleting converted file %s", data_file.converted_path
                        )
                await db.delete(data_file)
                await db.commit()
    else:
        # Legacy datasets that predate the DataFile table own their paths
        # directly. Best-effort cleanup; missing files are not an error.
        if legacy_file_path and os.path.exists(legacy_file_path):
            try:
                os.remove(legacy_file_path)
            except Exception:
                logger.exception("Error deleting file %s", legacy_file_path)
        if legacy_converted_path and os.path.exists(legacy_converted_path):
            try:
                if os.path.isdir(legacy_converted_path):
                    shutil.rmtree(legacy_converted_path)
                else:
                    os.remove(legacy_converted_path)
            except Exception:
                logger.exception(
                    "Error deleting converted file %s", legacy_converted_path
                )

    if legacy_converted_path:
        zarr_cache.invalidate(legacy_converted_path)

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
        return load_metadata(dataset.converted_path) or {}
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
        z = cast(zarr.Group, open_zarr(dataset.converted_path))
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
        z = cast(zarr.Group, open_zarr(dataset.converted_path))

        # Prefer the precomputed gene-name list from the sidecar — avoids a
        # full var/_index decode on every keystroke of the gene-search bar.
        cached_index = load_gene_index(dataset.converted_path)
        if cached_index is not None:
            all_gene_names = list(cached_index.keys())
        else:
            var_obj: Any = z['var'] if 'var' in cast(MutableMapping, z) else None
            if var_obj is None or '_index' not in var_obj:
                return []
            var_group = cast(zarr.Group, var_obj)
            index_arr = cast(zarr.Array, var_group['_index'])
            all_genes_arr = cast(np.ndarray, index_arr[:])
            if all_genes_arr.dtype.kind in ('S', 'U'):
                all_genes_arr = all_genes_arr.astype(str)
            all_gene_names = all_genes_arr.tolist()

        if query:
            q = query.lower()
            matches = [g for g in all_gene_names if q in g.lower()]
        else:
            matches = list(all_gene_names)

        # Search in Regulons (obsm) — they're searchable as gene-like names
        if 'obsm' in cast(MutableMapping, z):
            obsm_group = z['obsm']
            if isinstance(obsm_group, zarr.Group):
                for reg_key in ["RegulonsAUC", "MotifRegulonsAUC", "TrackRegulonsAUC"]:
                    if reg_key in obsm_group:
                        try:
                            obj = obsm_group[reg_key]
                            reg_names: list = []

                            if isinstance(obj, zarr.Array) and hasattr(obj.dtype, 'names') and obj.dtype.names:
                                reg_names = list(obj.dtype.names)
                            elif isinstance(obj, zarr.Group):
                                reg_names = [k for k in obj.keys() if k != '_index' and not k.startswith('__')]

                            if reg_names:
                                if query:
                                    matches.extend([r for r in reg_names if query in r.lower()])
                                else:
                                    matches.extend(reg_names)
                        except Exception:
                            logger.exception("Error searching regulons in %s", reg_key)

        return matches[:limit]
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
        z = cast(zarr.Group, open_zarr(dataset.converted_path))
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

        # 2. Clusterings from MetaData (cached parse)
        meta_json = load_metadata(dataset.converted_path)
        if meta_json and 'clusterings' in meta_json:
            for c in meta_json['clusterings']:
                features.append({"name": f"Clustering: {c['name']}", "type": "categorical"})

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

    path = dataset.converted_path

    # Browser-side cache key: a gene's expression for a particular dataset
    # version is immutable. Tag the response with the dataset's updated_at
    # so a reconvert busts the cache automatically.
    version = dataset.updated_at or dataset.created_at
    etag = f'"{dataset.id}-{int(version.timestamp()) if version else 0}-{gene}"'
    headers = {
        "Cache-Control": "private, max-age=86400, immutable",
        "ETag": etag,
    }

    try:
        idx = find_gene_index(path, gene)
        if idx >= 0:
            payload = await run_in_threadpool(_read_expression_column, path, idx)
            return Response(
                content=payload,
                media_type="application/octet-stream",
                headers=headers,
            )

        regulon = await run_in_threadpool(_read_regulon_expression, path, gene)
        if regulon is not None:
            return Response(
                content=regulon,
                media_type="application/octet-stream",
                headers=headers,
            )

        raise HTTPException(status_code=404, detail="Gene or Regulon not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("expression read failed for %s / %s", dataset_id, gene)
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
    Get values for a specific feature.

    Continuous-numeric features (library size, regulons, gene expression,
    numeric obs columns) are returned as a raw ``application/octet-stream``
    of float32 little-endian bytes — the client decodes with
    ``new Float32Array(buffer)``. This avoids JSON-encoding millions of
    floats per request.

    Categorical / string features are returned as a JSON list.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)

    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")

    def _numeric_response(values: np.ndarray) -> Response:
        return Response(
            content=np.ascontiguousarray(values, dtype=np.float32).tobytes(),
            media_type="application/octet-stream",
        )

    try:
        z = cast(zarr.Group, open_zarr(dataset.converted_path))
        
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
                            return _numeric_response(lib_size)

                # Case 2: obs is an array (structured array)
                elif isinstance(obs, zarr.Array):
                    if obs.dtype.names:
                        for key in keys_to_check:
                            if key in obs.dtype.names:
                                obs_data = cast(np.ndarray, obs[:])
                                lib_size = cast(np.ndarray, obs_data[key])
                                return _numeric_response(lib_size)

            raise HTTPException(status_code=404, detail="Library size not found in dataset")

        # Handle Regulons
        if feature.startswith("Regulon: "):
            regulon_name = feature.replace("Regulon: ", "")
            if 'obs' in cast(MutableMapping, z):
                obs_group = z['obs']
                if isinstance(obs_group, zarr.Group) and 'RegulonsAUC' in cast(MutableMapping, obs_group):
                    regulons_arr = cast(zarr.Array, obs_group['RegulonsAUC'])
                    if regulons_arr.dtype.names and regulon_name in regulons_arr.dtype.names:
                        regulons_data = cast(np.ndarray, regulons_arr[:])
                        values = cast(np.ndarray, regulons_data[regulon_name])
                        return _numeric_response(values)
                    else:
                        raise HTTPException(status_code=404, detail=f"Regulon {regulon_name} not found")

            raise HTTPException(status_code=404, detail="Regulons data not found")

        # Handle Clusterings
        if feature.startswith("Clustering: "):
            clustering_name = feature.replace("Clustering: ", "")

            meta_json = load_metadata(dataset.converted_path)
            if not meta_json:
                raise HTTPException(status_code=404, detail="Metadata not found")

            # Find clustering ID
            clustering_id = None
            clusters_map: dict = {}
            if 'clusterings' in meta_json:
                for c in meta_json['clusterings']:
                    if c['name'] == clustering_name:
                        clustering_id = str(c['id'])
                        for cluster in c['clusters']:
                            clusters_map[cluster['id']] = cluster['description']
                        break

            if clustering_id is None or 'obs' not in cast(MutableMapping, z):
                raise HTTPException(status_code=404, detail="Clustering data not found")

            obs_group = z['obs']
            if not (isinstance(obs_group, zarr.Group) and 'Clusterings' in cast(MutableMapping, obs_group)):
                raise HTTPException(status_code=404, detail="Clustering data not found")

            clusterings_arr = cast(zarr.Array, obs_group['Clusterings'])
            if not (clusterings_arr.dtype.names and clustering_id in clusterings_arr.dtype.names):
                raise HTTPException(status_code=404, detail=f"Clustering ID {clustering_id} not found in data")

            clusterings_data = cast(np.ndarray, clusterings_arr[:])
            codes = cast(np.ndarray, clusterings_data[clustering_id])

            # Vectorised lookup via numpy object array
            max_id = int(codes.max()) if codes.size else 0
            lookup = np.empty(max_id + 1, dtype=object)
            for k, v in clusters_map.items():
                if 0 <= k <= max_id:
                    lookup[k] = v
            values = lookup[codes]
            return [v if v is not None else "Unknown" for v in values]

        # Handle Genes — translate name → column index using the cached
        # sidecar when available, falling back to a var/_index scan otherwise.
        gene_index = find_gene_index(dataset.converted_path, feature)

        if gene_index == -1 and 'var' in cast(MutableMapping, z):
            # Last-ditch fallback: some legacy stores keep the name list under
            # var/Gene rather than var/_index.
            var_group = z['var']
            if isinstance(var_group, zarr.Group) and 'Gene' in var_group:
                gene_col = cast(zarr.Array, var_group['Gene'])
                genes = cast(np.ndarray, gene_col[:])
                if genes.dtype.kind == 'S':
                    genes = genes.astype(str)
                matches = np.where(genes == feature)[0]
                if len(matches) > 0:
                    gene_index = int(matches[0])

        if gene_index != -1:
            # Get expression data
            if 'X' in cast(MutableMapping, z):
                x_obj = z['X']
                if isinstance(x_obj, zarr.Array):
                    # Dense (cells, genes) — single column read
                    return _numeric_response(cast(np.ndarray, x_obj[:, gene_index]))
                elif isinstance(x_obj, zarr.Group):
                    encoding = x_obj.attrs.get('encoding-type')
                    if encoding == 'csc_matrix':
                        indptr = cast(zarr.Array, x_obj['indptr'])
                        start = int(cast(Any, indptr[gene_index]).item())
                        end = int(cast(Any, indptr[gene_index + 1]).item())

                        data = cast(zarr.Array, x_obj['data'])
                        indices = cast(zarr.Array, x_obj['indices'])
                        col_data = cast(np.ndarray, data[start:end])
                        col_indices = cast(np.ndarray, indices[start:end])

                        # Determine n_obs from store shape attrs or fall back
                        n_obs = 0
                        shape_attr = x_obj.attrs.get('shape')
                        if shape_attr is not None:
                            n_obs = int(shape_attr[0])
                        elif 'n_obs' in z.attrs:
                            n_obs = int(z.attrs['n_obs'])
                        elif 'obs' in cast(MutableMapping, z):
                            obs_group = z['obs']
                            if isinstance(obs_group, zarr.Group) and 'index' in obs_group:
                                n_obs = cast(zarr.Array, obs_group['index']).shape[0]

                        res = np.zeros(n_obs, dtype=np.float32)
                        res[col_indices] = col_data
                        return _numeric_response(res)

                    elif encoding == 'csr_matrix':
                        raise HTTPException(status_code=501, detail="CSR matrix slicing for genes not yet optimized")

        # Handle regular features (obs columns)
        if 'obs' in cast(MutableMapping, z):
            obs_obj = z['obs']
            if isinstance(obs_obj, zarr.Group):
                obs_map = cast(MutableMapping, obs_obj)
                if feature in obs_map:
                    obj = obs_map[feature]

                    if isinstance(obj, zarr.Group):
                        # Categorical (AnnData format)
                        if 'codes' in cast(MutableMapping, obj) and 'categories' in cast(MutableMapping, obj):
                            codes_arr = cast(zarr.Array, obj['codes'])
                            cats_arr = cast(zarr.Array, obj['categories'])
                            codes = cast(np.ndarray, codes_arr[:])
                            cats = cast(np.ndarray, cats_arr[:])

                            if cats.dtype.kind == 'S':
                                cats = cats.astype(str)

                            if codes.min() >= 0:
                                values = cats[codes]
                                return values.tolist()
                            res = np.empty(codes.shape, dtype=object)
                            mask = codes >= 0
                            res[mask] = cats[codes[mask]]
                            res[~mask] = cast(Any, None)
                            return res.tolist()
                        return []

                    # Regular array
                    arr = cast(zarr.Array, obj)
                    values = cast(np.ndarray, arr[:])
                    # Numeric → octet-stream; strings → JSON
                    if values.dtype.kind in ('f', 'i', 'u', 'b'):
                        return _numeric_response(values)
                    if values.dtype.kind == 'S':
                        values = values.astype(str)
                    return values.tolist()

                raise HTTPException(status_code=404, detail="Feature not found")
            raise HTTPException(status_code=404, detail="Feature not found")
        raise HTTPException(status_code=404, detail="Feature not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error reading feature %s", feature)
        raise HTTPException(status_code=500, detail=f"Error reading feature: {str(e)}")
