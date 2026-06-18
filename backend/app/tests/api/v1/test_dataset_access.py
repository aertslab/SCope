"""Access-control tests for dataset serving (the IDOR-relevant gate).

`check_dataset_access` is the single chokepoint every dataset read endpoint
(/metadata, /embedding, /expression, /feature, /download) flows through, and
the same helper now also guards attaching a dataset to a project. These tests
pin: owner access, unrelated-user denial, unauthenticated denial, public-via-
project access, and password-project access. Hermetic in-memory SQLite — no
running services required.
"""
from __future__ import annotations

import os

os.environ.setdefault("ALLOW_INSECURE_SECRETS", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.dataset import Dataset
from app.models.project import Project, ProjectVisibility, project_dataset
from app.models.user import User
from app.api.v1.endpoints.datasets import check_dataset_access
from app.core.security import get_password_hash_async


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


async def _user(db: AsyncSession, *, superuser: bool = False) -> User:
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


async def _dataset(db: AsyncSession, owner: User) -> Dataset:
    ds = Dataset(
        id=uuid.uuid4(),
        name="ds",
        file_type="h5ad",
        file_path="uploads/x.h5ad",
        status="ready",
        owner_id=owner.id,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return ds


async def _link(db: AsyncSession, project: Project, ds: Dataset) -> None:
    await db.execute(insert(project_dataset).values(project_id=project.id, dataset_id=ds.id))
    await db.commit()


async def test_owner_can_access(session: AsyncSession):
    owner = await _user(session)
    ds = await _dataset(session, owner)
    got = await check_dataset_access(ds.id, session, owner)
    assert got.id == ds.id


async def test_superuser_can_access(session: AsyncSession):
    owner = await _user(session)
    admin = await _user(session, superuser=True)
    ds = await _dataset(session, owner)
    got = await check_dataset_access(ds.id, session, admin)
    assert got.id == ds.id


async def test_unrelated_user_denied(session: AsyncSession):
    owner = await _user(session)
    other = await _user(session)
    ds = await _dataset(session, owner)
    with pytest.raises(HTTPException) as exc:
        await check_dataset_access(ds.id, session, other)
    assert exc.value.status_code == 403


async def test_anonymous_denied(session: AsyncSession):
    owner = await _user(session)
    ds = await _dataset(session, owner)
    with pytest.raises(HTTPException) as exc:
        await check_dataset_access(ds.id, session, None)
    assert exc.value.status_code == 401


async def test_public_project_grants_access(session: AsyncSession):
    owner = await _user(session)
    other = await _user(session)
    ds = await _dataset(session, owner)
    project = Project(id=uuid.uuid4(), name="p", owner_id=owner.id, visibility=ProjectVisibility.PUBLIC)
    session.add(project)
    await session.commit()
    await _link(session, project, ds)
    got = await check_dataset_access(ds.id, session, other)
    assert got.id == ds.id


async def test_password_project_requires_correct_password(session: AsyncSession):
    owner = await _user(session)
    other = await _user(session)
    ds = await _dataset(session, owner)
    project = Project(
        id=uuid.uuid4(),
        name="p",
        owner_id=owner.id,
        visibility=ProjectVisibility.PASSWORD,
        password_hash=await get_password_hash_async("s3cret"),
    )
    session.add(project)
    await session.commit()
    await _link(session, project, ds)

    # Missing / wrong password → denied.
    with pytest.raises(HTTPException):
        await check_dataset_access(ds.id, session, other, password=None)
    with pytest.raises(HTTPException):
        await check_dataset_access(ds.id, session, other, password="wrong")

    # Correct password → access.
    got = await check_dataset_access(ds.id, session, other, password="s3cret")
    assert got.id == ds.id


async def test_soft_deleted_dataset_is_not_found(session: AsyncSession):
    from datetime import datetime, timezone

    owner = await _user(session)
    ds = await _dataset(session, owner)
    ds.deleted_at = datetime.now(timezone.utc)
    session.add(ds)
    await session.commit()
    with pytest.raises(HTTPException) as exc:
        await check_dataset_access(ds.id, session, owner)
    assert exc.value.status_code == 404
