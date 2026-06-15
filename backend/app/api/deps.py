from typing import Optional
from datetime import datetime, timezone
import hashlib

from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.personal_access_token import PersonalAccessToken
from app.schemas.token import TokenPayload
from sqlalchemy import select


# Prefix that identifies a Personal Access Token in an Authorization header.
# JWTs from /login/access-token are dot-separated base64 segments; PATs
# always start with this fixed prefix so we can route auth without trying
# (and failing) to JWT-decode them.
PAT_PREFIX = "scope_pat_"


def _hash_pat(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _extract_token(request: Request) -> Optional[str]:
    """Return the raw JWT from the auth cookie, falling back to a Bearer header.

    Cookies are preferred so that browser clients never need to touch the token
    in JS. The Authorization header remains supported for CLI tooling and for
    backward compatibility with existing integrations.
    """
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip() or None
    return None


def _decode_token(token: str) -> TokenPayload:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
    return TokenPayload(**payload)


async def _resolve_pat(token: str, db: AsyncSession) -> Optional[User]:
    """Look up a PAT by hash, validate expiry, bump last_used_at."""
    digest = _hash_pat(token)
    result = await db.execute(
        select(PersonalAccessToken).where(PersonalAccessToken.token_hash == digest)
    )
    pat = result.scalars().first()
    if not pat:
        return None
    if pat.expires_at is not None:
        # Normalize to aware UTC for the comparison; SQLAlchemy returns aware
        # datetimes for timezone=True columns on Postgres.
        exp = pat.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= datetime.now(timezone.utc):
            return None
    # Avoid a write on every authenticated request — PAT-bearing CLI tools
    # often hammer the API and each commit otherwise turns into a hot row
    # under contention. Refresh at most once per minute.
    now = datetime.now(timezone.utc)
    last = pat.last_used_at
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if last is None or (now - last).total_seconds() > 60:
        pat.last_used_at = now  # type: ignore[assignment]
        await db.commit()
    user_result = await db.execute(select(User).where(User.id == pat.user_id))
    return user_result.scalars().first()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # PAT path: identifiable prefix, no JWT decoding.
    if token.startswith(PAT_PREFIX):
        user = await _resolve_pat(token, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    try:
        token_data = _decode_token(token)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Reject tokens issued before the user's last invalidation event
    # (logout, password change, password reset). `iat` is set by
    # security.create_access_token; if it's missing on a legacy token,
    # treat the token as still valid to avoid mass logouts on upgrade.
    if user.tokens_invalidated_after is not None and token_data.iat is not None:
        cutoff = user.tokens_invalidated_after
        if cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=timezone.utc)
        if token_data.iat < int(cutoff.timestamp()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    token = _extract_token(request)
    if not token:
        return None
    if token.startswith(PAT_PREFIX):
        return await _resolve_pat(token, db)
    try:
        token_data = _decode_token(token)
    except (JWTError, ValidationError):
        return None
    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalars().first()
    if user and user.tokens_invalidated_after is not None and token_data.iat is not None:
        cutoff = user.tokens_invalidated_after
        if cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=timezone.utc)
        if token_data.iat < int(cutoff.timestamp()):
            return None
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user
