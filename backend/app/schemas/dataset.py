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


class DatasetProjectRef(BaseModel):
    """Lean project reference for the dataset list view."""
    id: UUID
    name: str
    visibility: str

    model_config = ConfigDict(from_attributes=True)


class DatasetListItem(BaseModel):
    """One row in the scalable dataset list.

    Carries enough metadata to render the table without per-row follow-up
    requests: which project(s) own it, who it is shared with, size, and dates.
    """
    id: UUID
    name: str
    description: Optional[str] = None
    file_type: str
    status: str
    failure_reason: Optional[str] = None
    file_size: Optional[int] = 0
    converted_size: Optional[int] = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    projects: list[DatasetProjectRef] = []
    # Display labels of users/groups the dataset is shared with (via its
    # projects), plus the literal "Public" when any owning project is public.
    shared_with: list[str] = []
    # Highest visibility across owning projects: private | password | public.
    visibility: str = "private"


class DatasetListResponse(BaseModel):
    """Paginated dataset list envelope."""
    items: list[DatasetListItem]
    total: int


class TrashedDataset(BaseModel):
    """A soft-deleted dataset, with the project linkage that governs retention.

    A trashed dataset that is still linked to one or more projects is retained
    indefinitely (``auto_purge_at`` is null); an orphaned one is auto-purged
    after the retention window, surfaced here as ``auto_purge_at``.
    """
    id: UUID
    name: str
    description: Optional[str] = None
    file_type: str
    status: str
    file_size: Optional[int] = 0
    converted_size: Optional[int] = 0
    created_at: datetime
    deleted_at: Optional[datetime] = None
    projects: list[DatasetProjectRef] = []
    project_count: int = 0
    # When the dataset will be permanently removed automatically. Null while it
    # remains linked to a project (then it is kept until unlinked).
    auto_purge_at: Optional[datetime] = None
