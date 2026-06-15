from sqlalchemy import Column, String, DateTime, ForeignKey, Uuid, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class AuditLog(Base):
    """Immutable record of meaningful state changes.

    The activity feed shown in the admin dashboard previously derived events
    from ``created_at`` columns on Datasets/Projects/Groups, which means
    deletes, role changes, ownership transfers, and trash operations were
    invisible. This table is append-only — entries should never be mutated
    after insertion.

    ``actor_id`` is nullable + ``ondelete=SET NULL`` so audit history
    survives user deletion (we want to know that "user X did Y" even after
    X is gone, hence the optional ``actor_email`` snapshot).
    """

    __tablename__ = "audit_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Snapshotted at write-time so deleted-user history is still readable.
    actor_email = Column(String, nullable=True)
    # Verb-style label, e.g. "project.delete", "group.member.remove",
    # "dataset.restore", "project.ownership.transfer".
    action = Column(String, nullable=False, index=True)
    # Pluralisable noun, e.g. "project", "dataset", "group", "user".
    resource_type = Column(String, nullable=True, index=True)
    # Stored as String (not Uuid) so we can also reference compound keys
    # or short codes if a future event isn't tied to a UUID resource.
    resource_id = Column(String, nullable=True, index=True)
    # Free-form structured detail — old/new values, target email, etc.
    extra = Column("metadata", JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    actor = relationship("User", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )
