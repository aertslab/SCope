"""User-facing in-app notifications.

Lightweight notification rows the frontend pulls via /notifications/me. Other
services emit notifications via app.services.notifications.create(). Each row
carries an optional JSON payload for type-specific metadata (e.g. the
group_invitation_id on a "group_invitation" notification) and an optional
``link`` which the frontend uses as a click target.
"""
from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Free-form discriminator the frontend may use to pick an icon. Examples:
    # "group_invitation", "project_share", "ownership_transfer",
    # "dataset_processed", "dataset_failed".
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=True)
    link = Column(String, nullable=True)
    # JSONB on Postgres; SQLAlchemy maps to dict at the Python layer.
    payload = Column(JSONB, nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Composite index that powers the typical "unread for this user, newest first"
# query without forcing the planner into a full scan + sort on big tables.
Index(
    "ix_notifications_user_created",
    Notification.user_id,
    Notification.created_at.desc(),
)
