"""Resumable (chunked) upload sessions, stored in Redis.

A chunked upload is bootstrapped by ``POST /datasets/upload/init`` which creates
a session here, then driven by ``PATCH /datasets/upload/{id}`` chunk appends and
finalised by ``POST /datasets/upload/{id}/complete``.

The session row holds only the *metadata* (owner, hashes, target sizes, the
on-disk partial-file path). The authoritative byte **offset is always the size
of the ``.part`` file on disk**, never a counter in Redis — so a crashed request
can't desync it, and even if the Redis session is lost the client can re-init
(same content hash → same ``.part`` path) and resume from the file's size.

Unlike ``upload_registry`` (best-effort admin telemetry that swallows Redis
errors), this is protocol state: Redis errors propagate so the caller fails
loudly rather than silently losing an upload.
"""
from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Optional

from app.core.config import settings

# Resumable for two days — long enough to retry across a reboot, bounded so
# abandoned sessions (and their .part files, cleaned by the orphan sweeper)
# don't accumulate forever.
_TTL_SECONDS = 48 * 3600


def _key(upload_id: str) -> str:
    return f"scope:upload-session:{upload_id}"


_redis_client = None


def _client():
    global _redis_client
    if _redis_client is None:
        import redis  # type: ignore

        _redis_client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=5)
    return _redis_client


def create(
    *,
    name: str,
    description: Optional[str],
    file_type: str,
    file_hash: str,
    total_size: int,
    owner_id: Any,
    owner_email: str,
    part_path: str,
) -> str:
    """Create a session and return its opaque upload id."""
    upload_id = secrets.token_urlsafe(18)
    c = _client()
    c.hset(
        _key(upload_id),
        mapping={
            "id": upload_id,
            "name": name or "",
            "description": description or "",
            "file_type": file_type,
            "file_hash": file_hash,
            "total_size": int(total_size),
            "owner_id": str(owner_id),
            "owner_email": owner_email or "",
            "part_path": part_path,
            "started_at": time.time(),
        },
    )
    c.expire(_key(upload_id), _TTL_SECONDS)
    return upload_id


def get(upload_id: str) -> Optional[Dict[str, Any]]:
    c = _client()
    h = c.hgetall(_key(upload_id))
    if not h:
        return None
    rec: Dict[str, Any] = {}
    for k, v in h.items():
        k = k.decode() if isinstance(k, bytes) else k
        v = v.decode() if isinstance(v, bytes) else v
        rec[k] = v
    try:
        rec["total_size"] = int(rec.get("total_size") or 0)
    except (TypeError, ValueError):
        rec["total_size"] = 0
    return rec


def touch(upload_id: str) -> None:
    """Refresh the TTL while an upload is actively progressing."""
    try:
        _client().expire(_key(upload_id), _TTL_SECONDS)
    except Exception:  # noqa: BLE001 — a missed TTL refresh must not fail a chunk
        pass


def delete(upload_id: str) -> None:
    try:
        _client().delete(_key(upload_id))
    except Exception:  # noqa: BLE001
        pass
