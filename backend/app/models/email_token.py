"""Single-use tokens for password reset and email verification."""
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Uuid, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class EmailToken(Base):
    """Hashed, single-use token bound to a user and a purpose.

    We store only the hash so a database leak doesn't yield usable tokens.
    The plaintext is delivered exactly once via email.
    """

    __tablename__ = "email_tokens"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # "password_reset" or "email_verification"
    purpose = Column(String, nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

    def is_valid(self) -> bool:
        if self.used_at is not None:
            return False
        # Compare as naive UTC since DB column is timezone-aware. SQLAlchemy
        # returns aware datetimes for timezone=True columns on Postgres.
        now = datetime.now(self.expires_at.tzinfo) if self.expires_at.tzinfo else datetime.utcnow()
        return self.expires_at > now


Index("ix_email_tokens_user_purpose", EmailToken.user_id, EmailToken.purpose)
