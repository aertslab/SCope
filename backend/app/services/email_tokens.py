"""Issue / consume single-use email tokens (password reset, email verification).

We generate a high-entropy URL-safe random token, hash it with SHA-256, and
store only the hash. The plaintext is shown to the user exactly once via the
verification / reset URL we email them.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.email_token import EmailToken
from app.models.user import User

Purpose = Literal["password_reset", "email_verification"]


def _hash_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _expiry_for(purpose: Purpose) -> datetime:
    hours = (
        settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
        if purpose == "password_reset"
        else settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
    )
    return datetime.now(timezone.utc) + timedelta(hours=hours)


async def issue_token(
    db: AsyncSession,
    user: User,
    purpose: Purpose,
) -> str:
    """Create a fresh token for the user/purpose. Returns the plaintext token.

    Existing un-used tokens for the same purpose are kept; the latest one
    issued is what we email. Stale tokens just expire on their own. This
    avoids race conditions if the user clicks an older link.
    """
    plaintext = secrets.token_urlsafe(32)
    db_token = EmailToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=_hash_token(plaintext),
        expires_at=_expiry_for(purpose),
    )
    db.add(db_token)
    await db.commit()
    return plaintext


async def consume_token(
    db: AsyncSession,
    plaintext: str,
    purpose: Purpose,
) -> Optional[User]:
    """Validate a plaintext token; mark it used; return the bound user.

    Returns None if the token is unknown, expired, used, or wrong purpose.
    """
    token_hash = _hash_token(plaintext)
    res = await db.execute(
        select(EmailToken).where(EmailToken.token_hash == token_hash)
    )
    token = res.scalars().first()
    if token is None or token.purpose != purpose:
        return None
    if token.used_at is not None:
        return None
    now = datetime.now(timezone.utc)
    # Compare tolerant of naive vs aware datetimes returned by drivers.
    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= now:
        return None

    user_res = await db.execute(select(User).where(User.id == token.user_id))
    user = user_res.scalars().first()
    if user is None:
        return None

    token.used_at = now
    db.add(token)
    await db.commit()
    return user
