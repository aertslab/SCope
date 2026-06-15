"""Personal Access Tokens for programmatic API access.

A PAT is a long-lived bearer credential bound to a single user. We never
store the raw token — only its SHA-256 hash — so a database leak doesn't
yield usable tokens. The plaintext is shown to the user exactly once at
creation time.
"""
from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class PersonalAccessToken(Base):
    __tablename__ = "personal_access_tokens"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Human-readable label so users can tell tokens apart in their list.
    name = Column(String, nullable=False)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    # Null = never expires. Enforced at auth time, not by the DB.
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
