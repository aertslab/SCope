"""Apply Alembic migrations programmatically on app startup.

Why a subprocess + advisory lock:

* Alembic's ``env.py`` runs the online migrations via ``asyncio.run(...)``. The
  FastAPI lifespan is already inside a running event loop, and you cannot nest
  ``asyncio.run`` in the same thread. The previous approach used
  ``asyncio.to_thread`` to give env.py a clean thread — but inside the uvicorn
  server process that nested-loop-in-a-worker-thread reliably DEADLOCKED on
  startup (it ran fine standalone, which made it deceptive). Running
  ``alembic upgrade head`` as a child process sidesteps the whole problem: the
  child gets a pristine interpreter + event loop, and we just await it.

* When several workers/replicas boot at once they'd otherwise race to run DDL.
  A session-level Postgres advisory lock serializes them: the first acquires the
  lock and migrates; the rest block until it's released and then find the DB
  already at head (a no-op).
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

from app.db.session import engine

logger = logging.getLogger(__name__)

# Arbitrary fixed 64-bit key identifying the "schema migration" critical section.
_MIGRATION_LOCK_KEY = 776644


async def _alembic_upgrade_head() -> None:
    """Run ``alembic upgrade head`` in a child process and await it."""
    # app/db/migrate.py -> parents[2] == the backend/ root that holds alembic.ini.
    backend_root = Path(__file__).resolve().parents[2]
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "alembic",
        "-c", str(backend_root / "alembic.ini"),
        "upgrade", "head",
        cwd=str(backend_root),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    text = (out or b"").decode(errors="replace").strip()
    if text:
        logger.info("alembic:\n%s", text)
    if proc.returncode != 0:
        raise RuntimeError(f"alembic upgrade head failed (exit code {proc.returncode})")


async def run_migrations() -> None:
    """Upgrade the database to the latest revision, serialized across processes."""
    async with engine.connect() as conn:
        # Block until we hold the migration lock (released automatically if this
        # connection dies). The key is a constant, so no injection risk.
        await conn.exec_driver_sql(f"SELECT pg_advisory_lock({_MIGRATION_LOCK_KEY})")
        try:
            logger.info("Applying database migrations (alembic upgrade head)…")
            await _alembic_upgrade_head()
            logger.info("Database migrations are up to date.")
        finally:
            await conn.exec_driver_sql(f"SELECT pg_advisory_unlock({_MIGRATION_LOCK_KEY})")
