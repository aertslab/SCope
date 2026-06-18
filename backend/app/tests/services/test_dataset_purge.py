"""Tests for the complete-purge service.

Critically exercises a dataset that IS linked to a project (the case that made
an ORM ``session.delete`` raise MissingGreenlet under async), plus a session and
a notification that reference the dataset — all must be gone after a purge.
"""
from __future__ import annotations

import os

os.environ.setdefault("ALLOW_INSECURE_SECRETS", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import uuid
from typing import AsyncGenerator

import pytest_asyncio
from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.dataset import Dataset
from app.models.notification import Notification
from app.models.project import Project, ProjectVisibility, project_dataset
from app.models.session import Session as DbSession
from app.models.user import User
from app.services.dataset_purge import purge_dataset_completely


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


async def test_purge_removes_links_sessions_notifications(session: AsyncSession):
    user = User(id=uuid.uuid4(), email="o@x.test", hashed_password="x", is_active=True)
    ds = Dataset(
        id=uuid.uuid4(), name="ds", file_type="h5ad",
        file_path="uploads/x.h5ad", status="ready", owner_id=user.id,
    )
    project = Project(id=uuid.uuid4(), name="p", owner_id=user.id, visibility=ProjectVisibility.PRIVATE)
    session.add_all([user, ds, project])
    await session.commit()

    # Link the dataset to the project (the M2M row that broke ORM delete).
    await session.execute(insert(project_dataset).values(project_id=project.id, dataset_id=ds.id))
    # A share link and a notification that reference the dataset id.
    session.add(DbSession(id="sess-1", data={"datasetId": str(ds.id)}, created_by=user.id))
    session.add(
        Notification(
            id=uuid.uuid4(), user_id=user.id, type="dataset_processed",
            title="ready", link=f"/datasets/{ds.id}", payload={"dataset_id": str(ds.id)},
        )
    )
    await session.commit()

    summary = await purge_dataset_completely(session, ds)

    # Dataset row gone.
    assert await session.get(Dataset, ds.id) is None
    # M2M link gone.
    link_count = await session.scalar(
        select(func.count()).select_from(project_dataset).where(project_dataset.c.dataset_id == ds.id)
    )
    assert link_count == 0
    # Project itself survives.
    assert await session.get(Project, project.id) is not None
    # Referencing session + notification removed.
    assert await session.get(DbSession, "sess-1") is None
    assert (await session.scalar(select(func.count(Notification.id)))) == 0
    assert summary == {"sessions_removed": 1, "notifications_removed": 1}
