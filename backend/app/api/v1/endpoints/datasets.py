import asyncio
import hashlib
import shutil
import os
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, List, Optional
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, Request, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
import numpy as np
from uuid import UUID, uuid4
from fastapi.responses import JSONResponse, Response, FileResponse
from starlette.background import BackgroundTask

from app.api import deps
from app.models.user import User
from app.models.dataset import Dataset
from app.models.data_file import DataFile
from app.models.project import Project, ProjectVisibility, ProjectShare, project_dataset
from app.models.group import GroupMember
from app.schemas.dataset import (
    Dataset as DatasetSchema,
    DatasetCreate,
    DatasetUpdate,
    DatasetListItem,
    DatasetListResponse,
    DatasetProjectRef,
    TrashedDataset,
)
from app.worker import process_dataset
from app.core.config import settings
from app.core.security import verify_password_async
from app.services.permissions import get_user_project_permission
from app.services.audit import record_audit
from app.services.dataset_purge import purge_dataset_completely
from app.services import upload_registry, upload_session
from app.utils import soma_cache, soma_reader
from app.utils.soma_cache import find_gene_index

router = APIRouter()

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"


# ---------------------------------------------------------------------------
# Hot-path cache for gene expression columns.
#
# The viewer hammers /expression/{gene} every time the user picks a gene; for
# a large SOMA store the first sparse-column read off disk has real latency.
# Once decoded the bytes are tiny (n_cells × 4) and immutable until the dataset
# is reconverted, so a small process-local LRU pays for itself within the first
# repeat click.
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
    """Read one gene's column across all cells from the SOMA store → float32
    bytes. Runs in a threadpool; result cached by (path, idx)."""
    cached = _expression_cache_get((path, idx))
    if cached is not None:
        return cached
    payload = soma_reader.read_expression_column(path, idx)
    _expression_cache_put((path, idx), payload)
    return payload


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
    except BaseException:
        # Best-effort cleanup of the partial file. Catch BaseException (not just
        # Exception) so a request cancelled mid-upload — a client/proxy
        # disconnect raises asyncio.CancelledError — doesn't leave a partial file.
        try:
            if os.path.exists(destination):
                os.remove(destination)
        except OSError:
            pass
        raise
    return total


async def _stream_request_body_to_disk(
    request: Request,
    destination: str,
    max_bytes: int,
    progress_cb: Optional[Callable[[int], Any]] = None,
) -> "tuple[int, str]":
    """Stream the raw request body to `destination`. Returns (bytes, md5_hex).

    Unlike multipart/form-data (which makes Starlette spool the whole upload to a
    temp file before the handler even runs — doubling disk use and buffering
    100 GB+ files through the temp dir), this consumes ``request.stream()``
    directly, writing to disk in constant memory. Aborts with 413 past
    `max_bytes`; cleans up the partial file on any failure/cancellation.

    The MD5 is computed over the bytes as they stream (free — we already touch
    every byte), so the SERVER, not the client, decides the file's content hash.
    ``progress_cb`` (async) is invoked with the running byte total, throttled to
    ~once a second. A failing callback never interrupts the upload.
    """
    total = 0
    hasher = hashlib.md5()
    last_emit = time.monotonic()
    try:
        async with aiofiles.open(destination, "wb") as out:
            async for chunk in request.stream():
                if not chunk:
                    continue
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Upload exceeds maximum allowed size of {max_bytes} bytes",
                    )
                hasher.update(chunk)
                await out.write(chunk)
                if progress_cb is not None and (time.monotonic() - last_emit) >= 1.0:
                    last_emit = time.monotonic()
                    try:
                        await progress_cb(total)
                    except Exception:  # noqa: BLE001
                        pass
    except BaseException:
        try:
            if os.path.exists(destination):
                os.remove(destination)
        except OSError:
            pass
        raise
    return total, hasher.hexdigest()

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

_SORT_COLUMNS = {
    "name": Dataset.name,
    "created_at": Dataset.created_at,
    "file_size": Dataset.file_size,
    "status": Dataset.status,
}


def _visibility_value(v: Any) -> str:
    """ProjectVisibility may be stored as a str or an enum; normalize to str."""
    return getattr(v, "value", v)


