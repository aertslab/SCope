"""In-flight upload progress registry (Redis).

The dataset upload endpoint streams the raw request body to disk, which can take
many minutes for large files. To give admins visibility into uploads currently
in progress — and because both the browser and the API hit the same endpoint —
we record a small per-upload progress entry in Redis: id, user, name, total and
received bytes, and timestamps.

Entries are removed when the upload finishes or aborts, and also carry a TTL so a
crashed/killed request can't leave a phantom entry forever.

All functions are synchronous (mirroring the rest of the admin Redis usage —
call them via ``run_in_threadpool`` from async code) and swallow Redis errors:
upload progress is best-effort telemetry and must never break or slow a real
upload.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List

from app.core.config import settings

_ACTIVE_SET = "scope:uploads:active"
# Self-expiry backstop in case finish() never runs (process killed mid-upload).
_TTL_SECONDS = 6 * 3600


def _key(upload_id: str) -> str:
    return f"scope:upload:{upload_id}"


# Progress updates fire ~once a second for the whole (possibly multi-minute)
# upload, so reuse one client rather than opening a connection per tick. redis-py
# clients are thread-safe (pooled) and reconnect transparently, so a module-level
# singleton is safe across the threadpool threads these helpers run on.
_redis_client = None


def _client():
    global _redis_client
    if _redis_client is None:
        import redis  # type: ignore

        _redis_client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
    return _redis_client


def register(upload_id: str, *, user_email: str, name: str, file_type: str, total_bytes: int) -> None:
    try:
        now = time.time()
        c = _client()
        c.hset(
            _key(upload_id),
            mapping={
                "id": upload_id,
                "user_email": user_email or "",
                "name": name or "",
                "file_type": file_type or "",
                "total_bytes": int(total_bytes or 0),
                "received_bytes": 0,
                "started_at": now,
                "updated_at": now,
            },
        )
        c.expire(_key(upload_id), _TTL_SECONDS)
        c.sadd(_ACTIVE_SET, upload_id)
        c.expire(_ACTIVE_SET, _TTL_SECONDS)
    except Exception:  # noqa: BLE001
        pass


def update(upload_id: str, received_bytes: int) -> None:
    try:
        c = _client()
        c.hset(_key(upload_id), mapping={"received_bytes": int(received_bytes), "updated_at": time.time()})
        c.expire(_key(upload_id), _TTL_SECONDS)
        # Refresh set membership + its TTL too, so an upload that legitimately
        # runs longer than the TTL (a slow/resumed large transfer) doesn't drop
        # out of the admin active list while it's still progressing.
        c.sadd(_ACTIVE_SET, upload_id)
        c.expire(_ACTIVE_SET, _TTL_SECONDS)
    except Exception:  # noqa: BLE001
        pass


def finish(upload_id: str) -> None:
    try:
        c = _client()
        c.delete(_key(upload_id))
        c.srem(_ACTIVE_SET, upload_id)
    except Exception:  # noqa: BLE001
        pass


def list_active() -> List[Dict[str, Any]]:
    """Return all in-flight uploads, oldest first. Prunes stale set members."""
    out: List[Dict[str, Any]] = []
    try:
        c = _client()
        ids = c.smembers(_ACTIVE_SET) or set()
        for raw in ids:
            uid = raw.decode() if isinstance(raw, bytes) else raw
            h = c.hgetall(_key(uid))
            if not h:
                # The hash expired but the id lingered in the set — prune it.
                c.srem(_ACTIVE_SET, uid)
                continue
            rec: Dict[str, Any] = {}
            for k, v in h.items():
                k = k.decode() if isinstance(k, bytes) else k
                v = v.decode() if isinstance(v, bytes) else v
                rec[k] = v
            for nk in ("total_bytes", "received_bytes"):
                try:
                    rec[nk] = int(float(rec.get(nk, 0)))
                except (TypeError, ValueError):
                    rec[nk] = 0
            for fk in ("started_at", "updated_at"):
                try:
                    rec[fk] = float(rec.get(fk, 0))
                except (TypeError, ValueError):
                    rec[fk] = 0.0
            out.append(rec)
    except Exception:  # noqa: BLE001
        pass
    out.sort(key=lambda r: r.get("started_at", 0))
    return out
