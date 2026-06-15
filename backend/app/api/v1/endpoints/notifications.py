"""In-app notification inbox endpoints."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    Notification as NotificationSchema,
    NotificationList,
)


router = APIRouter()


@router.get("/me", response_model=NotificationList)
async def list_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Newest-first inbox for the current user.

    Always returns the user's total ``unread_count`` even when ``unread_only``
    is True so the frontend bell badge can update from the same call.
    """
    base = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        base = base.where(Notification.read_at.is_(None))
    items_q = base.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    items_result = await db.execute(items_q)
    items = items_result.scalars().all()

    unread_q = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    )
    unread_count = await db.scalar(unread_q) or 0

    return NotificationList(items=items, unread_count=unread_count)  # type: ignore[arg-type]


@router.get("/me/unread-count")
async def unread_count(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Tiny endpoint the bell can poll cheaply (single integer)."""
    q = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    )
    return {"unread_count": await db.scalar(q) or 0}


@router.patch("/{notification_id}/read", response_model=NotificationSchema)
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    notif = await db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.read_at is None:
        notif.read_at = func.now()  # type: ignore[assignment]
    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/me/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Mark every unread notification for this user as read in one shot."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    await db.execute(stmt)
    await db.commit()
    return None


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    notif = await db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notif)
    await db.commit()
    return None
