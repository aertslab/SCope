from celery import Celery
from celery.signals import worker_ready
from typing import Optional
import os
import time
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import Dataset, DataFile, Notification
from app.utils.soma_converter import convert_to_soma

logger = logging.getLogger(__name__)

# A conversion that keeps dying (e.g. OOM on a huge file) would otherwise be
# re-queued by startup recovery forever. Cap the attempts: after this many, mark
# the dataset failed instead of retrying. The counter lives in Redis (keyed by
# dataset id) so it survives task/worker restarts; it's cleared on success.
MAX_CONVERSION_ATTEMPTS = 3

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Daily auto-purge of expired, orphaned trashed datasets. Requires the worker
# to run with embedded beat (`celery -A app.worker worker -B`) or a dedicated
# beat process; see docker-compose.
celery_app.conf.beat_schedule = {
    "purge-expired-trash": {
        "task": "purge_expired_trash",
        "schedule": float(24 * 60 * 60),  # once a day
    }
}

def _publish_dataset_event(owner_id, payload: dict) -> None:
    """Publish a dataset status change to the owner's SSE channel (best-effort)."""
    import json as _json

    import redis as _redis  # sync client; the worker is not async

    try:
        client = _redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        client.publish(f"scope:ds-events:{owner_id}", _json.dumps(payload))
    except Exception:
        logger.exception("Failed to publish dataset event for owner %s", owner_id)


def _bump_conversion_attempts(dataset_id) -> int:
    """Increment + return this dataset's conversion-attempt count (Redis)."""
    import redis as _redis

    try:
        client = _redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        key = f"scope:conv-attempts:{dataset_id}"
        n = int(client.incr(key))
        client.expire(key, 7 * 24 * 3600)
        return n
    except Exception:
        logger.exception("Failed to read conversion attempts for %s", dataset_id)
        return 1  # fail open — don't block a conversion because Redis hiccuped


def _reset_conversion_attempts(dataset_id) -> None:
    import redis as _redis

    try:
        client = _redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        client.delete(f"scope:conv-attempts:{dataset_id}")
    except Exception:  # noqa: BLE001
        pass


@worker_ready.connect
def _requeue_interrupted_conversions(**_kwargs) -> None:
    """On worker boot, resume conversions left in 'processing' by a crash/reboot.

    A freshly-started worker means nothing is actively converting, so any dataset
    still in 'processing' was interrupted (OOM, SIGKILL, power loss, restart). We
    re-queue each one so work resumes automatically. The per-dataset attempt cap
    in ``process_dataset`` keeps a perpetually-failing job from looping.

    (Single-worker assumption for dev. With multiple worker replicas, gate this
    behind an advisory lock so only one performs recovery.)
    """
    async def _run() -> int:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with SessionLocal() as session:
                rows = (
                    await session.execute(
                        select(Dataset).where(
                            Dataset.status == "processing",
                            Dataset.deleted_at.is_(None),
                        )
                    )
                ).scalars().all()
                targets = [(str(d.id), d.file_path) for d in rows if d.file_path]
            for dsid, path in targets:
                logger.info("Recovery: re-enqueuing interrupted conversion for dataset %s", dsid)
                process_dataset.delay(dsid, path)
            return len(targets)
        finally:
            await engine.dispose()

    try:
        n = asyncio.run(_run())
        if n:
            logger.info("Recovery: re-enqueued %d interrupted conversion(s)", n)
        else:
            logger.info("Recovery: no interrupted conversions to resume")
    except Exception:
        logger.exception("Recovery scan failed on worker startup")


@celery_app.task(acks_late=True)
def test_celery(word: str) -> str:
    return f"test task return {word}"

