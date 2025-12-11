from pydantic import BaseModel
from typing import Any, Dict
from datetime import datetime

class SessionBase(BaseModel):
    data: Dict[str, Any]

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
