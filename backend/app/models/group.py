from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Table, Enum, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum
import uuid

class GroupRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"

class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(Uuid(as_uuid=True), ForeignKey("groups.id"), primary_key=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(String, default=GroupRole.MEMBER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="group_memberships")
    group = relationship("Group", back_populates="members")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="owned_groups")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    project_shares = relationship("ProjectShare", back_populates="group", cascade="all, delete-orphan")

from app.models.user import User
User.owned_groups = relationship("Group", back_populates="owner")
User.group_memberships = relationship("GroupMember", back_populates="user")
