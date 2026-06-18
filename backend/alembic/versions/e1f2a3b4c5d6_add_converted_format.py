"""converted_format on datasets/data_files (zarr|soma dual-read)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-06-15 00:30:00
"""
from alembic import op
import sqlalchemy as sa


revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NULL means "legacy zarr"; the worker stamps "soma" on new conversions.
    op.add_column("datasets", sa.Column("converted_format", sa.String(), nullable=True))
    op.add_column("data_files", sa.Column("converted_format", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("data_files", "converted_format")
    op.drop_column("datasets", "converted_format")
