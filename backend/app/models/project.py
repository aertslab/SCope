from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Table, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum
import uuid

from app.models.tag import project_tag

class ProjectVisibility(str, enum.Enum):
    PRIVATE = "private"
    PUBLIC = "public"
    PASSWORD = "password"

class ProjectPermission(str, enum.Enum):
    VIEW = "view"
    EDIT = "edit" # Add/Remove datasets
    ADMIN = "admin" # Manage project settings/shares

# Association table for Project <-> Dataset
project_dataset = Table(
    "project_datasets",
    Base.metadata,
    Column(
        "project_id",
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "dataset_id",
        Uuid(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

class ProjectShare(Base):
    __tablename__ = "project_shares"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(Uuid(as_uuid=True), ForeignKey("projects.id"))
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    group_id = Column(Uuid(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    permission = Column(String, default=ProjectPermission.VIEW)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="shares")
    user = relationship("User", back_populates="project_shares")
    group = relationship("Group", back_populates="project_shares")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    visibility = Column(String, default=ProjectVisibility.PRIVATE)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="owned_projects")
    datasets = relationship("Dataset", secondary=project_dataset, back_populates="projects")
    shares = relationship("ProjectShare", back_populates="project", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=project_tag, back_populates="projects")

from app.models.user import User
from app.models.group import Group
from app.models.dataset import Dataset

User.owned_projects = relationship("Project", back_populates="owner")
User.project_shares = relationship("ProjectShare", back_populates="user")
Dataset.projects = relationship("Project", secondary=project_dataset, back_populates="datasets")
