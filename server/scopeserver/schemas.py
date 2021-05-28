" Data types for API input and output. "

# pylint: disable=missing-class-docstring
# pylint: disable=too-few-public-methods

from typing import List

from pydantic import BaseModel  # pylint: disable=no-name-in-module

# Datasets
class DatasetBase(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True


class Dataset(DatasetBase):
    filename: str

    class Config:
        orm_mode = True


# Projects
class ProjectBase(BaseModel):
    name: str
    uuid: str

    class Config:
        orm_mode = True


class Project(ProjectBase):
    datasets: List[Dataset]

    class Config:
        orm_mode = True


# Users
class UserBase(BaseModel):
    id: int


class UserResponse(UserBase):
    class Config:
        orm_mode = True


class User(UserBase):
    id: int
    projects: List[ProjectBase] = []

    class Config:
        orm_mode = True