@router.get("/", response_model=DatasetListResponse)
async def read_datasets(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve the caller's datasets (superusers see all), with server-side
    search, status filter, sorting, and pagination so the list scales to
    hundreds/thousands of datasets. Each row includes its owning project(s),
    who it is shared with, size, and dates — no per-row follow-up requests.
    """
    base = select(Dataset).where(Dataset.deleted_at.is_(None))
    count_q = select(func.count(Dataset.id)).where(Dataset.deleted_at.is_(None))

    if not current_user.is_superuser:
        base = base.where(Dataset.owner_id == current_user.id)
        count_q = count_q.where(Dataset.owner_id == current_user.id)

    if search and search.strip():
        like = f"%{search.strip()}%"
        cond = or_(Dataset.name.ilike(like), Dataset.description.ilike(like))
        base = base.where(cond)
        count_q = count_q.where(cond)

    if status:
        base = base.where(Dataset.status == status)
        count_q = count_q.where(Dataset.status == status)

    sort_col = _SORT_COLUMNS.get(sort_by, Dataset.created_at)
    base = base.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    # Eager-load projects + their shares (with user/group) so we can render the
    # "project" and "shared with" columns without N+1 queries. Bounded by limit.
    base = base.options(
        selectinload(Dataset.projects).selectinload(Project.shares).joinedload(ProjectShare.user),
        selectinload(Dataset.projects).selectinload(Project.shares).joinedload(ProjectShare.group),
    ).offset(skip).limit(limit)

    total = await db.scalar(count_q)
    rows = (await db.execute(base)).scalars().unique().all()

    items: list[DatasetListItem] = []
    for ds in rows:
        proj_refs: list[DatasetProjectRef] = []
        shared: set[str] = set()
        highest = "private"
        for p in ds.projects:
            vis = _visibility_value(p.visibility)
            proj_refs.append(DatasetProjectRef(id=p.id, name=p.name, visibility=vis))
            if vis == "public":
                highest = "public"
                shared.add("Public")
            elif vis == "password" and highest != "public":
                highest = "password"
            for sh in p.shares:
                if sh.user is not None:
                    shared.add(sh.user.email)
                elif sh.group is not None:
                    shared.add(sh.group.name)
        items.append(
            DatasetListItem(
                id=ds.id,
                name=ds.name,
                description=ds.description,
                file_type=ds.file_type,
                status=ds.status,
                failure_reason=ds.failure_reason,
                file_size=ds.file_size,
                converted_size=ds.converted_size,
                created_at=ds.created_at,
                updated_at=ds.updated_at,
                projects=proj_refs,
                shared_with=sorted(shared),
                visibility=highest,
            )
        )

    return DatasetListResponse(items=items, total=total or 0)

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

async def _link_existing_datafile(
    db: AsyncSession,
    data_file: DataFile,
    *,
    name: str,
    description: Optional[str],
    file_type: str,
    current_user: User,
) -> Dataset:
    """Create a Dataset linked to an already-stored DataFile (de-dup path).

    Shared by the single-shot and chunked-init endpoints: when the content hash
    is already on disk, no bytes need to be uploaded — just link a new Dataset
    (re-triggering conversion if the stored file was never converted). Raises 400
    if the user already has an active dataset for this file.
    """
    existing_link = await db.execute(
        select(Dataset).where(
            Dataset.owner_id == current_user.id,
            Dataset.data_file_id == data_file.id,
            Dataset.deleted_at.is_(None),
        )
    )
    if existing_link.scalars().first():
        raise HTTPException(status_code=400, detail="You have already uploaded this dataset.")

    dataset = Dataset(
        name=name,
        description=description,
        file_type=file_type,
        owner_id=current_user.id,
        status=data_file.status,
        data_file_id=data_file.id,
        file_path=data_file.file_path,
        file_size=data_file.file_size,
        converted_path=data_file.converted_path,
        converted_size=data_file.converted_size,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    await record_audit(
        db, actor=current_user, action="dataset.create",
        resource_type="dataset", resource_id=dataset.id,
        extra={"name": dataset.name, "file_type": file_type, "deduped": True},
    )
    await db.commit()
    logger.info(
        "Linked dataset %s to existing file (hash=%s, status=%s, dedup) for user %s",
        dataset.id, data_file.file_hash, data_file.status, current_user.id,
    )
    if (data_file.status or "pending") in ("pending", "failed"):
        process_dataset.delay(str(dataset.id), data_file.file_path)
        logger.info("Linked file is %s — enqueued conversion for dataset %s", data_file.status, dataset.id)
    return dataset


async def _persist_uploaded_dataset(
    db: AsyncSession,
    *,
    name: str,
    description: Optional[str],
    file_type: str,
    file_hash: str,
    file_location: str,
    file_size: int,
    owner_id: Any,
    current_user: User,
    file_preexisted: bool = False,
) -> Dataset:
    """Persist DataFile + Dataset for freshly-uploaded bytes already on disk.

    Shared by the single-shot upload and the chunked ``/complete`` endpoint. The
    bytes are at ``file_location``; on any failure (including a cancelled request)
    a genuine orphan file is removed. Handles the concurrent-dedup unique(hash)
    race, the non-fatal audit (refreshing ``current_user`` first, since a prior
    rollback expired it), and enqueues conversion. Returns the committed Dataset.

    ``file_preexisted`` = the content file was already on disk (same content hash
    from a prior upload) and we did NOT create it, so it must never be deleted on
    failure — it may be owned by another DataFile.
    """
    file_has_owner = False  # a DataFile row references file_location
    try:
        data_file = DataFile(
            file_hash=file_hash,
            file_path=file_location,
            file_size=file_size,
            status="pending",
        )
        db.add(data_file)
        try:
            await db.commit()
            await db.refresh(data_file)
            file_has_owner = True
        except IntegrityError:
            # A concurrent upload of the same bytes won the unique(file_hash)
            # race. Reuse its DataFile — our on-disk copy is identical bytes at
            # the same path, so it's now owned by that row; keep the file.
            await db.rollback()
            existing = await db.execute(
                select(DataFile).where(DataFile.file_hash == file_hash)
            )
            data_file = existing.scalars().first()
            if data_file is None:
                raise
            file_has_owner = True

        dataset = Dataset(
            name=name,
            description=description,
            file_type=file_type,
            owner_id=owner_id,
            data_file_id=data_file.id,
            status=data_file.status or "pending",
            file_path=data_file.file_path,
            file_size=data_file.file_size,
            converted_path=data_file.converted_path,
            converted_size=data_file.converted_size,
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)
    except BaseException:
        logger.exception(
            "Upload streamed to %s but persisting the dataset failed/was cancelled.",
            file_location,
        )
        # Remove a genuine orphan we created — but never a file that already
        # existed (it may hold another DataFile's content) or one now owned by a
        # DataFile row (the concurrent-dedup winner's).
        if not file_has_owner and not file_preexisted:
            try:
                os.remove(file_location)
            except OSError:
                pass
        raise

    # Audit is non-fatal: the dataset is already committed and visible.
    try:
        await db.refresh(current_user)
        await record_audit(
            db, actor=current_user, action="dataset.create",
            resource_type="dataset", resource_id=dataset.id,
            extra={"name": dataset.name, "file_type": file_type, "file_size": file_size},
        )
        await db.commit()
    except Exception:
        logger.warning("Audit log for dataset %s failed (non-fatal)", dataset.id, exc_info=True)

    logger.info(
        "Created dataset %s (data_file=%s, %d bytes) for user %s",
        dataset.id, dataset.data_file_id, file_size, owner_id,
    )
    process_dataset.delay(str(dataset.id), file_location)
    logger.info("Enqueued conversion task for dataset %s", dataset.id)
    return dataset


@router.post("/", response_model=DatasetSchema)
async def create_dataset(
    request: Request,
    name: str = Query(..., description="Display name for the dataset"),
    file_type: str = Query(..., description="loom | h5ad | csv"),
    file_hash: str = Query(..., description="MD5 of the file, used for de-duplication"),
    description: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a dataset by streaming the file as the raw request body.

    Metadata is passed as query params; the body is the raw file bytes
    (``application/octet-stream``). This streams straight to disk in constant
    memory — multipart/form-data would instead make Starlette spool the entire
    file to a temp dir first, doubling disk use and making 100 GB+ uploads
    impractical.

    If ``file_hash`` already exists, links to the stored file (no body needed).
    """
    logger.info(
        "Dataset upload request: user=%s name=%r file_type=%s hash=%s declared_bytes=%s",
        current_user.id, name, file_type, file_hash,
        request.headers.get("content-length") or "?",
    )

    # Check if DataFile exists
    result = await db.execute(select(DataFile).where(DataFile.file_hash == file_hash))
    data_file = result.scalars().first()

    if data_file:
        # Content hash already on disk — link a new Dataset, no upload needed.
        return await _link_existing_datafile(
            db, data_file, name=name, description=description,
            file_type=file_type, current_user=current_user,
        )

    # New Upload
    if file_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file_type. Allowed: {sorted(ALLOWED_FILE_TYPES)}",
        )

    # Capture the owner id as a plain value BEFORE the rollback below: rollback()
    # EXPIRES every ORM object in the session, so reading current_user.id after
    # the (possibly multi-minute) upload would trigger a lazy reload — which is
    # illegal in async SQLAlchemy (MissingGreenlet) and 500s the whole request
    # after the bytes are already on disk.
    owner_id = current_user.id
    owner_email = current_user.email  # captured before rollback for the upload registry

    # Release the read transaction opened by the de-dup SELECT above before the
    # (potentially very long) upload. Otherwise the connection sits "idle in
    # transaction" for the whole stream and can be reclaimed by the pool / killed
    # by Postgres' idle_in_transaction_session_timeout, making the post-upload
    # commit fail.
    await db.rollback()

    # Stream to a UNIQUE temp file. The authoritative content hash — and the
    # final filename — is computed by the SERVER from the bytes as they stream,
    # NOT trusted from the client (whose `file_hash` is only the de-dup
    # pre-check). The ".part" suffix gets the temp swept if abandoned and ignored
    # by the admin orphan scan.
    upload_id = uuid4().hex
    temp_location = f"{UPLOAD_DIR}/{upload_id}.{file_type}.part"

    # Register the in-flight upload so admins can watch progress (both browser
    # and API uploads hit this path). Best-effort telemetry — never fatal.
    try:
        total_bytes = int(request.headers.get("content-length") or 0)
    except (TypeError, ValueError):
        total_bytes = 0
    await run_in_threadpool(
        upload_registry.register,
        upload_id,
        user_email=owner_email,
        name=name,
        file_type=file_type,
        total_bytes=total_bytes,
    )

    logger.info("Streaming upload body to %s …", temp_location)
    try:
        async def _on_progress(received: int) -> None:
            await run_in_threadpool(upload_registry.update, upload_id, received)

        file_size, server_hash = await _stream_request_body_to_disk(
            request, temp_location, settings.MAX_UPLOAD_BYTES, progress_cb=_on_progress
        )
    finally:
        await run_in_threadpool(upload_registry.finish, upload_id)
    if file_size == 0:
        try:
            os.remove(temp_location)
        except OSError:
            pass
        logger.warning("Upload for hash=%s had an empty body; nothing created.", file_hash)
        raise HTTPException(status_code=400, detail="Request body (file bytes) required for a new upload")

    # Name the stored file by the SERVER-computed hash, and never overwrite an
    # existing one (first-writer-wins): identical content is already there, so we
    # drop our copy and let _persist de-dup-link — this also means a bad/lying
    # upload can't clobber a file already committed under that hash.
    file_location = f"{UPLOAD_DIR}/{server_hash}.{file_type}"
    file_preexisted = os.path.exists(file_location)
    if file_preexisted:
        try:
            os.remove(temp_location)
        except OSError:
            pass
    else:
        try:
            os.replace(temp_location, file_location)
        except OSError as e:
            try:
                os.remove(temp_location)
            except OSError:
                pass
            raise HTTPException(status_code=500, detail=f"Failed to finalize upload: {e}")

    logger.info("Upload complete: %s (%.1f MiB, server hash=%s)", file_location, file_size / (1024 * 1024), server_hash)

    return await _persist_uploaded_dataset(
        db, name=name, description=description, file_type=file_type, file_hash=server_hash,
        file_location=file_location, file_size=file_size, owner_id=owner_id,
        current_user=current_user, file_preexisted=file_preexisted,
    )


