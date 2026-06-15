"""notifications + group invitations

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-30 12:00:00.000000

Adds two tightly related tables:

* ``notifications`` — in-app inbox rows. JSONB payload for type-specific data.
* ``group_invitations`` — pending join requests with accept/decline workflow,
  unique per (group, invitee) so a user can't be spammed with duplicate
  invites for the same group.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=True),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index(
        "ix_notifications_user_created",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
    )

    op.create_table(
        "group_invitations",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("group_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("inviter_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("invitee_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inviter_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invitee_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "group_id", "invitee_id", name="uq_group_invitations_group_invitee"
        ),
    )
    op.create_index("ix_group_invitations_group_id", "group_invitations", ["group_id"])
    op.create_index("ix_group_invitations_invitee_id", "group_invitations", ["invitee_id"])


def downgrade() -> None:
    op.drop_index("ix_group_invitations_invitee_id", table_name="group_invitations")
    op.drop_index("ix_group_invitations_group_id", table_name="group_invitations")
    op.drop_table("group_invitations")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
