import hashlib
import json
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db, get_current_active_user, get_current_user_optional
from app.models.session import Session
from app.models.user import User
from app.schemas.session import SessionCreate, Session as SessionSchema
import uuid

router = APIRouter()


def generate_deterministic_id(data: dict, length=8, attempt=0):
    data_str = json.dumps(data, sort_keys=True)
    if attempt > 0:
        data_str += f":{attempt}"
    seed_str = hashlib.sha256(data_str.encode()).hexdigest()
    rng = random.Random(seed_str)
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return ''.join(rng.choice(alphabet) for _ in range(length))


@router.post("/", response_model=SessionSchema)
async def create_session(
    session_in: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    creator_id = current_user.id if current_user else None

    for attempt in range(10):
        short_id = generate_deterministic_id(session_in.data, attempt=attempt)
        existing = await db.get(Session, short_id)

        if existing:
            if existing.data == session_in.data:
                # Claim ownership if previously anonymous and we're logged in now
                if existing.created_by is None and creator_id is not None:
                    existing.created_by = creator_id
                    await db.commit()
                    await db.refresh(existing)
                return existing
            # Hash collision on different content; try again with a salt.
            continue
        else:
            db_session = Session(
                id=short_id,
                data=session_in.data,
                created_by=creator_id,
            )
            db.add(db_session)
            await db.commit()
            await db.refresh(db_session)
            return db_session

    # Fallback to UUID if collision loop fails
    db_session = Session(
        id=str(uuid.uuid4()),
        data=session_in.data,
        created_by=creator_id,
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session


@router.get("/me", response_model=List[SessionSchema])
async def list_my_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
):
    """List sessions created by the current user."""
    result = await db.execute(
        select(Session)
        .where(Session.created_by == current_user.id)
        .order_by(Session.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/me/{session_id}", status_code=204)
async def delete_my_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete one of the current user's sessions."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.created_by != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not your session")
    await db.delete(session)
    await db.commit()
    return None


@router.get("/{session_id}", response_model=SessionSchema)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