# ---------------------------------------------------------------------------
# Chunked / resumable uploads
#
# These coexist with the single-shot POST /datasets/ (curl -T) path above. The
# browser uses them so a dropped connection resumes instead of restarting; CLI
# users can too (scripts/upload_local.py --chunked). Each chunk is its own short
# request, so no single connection lives long enough to hit an intermediary's
# idle/duration cap. The authoritative offset is always the .part file's size.
# ---------------------------------------------------------------------------

# Bound a single chunk so the (in-memory) body read can't be abused; the browser
# sends ~32 MiB chunks.
MAX_CHUNK_BYTES = 128 * 1024 * 1024

# Per-part-file locks serialize concurrent appends within this process. (Single
# backend container in dev/prod; a multi-replica deployment would need a
# distributed lock — the offset check is the correctness backstop regardless.)
_part_locks: "dict[str, asyncio.Lock]" = {}


def _part_lock(path: str) -> asyncio.Lock:
    lock = _part_locks.get(path)
    if lock is None:
        lock = asyncio.Lock()
        _part_locks[path] = lock
    return lock


def _md5_of_file(path: str, block: int = 8 * 1024 * 1024) -> str:
    """Stream a file through MD5 (sync — call via run_in_threadpool)."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(block), b""):
            h.update(chunk)
    return h.hexdigest()


def _part_path_for(owner_id: Any, file_hash: str, file_type: str) -> str:
    # Keyed by OWNER as well as content hash so two users uploading the same
    # file never share one in-flight ``.part`` scratch file — otherwise their
    # chunks would interleave into it and one could corrupt or poison the
    # other's upload. The *committed* file stays hash-keyed (and de-duplicated)
    # via the unique(file_hash) constraint. Same-owner resume still works: a
    # re-init for the same (owner, hash) finds the existing ``.part``.
    return f"{UPLOAD_DIR}/{owner_id}.{file_hash}.{file_type}.part"


@router.post("/upload/init")
async def init_chunked_upload(
    name: str = Query(...),
    file_type: str = Query(..., description="loom | h5ad | csv"),
    file_hash: str = Query(..., description="MD5 of the whole file"),
    total_size: int = Query(..., description="Total file size in bytes"),
    description: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Begin (or resume) a chunked upload.

    If the content hash already exists, links a Dataset immediately
    (``{deduped: true, dataset}``). Otherwise returns ``{upload_id, offset}``
    where ``offset`` is the size of any existing ``.part`` file (so an
    interrupted upload of the same file resumes from where it stopped).
    """
    if file_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file_type. Allowed: {sorted(ALLOWED_FILE_TYPES)}")
    if total_size <= 0:
        raise HTTPException(status_code=400, detail="total_size must be > 0")
    if total_size > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Upload exceeds maximum allowed size of {settings.MAX_UPLOAD_BYTES} bytes")

    # De-dup: if the bytes are already stored, link without uploading.
    result = await db.execute(select(DataFile).where(DataFile.file_hash == file_hash))
    data_file = result.scalars().first()
    if data_file:
        dataset = await _link_existing_datafile(
            db, data_file, name=name, description=description, file_type=file_type, current_user=current_user,
        )
        return {"deduped": True, "dataset": DatasetSchema.model_validate(dataset)}

    owner_id = current_user.id
    owner_email = current_user.email
    part_path = _part_path_for(owner_id, file_hash, file_type)
    offset = os.path.getsize(part_path) if os.path.exists(part_path) else 0

    upload_id = await run_in_threadpool(
        upload_session.create,
        name=name, description=description, file_type=file_type, file_hash=file_hash,
        total_size=total_size, owner_id=owner_id, owner_email=owner_email, part_path=part_path,
    )
    # Surface the in-flight upload to the admin panel too.
    await run_in_threadpool(
        upload_registry.register, upload_id,
        user_email=owner_email, name=name, file_type=file_type, total_bytes=total_size,
    )
    if offset:
        await run_in_threadpool(upload_registry.update, upload_id, offset)

    logger.info("Chunked upload init: id=%s hash=%s type=%s total=%d resume_offset=%d user=%s",
                upload_id, file_hash, file_type, total_size, offset, owner_id)
    return {"deduped": False, "upload_id": upload_id, "offset": offset, "chunk_size": MAX_CHUNK_BYTES // 4}


async def _load_owned_session(upload_id: str, current_user: User) -> dict:
    session = await run_in_threadpool(upload_session.get, upload_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found or expired")
    if session.get("owner_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your upload session")
    return session


@router.get("/upload/{upload_id}")
async def chunked_upload_status(
    upload_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Current byte offset for a chunked upload, so a client can resume."""
    session = await _load_owned_session(upload_id, current_user)
    part_path = session["part_path"]
    offset = os.path.getsize(part_path) if os.path.exists(part_path) else 0
    return {"upload_id": upload_id, "offset": offset, "total_size": session["total_size"]}


@router.patch("/upload/{upload_id}")
async def upload_chunk(
    upload_id: str,
    request: Request,
    upload_offset: int = Header(..., alias="Upload-Offset", description="Byte offset this chunk begins at"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Append one chunk at ``Upload-Offset`` to the upload's ``.part`` file.

    The offset must equal the file's current size (sequential append); a mismatch
    returns 409 with the authoritative offset so the client can re-sync. The
    chunk body is read whole (bounded by MAX_CHUNK_BYTES) and appended only if
    fully received — a mid-chunk disconnect leaves the ``.part`` file untouched,
    so the client safely retries the same offset.
    """
    session = await _load_owned_session(upload_id, current_user)
    part_path = session["part_path"]
    total_size = session["total_size"]

    declared = int(request.headers.get("content-length") or 0)
    if declared > MAX_CHUNK_BYTES:
        raise HTTPException(status_code=413, detail=f"Chunk exceeds {MAX_CHUNK_BYTES} bytes")

    async with _part_lock(part_path):
        current = os.path.getsize(part_path) if os.path.exists(part_path) else 0
        if upload_offset != current:
            raise HTTPException(status_code=409, detail={"message": "Offset mismatch", "offset": current})
        if current + declared > total_size:
            raise HTTPException(status_code=413, detail="Chunk would exceed the declared total size")
        # Read the whole chunk first: if the client disconnects mid-chunk this
        # raises before any write, leaving the .part file at a clean offset.
        body = await request.body()
        if current + len(body) > total_size:
            raise HTTPException(status_code=413, detail="Chunk would exceed the declared total size")
        if body:
            async with aiofiles.open(part_path, "ab") as out:
                await out.write(body)
        new_size = current + len(body)

    await run_in_threadpool(upload_registry.update, upload_id, new_size)
    await run_in_threadpool(upload_session.touch, upload_id)
    return {"offset": new_size, "complete": new_size >= total_size}


@router.post("/upload/{upload_id}/complete", response_model=DatasetSchema)
async def complete_chunked_upload(
    upload_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Finalize a chunked upload: verify size, compute the authoritative content
    hash from the assembled bytes, move the ``.part`` into place, and persist.

    The stored file is named by the SERVER-computed hash (the client's declared
    ``file_hash`` was only a de-dup pre-check), and an existing file under that
    hash is never overwritten — so a bad upload can't clobber stored content.
    """
    session = await _load_owned_session(upload_id, current_user)
    part_path = session["part_path"]
    total_size = session["total_size"]
    file_type = session["file_type"]

    async with _part_lock(part_path):
        current = os.path.getsize(part_path) if os.path.exists(part_path) else 0
        if current != total_size:
            raise HTTPException(status_code=409, detail={"message": "Upload incomplete", "offset": current, "total_size": total_size})

        # Authoritative hash from the assembled bytes (one streamed read). Held
        # under the part lock so a stray concurrent chunk can't mutate the file
        # mid-hash.
        server_hash = await run_in_threadpool(_md5_of_file, part_path)
        file_location = f"{UPLOAD_DIR}/{server_hash}.{file_type}"
        file_preexisted = os.path.exists(file_location)
        try:
            if file_preexisted:
                os.remove(part_path)  # identical content already stored — drop ours
            else:
                os.replace(part_path, file_location)  # atomic on the same filesystem
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Failed to finalize upload: {e}")

    owner_id = current_user.id
    try:
        dataset = await _persist_uploaded_dataset(
            db, name=session["name"], description=(session.get("description") or None),
            file_type=file_type, file_hash=server_hash, file_location=file_location,
            file_size=total_size, owner_id=owner_id, current_user=current_user,
            file_preexisted=file_preexisted,
        )
    finally:
        await run_in_threadpool(upload_session.delete, upload_id)
        await run_in_threadpool(upload_registry.finish, upload_id)
    logger.info("Chunked upload complete: id=%s -> dataset %s (server hash=%s)", upload_id, dataset.id, server_hash)
    return dataset


@router.delete("/upload/{upload_id}")
async def abort_chunked_upload(
    upload_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Abort a chunked upload: delete the partial file and the session."""
    session = await _load_owned_session(upload_id, current_user)
    part_path = session["part_path"]
    try:
        if os.path.exists(part_path):
            os.remove(part_path)
    except OSError:
        pass
    await run_in_threadpool(upload_session.delete, upload_id)
    await run_in_threadpool(upload_registry.finish, upload_id)
    return {"ok": True}


@router.get("/upload-helper")
async def download_upload_helper() -> Any:
    """Download the CLI helper script (``scripts/upload_local.py``).

    Linked from the upload dialog's API instructions so users can grab the
    resumable-chunked uploader directly. Serves the real file on disk (single
    source of truth) as an attachment. Public — the script carries no secrets.
    """
    from pathlib import Path

    # app/api/v1/endpoints/datasets.py -> parents[4] is the backend root ("/app"
    # in the container), where scripts/ lives.
    script = Path(__file__).resolve().parents[4] / "scripts" / "upload_local.py"
    if not script.is_file():
        raise HTTPException(status_code=404, detail="Helper script not found")
    return FileResponse(str(script), media_type="text/x-python", filename="upload_local.py")


@router.get("/events")
async def dataset_events(
    request: Request,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Server-Sent Events stream of the caller's dataset status changes.

    The worker publishes ``{dataset_id, status}`` to a per-user Redis channel as
    conversions progress; this endpoint relays them so the UI updates instantly
    instead of polling. Auth is via the HttpOnly cookie (EventSource sends it
    automatically). Registered before ``/{dataset_id}`` so the literal path
    isn't captured by the UUID route.
    """
    import redis.asyncio as aioredis
    from fastapi.responses import StreamingResponse

    channel = f"scope:ds-events:{current_user.id}"

    async def event_gen():
        client = aioredis.from_url(settings.REDIS_URL)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if msg and msg.get("type") == "message":
                    data = msg["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                else:
                    # Comment line keeps the connection (and proxies) alive.
                    yield ": keepalive\n\n"
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
                await client.aclose()
            except Exception:  # noqa: BLE001
                pass

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


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
            soma_cache.invalidate(old_converted_path)

    if trigger_processing:
        process_dataset.delay(str(dataset.id), new_file_path)
        logger.info("Enqueued reconversion for replaced dataset %s", dataset.id)

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

@router.get("/trash", response_model=List[TrashedDataset])
async def list_trashed_datasets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List the current user's soft-deleted datasets, newest deletions first.

    Each item carries its project linkage and, when orphaned, the date it will
    be auto-purged. A trashed dataset still linked to a project is retained
    (``auto_purge_at`` null) so projects never lose their data.

    Mounted before the parameterized routes so the literal "trash" path is not
    swallowed by ``/{dataset_id}``.
    """
    from datetime import timedelta

    base = (
        select(Dataset)
        .options(selectinload(Dataset.projects))
        .where(Dataset.deleted_at.is_not(None))
    )
    if not current_user.is_superuser:
        base = base.where(Dataset.owner_id == current_user.id)
    rows = (await db.execute(base.order_by(Dataset.deleted_at.desc()))).scalars().unique().all()

    retention = timedelta(days=settings.TRASH_RETENTION_DAYS)
    items: list[TrashedDataset] = []
    for ds in rows:
        proj_refs = [
            DatasetProjectRef(id=p.id, name=p.name, visibility=_visibility_value(p.visibility))
            for p in ds.projects
        ]
        # Linked datasets are retained indefinitely; only orphans auto-purge.
        auto_purge_at = None
        if not proj_refs and ds.deleted_at is not None:
            auto_purge_at = ds.deleted_at + retention
        items.append(
            TrashedDataset(
                id=ds.id,
                name=ds.name,
                description=ds.description,
                file_type=ds.file_type,
                status=ds.status,
                file_size=ds.file_size,
                converted_size=ds.converted_size,
                created_at=ds.created_at,
                deleted_at=ds.deleted_at,
                projects=proj_refs,
                project_count=len(proj_refs),
                auto_purge_at=auto_purge_at,
            )
        )
    return items


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


@router.delete("/{dataset_id}/purge")
async def purge_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Permanently delete a trashed dataset and everything referencing it.

    Admin-only: a purge is irreversible AND may destroy data other users still
    rely on via their projects, so regular users can only soft-delete (trash) /
    restore — they must ask an admin for permanent removal. (Orphaned trash is
    also auto-purged after the retention window by the scheduled task.)

    The dataset must already be in the trash (``deleted_at`` set).
    """
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.deleted_at is None:
        raise HTTPException(
            status_code=400,
            detail="Dataset must be in the trash before it can be purged",
        )

    purged_name = dataset.name
    purged_id = dataset.id

    # Complete purge: row + project links + files + DataFile GC + referencing
    # sessions/notifications + cache (shared with the admin + auto-expire paths).
    summary = await purge_dataset_completely(db, dataset)
    await record_audit(
        db,
        actor=current_user,
        action="dataset.purge",
        resource_type="dataset",
        resource_id=purged_id,
        extra={"name": purged_name, **summary},
    )
    await db.commit()

    return {"status": "purged", "id": str(purged_id), **summary}

@router.get("/{dataset_id}/debug")
async def debug_dataset(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Diagnostics: what the converted SOMA store + sidecars actually contain
    (measurements, obsm keys, obs columns, embeddings resolved for the viewer).
    Useful when the viewer reports 'no embeddings'."""
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    return {
        "id": str(dataset.id),
        "status": dataset.status,
        "converted_format": getattr(dataset, "converted_format", None),
        "converted_path": dataset.converted_path,
        "store": await run_in_threadpool(soma_reader.describe, dataset.converted_path)
        if dataset.converted_path
        else None,
    }


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
        # soma_reader.load_metadata enriches the SCope MetaData sidecar with
        # embeddings discovered from obsm, so generic h5ad/loom uploads (which
        # carry no SCope MetaData blob) still expose embeddings to the viewer.
        return await run_in_threadpool(soma_reader.load_metadata, dataset.converted_path) or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading metadata: {str(e)}")

@router.get("/{dataset_id}/embedding/{embedding_name}")
async def get_dataset_embedding(
    dataset_id: UUID,
    embedding_name: str,
    dims: Optional[str] = None,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get dataset embedding coordinates as interleaved float32 bytes.

    ``dims`` is an optional comma-separated list of dimension indices to return
    in order (e.g. ``0,1,2`` for a 3D plot). Defaults to the first two.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)

    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")

    dim_list = None
    if dims:
        try:
            dim_list = [int(d) for d in dims.split(",") if d.strip() != ""]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dims parameter")

    try:
        payload = await run_in_threadpool(soma_reader.read_embedding, dataset.converted_path, embedding_name, dim_list)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Embedding {embedding_name} not found")
        return Response(content=payload, media_type="application/octet-stream")
    except HTTPException:
        raise
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
        return await run_in_threadpool(soma_reader.search_genes, dataset.converted_path, query, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching genes: {str(e)}")

@router.get("/{dataset_id}/search")
async def search_features(
    dataset_id: UUID,
    query: str = "",
    limit: int = 50,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Generalised, relevance-ordered search across all plottable element types
    (genes, regulons, clusterings, annotations, metrics).

    Returns ``[{"name": str, "type": str}]`` ordered so the best matches (exact
    first) come first regardless of type.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)

    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")

    try:
        return await run_in_threadpool(soma_reader.search, dataset.converted_path, query, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching dataset: {str(e)}")

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
        return await run_in_threadpool(soma_reader.list_features, dataset.converted_path)
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

        regulon = await run_in_threadpool(soma_reader.read_regulon, path, gene)
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

    try:
        return await run_in_threadpool(
            soma_reader.read_feature, dataset.converted_path, feature
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error reading feature %s", feature)
        raise HTTPException(status_code=500, detail=f"Error reading feature: {str(e)}")


@router.get("/{dataset_id}/feature/{feature}/categories")
async def get_feature_categories(
    dataset_id: UUID,
    feature: str,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """List the unique category labels of a categorical feature.

    Powers the viewer's filter-builder autocomplete: returns just the distinct
    labels (sorted, capped) rather than the full per-cell column. Numeric
    features yield an empty list. Longer path than ``/feature/{feature}`` so it
    does not collide with it.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)

    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")

    try:
        return await run_in_threadpool(
            soma_reader.list_categories, dataset.converted_path, feature
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing categories for %s", feature)
        raise HTTPException(status_code=500, detail=f"Error listing categories: {str(e)}")


@router.get("/{dataset_id}/export")
async def export_dataset_h5ad(
    dataset_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Export the converted SOMA store back to an .h5ad download.

    Reuses ``check_dataset_access`` so anyone who can view the dataset can
    export it. The temp file is streamed back and removed afterwards.
    """
    dataset = await check_dataset_access(dataset_id, db, current_user, x_project_password)
    if dataset.status != "ready" or not dataset.converted_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")

    from app.utils.soma_converter import export_soma_to_h5ad

    os.makedirs(os.path.join(UPLOAD_DIR, "exports"), exist_ok=True)
    out_path = os.path.join(UPLOAD_DIR, "exports", f"{dataset.id}.h5ad")
    try:
        await run_in_threadpool(export_soma_to_h5ad, dataset.converted_path, out_path)
    except Exception as e:
        logger.exception("Export failed for %s", dataset_id)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    safe_stem = (dataset.name or "dataset").strip().replace("/", "_").replace("\\", "_").strip(". ") or "dataset"

    def _cleanup(path: str = out_path) -> None:
        try:
            os.remove(path)
        except OSError:
            pass

    return FileResponse(
        path=out_path,
        filename=f"{safe_stem}.h5ad",
        media_type="application/octet-stream",
        background=BackgroundTask(_cleanup),
    )
