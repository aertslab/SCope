"""add db-level constraints: disjoint share fk + oauth uniqueness

Revision ID: a1b2c3d4e5f6
Revises: 8901234567cd
Create Date: 2026-04-30 00:00:00.000000

Adds:
  * CHECK constraint on `project_shares` enforcing exactly one of
    (user_id, group_id) is non-null.
  * Composite UNIQUE on `oauth_accounts(provider, provider_account_id)`
    (matches the lookup pattern in the auth flow).
  * Composite UNIQUE on `project_shares(project_id, user_id)` and
    `project_shares(project_id, group_id)` so that duplicate share inserts
    surface as IntegrityError instead of silently double-counting.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "8901234567cd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_project_shares_user_xor_group",
        "project_shares",
        "(user_id IS NULL) <> (group_id IS NULL)",
    )
    op.create_unique_constraint(
        "uq_oauth_accounts_provider_account",
        "oauth_accounts",
        ["provider", "provider_account_id"],
    )
    op.create_unique_constraint(
        "uq_project_shares_project_user",
        "project_shares",
        ["project_id", "user_id"],
    )
    op.create_unique_constraint(
        "uq_project_shares_project_group",
        "project_shares",
        ["project_id", "group_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_project_shares_project_group", "project_shares", type_="unique"
    )
    op.drop_constraint(
        "uq_project_shares_project_user", "project_shares", type_="unique"
    )
    op.drop_constraint(
        "uq_oauth_accounts_provider_account", "oauth_accounts", type_="unique"
    )
    op.drop_constraint(
        "ck_project_shares_user_xor_group", "project_shares", type_="check"
    )
