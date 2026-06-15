"""Unit tests for permission resolution.

These tests use an in-memory SQLite database to keep things hermetic. The
`get_user_project_permission` helper only depends on the ProjectShare /
GroupMember tables, so a thin slice of the schema is enough.
"""
from __future__ import annotations

import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.group import Group, GroupMember
from app.models.project import Project, ProjectPermission, ProjectShare, ProjectVisibility
from app.models.user import User
from app.services.permissions import get_user_project_permission


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


async def _make_project(db: AsyncSession, owner: User) -> Project:
    project = Project(
        id=uuid.uuid4(),
        name="p",
        owner_id=owner.id,
        visibility=ProjectVisibility.PRIVATE,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def _make_user(db: AsyncSession, *, superuser: bool = False) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@x.test",
        hashed_password="x",
        is_superuser=superuser,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest.mark.asyncio
async def test_no_user_returns_none(session: AsyncSession):
    owner = await _make_user(session)
    project = await _make_project(session, owner)
    assert await get_user_project_permission(project, None, session) is None


@pytest.mark.asyncio
async def test_owner_is_admin(session: AsyncSession):
    owner = await _make_user(session)
    project = await _make_project(session, owner)
    assert (
        await get_user_project_permission(project, owner, session)
        == ProjectPermission.ADMIN
    )


@pytest.mark.asyncio
async def test_superuser_is_admin(session: AsyncSession):
    owner = await _make_user(session)
    project = await _make_project(session, owner)
    admin = await _make_user(session, superuser=True)
    assert (
        await get_user_project_permission(project, admin, session)
        == ProjectPermission.ADMIN
    )


@pytest.mark.asyncio
async def test_unrelated_user_has_no_permission(session: AsyncSession):
    owner = await _make_user(session)
    other = await _make_user(session)
    project = await _make_project(session, owner)
    assert await get_user_project_permission(project, other, session) is None


@pytest.mark.parametrize(
    "permission",
    [ProjectPermission.VIEW, ProjectPermission.EDIT, ProjectPermission.ADMIN],
)
@pytest.mark.asyncio
async def test_direct_share_grants_permission(
    session: AsyncSession, permission: ProjectPermission
):
    owner = await _make_user(session)
    other = await _make_user(session)
    project = await _make_project(session, owner)
    session.add(
        ProjectShare(project_id=project.id, user_id=other.id, permission=permission)
    )
    await session.commit()
    assert (
        await get_user_project_permission(project, other, session) == permission
    )


@pytest.mark.asyncio
async def test_view_plus_edit_resolves_to_edit(session: AsyncSession):
    """If a user receives VIEW directly and EDIT via group, EDIT wins."""
    owner = await _make_user(session)
    user = await _make_user(session)
    project = await _make_project(session, owner)

    group = Group(id=uuid.uuid4(), name="g")
    session.add(group)
    await session.commit()
    session.add(GroupMember(group_id=group.id, user_id=user.id))
    session.add(
        ProjectShare(
            project_id=project.id,
            user_id=user.id,
            permission=ProjectPermission.VIEW,
        )
    )
    session.add(
        ProjectShare(
            project_id=project.id,
            group_id=group.id,
            permission=ProjectPermission.EDIT,
        )
    )
    await session.commit()

    assert (
        await get_user_project_permission(project, user, session)
        == ProjectPermission.EDIT
    )


@pytest.mark.asyncio
async def test_admin_short_circuits_lower_grants(session: AsyncSession):
    owner = await _make_user(session)
    user = await _make_user(session)
    project = await _make_project(session, owner)
    session.add(
        ProjectShare(
            project_id=project.id,
            user_id=user.id,
            permission=ProjectPermission.VIEW,
        )
    )
    # Add an ADMIN share via duplicate row (only possible until the DB UNIQUE
    # constraint lands; the helper itself must still pick ADMIN).
    session.add(
        ProjectShare(
            project_id=project.id,
            user_id=user.id,
            permission=ProjectPermission.ADMIN,
        )
    )
    await session.commit()

    assert (
        await get_user_project_permission(project, user, session)
        == ProjectPermission.ADMIN
    )
