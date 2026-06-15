from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class Notification(BaseModel):
    id: UUID
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationList(BaseModel):
    items: list[Notification]
    unread_count: int
