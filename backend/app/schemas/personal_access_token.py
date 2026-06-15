from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PersonalAccessTokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    # Optional expiry in days from now; null/None means "never expires".
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)


class PersonalAccessToken(BaseModel):
    id: UUID
    name: str
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PersonalAccessTokenWithSecret(PersonalAccessToken):
    """Returned exactly once on creation; the plaintext is shown to the user
    and never persisted."""
    token: str
