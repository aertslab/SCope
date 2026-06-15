from sqlalchemy import Column, String, ForeignKey, DateTime, Table, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


# Many-to-many between projects and tags. Cascade so that deleting a project
# cleans up its tag links automatically (the Tag itself is preserved — other
# projects may still reference it).
project_tag = Table(
    "project_tags",
    Base.metadata,
    Column(
        "project_id",
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        Uuid(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tag(Base):
    """A free-form taxonomy label attached to projects.

    Tags are global (not per-user) so that public-gallery filtering produces
    a coherent vocabulary. ``slug`` is the lowercased, dash-separated form
    used for URL-safe filtering; ``name`` preserves the user's casing for
    display.
    """

    __tablename__ = "tags"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, index=True)
    created_by = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("slug", name="uq_tags_slug"),
    )

    projects = relationship("Project", secondary=project_tag, back_populates="tags")
