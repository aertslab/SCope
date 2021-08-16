" Provides low-level Create, Read, Update, and Delete functions for API resources. "

from typing import List, Optional
from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from scopeserver import models, schemas

# Projects


def get_projects(database: Session, offset: int, limit: int) -> List[models.Project]:
    "Read all projects"
    return database.query(models.Project).order_by(models.Project.id).offset(offset).limit(limit).all()


def get_projects(database: Session, offset: int, limit: int) -> List[models.Project]:
    "Read all projects"
    return database.query(models.Project).order_by(models.Project.id).offset(offset).limit(limit).all()


def get_projects_for_user(database: Session, user_id: int) -> List[models.Project]:
    "Read all projects for a given user."
    user = database.query(models.User).filter(models.User.id == user_id).first()
    return user.projects if user else []


def get_project(database: Session, project_uuid: str) -> Optional[models.Project]:
    "Get a specified project if it is accessible by a specified user."
    return database.query(models.Project).filter(models.Project.uuid == project_uuid).first()


def create_project(database: Session, user_id: int, name: str) -> models.Project:
    "Create a new project."
    try:
        new_project = models.Project(name=name, uuid=str(uuid4()), created=datetime.now(), size=0)
        database.add(new_project)
        database.flush()
        database.refresh(new_project)

        database.add(models.ProjectMapping(project=new_project.id, user=user_id))
        database.add(models.ProjectOwnerMapping(project=new_project.id, owner=user_id))
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()
    return new_project


def add_user_to_project(database: Session, user_id: int, project_id: int):
    "Give a specified user_id access to a given project."
    try:
        database.add(models.ProjectMapping(project=project_id, user=user_id))
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def remove_user_from_project(database: Session, user=models.User, project=models.Project):
    "Remove access for a specified user from a project"
    try:
        database.query(models.ProjectMapping).filter(
            models.ProjectMapping.user == user.id, models.ProjectMapping.project == project.id
        ).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def add_owner_to_project(database: Session, user_id: int, project_id: int):
    "Add a specified user_id to the owners of this project."
    try:
        database.add(models.ProjectOwnerMapping(project=project_id, owner=user_id))
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def remove_owner_from_project(database: Session, user=models.User, project=models.Project):
    "Remove a specified user from the owners of this project."
    try:
        database.query(models.ProjectOwnerMapping).filter(
            models.ProjectOwnerMapping.owner == user.id, models.ProjectOwnerMapping.project == project.id
        ).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def delete_project(database: Session, project_uuid: str):
    "Remove a project from the database by uuid"
    try:
        database.query(models.Project).filter(models.Project.uuid == project_uuid).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def delete_project(database: Session, project_uuid: str):
    "Remove a project from the database by uuid"
    try:
        database.query(models.Project).filter(models.Project.uuid == project_uuid).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


# Users


def get_users(database: Session, offset: int, limit: int) -> List[models.User]:
    "Read all users from the database"
    return database.query(models.User).order_by(models.User.id).offset(offset).limit(limit).all()


def get_user(database: Session, user_id: int) -> Optional[models.User]:
    "Read a user from the database."
    return database.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_identity(database: Session, issuer: str, subject: str) -> Optional[models.User]:
    "Get a user with a specific issuer and subject."
    return database.query(models.User).filter(models.User.iss == issuer, models.User.sub == subject).first()


def is_admin(user: models.User) -> bool:
    "Check if a user is an admin."
    return user.role == "admin"


def is_owner(user: models.User, project: models.Project) -> bool:
    "Check if a user owns a project."
    return user.id in (owner.id for owner in project.owners)


def is_user(user: models.User, project: models.Project) -> bool:
    "Check if a user is allowed to access a project."
    return user.id in (usr.id for usr in project.users)


def is_owner(user: models.User, project: models.Project) -> bool:
    "Check if a user owns a project."
    return user.id in (owner.id for owner in project.owners)


def is_user(user: models.User, project: models.Project) -> bool:
    "Check if a user is allowed to access a project."
    return user.id in (usr.id for usr in project.users)


def promote_to_admin(database: Session, user: models.User) -> models.User:
    "Give user the admin role"
    user.role = "admin"
    database.commit()
    database.refresh(user)
    return user


def demote_from_admin(database: Session, user: models.User) -> models.User:
    "Give user the user role"
    user.role = "user"
    database.commit()
    database.refresh(user)
    return user


def create_user(database: Session, user: Optional[schemas.UserCreate] = None) -> models.User:
    "Create a new user."
    if user is None:
        new_user = models.User(created=datetime.now(), name="Guest")
    else:
        new_user = models.User(**user.dict(), created=datetime.now())

    try:
        database.add(new_user)
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()

    database.refresh(new_user)
    return new_user


def delete_user(database: Session, user_id: int):
    "Delete a user by id"
    try:
        database.query(models.User).filter(models.User.id == user_id).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


def delete_user(database: Session, user_id: int):
    "Delete a user by id"
    try:
        database.query(models.User).filter(models.User.id == user_id).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


# Datasets


def create_dataset(database: Session, name: str, filename: str, project: models.Project, size: int) -> models.Dataset:
    "Create a new dataset."
    new_dataset = models.Dataset(
        name=name,
        created=datetime.now(),
        filename=filename,
        size=size,
        project=project.id,
    )

    try:
        database.add(new_dataset)
        project.size += size
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()

    database.refresh(new_dataset)
    return new_dataset


def get_dataset(database: Session, dataset_id: int) -> Optional[models.Dataset]:
    "Get an existing dataset by id"
    return database.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()


def delete_dataset(database: Session, dataset: models.Dataset):
    "Delete a dataset by id"
    try:
        if (project := database.query(models.Project).filter(models.Project.id == dataset.project).first()) is not None:
            project.size -= dataset.size

        database.query(models.Dataset).filter(models.Dataset.id == dataset.id).delete()
    except SQLAlchemyError:
        database.rollback()
        raise
    else:
        database.commit()


# Auth


def get_identity_providers(database: Session) -> List[models.IdentityProvider]:
    "Get all available identity providers."
    return database.query(models.IdentityProvider).all()


def get_provider_by_id(database: Session, provider_id: Optional[int]) -> Optional[models.IdentityProvider]:
    "Get an identity provider given an identifier."
    if provider_id is None:
        return None

    return database.query(models.IdentityProvider).filter(models.IdentityProvider.id == provider_id).first()


# Limits


def get_upload_limits(database: Session) -> List[models.UploadLimit]:
    "Get all upload limits."
    return database.query(models.UploadLimit).all()
