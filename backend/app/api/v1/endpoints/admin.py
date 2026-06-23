from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.config import settings
from app.models.data_file import DataFile
from app.models.dataset import Dataset
from app.models.group import Group
from app.models.project import Project
from app.models.session import Session as DbSession
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.audit import record_audit
from app.services.dataset_purge import purge_dataset_completely
from app.utils import soma_cache

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def read_admin_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Headline counters used by the dashboard cards."""
    users_count = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True)))
    admin_users = await db.scalar(select(func.count(User.id)).where(User.is_superuser.is_(True)))
    datasets_count = await db.scalar(select(func.count(Dataset.id)))
    projects_count = await db.scalar(select(func.count(Project.id)))
    groups_count = await db.scalar(select(func.count(Group.id)))
    sessions_count = await db.scalar(select(func.count(DbSession.id)))
    data_files_count = await db.scalar(select(func.count(DataFile.id)))

    status_rows = (await db.execute(
        select(Dataset.status, func.count(Dataset.id)).group_by(Dataset.status)
    )).all()
    dataset_status: dict[str, int] = {status or "unknown": count for status, count in status_rows}

    total_uploaded = await db.scalar(select(func.coalesce(func.sum(Dataset.file_size), 0)))
    total_converted = await db.scalar(select(func.coalesce(func.sum(Dataset.converted_size), 0)))

    return {
        "total_users": users_count or 0,
        "active_users": active_users or 0,
        "admin_users": admin_users or 0,
        "total_datasets": datasets_count or 0,
        "total_projects": projects_count or 0,
        "total_groups": groups_count or 0,
        "total_sessions": sessions_count or 0,
        "total_data_files": data_files_count or 0,
        "dataset_status_counts": dataset_status,
        "total_uploaded_bytes": int(total_uploaded or 0),
        "total_converted_bytes": int(total_converted or 0),
        "system_status": "Healthy",
    }


@router.get("/disk-usage")
async def read_disk_usage(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Per-user storage breakdown."""
    stmt = (
        select(
            User.id,
            User.email,
            User.full_name,
            func.sum(func.coalesce(Dataset.file_size, 0)).label("total_uploaded"),
            func.sum(func.coalesce(Dataset.converted_size, 0)).label("total_converted"),
            func.count(Dataset.id).label("dataset_count"),
        )
        .outerjoin(Dataset, User.id == Dataset.owner_id)
        .group_by(User.id)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "user_id": row.id,
            "email": row.email,
            "full_name": row.full_name,
            "total_uploaded": int(row.total_uploaded or 0),
            "total_converted": int(row.total_converted or 0),
            "total_usage": int((row.total_uploaded or 0) + (row.total_converted or 0)),
            "dataset_count": row.dataset_count,
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Processing queue
# ---------------------------------------------------------------------------

@router.get("/processing-datasets")
async def read_processing_datasets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Datasets pending, processing, or failed."""
    query = (
        select(Dataset)
        .options(selectinload(Dataset.owner), selectinload(Dataset.projects))
        .where(
            or_(
                Dataset.status == "pending",
                Dataset.status.like("processing%"),
                Dataset.status == "failed",
            )
        )
        .order_by(Dataset.created_at.desc())
    )
    datasets = (await db.execute(query)).scalars().all()
    return [
        {
            "id": ds.id,
            "name": ds.name,
            "status": ds.status,
            "created_at": ds.created_at,
            "owner_email": ds.owner.email if ds.owner else "Unknown",
            "projects": [p.name for p in ds.projects],
        }
        for ds in datasets
    ]


@router.get("/uploads")
async def read_active_uploads(
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """In-flight dataset uploads (browser or API), from the Redis progress registry.

    Each entry: id, user_email, name, file_type, total_bytes (0 if the client
    sent no Content-Length), received_bytes, started_at, updated_at (epoch secs).
    """
    from app.services import upload_registry

    return await run_in_threadpool(upload_registry.list_active)


@router.post("/datasets/{dataset_id}/reconvert")
async def reconvert_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Re-queue conversion for a dataset (e.g. after a converter upgrade)."""
    from app.worker import process_dataset  # local import: celery imports settings

    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.file_path or not os.path.exists(dataset.file_path):
        raise HTTPException(
            status_code=400,
            detail="Source file is missing on disk; cannot reconvert.",
        )

    # Drop any cached zarr handle for the old conversion so subsequent reads
    # re-open the new artefact.
    if dataset.converted_path:
        soma_cache.invalidate(dataset.converted_path)

    dataset.status = "pending"
    db.add(dataset)
    await db.commit()

    process_dataset.delay(str(dataset.id), dataset.file_path)
    return {"status": "queued", "dataset_id": str(dataset.id)}


# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------

def _component_ok(detail: str = "ok") -> dict[str, Any]:
    return {"status": "ok", "detail": detail}


def _component_err(detail: str) -> dict[str, Any]:
    return {"status": "error", "detail": detail}


def _gather_disk_usage() -> dict[str, Any]:
    """Cheap, O(1) disk-usage probe for the uploads volume.

    Note: this deliberately does *not* walk the uploads tree. Zarr stores
    contain thousands of tiny chunk files which makes a recursive os.walk
    the single most expensive thing on the admin dashboard. The aggregate
    bytes/files counters are filled in from the database (`Dataset` and
    `DataFile` rows store `file_size` / `converted_size` at upload time).
    """
    upload_root = os.path.abspath(os.path.join(os.getcwd(), "uploads"))
    if not os.path.isdir(upload_root):
        return {"path": upload_root, "exists": False}
    try:
        usage = shutil.disk_usage(upload_root)
    except OSError as exc:
        return {"path": upload_root, "exists": True, "error": str(exc)}
    return {
        "path": upload_root,
        "exists": True,
        "disk_total": usage.total,
        "disk_used": usage.used,
        "disk_free": usage.free,
    }


async def _gather_uploads_size_from_db(db: AsyncSession) -> dict[str, int]:
    """Sum the bytes/file counts the application itself has tracked.

    These come back as up-to-date as the last upload/conversion — we don't
    need to scan the filesystem to render the dashboard.
    """
    ds_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Dataset.file_size), 0),
                func.coalesce(func.sum(Dataset.converted_size), 0),
                func.count(Dataset.id),
            )
        )
    ).one()
    df_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(DataFile.file_size), 0),
                func.coalesce(func.sum(DataFile.converted_size), 0),
                func.count(DataFile.id),
            )
        )
    ).one()
    ds_raw, ds_conv, ds_count = ds_row
    df_raw, df_conv, df_count = df_row
    return {
        "uploads_bytes": int((ds_raw or 0) + (ds_conv or 0) + (df_raw or 0) + (df_conv or 0)),
        "uploads_files": int((ds_count or 0) + (df_count or 0)),
    }


