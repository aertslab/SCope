from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.group import GroupRole
from app.schemas.user import User


class GroupInvitationCreate(BaseModel):
    user_id: UUID
    role: GroupRole = GroupRole.MEMBER


class GroupSummary(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class GroupInvitation(BaseModel):
    id: UUID
    group_id: UUID
    invitee_id: UUID
    inviter_id: Optional[UUID] = None
    role: str
    status: str
    created_at: datetime
    responded_at: Optional[datetime] = None
    group: Optional[GroupSummary] = None
    inviter: Optional[User] = None

    class Config:
        from_attributes = True
