from sqlalchemy import Column, String, BigInteger, DateTime, Uuid
from sqlalchemy.sql import func
from app.db.base import Base
import uuid

class DataFile(Base):
    __tablename__ = "data_files"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_hash = Column(String, unique=True, index=True, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)
    converted_path = Column(String, nullable=True)
    converted_size = Column(BigInteger, nullable=True, default=0)
    # "soma" (TileDB-SOMA) | "zarr" (legacy) | NULL (treated as zarr).
    converted_format = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, processing, ready, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
