""" Database model definitions. """

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from scopeserver.database import Base

# PyLint "too-few-public-methods" is disabled here because this is how
# SQLAlchemy works. Therefore it is really an invalid lint for this file.

# pylint: disable=too-few-public-methods


class ProjectMapping(Base):
    "Many-to-many relationship between users and projects."
    __tablename__ = "project_user_mapping"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(Integer, ForeignKey("projects.id"), index=True)
    user = Column(Integer, ForeignKey("users.id"), index=True)


class ProjectOwnerMapping(Base):
    "Many-to-many relationship between (owning) users and projects."
    __tablename__ = "project_owner_mapping"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(Integer, ForeignKey("projects.id"), index=True)
    owner = Column(Integer, ForeignKey("users.id"), index=True)


class User(Base):
    "A SCope user."
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    iss = Column(String, index=True)
    sub = Column(String, index=True)
    created = Column(DateTime, nullable=False, default=datetime.now())
    name = Column(String)
    role = Column(String, nullable=False, default="guest")
    projects = relationship("Project", secondary="project_user_mapping", back_populates="users")
    owned = relationship("Project", secondary="project_owner_mapping", back_populates="owners")

    __table_args__ = (UniqueConstraint("iss", "sub", name="login_id"),)


class Project(Base):
    "An ad-hoc collection of related datasets."
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    uuid = Column(String, index=True, nullable=False)
    created = Column(DateTime, nullable=False, default=datetime.now())
    size = Column(Integer, nullable=False)
    users = relationship("User", secondary="project_user_mapping", back_populates="projects")
    owners = relationship("User", secondary="project_owner_mapping", back_populates="owned")
    datasets = relationship("Dataset")


class Dataset(Base):
    "A single SCope dataset."
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    created = Column(DateTime, nullable=False, default=datetime.now())
    filename = Column(String)
    size = Column(Integer, nullable=False)
    project = Column(Integer, ForeignKey("projects.id"), nullable=False)


class IdentityProvider(Base):
    "A table of acceptable identity providers."
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    issuer = Column(String, nullable=False)
    clientid = Column(String, nullable=False)
    secret = Column(String, nullable=False)
