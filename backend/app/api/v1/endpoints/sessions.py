import hashlib
import json
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db, get_current_active_user, get_current_user_optional
from app.models.session import Session
from app.models.user import User
from app.schemas.session import SessionCreate, Session as SessionSchema, SessionPublic

router = APIRouter()


def _content_hash(data: dict) -> str:
    """Stable fingerprint of a session payload, used only for internal dedup."""
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()


@router.post("/", response_model=SessionSchema)
async def create_session(
    session_in: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Create (or dedupe to) a shareable session.

    The public URL ``id`` is a long, unguessable random token so share links
    are not enumerable and are not derivable from the payload. Identical
    payloads still collapse to one row via the internal ``content_hash`` so
    re-sharing the same workspace yields a stable link.
    """
    creator_id = current_user.id if current_user else None
    chash = _content_hash(session_in.data)

    existing = (
        await db.execute(select(Session).where(Session.content_hash == chash))
    ).scalars().first()
    if existing and existing.data == session_in.data:
        # Claim ownership if previously anonymous and we're logged in now.
        if existing.created_by is None and creator_id is not None:
            existing.created_by = creator_id
            await db.commit()
            await db.refresh(existing)
        return existing

    # 128 bits of entropy in a url-safe token (~22 chars). Not enumerable.
    db_session = Session(
        id=secrets.token_urlsafe(16),
        data=session_in.data,
        created_by=creator_id,
        content_hash=chash,
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


@router.get("/{session_id}", response_model=SessionPublic)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public share-link resolution. Returns only ``{id, data}`` — never the
    creator id or timestamps. Any dataset referenced inside ``data`` is still
    gated by ``check_dataset_access`` when the viewer loads it, so a leaked
    link to a private dataset still requires the viewer's own permission."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
