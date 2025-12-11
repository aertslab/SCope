"""add data_files table

Revision ID: 8901234567cd
Revises: 52956a294447
Create Date: 2025-12-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8901234567cd'
down_revision = '52956a294447'
branch_labels = None
depends_on = None


def upgrade():
    # Create data_files table
    op.create_table(
        'data_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_hash', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('converted_path', sa.String(), nullable=True),
        sa.Column('converted_size', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_data_files_file_hash'), 'data_files', ['file_hash'], unique=True)
    op.create_index(op.f('ix_data_files_id'), 'data_files', ['id'], unique=False)

    # Add data_file_id to datasets table
    op.add_column('datasets', sa.Column('data_file_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(None, 'datasets', 'data_files', ['data_file_id'], ['id'])


def downgrade():
    op.drop_constraint('datasets_data_file_id_fkey', 'datasets', type_='foreignkey')
    op.drop_column('datasets', 'data_file_id')
    op.drop_index(op.f('ix_data_files_id'), table_name='data_files')
    op.drop_index(op.f('ix_data_files_file_hash'), table_name='data_files')
    op.drop_table('data_files')
