" Provides Depends() objects for all API endpoints. "

from typing import Generator, Optional

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas
from scopeserver.database import SessionLocal


def get_db() -> Generator:
    "Provide access to the database."
    try:
        database = SessionLocal()
        yield database
    finally:
        database.close()


def get_current_user(database: Session = Depends(get_db), user_id: Optional[int] = Cookie(None)) -> models.User:
    "Provide access to the User currently accessing the API."
    unknown_user = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Unknown user ID",
    )

    no_user_id = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No user ID provided",
    )

    if user_id is not None:
        user = crud.get_user(database, user=schemas.User(id=user_id))
        if not user:
            raise unknown_user

        return user

    raise no_user_id
