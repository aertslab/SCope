""" Database model definitions. """

from pathlib import Path
import pickle
from typing import List, Optional
from datetime import datetime
from scopeserver.dataserver.utils.loom import Loom
from scopeserver.dataserver.utils.loom_file_handler import LoomFileHandler
from scopeserver.dataserver.utils.loom_like_connection import LoomLikeConnection

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.ext.hybrid import hybrid_method
from scipy.sparse import coo_matrix
from h5py import File
from io import BytesIO

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

    id: int = Column(Integer, primary_key=True, index=True)
    iss: Optional[str] = Column(String, index=True)
    sub: Optional[str] = Column(String, index=True)
    created: datetime = Column(DateTime, nullable=False, default=datetime.now())
    name: Optional[str] = Column(String)
    role: str = Column(String, nullable=False, default="guest")
    projects: Mapped[List["Project"]] = relationship(
        "Project", secondary="project_user_mapping", back_populates="users", uselist=True, collection_class=list
    )
    owned: Mapped[List["Project"]] = relationship(
        "Project", secondary="project_owner_mapping", back_populates="owners", uselist=True, collection_class=list
    )

    __table_args__ = (UniqueConstraint("iss", "sub", name="login_id"),)


class Project(Base):
    "An ad-hoc collection of related datasets."
    __tablename__ = "projects"

    id: int = Column(Integer, primary_key=True, index=True)
    name: Optional[str] = Column(String)
    uuid: str = Column(String, index=True, nullable=False, unique=True)
    created: datetime = Column(DateTime, nullable=False, default=datetime.now())
    size: int = Column(Integer, nullable=False)
    users: List[User] = relationship("User", secondary="project_user_mapping", back_populates="projects", uselist=True)
    owners: List[User] = relationship("User", secondary="project_owner_mapping", back_populates="owned", uselist=True)
    datasets: Mapped[List["Dataset"]] = relationship("Dataset", uselist=True, collection_class=list)


class Dataset(Base):
    "A single SCope dataset."
    __tablename__ = "datasets"

    id: int = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    created = Column(DateTime, nullable=False, default=datetime.now())
    filename: str = Column(String, nullable=False)
    size: int = Column(Integer, nullable=False)
    project = Column(Integer, ForeignKey("projects.id"), nullable=False)


class BinaryData(Base):
    "Data stored as a binary blob"
    __tablename__ = "binary_data"

    id: int = Column(Integer, primary_key=True, index=True)
    dataset: int = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    data = Column(LargeBinary, nullable=False)
    data_format: str = Column(String, nullable=False)

    @hybrid_method
    def load_scipy_sparse_matrix(self) -> Optional[coo_matrix]:
        if self.data_format != "binary_scipy_sparse_matrix":
            return

        return pickle.loads(self.data)

    @hybrid_method
    def load_loom_file(self, lfh: LoomFileHandler) -> Optional[Loom]:
        if self.data_format != "binary_loom":
            return

        h5 = File(BytesIO(self.data), mode="r")
        return Loom(Path("virtual.loom"), Path("virtual.loom"), LoomLikeConnection(h5), lfh)


class ExplodedMatrix(Base):
    "Matrices exploded"
    __tablename__ = "matrices"

    id: int = Column(Integer, primary_key=True, index=True)
    row: int = Column(Integer, nullable=False)
    column: int = Column(Integer, nullable=False)
    value: float = Column(Float, nullable=False)
    dataset: Column(Integer, ForeignKey("datasets.id"), nullable=False)


class IdentityProvider(Base):
    "A table of acceptable identity providers."
    __tablename__ = "providers"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String, nullable=False, unique=True)
    issuer: str = Column(String, nullable=False)
    clientid: str = Column(String, nullable=False)
    secret: str = Column(String, nullable=False)
    icon: str = Column(String, nullable=True)


class UploadLimit(Base):
    "A table of acceptable upload file MIME types and file sizes."
    __tablename__ = "uploadlimit"

    mime: str = Column(String, nullable=False, primary_key=True, index=True, unique=True)
    maxsize: int = Column(Integer, nullable=False)
