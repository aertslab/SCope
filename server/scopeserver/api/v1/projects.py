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

    if crud.is_admin(current_user) or crud.is_user(current_user, found_project):
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

    if crud.is_admin(current_user) or crud.is_user(current_user, found_project):
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
    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        if not crud.is_user(user_to_add, found_project):
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

    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        if crud.is_user(user_to_remove, found_project):
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

    limits = {
        (limit := schemas.UploadLimit.from_orm(_limit)).mime: limit.maxsize
        for _limit in crud.get_upload_limits(database)
    }

    if uploadfile.content_type not in limits:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported upload mime type: {uploadfile.content_type}",
        )

    # Check that the user is an admin or an owner
    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        return crud.create_dataset(database, name=name, uploadfile=uploadfile, project=found_project)

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

    if (found_dataset := crud.get_dataset(database, dataset_id=dataset)) is not None:
        if found_dataset.id in (proj_dataset.id for proj_dataset in found_project.datasets):
            # Check that the user is an admin or an owner
            if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
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

    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        crud.delete_project(database, project)
        shutil.rmtree(settings.DATA_PATH / Path(project))
        return Response(status_code=status.HTTP_200_OK)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")


@router.get("/owner", summary="Get the owners of this project", response_model=List[schemas.UserResponse])
def get_owners(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    "Get a list of the owners of this project."
    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not exist")

    if crud.is_admin(current_user) or crud.is_user(current_user, found_project):
        return found_project.owners

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not in this project")


@router.post("/owner", summary="Make a user an owner of this project")
async def add_owner(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """Add a new owner to an existing project."""
    if (user_to_add := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find this user")

    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find project")

    # Check that the user is an admin or an owner
    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        if not crud.is_owner(user_to_add, found_project):
            crud.add_user_to_project(database, user_id=user_to_add.id, project_id=found_project.id)
            crud.add_owner_to_project(database, user_id=user_to_add.id, project_id=found_project.id)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an owner.",
        )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")


@router.delete("/owner", summary="Remove a user from ownership of this project")
async def delete_owner(
    *,
    database: Session = Depends(deps.get_db),
    project: str,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    "Remove a user from ownership over an existing project"
    if (user_to_remove := crud.get_user(database, user_id=user_id)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot find {user_id=}")

    if (found_project := crud.get_project(database, project_uuid=project)) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot find project")

    if crud.is_admin(current_user) or crud.is_owner(current_user, found_project):
        if crud.is_owner(user_to_remove, found_project):
            crud.remove_owner_from_project(database, user_to_remove, found_project)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an owner of this project",
        )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You do not own this project")
