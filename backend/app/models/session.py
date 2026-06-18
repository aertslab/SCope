from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Uuid
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    data = Column(JSON, nullable=False)
    # Content fingerprint (sha256 of the canonical JSON) used to dedupe
    # identical share payloads to a single row WITHOUT making the public URL
    # derivable from the payload. The URL `id` is an unguessable random token;
    # this hash is an internal lookup key only.
    content_hash = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
