from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from uuid import UUID

class OAuthAccountBase(BaseModel):
    provider: str
    provider_account_id: str

class OAuthAccountCreate(OAuthAccountBase):
    pass

class OAuthAccountUpdate(OAuthAccountBase):
    pass

class OAuthAccount(OAuthAccountBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime]
    last_login: Optional[datetime]

    class Config:
        from_attributes = True