@celery_app.task
def process_dataset(dataset_id: int, file_path: str):
    async def process():
        # Create a local engine and session for this task to avoid loop issues
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        def get_dir_size(path):
            total = 0
            with os.scandir(path) as it:
                for entry in it:
                    if entry.is_file():
                        total += entry.stat().st_size
                    elif entry.is_dir():
                        total += get_dir_size(entry.path)
            return total

        async def update_status(
            status: str,
            converted_path: Optional[str] = None,
            failure_reason: Optional[str] = None,
            converted_format: Optional[str] = None,
        ):
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(Dataset).where(Dataset.id == dataset_id))
                dataset = result.scalars().first()
                if dataset:
                    dataset.status = status
                    # Clear stale failure messages on retry/success; persist on failure.
                    if status == "failed":
                        dataset.failure_reason = failure_reason
                    elif status in ("processing", "ready"):
                        dataset.failure_reason = None
                    if converted_path:
                        dataset.converted_path = converted_path
                        if converted_format:
                            dataset.converted_format = converted_format
                        # Calculate converted size
                        if os.path.exists(converted_path):
                            if os.path.isdir(converted_path):
                                dataset.converted_size = get_dir_size(converted_path)
                            else:
                                dataset.converted_size = os.path.getsize(converted_path)

                    # Update DataFile if linked
                    if dataset.data_file_id:
                        df_result = await session.execute(select(DataFile).where(DataFile.id == dataset.data_file_id))
                        data_file = df_result.scalars().first()
                        if data_file:
                            data_file.status = status
                            if converted_path:
                                data_file.converted_path = converted_path
                                data_file.converted_size = dataset.converted_size
                                if converted_format:
                                    data_file.converted_format = converted_format
                            session.add(data_file)

                            # Update ALL datasets linked to this DataFile
                            linked_datasets_res = await session.execute(select(Dataset).where(Dataset.data_file_id == data_file.id))
                            linked_datasets = linked_datasets_res.scalars().all()
                            for linked_ds in linked_datasets:
                                linked_ds.status = status
                                if converted_path:
                                    linked_ds.converted_path = converted_path
                                    linked_ds.converted_size = dataset.converted_size
                                    if converted_format:
                                        linked_ds.converted_format = converted_format
                                session.add(linked_ds)

                    session.add(dataset)
                    # Drop a notification for the dataset owner on terminal
                    # states so the UI doesn't have to poll. Best-effort —
                    # a missing notification must not stall conversion.
                    try:
                        if status in ("ready", "failed") and dataset.owner_id is not None:
                            if status == "ready":
                                title = "Dataset ready"
                                message = f'"{dataset.name}" finished processing and is ready to view.'
                                notif_type = "dataset_processed"
                            else:
                                title = "Dataset processing failed"
                                reason_txt = (failure_reason or "").strip()
                                message = (
                                    f'"{dataset.name}" failed to process'
                                    + (f": {reason_txt}" if reason_txt else ".")
                                )
                                notif_type = "dataset_failed"
                            session.add(
                                Notification(
                                    user_id=dataset.owner_id,
                                    type=notif_type,
                                    title=title,
                                    message=message,
                                    link=f"/datasets/{dataset.id}",
                                    payload={"dataset_id": str(dataset.id)},
                                )
                            )
                    except Exception:
                        logger.exception("Failed to enqueue dataset notification")
                    await session.commit()

                    # Publish a live status event to the owner's SSE channel so
                    # the UI updates without polling. Best-effort and fire-and-
                    # forget — a Redis hiccup must never stall conversion.
                    if dataset.owner_id is not None:
                        _publish_dataset_event(
                            dataset.owner_id,
                            {"dataset_id": str(dataset.id), "status": status},
                        )

        input_mib = (
            os.path.getsize(file_path) / (1024 * 1024)
            if os.path.exists(file_path) else -1
        )
        # Count this attempt up-front (before the heavy/possibly-OOMing work, so
        # the count survives even a SIGKILL). Give up after the cap so a job that
        # keeps dying doesn't get resurrected forever by startup recovery.
        attempts = _bump_conversion_attempts(dataset_id)
        logger.info(
            "process_dataset START: dataset=%s file=%s (%.1f MiB) attempt=%d",
            dataset_id, file_path, input_mib, attempts,
        )
        if attempts > MAX_CONVERSION_ATTEMPTS:
            logger.error(
                "Dataset %s exceeded %d conversion attempts — marking failed (no further auto-retry)",
                dataset_id, MAX_CONVERSION_ATTEMPTS,
            )
            await update_status(
                "failed",
                failure_reason=(
                    f"Conversion failed or was interrupted {attempts - 1} times "
                    "(a very large file can exhaust worker memory). Not retrying automatically."
                ),
            )
            _reset_conversion_attempts(dataset_id)
            return False

        started = time.monotonic()

        try:
            await update_status("processing")
            logger.info("Dataset %s status -> processing", dataset_id)

            # Convert into a TileDB-SOMA Experiment (sparse, out-of-core).
            output_path = os.path.splitext(file_path)[0] + ".soma"
            logger.info("Converting dataset %s: %s -> %s", dataset_id, file_path, output_path)
            await convert_to_soma(file_path, output_path, status_callback=update_status)

            elapsed = time.monotonic() - started
            out_mib = get_dir_size(output_path) / (1024 * 1024) if os.path.exists(output_path) else -1
            logger.info(
                "process_dataset DONE: dataset=%s converted to %s (%.1f MiB) in %.1fs",
                dataset_id, output_path, out_mib, elapsed,
            )

            await update_status("ready", output_path, converted_format="soma")
            _reset_conversion_attempts(dataset_id)
            logger.info("Dataset %s status -> ready", dataset_id)

            return True
        except Exception as e:
            logger.exception("process_dataset FAILED: dataset=%s: %s", dataset_id, e)
            # Truncate to a sensible length so we don't store unbounded tracebacks.
            reason = str(e)[:500] if str(e) else type(e).__name__
            await update_status("failed", failure_reason=reason)
            logger.info("Dataset %s status -> failed (%s)", dataset_id, reason)
            return False
        finally:
            await engine.dispose()

    return asyncio.run(process())


@celery_app.task(name="purge_expired_trash")
def purge_expired_trash():
    """Permanently delete trashed datasets that are BOTH expired and orphaned.

    A trashed dataset still linked to any project is retained (skipped), so a
    project never loses its data. Runs daily via Celery beat.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import exists
    from app.models.project import project_dataset
    from app.services.dataset_purge import purge_dataset_completely

    async def run():
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.TRASH_RETENTION_DAYS)
        purged = 0
        try:
            async with AsyncSessionLocal() as session:
                linked = exists(
                    select(project_dataset.c.dataset_id).where(
                        project_dataset.c.dataset_id == Dataset.id
                    )
                )
                q = select(Dataset).where(
                    Dataset.deleted_at.is_not(None),
                    Dataset.deleted_at < cutoff,
                    ~linked,
                )
                rows = (await session.execute(q)).scalars().all()
                for ds in rows:
                    # Same complete purge as the admin / user paths (also clears
                    # any lingering sessions/notifications).
                    await purge_dataset_completely(session, ds)
                    purged += 1
        finally:
            await engine.dispose()
        if purged:
            logger.info("Auto-purged %d expired/orphaned trashed dataset(s)", purged)
        return purged

    return asyncio.run(run())
