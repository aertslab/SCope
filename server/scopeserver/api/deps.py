" Provides Depends() objects for all API endpoints. "

from typing import AsyncGenerator, Generator
from datetime import datetime, timezone

import httpx
from fastapi import Depends, Header, HTTPException, status
from fastapi.security.utils import get_authorization_scheme_param
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas
from scopeserver.database import SessionLocal
from scopeserver.config import settings


def get_db() -> Generator:
    "Provide access to the database."
    try:
        database = SessionLocal()
        yield database
    finally:
        database.close()


async def get_http_client() -> AsyncGenerator:
    "Provide access to an HTTP client"
    try:
        client = httpx.AsyncClient()
        yield client
    finally:
        await client.aclose()


def get_current_user(database: Session = Depends(get_db), authorization: str = Header(...)) -> models.User:
    "Provide access to the User currently accessing the API."
    unknown_user = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Unknown user ID",
    )

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    scheme, token = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer":
        raise credentials_error

    try:
        payload = jwt.decode(token, settings.API_SECRET, settings.API_JWT_ALGORITHM)
    except JWTError as err:
        raise HTTPException(  # pylint: disable=raise-missing-from
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(err)
        )

    expiry = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    current_time = datetime.now(tz=timezone.utc)
    if expiry < current_time:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credentials expired")

    user = schemas.UserResponse(**payload)
    if not (db_user := crud.get_user(database, user_id=user.id)):
        raise unknown_user

    return db_user


def get_current_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    "Provide access to the Admin currently accessing the API."
    if not crud.is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an admin")

    return current_user
