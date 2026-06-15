"""user-facing feature columns: dataset failure_reason + session.created_by

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-30 00:00:00.000000

* ``datasets.failure_reason`` — captures the worker's exception message when
  conversion fails, surfacing it to the user in the dataset list.
* ``sessions.created_by`` — nullable FK to users; lets logged-in viewers see
  the sessions they created. Existing anonymous sessions remain NULL.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("failure_reason", sa.String(), nullable=True),
    )
    op.add_column(
        "sessions",
        sa.Column("created_by", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sessions_created_by_users",
        "sessions",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_sessions_created_by", "sessions", ["created_by"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_created_by", table_name="sessions")
    op.drop_constraint(
        "fk_sessions_created_by_users", "sessions", type_="foreignkey"
    )
    op.drop_column("sessions", "created_by")
    op.drop_column("datasets", "failure_reason")
