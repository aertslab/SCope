" API endpoints related to managing users. "

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from scopeserver import crud, schemas
from scopeserver.api import deps

router = APIRouter()

# pylint: disable=invalid-name


@router.post("/new", summary="Create a new user.", response_model=schemas.UserResponse)
async def new_user(db: Session = Depends(deps.get_db)):
    """ Create a new user. """
    return crud.create_user(db=db)
