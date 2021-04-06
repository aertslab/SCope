from sqlalchemy import Column, ForeignKey, Integer, String
from scopeserver.database import Base


class ProjectMapping(Base):
    __tablename__ = "project_user_mapping"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(Integer, ForeignKey("projects.id"), index=True)
    user = Column(Integer, ForeignKey("users.id"), index=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String)