def _gather_uploads_dir() -> dict[str, Any]:
    """Full filesystem walk — only used by on-demand admin tools."""
    info = _gather_disk_usage()
    if not info.get("exists"):
        return info
    upload_root = info["path"]
    total_size = 0
    file_count = 0
    for root, _dirs, files in os.walk(upload_root):
        for name in files:
            try:
                total_size += os.path.getsize(os.path.join(root, name))
                file_count += 1
            except OSError:
                continue
    info["uploads_bytes"] = total_size
    info["uploads_files"] = file_count
    return info


def _gather_system_metrics() -> dict[str, Any]:
    try:
        import psutil  # type: ignore
    except ImportError:
        return {"available": False, "reason": "psutil not installed"}

    try:
        # interval=None returns the cached delta since the previous call;
        # still meaningful and avoids a forced 100ms sleep on every probe.
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        load = os.getloadavg() if hasattr(os, "getloadavg") else None
        return {
            "available": True,
            "cpu_percent": cpu,
            "cpu_count": psutil.cpu_count(logical=True),
            "memory_total": mem.total,
            "memory_used": mem.used,
            "memory_percent": mem.percent,
            "load_average": list(load) if load else None,
            "boot_time": psutil.boot_time(),
        }
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("psutil metric collection failed")
        return {"available": False, "reason": str(exc)}


def _ping_redis() -> dict[str, Any]:
    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        if client.ping():
            # Don't leak the host:port of internal infrastructure even to
            # admins on the health page — a successful ping is enough.
            return _component_ok("reachable")
        return _component_err("ping returned false")
    except Exception as exc:
        return _component_err(str(exc))


def _ping_celery() -> dict[str, Any]:
    try:
        from app.worker import celery_app

        replies = celery_app.control.ping(timeout=1.0)
        if not replies:
            return _component_err("no workers responded")
        return {"status": "ok", "detail": f"{len(replies)} worker(s)", "workers": replies}
    except Exception as exc:
        return _component_err(str(exc))


