" API endpoints related to managing SCope projects. "

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from scopeserver import crud, models, schemas
from scopeserver.api import deps

router = APIRouter()

# pylint: disable=invalid-name


@router.get("/", summary="Get all projects accessible to the current user.", response_model=List[schemas.Project])
async def my_projects(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Retrieve all projects for the current user. """
    return crud.get_projects(db=db, user_id=current_user.id)


@router.get("/{project_id}/", summary="Get all datasets in a project.", response_model=List[schemas.Dataset])
async def datasets(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Retrieve all datasets in a given project. """
    project = crud.get_project(db, user_id=current_user.id, project_id=project_id)
    if project:
        return project.datasets

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No project with id: {project_id} exists.")


@router.post("/new", summary="Create a new project for the current user.", response_model=schemas.ProjectBase)
async def new_project(
    *,
    db: Session = Depends(deps.get_db),
    name: str,
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Create a new project. """
    return crud.create_project(db, current_user.id, name)


@router.post("/{project_id}/user")
async def add_user(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Add a new user to an existing project. """
    user = crud.get_user(db, schemas.User(id=user_id))
    project = crud.get_project(db, project_id=project_id, user_id=current_user.id)

    if user is not None and project is not None:
        project_existing_users = [existing_user.id for existing_user in project.users]
        if user.id not in project_existing_users:
            crud.add_user_to_project(db, user_id=user.id, project_id=project.id)
            return Response(status_code=status.HTTP_200_OK)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already in project",
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User or project does not exist")


@router.post("/{project_id}/dataset")
async def add_dataset(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    name: str,
    uploadfile: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Add a dataset to a project. """
    project = crud.get_project(db, project_id=project_id, user_id=current_user.id)
    if project:
        crud.create_dataset(db, name=name, filename=uploadfile.filename, project=project, data=await uploadfile.read())
        return Response(status_code=status.HTTP_200_OK)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not in this project")


@router.delete("/{project_id}/delete", summary="Delete an existing project.")
def delete_project(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    current_user: models.User = Depends(deps.get_current_user),
):
    """ Unimplemented. """
    # TODO: Unimplemented
    return Response(status_code=status.HTTP_401_UNAUTHORIZED)
