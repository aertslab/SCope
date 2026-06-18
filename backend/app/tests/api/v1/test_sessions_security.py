"""Tests for the hardened session share-link behaviour.

Share links must be (a) unguessable random IDs (not derived from payload),
(b) deduped by content so re-sharing the same workspace is stable, and (c)
served to anonymous callers WITHOUT leaking the creator id.
"""
from __future__ import annotations

import os

os.environ.setdefault("ALLOW_INSECURE_SECRETS", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import uuid
from typing import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.user import User
from app.schemas.session import SessionCreate, SessionPublic, Session as SessionSchema
from app.api.v1.endpoints.sessions import _content_hash, create_session


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


def test_content_hash_is_deterministic_and_distinct():
    a = {"type": "workspace", "views": {"main": {"datasetId": "1"}}}
    b = {"type": "workspace", "views": {"main": {"datasetId": "2"}}}
    assert _content_hash(a) == _content_hash(dict(a))  # order-independent / stable
    assert _content_hash(a) != _content_hash(b)


def test_public_schema_omits_creator_and_timestamps():
    # The unauthenticated GET must not leak who created the session or when.
    assert "created_by" not in SessionPublic.model_fields
    assert "created_at" not in SessionPublic.model_fields
    assert set(SessionPublic.model_fields) == {"id", "data"}
    # The owner-facing schema still carries them.
    assert "created_by" in SessionSchema.model_fields


async def test_create_session_uses_unguessable_id_and_dedupes(session: AsyncSession):
    payload = SessionCreate(data={"type": "workspace", "datasetId": "abc"})

    s1 = await create_session(payload, session, None)
    # token_urlsafe(16) → ~22 chars; definitely not the old 8-char derived id,
    # and not derivable from the payload.
    assert len(s1.id) >= 20
    assert s1.content_hash == _content_hash(payload.data)

    # Re-creating the identical payload dedupes to the same row/id.
    s2 = await create_session(SessionCreate(data=dict(payload.data)), session, None)
    assert s2.id == s1.id

    # A different payload gets a different unguessable id.
    s3 = await create_session(SessionCreate(data={"type": "workspace", "datasetId": "xyz"}), session, None)
    assert s3.id != s1.id


async def test_anonymous_session_claims_owner_on_login(session: AsyncSession):
    user = User(id=uuid.uuid4(), email="o@x.test", hashed_password="x", is_active=True)
    session.add(user)
    await session.commit()

    payload = SessionCreate(data={"type": "workspace", "datasetId": "claim"})
    anon = await create_session(payload, session, None)
    assert anon.created_by is None

    claimed = await create_session(SessionCreate(data=dict(payload.data)), session, user)
    assert claimed.id == anon.id
    assert claimed.created_by == user.id
