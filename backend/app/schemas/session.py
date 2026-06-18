from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)


class SessionPublic(BaseModel):
    """Lean payload for the unauthenticated GET /sessions/{id} share endpoint.

    Deliberately omits ``created_by`` and ``created_at`` so an anonymous caller
    who opens a share link cannot learn who created it or when.
    """
    id: str
    data: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)