@router.get("/health")
async def read_system_health(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Aggregated liveness check across the moving parts the admin cares about."""
    components: dict[str, Any] = {}

    async def _db_check() -> dict[str, Any]:
        try:
            await db.execute(text("SELECT 1"))
            return _component_ok()
        except Exception as exc:
            return _component_err(str(exc))

    # Run every probe concurrently so total latency = max(component) instead
    # of sum(component). Storage size is derived from the DB — traversing
    # the uploads tree was the dominant cost when zarr stores are large.
    db_status, redis_status, celery_status, disk, uploads_size, metrics = await asyncio.gather(
        _db_check(),
        run_in_threadpool(_ping_redis),
        run_in_threadpool(_ping_celery),
        run_in_threadpool(_gather_disk_usage),
        _gather_uploads_size_from_db(db),
        run_in_threadpool(_gather_system_metrics),
    )
    components["database"] = db_status
    components["redis"] = redis_status
    components["celery"] = celery_status
    storage = {**disk, **uploads_size} if disk.get("exists") else disk

    overall = "ok" if all(c.get("status") == "ok" for c in components.values()) else "degraded"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": components,
        "storage": storage,
        "system": metrics,
    }


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

def _inspect_celery() -> dict[str, Any]:
    try:
        from app.worker import celery_app

        # Single short timeout shared across the four inspect RPCs; the
        # default 2s×4 sequential made /admin/tasks take up to 8 seconds
        # when a worker was slow to answer.
        inspect = celery_app.control.inspect(timeout=1.0)
        active = inspect.active() or {}
        scheduled = inspect.scheduled() or {}
        reserved = inspect.reserved() or {}
        stats = inspect.stats() or {}
        return {
            "active": active,
            "scheduled": scheduled,
            "reserved": reserved,
            "stats": stats,
        }
    except Exception as exc:
        logger.exception("celery inspect failed")
        return {"error": str(exc), "active": {}, "scheduled": {}, "reserved": {}, "stats": {}}


@router.get("/tasks")
async def read_tasks(
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Snapshot of active / scheduled / reserved Celery tasks per worker."""
    return await run_in_threadpool(_inspect_celery)


@router.post("/tasks/{task_id}/revoke")
async def revoke_task(
    task_id: str,
    terminate: bool = Query(False, description="Send SIGTERM to running task"),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    def _revoke():
        from app.worker import celery_app

        celery_app.control.revoke(task_id, terminate=terminate, signal="SIGTERM")
        return True

    try:
        await run_in_threadpool(_revoke)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "revoked", "task_id": task_id, "terminate": terminate}


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    total = await db.scalar(select(func.count(DbSession.id)))
    # `pg_column_size` is computed from the on-disk TOAST representation
    # without materialising the JSON in Python, which is dramatically
    # faster than `len(str(s.data))` on map-state-sized rows.
    rows = (
        await db.execute(
            select(
                DbSession.id,
                DbSession.created_at,
                DbSession.data,
                func.pg_column_size(DbSession.data).label("size_estimate"),
            )
            .order_by(DbSession.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    items = []
    for s in rows:
        keys: list[str] = []
        if isinstance(s.data, dict):
            keys = sorted(s.data.keys())
        items.append(
            {
                "id": s.id,
                "created_at": s.created_at,
                "data_keys": keys,
                "size_estimate": int(s.size_estimate or 0),
            }
        )

    return {"total": total or 0, "items": items, "limit": limit, "offset": offset}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    sess = await db.get(DbSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(sess)
    await db.commit()
    return {"status": "deleted", "id": session_id}


@router.post("/sessions/cleanup")
async def cleanup_sessions(
    older_than_days: int = Query(30, ge=1, le=3650),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = await db.execute(sql_delete(DbSession).where(DbSession.created_at < cutoff))
    await db.commit()
    return {"status": "ok", "deleted": result.rowcount or 0, "cutoff": cutoff.isoformat()}


# ---------------------------------------------------------------------------
# Files / orphans
# ---------------------------------------------------------------------------

UPLOAD_DIR = os.path.abspath(os.path.join(os.getcwd(), "uploads"))

# Git/OS placeholder files live in the uploads dir to keep it tracked or
# non-empty. They are NEVER orphans and must never be offered for deletion.
IGNORED_ORPHAN_NAMES = {".gitignore", ".gitkeep", ".gitattributes", ".DS_Store", "Thumbs.db"}


def _dir_size(path: str) -> int:
    """Recursively sum file sizes under ``path`` (e.g. a zarr/SOMA store)."""
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                continue
    return total


def _scan_uploads() -> list[dict[str, Any]]:
    """Return top-level entries in the uploads directory.

    Excludes git/OS placeholder files (``.gitignore``/``.gitkeep``/…), any
    dotfile, and in-progress chunked-upload scratch files (``*.part``) so none
    are ever flagged as orphans. (A ``.part`` belongs to a live upload and is not
    yet referenced by any DataFile row, so without this it would be offered for
    deletion mid-transfer. Abandoned ``.part`` files are reclaimed by the
    ``purge_orphaned_upload_parts`` beat task instead.) Directory sizes are NOT
    computed here — that recursive walk over thousands of zarr/SOMA chunk files
    is the dominant cost, so callers compute size only for the (few) entries
    they actually display. Sizes start as ``None`` for directories.
    """
    if not os.path.isdir(UPLOAD_DIR):
        return []
    items: list[dict[str, Any]] = []
    with os.scandir(UPLOAD_DIR) as it:
        for entry in it:
            if (
                entry.name in IGNORED_ORPHAN_NAMES
                or entry.name.startswith(".")
                or entry.name.endswith(".part")
            ):
                continue
            try:
                stat = entry.stat()
            except OSError:
                continue
            items.append(
                {
                    "name": entry.name,
                    "path": os.path.abspath(entry.path),
                    "is_dir": entry.is_dir(),
                    "size": None if entry.is_dir() else stat.st_size,
                    "modified": stat.st_mtime,
                }
            )
    return items


# Same TTL caching strategy used to wrap the deeper traversal. The orphans
# page is the only consumer; we accept up-to-30s staleness in exchange
# for an instant render.
_UPLOAD_SCAN_CACHE: tuple[float, list[dict[str, Any]]] | None = None
_UPLOAD_SCAN_CACHE_TTL = 30.0


def _scan_uploads_cached() -> list[dict[str, Any]]:
    global _UPLOAD_SCAN_CACHE
    now = time.monotonic()
    if _UPLOAD_SCAN_CACHE is not None:
        ts, cached = _UPLOAD_SCAN_CACHE
        if now - ts < _UPLOAD_SCAN_CACHE_TTL:
            return cached
    fresh = _scan_uploads()
    _UPLOAD_SCAN_CACHE = (now, fresh)
    return fresh


async def _gather_referenced_paths(db: AsyncSession) -> set[str]:
    # Single round-trip across all four columns instead of one per column.
    referenced: set[str] = set()
    rows = (
        await db.execute(
            select(Dataset.file_path, Dataset.converted_path).where(
                or_(Dataset.file_path.is_not(None), Dataset.converted_path.is_not(None))
            )
        )
    ).all()
    for file_path, converted_path in rows:
        if file_path:
            referenced.add(os.path.abspath(file_path))
        if converted_path:
            referenced.add(os.path.abspath(converted_path))
    rows = (
        await db.execute(
            select(DataFile.file_path, DataFile.converted_path).where(
                or_(DataFile.file_path.is_not(None), DataFile.converted_path.is_not(None))
            )
        )
    ).all()
    for file_path, converted_path in rows:
        if file_path:
            referenced.add(os.path.abspath(file_path))
        if converted_path:
            referenced.add(os.path.abspath(converted_path))
    return referenced


@router.get("/files/orphans")
async def list_orphan_files(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Files in the uploads directory not referenced by any Dataset or DataFile."""
    referenced = await _gather_referenced_paths(db)
    entries = await run_in_threadpool(_scan_uploads_cached)

    # Compute the expensive directory size ONLY for the orphan subset — the
    # referenced stores (the vast majority) never get walked.
    def _build_orphans() -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for e in entries:
            if e["path"] in referenced:
                continue
            size = e["size"]
            if size is None and e["is_dir"]:
                size = _dir_size(e["path"])
            out.append({**e, "size": size})
        return out

    orphans = await run_in_threadpool(_build_orphans)
    return {
        "uploads_dir": UPLOAD_DIR,
        "total_files_scanned": len(entries),
        "orphan_count": len(orphans),
        "orphans": orphans,
    }


@router.delete("/files/orphans")
async def delete_orphan_files(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete every orphan entry in the uploads directory."""
    referenced = await _gather_referenced_paths(db)
    entries = await run_in_threadpool(_scan_uploads)
    deleted: list[str] = []
    failed: list[dict[str, str]] = []
    for entry in entries:
        if entry["path"] in referenced:
            continue
        try:
            if entry["is_dir"]:
                shutil.rmtree(entry["path"])
            else:
                os.remove(entry["path"])
            deleted.append(entry["name"])
        except OSError as exc:
            logger.exception("Failed to delete orphan %s", entry["path"])
            failed.append({"name": entry["name"], "error": str(exc)})

    # Drop the cached scan so the next render reflects the deletions.
    global _UPLOAD_SCAN_CACHE
    _UPLOAD_SCAN_CACHE = None

    return {"deleted": deleted, "failed": failed}


# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------

@router.get("/activity")
async def read_activity(
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Recent dataset uploads, project creations, and group creations.

    Combines the durable audit log (deletes, transfers, role changes) with
    derived creation events from ``created_at`` columns so the dashboard
    reflects both what currently exists and what has been changed/removed.
    """
    audit_rows = (
        await db.execute(
            select(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    ds_rows = (
        await db.execute(
            select(Dataset)
            .options(selectinload(Dataset.owner))
            .order_by(Dataset.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    proj_rows = (
        await db.execute(
            select(Project)
            .options(selectinload(Project.owner))
            .order_by(Project.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    grp_rows = (
        await db.execute(
            select(Group)
            .options(selectinload(Group.owner))
            .order_by(Group.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    events: list[dict[str, Any]] = []
    for ds in ds_rows:
        events.append({
            "type": "dataset_uploaded",
            "timestamp": ds.created_at,
            "actor": ds.owner.email if ds.owner else None,
            "subject": ds.name,
            "subject_id": str(ds.id),
            "status": ds.status,
        })
    for p in proj_rows:
        events.append({
            "type": "project_created",
            "timestamp": p.created_at,
            "actor": p.owner.email if p.owner else None,
            "subject": p.name,
            "subject_id": str(p.id),
        })
    for g in grp_rows:
        events.append({
            "type": "group_created",
            "timestamp": g.created_at,
            "actor": g.owner.email if g.owner else None,
            "subject": g.name,
            "subject_id": str(g.id),
        })
    for entry in audit_rows:
        meta = entry.extra or {}
        # Pull a human-readable subject label out of the metadata where the
        # write-site stashed it. Falling back to the resource_id keeps every
        # row at least minimally renderable.
        subject = (
            meta.get("name")
            or meta.get("subject")
            or entry.resource_id
            or entry.action
        )
        events.append({
            "type": entry.action,
            "timestamp": entry.created_at,
            "actor": entry.actor_email,
            "subject": subject,
            "subject_id": entry.resource_id,
            "metadata": meta or None,
        })

    events.sort(
        key=lambda e: e["timestamp"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return events[:limit]


# ---------------------------------------------------------------------------
# Sanitised configuration view
# ---------------------------------------------------------------------------

def _sanitize_db_url(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    creds, host = rest.split("@", 1)
    if ":" in creds:
        user, _ = creds.split(":", 1)
        return f"{scheme}://{user}:***@{host}"
    return url


@router.get("/config")
async def read_config(
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Read-only, secrets-redacted snapshot of the runtime configuration."""
    return {
        "project_name": settings.PROJECT_NAME,
        "api_v1_str": settings.API_V1_STR,
        "frontend_url": settings.FRONTEND_URL,
        "database_url": _sanitize_db_url(settings.DATABASE_URL),
        "redis_url": _sanitize_db_url(settings.REDIS_URL),
        "auth": {
            "cookie_name": settings.AUTH_COOKIE_NAME,
            "cookie_samesite": settings.AUTH_COOKIE_SAMESITE,
            "cookie_secure": settings.AUTH_COOKIE_SECURE,
            "cookie_domain": settings.AUTH_COOKIE_DOMAIN,
            "access_token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            "algorithm": settings.ALGORITHM,
        },
        "uploads": {
            "max_upload_bytes": settings.MAX_UPLOAD_BYTES,
        },
        "oauth": {
            "google_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "orcid_configured": bool(settings.ORCID_CLIENT_ID and settings.ORCID_CLIENT_SECRET),
        },
        "cors_origins": settings.BACKEND_CORS_ORIGINS,
        "insecure_secrets_allowed": settings.ALLOW_INSECURE_SECRETS,
    }


# ---------------------------------------------------------------------------
# Bulk dataset operations
# ---------------------------------------------------------------------------

@router.get("/datasets")
async def list_all_datasets(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    deleted: Optional[bool] = Query(
        None, description="true = only trashed, false = only active, omit = all"
    ),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """All datasets across the system (admin global view).

    Shows trashed datasets too (flagged via ``deleted_at``); ``project_count``
    of 0 means the dataset is not attached to any project. Filter with
    ``deleted`` to isolate trashed vs active rows.
    """
    base = select(Dataset).options(selectinload(Dataset.owner), selectinload(Dataset.projects))
    count_q = select(func.count(Dataset.id))
    if status:
        base = base.where(Dataset.status == status)
        count_q = count_q.where(Dataset.status == status)
    if deleted is True:
        base = base.where(Dataset.deleted_at.is_not(None))
        count_q = count_q.where(Dataset.deleted_at.is_not(None))
    elif deleted is False:
        base = base.where(Dataset.deleted_at.is_(None))
        count_q = count_q.where(Dataset.deleted_at.is_(None))
    base = base.order_by(Dataset.created_at.desc()).limit(limit).offset(offset)

    total = await db.scalar(count_q)
    rows = (await db.execute(base)).scalars().all()
    items = [
        {
            "id": str(ds.id),
            "name": ds.name,
            "status": ds.status,
            "file_size": ds.file_size,
            "converted_size": ds.converted_size,
            "created_at": ds.created_at,
            "deleted_at": ds.deleted_at,
            "owner_email": ds.owner.email if ds.owner else None,
            "project_count": len(ds.projects),
        }
        for ds in rows
    ]
    return {"total": total or 0, "items": items, "limit": limit, "offset": offset}


@router.delete("/datasets/{dataset_id}")
async def admin_delete_dataset(
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Permanently and completely purge ANY dataset (superuser), regardless of
    trash state.

    Unlike ``DELETE /datasets/{id}`` (which soft-deletes), this removes the
    dataset everywhere: the row, its project links, the underlying files (and
    the dedup DataFile when unreferenced), plus any sessions / notifications
    that referenced it, and cached handles.
    """
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    name = dataset.name
    summary = await purge_dataset_completely(db, dataset)
    await record_audit(
        db,
        actor=current_user,
        action="dataset.admin_purge",
        resource_type="dataset",
        resource_id=dataset_id,
        extra={"name": name, **summary},
    )
    await db.commit()

    return {"status": "deleted", "id": str(dataset_id), **summary}


# ---------------------------------------------------------------------------
# Projects (admin global view)
# ---------------------------------------------------------------------------

@router.get("/projects")
async def list_all_projects(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """All projects across the system, with owner + dataset/share counts.

    Admins manage an individual project (settings, shares, ownership transfer)
    from its detail page — superusers already resolve to ADMIN permission there,
    so every control is available.
    """
    base = select(Project).options(
        selectinload(Project.owner),
        selectinload(Project.shares),
        selectinload(Project.datasets),
    )
    count_q = select(func.count(Project.id))
    if search and search.strip():
        like = f"%{search.strip()}%"
        cond = or_(Project.name.ilike(like), Project.description.ilike(like))
        base = base.where(cond)
        count_q = count_q.where(cond)
    base = base.order_by(Project.created_at.desc()).limit(limit).offset(offset)

    total = await db.scalar(count_q)
    rows = (await db.execute(base)).scalars().unique().all()
    items = [
        {
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "visibility": getattr(p.visibility, "value", p.visibility),
            "owner_email": p.owner.email if p.owner else None,
            "owner_id": str(p.owner_id) if p.owner_id else None,
            "dataset_count": len(p.datasets),
            "share_count": len(p.shares),
            "created_at": p.created_at,
        }
        for p in rows
    ]
    return {"total": total or 0, "items": items, "limit": limit, "offset": offset}


@router.delete("/projects/{project_id}")
async def admin_delete_project(
    project_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete ANY project (superuser). Removes the project, its shares, and its
    dataset links; the datasets themselves are preserved (only unlinked)."""
    res = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares),
            selectinload(Project.datasets),
            selectinload(Project.tags),
        )
        .where(Project.id == project_id)
    )
    project = res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    name = project.name
    # Relationships are eager-loaded so the ORM cascade (shares delete-orphan,
    # project_dataset secondary rows) runs without lazy IO under async.
    await db.delete(project)
    await record_audit(
        db,
        actor=current_user,
        action="project.admin_delete",
        resource_type="project",
        resource_id=project_id,
        extra={"name": name},
    )
    await db.commit()
    return {"status": "deleted", "id": str(project_id)}
