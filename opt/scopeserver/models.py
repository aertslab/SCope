""" Database model definitions. """

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from scopeserver.database import Base

# pylint: disable=too-few-public-methods


class ProjectMapping(Base):
    " Many-to-many relationship between users and projects. "
    __tablename__ = "project_user_mapping"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(Integer, ForeignKey("projects.id"), index=True)
    user = Column(Integer, ForeignKey("users.id"), index=True)


class User(Base):
    " A SCope user. "
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    projects = relationship("Project", secondary="project_user_mapping", back_populates="users")


class Project(Base):
    " A SCope project containing datasets. "
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    uuid = Column(String, index=True, nullable=False)
    created = Column(DateTime, nullable=False)
    size = Column(Integer, nullable=False)
    users = relationship("User", secondary="project_user_mapping", back_populates="projects")
    datasets = relationship("Dataset")


class Dataset(Base):
    " A single SCope dataset. "
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    filename = Column(String)
    size = Column(Integer, nullable=False)
    project = Column(Integer, ForeignKey("projects.id"), nullable=False)
