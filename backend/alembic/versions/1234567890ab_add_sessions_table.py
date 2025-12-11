"""Add sessions table

Revision ID: 1234567890ab
Revises: 4fa7fdf7d45c
Create Date: 2025-11-26 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1234567890ab'
down_revision = '589adb91bea5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('sessions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('data', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('sessions')
