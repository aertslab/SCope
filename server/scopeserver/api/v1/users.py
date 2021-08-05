" API endpoints related to managing users. "

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas, oidc
from scopeserver.api import deps

router = APIRouter()


@router.post("/new", summary="Create a new guest user.", response_model=schemas.Token)
async def new_user(database: Session = Depends(deps.get_db)):
    """Create a new guest user."""
    new_guest = schemas.UserResponse.from_orm(crud.create_user(database=database))
    access_token = oidc.create_access_token(data=new_guest)
    return schemas.Token(  # nosemgrep: gitlab.bandit.B106
        access_token=access_token,
        token_type="bearer",
        user=new_guest,
    )


@router.get("/", summary="Get all accessible projects", response_model=List[schemas.Project])
async def my_projects(
    database: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all projects for the current user."""
    return crud.get_projects_for_user(database=database, user_id=current_user.id)


@router.get("/all", summary="Get all users", response_model=List[schemas.UserResponse])
async def all_users(
    database: Session = Depends(deps.get_db),
    offset: int = 0,
    limit: int = 100,
    _current_user: models.User = Depends(deps.get_current_admin),
):
    "Get a listing of all users"
    return crud.get_users(database, offset, limit)


@router.post("/promote", summary="Promote a user to an admin", response_model=schemas.UserResponse)
async def promote(
    *,
    database: Session = Depends(deps.get_db),
    user_id: int,
    _current_user: models.User = Depends(deps.get_current_admin),
):
    "Promote user_id to an admin"
    if (user := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown user_id {user_id}")

    return crud.promote_to_admin(database, user)


@router.post("/demote", summary="Demote a user from admin to user", response_model=schemas.UserResponse)
async def demote(
    *,
    database: Session = Depends(deps.get_db),
    user_id: int,
    _current_user: models.User = Depends(deps.get_current_admin),
):
    "Demote user_id from admin to user"
    if (user := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown user_id {user_id}")

    if crud.is_admin(user):
        return crud.demote_from_admin(database, user)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User {user_id} is not an admin")


@router.delete("/", summary="Delete a user")
async def delete_user(
    *,
    database: Session = Depends(deps.get_db),
    user_id: int,
    _current_user: models.User = Depends(deps.get_current_admin),
):
    "Delete user_id"
    crud.delete_user(database, user_id)
    return Response(status_code=status.HTTP_200_OK)
