from sqlalchemy import Boolean, Column, Integer, String, Uuid
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

    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
