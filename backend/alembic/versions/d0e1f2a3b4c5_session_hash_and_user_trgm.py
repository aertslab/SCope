"""session content_hash (unguessable share IDs) + pg_trgm user-search indexes

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-06-15 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Session share links now use unguessable random IDs; content_hash is the
    # internal dedup key so identical payloads still collapse to one row.
    op.add_column("sessions", sa.Column("content_hash", sa.String(), nullable=True))
    op.create_index("ix_sessions_content_hash", "sessions", ["content_hash"])

    # Trigram indexes make the leading-wildcard ILIKE user search cheap and
    # avoid full-table scans that could be abused for enumeration/DoS.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_users_email_trgm",
        "users",
        ["email"],
        postgresql_using="gin",
        postgresql_ops={"email": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_users_full_name_trgm",
        "users",
        ["full_name"],
        postgresql_using="gin",
        postgresql_ops={"full_name": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_users_full_name_trgm", table_name="users")
    op.drop_index("ix_users_email_trgm", table_name="users")
    op.drop_index("ix_sessions_content_hash", table_name="sessions")
    op.drop_column("sessions", "content_hash")
