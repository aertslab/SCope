from sqlalchemy import Boolean, Column, DateTime, Integer, String, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    full_name = Column(String, index=True)
    has_password = Column(Boolean, default=True, nullable=False)
    # Set when the user clicks the verification link. Null = unverified.
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    # Bumped on logout, password change, and password reset. Any JWT whose
    # `iat` claim is older than this timestamp is rejected by the auth
    # dependency — a poor-man's revocation list without the per-jti storage.
    tokens_invalidated_after = Column(DateTime(timezone=True), nullable=True)

    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
