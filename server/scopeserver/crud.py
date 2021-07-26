" Provides low-level Create, Read, Update, and Delete functions for API resources. "

from typing import List
from datetime import datetime
from uuid import uuid4

from returns.io import IO, IOFailure, IOResult, IOSuccess
from sqlalchemy.orm import Session

from scopeserver import models, schemas

# pylint: disable=invalid-name

# Projects


def get_projects(db: Session, user_id: int) -> IO[List[models.Project]]:
    "Read all projects for a given user."
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return IO(user.projects) if user else IO([])


def get_project(db: Session, project_uuid: str, user_id: int) -> IOResult[models.Project, str]:
    "Get a specified project if it is accessible by a specified user."
    project = db.query(models.Project).filter(models.Project.uuid == project_uuid).first()
    if project:
        mapping = (
            db.query(models.ProjectMapping)
            .filter(models.ProjectMapping.project == project.id, models.ProjectMapping.user == user_id)
            .first()
        )
        if mapping:
            return IOSuccess(project)

    return IOFailure("Not a project you can access")


def get_users_in_project(db: Session, project_uuid: str) -> IO[List[models.User]]:
    "Get all users in a given project."
    project = db.query(models.Project).filter(models.Project.uuid == project_uuid).first()
    return IO(db.query(models.ProjectMapping).filter(models.ProjectMapping.project == project.id).all())


def create_project(db: Session, user_id: int, name: str) -> IO[models.Project]:
    "Create a new project."
    new_project = models.Project(name=name, uuid=str(uuid4()), created=datetime.now(), size=0)
    db.add(new_project)
    db.flush()
    db.refresh(new_project)

    db.add(models.ProjectMapping(project=new_project.id, user=user_id))
    db.commit()
    return IO(new_project)


def add_user_to_project(db: Session, user_id: int, project_id: int) -> IO[None]:
    "Give a specified user_id access to a given project."
    db.add(models.ProjectMapping(project=project_id, user=user_id))
    db.commit()
    return IO(None)


# Users


def get_user(db: Session, user: schemas.User) -> IOResult[models.User, str]:
    "Read a user from the database."
    if (user := db.query(models.User).filter(models.User.id == user.id).first()) is not None:
        return IOSuccess(user)

    return IOFailure("User not found")


def create_user(db: Session) -> IO[models.User]:
    "Create a new user."
    new_user = models.User(created=datetime.now())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return IO(new_user)


# Datasets


def create_dataset(db: Session, name: str, filename: str, project: models.Project, size: int) -> IO[models.Dataset]:
    "Create a new dataset."
    new_dataset = models.Dataset(
        name=name,
        created=datetime.now(),
        filename=filename,
        size=size,
        project=project.id,
    )
    db.add(new_dataset)
    project.size += size
    db.commit()
    db.refresh(new_dataset)
    return IO(new_dataset)
