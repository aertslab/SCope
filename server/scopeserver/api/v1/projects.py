" API endpoints related to managing SCope projects. "

from typing import List
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas
from scopeserver.api import deps
from scopeserver.config import settings

router = APIRouter()

# pylint: disable=invalid-name


@router.get("/", summary="Get all projects accessible to the current user.", response_model=List[schemas.Project])
async def my_projects(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all projects for the current user."""
    return crud.get_projects(db=db, user_id=current_user.id)


@router.get("/datasets", summary="Get all datasets in a project.", response_model=List[schemas.Dataset])
async def datasets(
    *,
    db: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all datasets in a given project."""
    found_project = crud.get_project(db, user_id=current_user.id, project_uuid=project)
    if found_project:
        return found_project.datasets

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No project with id: {project} exists.")


@router.get(
    "/users", summary="List all users who have access to this project.", response_model=List[schemas.UserResponse]
)
async def users(
    *,
    db: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all users on a given project."""
    all_users = crud.get_users_in_project(db, project_uuid=project)
    if current_user.id in (u.user for u in all_users):
        return all_users

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not in this project")


@router.post("/new", summary="Create a new project for the current user.", response_model=schemas.ProjectBase)
async def new_project(
    *,
    db: Session = Depends(deps.get_db),
    name: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create a new project."""
    project = crud.create_project(db, current_user.id, name)
    (settings.DATA_PATH / Path(project.uuid)).mkdir()
    return project


@router.post("/adduser")
async def add_user(
    *,
    db: Session = Depends(deps.get_db),
    project: str,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add a new user to an existing project."""
    user = crud.get_user(db, schemas.User(id=user_id))
    found_project = crud.get_project(db, project_uuid=project, user_id=current_user.id)

    if user is not None and found_project is not None:
        project_existing_users = [existing_user.id for existing_user in found_project.users]
        if user.id not in project_existing_users:
            crud.add_user_to_project(db, user_id=user.id, project_id=found_project.id)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already in project",
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User or project does not exist")


@router.post("/dataset", summary="", response_model=schemas.Dataset)
async def add_dataset(
    *,
    db: Session = Depends(deps.get_db),
    project: str,
    name: str,
    uploadfile: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add a dataset to a project."""
    found_project = crud.get_project(db, project_uuid=project, user_id=current_user.id)
    if found_project:
        size = 0
        with (settings.DATA_PATH / Path(project) / Path(uploadfile.filename)).open(mode="wb") as datafile:
            data = await uploadfile.read()
            if isinstance(data, str):
                data = data.encode("utf8")
            size = len(data)
            datafile.write(data)

        return crud.create_dataset(db, name=name, filename=uploadfile.filename, project=found_project, size=size)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not in this project")


@router.delete("/delete", summary="Delete an existing project.")
def delete_project(
    *,
    db: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Unimplemented."""
    # TODO: Unimplemented
    return Response(status_code=status.HTTP_401_UNAUTHORIZED)
