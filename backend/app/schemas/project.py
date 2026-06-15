from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from app.models.project import ProjectVisibility, ProjectPermission

class ProjectShareBase(BaseModel):
    user_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    permission: ProjectPermission

class ProjectShareCreate(ProjectShareBase):
    pass

from app.schemas.user import User
from app.schemas.group import Group
from app.schemas.dataset import Dataset
from app.schemas.tag import Tag

class ProjectShare(ProjectShareBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    user: Optional[User] = None
    group: Optional[Group] = None

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    description: Optional[str] = None
    visibility: ProjectVisibility = ProjectVisibility.PRIVATE

class ProjectCreate(ProjectBase):
    name: str
    password: Optional[str] = None

class ProjectUpdate(ProjectBase):
    name: Optional[str] = None
    password: Optional[str] = None


class ProjectTransferOwnership(BaseModel):
    new_owner_id: UUID

class Project(ProjectBase):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    shares: List[ProjectShare] = []
    datasets: List[Dataset] = []
    tags: List[Tag] = []

    class Config:
        from_attributes = True
