"""Pending invitations to join a group.

Replaces the previous "admin adds members directly" model: an invitation is
created with status="pending", the invitee gets a notification, and they may
accept (which spawns a GroupMember) or decline (which deletes the row).
"""
from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum
import uuid


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    REVOKED = "revoked"


class GroupInvitation(Base):
    __tablename__ = "group_invitations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inviter_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    invitee_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Stored as plain string so we don't pin the DB to a Postgres ENUM type.
    role = Column(String, nullable=False, default="member")
    status = Column(String, nullable=False, default=InvitationStatus.PENDING.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    group = relationship("Group")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

    # Only one outstanding (or historical) invitation per (group, invitee).
    # When a user declines we delete the row, so the next invite is unblocked.
    __table_args__ = (
        UniqueConstraint("group_id", "invitee_id", name="uq_group_invitations_group_invitee"),
    )
