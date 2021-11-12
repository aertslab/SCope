" Data types for API input and output. "

# pylint: disable=missing-class-docstring
# pylint: disable=too-few-public-methods

from typing import List, Optional

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


# Users and Projects
class UserBase(BaseModel):
    name: Optional[str]
    role: str = "guest"


class UserCreate(UserBase):
    iss: str  # Issuer
    sub: str  # Subject

class ProjectBase(BaseModel):
    name: str
    uuid: str

    class Config:
        orm_mode = True


class Project(ProjectBase):
    datasets: List[Dataset]

    class Config:
        orm_mode = True

class UserResponse(UserBase):
    id: int
    projects: List[Project]

    class Config:
        orm_mode = True


class OwnedProject(ProjectBase):
    datasets: List[Dataset]
    owned: List[UserResponse]

    class Config:
        orm_mode = True


class User(UserBase):
    id: int
    projects: List[ProjectBase] = []

    class Config:
        orm_mode = True


# Auth


class AuthorizationResponse(BaseModel):
    state: str
    code: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ORCIDUser(BaseModel):
    iss: str  # Issuer
    sub: str  # Subject
    name: Optional[str] = None


class Provider(BaseModel):
    id: int
    name: str
    issuer: str
    clientid: str
    secret: str

    class Config:
        orm_mode = True


class LoginUrl(BaseModel):
    id: int
    name: str
    url: str
    icon: Optional[str]

    class Config:
        schema_extra = {
            "example": {
                "url": (
                    "http://localhost:8080/auth/realms/SCope/protocol/openid-connect/auth?client_id=scope"
                    "&redirect_uri=http%3A%2F%2Flocalhost%3A55850&response_type=code&scope=openid+profile&state=1"
                )
            }
        }


# Limits


class UploadLimit(BaseModel):
    mime: str
    maxsize: int

    class Config:
        orm_mode = True


# Legacy compatibility


class Permalink(BaseModel):
    sessiondata: str
