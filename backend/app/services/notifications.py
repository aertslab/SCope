"""Helper to emit notifications from any endpoint.

Endpoints should call ``create(...)`` *before* committing so the row joins the
same transaction as the action that triggered it. If creation fails, callers
are expected to log and swallow — a missing notification must never break the
underlying business action.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    type: str,
    title: str,
    message: Optional[str] = None,
    link: Optional[str] = None,
    payload: Optional[Mapping[str, Any]] = None,
) -> Notification:
    """Insert a notification row (without committing).

    The caller's outer transaction is responsible for the commit. We add only
    — no flush — so we don't force a round-trip mid-handler.
    """
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
        payload=dict(payload) if payload is not None else None,
    )
    db.add(notif)
    return notif
