from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Normalize a tag display name to a URL-safe slug.

    Lowercases, replaces runs of non-alphanumerics with single hyphens, and
    trims leading/trailing hyphens. Returns empty string if the input has no
    alphanumerics.
    """
    return _SLUG_RE.sub("-", value.lower()).strip("-")


class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class TagCreate(TagBase):
    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not slugify(cleaned):
            raise ValueError("Tag name must contain at least one alphanumeric character")
        return cleaned


class Tag(TagBase):
    id: UUID
    slug: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TagWithCount(Tag):
    project_count: int = 0


class ProjectTagsUpdate(BaseModel):
    """Replace the full set of tags on a project.

    ``tags`` is a list of display names; the server slugifies and reuses
    existing tag rows, creating new ones as needed.
    """

    tags: List[str] = Field(default_factory=list, max_length=20)


class PublicProject(BaseModel):
    """Lean projection of a project for the public discovery gallery.

    Excludes shares, password hashes, and explicit dataset details so it can
    safely be returned to anonymous clients.
    """

    id: UUID
    name: str
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime
    dataset_count: int = 0
    tags: List[Tag] = []

    model_config = ConfigDict(from_attributes=True)
