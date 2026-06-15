from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime
from uuid import UUID

class SessionBase(BaseModel):
    data: Dict[str, Any]

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: str
    created_at: datetime
    created_by: Optional[UUID] = None

    class Config:
        from_attributes = True
