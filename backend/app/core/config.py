from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SCope v2"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "changethis_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080 # 7 days
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    DATABASE_URL: str = "postgresql+asyncpg://scope:scope_password@localhost:5432/scope_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    ORCID_CLIENT_ID: Optional[str] = None
    ORCID_CLIENT_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

settings = Settings()
