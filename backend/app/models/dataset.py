from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Uuid, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid
from app.models.data_file import DataFile # Import to ensure registry

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # loom, h5ad, zarr
    file_size = Column(BigInteger, nullable=True, default=0) # Size in bytes
    converted_path = Column(String, nullable=True)
    converted_size = Column(BigInteger, nullable=True, default=0) # Size in bytes
    # Storage backend of the converted artefact: "soma" (TileDB-SOMA, new) or
    # "zarr" (legacy). NULL is treated as "zarr" for rows that predate the
    # migration, so the serving layer can dual-read during the transition.
    converted_format = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, processing, ready, failed
    failure_reason = Column(String, nullable=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    data_file_id = Column(Uuid(as_uuid=True), ForeignKey("data_files.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Set when the dataset is moved to trash. Filtered out of default queries;
    # cleared on restore. Hard-deletion drops the row entirely.
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    meta_data = Column(JSON, nullable=True)

    owner = relationship("User", back_populates="datasets")
    data_file = relationship("DataFile")

from app.models.user import User
User.datasets = relationship("Dataset", back_populates="owner")
