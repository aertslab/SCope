" API endpoints related to managing SCope projects. "

from typing import List
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas
from scopeserver.api import deps
from scopeserver.config import settings

router = APIRouter()


@router.get("/all", summary="Get all projects", response_model=List[schemas.Project])
async def all_projects(
    database: Session = Depends(deps.get_db),
    offset: int = 0,
    limit: int = 100,
    _admin: models.User = Depends(deps.get_current_admin),
):
    "Retrieve all projects"
    return crud.get_projects(database, offset, limit)


@router.get("/datasets", summary="Get all datasets in a project.", response_model=List[schemas.Dataset])
async def datasets(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all datasets in a given project."""
    if (found_project := crud.get_project(database, project)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No project with id: {project} exists.")

    if crud.is_admin(current_user) or current_user.id in (user.id for user in found_project.users):
        return found_project.datasets

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not a member of this project")


@router.get(
    "/users", summary="List all users who have access to this project.", response_model=List[schemas.UserResponse]
)
async def users(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Retrieve all users on a given project."""
    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project does not exist")

    if crud.is_admin(current_user) or current_user.id in (u.id for u in found_project.users):
        return found_project.users

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not in this project")


@router.post("/new", summary="Create a new project for the current user.", response_model=schemas.ProjectBase)
async def new_project(
    *,
    database: Session = Depends(deps.get_db),
    name: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create a new project."""
    project = crud.create_project(database, current_user.id, name)
    (settings.DATA_PATH / Path(project.uuid)).mkdir()
    return project


@router.post("/user")
async def add_user(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add a new user to an existing project."""
    if (user_to_add := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find this user")

    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find project")

    # Check that the user is an admin or an owner
    if crud.is_admin(current_user) or current_user.id in (owner.id for owner in found_project.owners):
        project_existing_users = [existing_user.id for existing_user in found_project.users]
        if user_to_add.id not in project_existing_users:
            crud.add_user_to_project(database, user_id=user_to_add.id, project_id=found_project.id)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already in project",
        )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")


@router.delete("/user", summary="Remove a user from a project")
async def delete_user(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    "Remove a user from an existing project"
    if (user_to_remove := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot find {user_id=}")

    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find project")

    print(current_user.id)
    print(user_to_remove.id)
    print(found_project.owners)
    print(found_project.users)

    if crud.is_admin(current_user) or current_user.id in (owner.id for owner in found_project.owners):
        project_existing_users = [existing_user.id for existing_user in found_project.users]
        if user_to_remove.id in project_existing_users:
            crud.remove_user_from_project(database, user_to_remove, found_project)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in project",
        )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")


@router.post("/dataset", summary="", response_model=schemas.Dataset)
async def add_dataset(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    name: str,
    uploadfile: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add a dataset to a project."""
    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not exist")

    # Check that the user is an admin or an owner
    if crud.is_admin(current_user) or current_user.id in (owner.id for owner in found_project.owners):
        size = 0
        with (settings.DATA_PATH / Path(project) / Path(uploadfile.filename)).open(mode="wb") as datafile:
            data = await uploadfile.read()
            if isinstance(data, str):
                data = data.encode("utf8")
            size = len(data)
            datafile.write(data)

        return crud.create_dataset(database, name=name, filename=uploadfile.filename, project=found_project, size=size)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")


@router.delete("/dataset", summary="Remove a dataset from a project.")
async def delete_dataset(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    dataset: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    "Delete a dataset from a project."
    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not exist.")

    # Check that the user is an admin or an owner
    is_admin = crud.is_admin(current_user)
    if (found_dataset := crud.get_dataset(database, dataset_id=dataset)) is not None:
        if found_dataset.id in (proj_dataset.id for proj_dataset in found_project.datasets):
            if is_admin or current_user.id in (owner.id for owner in found_project.owners):
                (settings.DATA_PATH / Path(project) / Path(found_dataset.filename)).unlink()
                crud.delete_dataset(database, dataset=found_dataset)
                return Response(status_code=status.HTTP_200_OK)

            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{dataset=} not in {project=}")

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset does not exist")


@router.delete("/", summary="Delete a project.")
def delete_project(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    "Delete a project."
    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not exist")

    if crud.is_admin(current_user) or current_user.id in (owner.id for owner in found_project.owners):
        crud.delete_project(database, project)
        shutil.rmtree(settings.DATA_PATH / Path(project))
        return Response(status_code=status.HTTP_200_OK)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")
