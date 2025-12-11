from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from app.models.group import GroupRole

class GroupMemberBase(BaseModel):
    user_id: UUID
    role: GroupRole

class GroupMemberCreate(GroupMemberBase):
    pass

from app.schemas.user import User

class GroupMember(GroupMemberBase):
    created_at: datetime
    user: Optional[User] = None
    
    class Config:
        from_attributes = True

class GroupBase(BaseModel):
    description: Optional[str] = None

class GroupCreate(GroupBase):
    name: str

class GroupUpdate(GroupBase):
    name: Optional[str] = None

class Group(GroupBase):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    # members: List[GroupMember] = [] # Avoid circular dependency or heavy loading by default

    class Config:
        from_attributes = True

class GroupMemberUpdate(BaseModel):
    role: GroupRole

class GroupTransferOwnership(BaseModel):
    new_owner_id: UUID
