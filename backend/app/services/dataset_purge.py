"""Complete, irreversible dataset purge — disk + every DB reference.

Shared by the admin force-delete, the user "delete forever" (trash purge), and
the auto-expire task so "purge" means the same thorough thing everywhere:

* removes the dataset row and its ``project_dataset`` links,
* deletes the underlying files (and the dedup ``DataFile`` + its files when no
  other dataset references it),
* deletes any sessions (share links / saved workspaces) and notifications that
  referenced the dataset, so nothing points at a now-gone id, and
* drops cached SOMA handles for the converted store.

The audit log is intentionally NOT touched — it's the durable record of the
purge itself.
"""
from __future__ import annotations

import logging
import os
import shutil
from typing import Any, Optional

from sqlalchemy import Text, cast, delete as sql_delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import Dataset
from app.models.data_file import DataFile
from app.models.notification import Notification
from app.models.project import project_dataset
from app.models.session import Session as DbSession
from app.utils import soma_cache

logger = logging.getLogger(__name__)


def _rm(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    except Exception:
        logger.exception("Error removing %s", path)


async def purge_dataset_completely(db: AsyncSession, dataset: Dataset) -> dict[str, Any]:
    """Hard-delete ``dataset`` and every reference to it. Returns a summary."""
    ds_id = dataset.id
    data_file_id = dataset.data_file_id
    legacy_file_path = dataset.file_path
    legacy_converted_path = dataset.converted_path

    # 1. Drop M2M project links explicitly (works regardless of FK cascade).
    await db.execute(
        sql_delete(project_dataset).where(project_dataset.c.dataset_id == ds_id)
    )
    # 2. Delete the dataset row via a Core DELETE rather than session.delete().
    #    An ORM delete would, during flush, try to lazy-load the unloaded
    #    `Dataset.projects` (many-to-many) collection to cascade the secondary
    #    rows — which raises MissingGreenlet under the async engine. The Core
    #    delete bypasses relationship processing entirely; we already cleared
    #    the association rows above.
    await db.execute(sql_delete(Dataset).where(Dataset.id == ds_id))
    await db.commit()

    # 3. GC the dedup DataFile (and its on-disk files) if now unreferenced.
    if data_file_id:
        ref = await db.scalar(
            select(func.count(Dataset.id)).where(Dataset.data_file_id == data_file_id)
        )
        if (ref or 0) == 0:
            df = await db.get(DataFile, data_file_id)
            if df:
                _rm(df.file_path)
                _rm(df.converted_path)
                await db.delete(df)
                await db.commit()
    else:
        # Legacy datasets that own their paths directly.
        _rm(legacy_file_path)
        _rm(legacy_converted_path)

    # 4. Remove sessions / notifications referencing this dataset id. The id
    #    appears as a substring in the JSON blobs (single-view datasetId or
    #    nested workspace views) and in notification links/payloads.
    sid = str(ds_id)
    sess_res = await db.execute(
        sql_delete(DbSession).where(cast(DbSession.data, Text).like(f"%{sid}%"))
    )
    notif_res = await db.execute(
        sql_delete(Notification).where(
            or_(
                Notification.link.like(f"%{sid}%"),
                cast(Notification.payload, Text).like(f"%{sid}%"),
            )
        )
    )
    await db.commit()

    # 5. Drop cached SOMA handles / expression bytes for the converted store.
    if legacy_converted_path:
        try:
            soma_cache.invalidate(legacy_converted_path)
        except Exception:  # noqa: BLE001
            pass

    return {
        "sessions_removed": int(sess_res.rowcount or 0),
        "notifications_removed": int(notif_res.rowcount or 0),
    }
