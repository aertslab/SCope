import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
import bcrypt
from app.core.config import settings


def _verify_password_sync(plain_password, hashed_password) -> bool:
    if not hashed_password:
        return False
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password, hashed_password)


def _get_password_hash_sync(password) -> str:
    if isinstance(password, str):
        password = password.encode('utf-8')
    return bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password, hashed_password) -> bool:
    """Synchronous bcrypt verify. Use only from sync code (CLI, scripts).

    Async handlers must call :func:`verify_password_async` to avoid blocking
    the event loop on bcrypt's CPU-bound work.
    """
    return _verify_password_sync(plain_password, hashed_password)


def get_password_hash(password) -> str:
    """Synchronous bcrypt hash. Use only from sync code (CLI, scripts)."""
    return _get_password_hash_sync(password)


async def verify_password_async(plain_password, hashed_password) -> bool:
    return await asyncio.to_thread(_verify_password_sync, plain_password, hashed_password)


async def get_password_hash_async(password) -> str:
    return await asyncio.to_thread(_get_password_hash_sync, password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=15)
    # python-jose accepts datetimes for exp/iat, but storing integers makes
    # tokens portable across libraries that strictly follow RFC 7519 (which
    # requires NumericDate). `iat` is added so a future denylist can scope
    # revocations to tokens issued before a given moment.
    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    })
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt
