from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from uuid import UUID

class DatasetBase(BaseModel):
    description: Optional[str] = None

class DatasetCreate(DatasetBase):
    name: str
    file_type: str

class DatasetUpdate(DatasetBase):
    name: Optional[str] = None
    file_type: Optional[str] = None

class DatasetInDBBase(DatasetBase):
    id: UUID
    name: str
    file_type: str
    file_size: Optional[int] = 0
    owner_id: UUID
    converted_path: Optional[str] = None
    converted_size: Optional[int] = 0
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    meta_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class Dataset(DatasetInDBBase):
    highest_visibility: Optional[str] = None
