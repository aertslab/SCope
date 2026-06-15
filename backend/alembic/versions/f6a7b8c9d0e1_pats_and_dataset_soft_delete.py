"""personal access tokens + dataset soft delete

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-30 18:00:00.000000

* ``personal_access_tokens`` — hashed long-lived bearer tokens for
  programmatic API access.
* ``datasets.deleted_at`` — nullable timestamp; non-null rows are
  soft-deleted (hidden from default queries, restorable until purged).
"""
from alembic import op
import sqlalchemy as sa


revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personal_access_tokens",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash", name="uq_pat_token_hash"),
    )
    op.create_index("ix_pat_user_id", "personal_access_tokens", ["user_id"])
    op.create_index("ix_pat_token_hash", "personal_access_tokens", ["token_hash"])

    op.add_column(
        "datasets",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_datasets_deleted_at", "datasets", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_datasets_deleted_at", table_name="datasets")
    op.drop_column("datasets", "deleted_at")
    op.drop_index("ix_pat_token_hash", table_name="personal_access_tokens")
    op.drop_index("ix_pat_user_id", table_name="personal_access_tokens")
    op.drop_table("personal_access_tokens")
