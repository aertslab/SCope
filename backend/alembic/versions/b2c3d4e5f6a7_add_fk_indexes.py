"""add fk indexes for join-heavy queries

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-30 00:00:00.000000

Postgres does not auto-create indexes for foreign keys. Without them, every
``DELETE`` or join through these columns triggers a sequential scan. Indexes
added:

* ``project_datasets.project_id`` — listing a project's datasets.
* ``project_datasets.dataset_id`` — cascade-deleting a dataset.
* ``project_shares.project_id`` — fetching shares for a project.
* ``project_shares.user_id``    — listing projects shared with a user.
* ``project_shares.group_id``   — listing projects shared with a group.
* ``datasets.owner_id``         — listing datasets owned by a user.
* ``datasets.data_file_id``     — refcount lookups on dataset deletion.
* ``oauth_accounts.user_id``    — fetching all oauth links for a user.
* ``group_members.user_id``     — listing groups for a user.
* ``group_members.group_id``    — listing members of a group.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


_INDEXES = [
    ("ix_project_datasets_project_id", "project_datasets", ["project_id"]),
    ("ix_project_datasets_dataset_id", "project_datasets", ["dataset_id"]),
    ("ix_project_shares_project_id", "project_shares", ["project_id"]),
    ("ix_project_shares_user_id", "project_shares", ["user_id"]),
    ("ix_project_shares_group_id", "project_shares", ["group_id"]),
    ("ix_datasets_owner_id", "datasets", ["owner_id"]),
    ("ix_datasets_data_file_id", "datasets", ["data_file_id"]),
    ("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"]),
    ("ix_group_members_user_id", "group_members", ["user_id"]),
    ("ix_group_members_group_id", "group_members", ["group_id"]),
]


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        op.create_index(name, table, cols, unique=False)


def downgrade() -> None:
    for name, table, _cols in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
