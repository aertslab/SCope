from celery import Celery
from typing import Optional
import os
import asyncio
import logging

import anndata
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import Dataset, DataFile, Notification
from app.utils.loom_converter import convert_loom_to_zarr, convert_anndata_to_zarr

logger = logging.getLogger(__name__)

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

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

        async def update_status(status: str, converted_path: Optional[str] = None, failure_reason: Optional[str] = None):
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
                            session.add(data_file)
                            
                            # Update ALL datasets linked to this DataFile
                            linked_datasets_res = await session.execute(select(Dataset).where(Dataset.data_file_id == data_file.id))
                            linked_datasets = linked_datasets_res.scalars().all()
                            for linked_ds in linked_datasets:
                                linked_ds.status = status
                                if converted_path:
                                    linked_ds.converted_path = converted_path
                                    linked_ds.converted_size = dataset.converted_size
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

        logger.info("Processing dataset %s from %s", dataset_id, file_path)

        try:
            await update_status("processing")

            # Determine output path (replace extension with .zarr)
            output_path = os.path.splitext(file_path)[0] + ".zarr"
            
            # Read the file based on extension
            if file_path.endswith(".loom"):
                await convert_loom_to_zarr(file_path, output_path, status_callback=update_status)
            elif file_path.endswith(".h5ad"):
                # Read in backed mode to avoid loading everything into memory
                adata = anndata.read_h5ad(file_path, backed='r')
                await convert_anndata_to_zarr(adata, output_path, status_callback=update_status)
            elif file_path.endswith(".csv"):
                adata = anndata.read_csv(file_path)
                await convert_anndata_to_zarr(adata, output_path, status_callback=update_status)
            else:
                raise ValueError(f"Unsupported file format: {file_path}")

            logger.info("Successfully converted to %s", output_path)

            await update_status("ready", output_path)
            
            return True
        except Exception as e:
            logger.exception("Error processing dataset %s: %s", dataset_id, e)
            # Truncate to a sensible length so we don't store unbounded tracebacks.
            reason = str(e)[:500] if str(e) else type(e).__name__
            await update_status("failed", failure_reason=reason)
            return False
        finally:
            await engine.dispose()

    return asyncio.run(process())
