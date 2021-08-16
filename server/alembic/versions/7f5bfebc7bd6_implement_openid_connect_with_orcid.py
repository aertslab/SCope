"""Implement OpenID Connect auth

Revision ID: 7f5bfebc7bd6
Revises: fdb90fa20f06
Create Date: 2021-08-04 22:08:47.059845

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7f5bfebc7bd6"
down_revision = "fdb90fa20f06"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "uploadlimit",
        sa.Column("mime", sa.String(), nullable=False),
        sa.Column("maxsize", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("mime"),
    )
    with op.batch_alter_table("uploadlimit", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_uploadlimit_mime"), ["mime"], unique=True)

    provider_table = op.create_table(
        "providers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("issuer", sa.String(), nullable=False),
        sa.Column("clientid", sa.String(), nullable=False),
        sa.Column("secret", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("providers", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_providers_id"), ["id"], unique=False)
    op.create_table(
        "project_owner_mapping",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project", sa.Integer(), nullable=True),
        sa.Column("owner", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["project"],
            ["projects.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("project_owner_mapping", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_project_owner_mapping_id"), ["id"], unique=False)
        batch_op.create_index(batch_op.f("ix_project_owner_mapping_owner"), ["owner"], unique=False)
        batch_op.create_index(batch_op.f("ix_project_owner_mapping_project"), ["project"], unique=False)

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("iss", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("sub", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("role", sa.String(), nullable=False))
        batch_op.create_index(batch_op.f("ix_users_iss"), ["iss"], unique=False)
        batch_op.create_index(batch_op.f("ix_users_sub"), ["sub"], unique=False)
        batch_op.create_unique_constraint("login_id", ["iss", "sub"])

    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_index("ix_projects_uuid")
        batch_op.create_index(batch_op.f("ix_projects_uuid"), ["uuid"], unique=True)

    # Prefill Keycloak provider
    op.bulk_insert(
        provider_table,
        [
            {
                "name": "Keycloak (Dev only)",
                "issuer": "http://localhost:8080/auth/realms/SCope",
                "clientid": "scope",
                "secret": "4e979b39-9386-45a3-b3f8-e47461b03e3e",
            },
        ],
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_projects_uuid"))
        batch_op.create_index("ix_projects_uuid", ["uuid"], unique=False)

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("login_id", type_="unique")
        batch_op.drop_index(batch_op.f("ix_users_sub"))
        batch_op.drop_index(batch_op.f("ix_users_iss"))
        batch_op.drop_column("role")
        batch_op.drop_column("name")
        batch_op.drop_column("sub")
        batch_op.drop_column("iss")

    with op.batch_alter_table("providers", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_providers_id"))

    op.drop_table("providers")

    with op.batch_alter_table("project_owner_mapping", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_owner_mapping_project"))
        batch_op.drop_index(batch_op.f("ix_project_owner_mapping_owner"))
        batch_op.drop_index(batch_op.f("ix_project_owner_mapping_id"))

    op.drop_table("project_owner_mapping")

    with op.batch_alter_table("uploadlimit", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_uploadlimit_mime"))

    op.drop_table("uploadlimit")
    # ### end Alembic commands ###
