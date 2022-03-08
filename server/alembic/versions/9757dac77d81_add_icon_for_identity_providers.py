"""Add icon for identity providers

Revision ID: 9757dac77d81
Revises: 7f5bfebc7bd6
Create Date: 2021-10-13 10:52:11.738485

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9757dac77d81"
down_revision = "7f5bfebc7bd6"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("providers", schema=None) as batch_op:
        batch_op.add_column(sa.Column("icon", sa.String(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("providers", schema=None) as batch_op:
        batch_op.drop_column("icon")

    # ### end Alembic commands ###
