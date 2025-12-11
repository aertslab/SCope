from sqlalchemy import Column, String, JSON, DateTime
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
