from sqlalchemy import Column, String, Uuid, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False, index=True)
    provider_account_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="oauth_accounts")
