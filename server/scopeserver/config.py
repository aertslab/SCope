""" Server configuration handling. """

from pathlib import Path
import secrets

from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Global settings for the SCope server application."""

    # pylint: disable=no-self-argument
    # pylint: disable=no-self-use
    # pylint: disable=too-few-public-methods

    DATABASE_URL: str = ""

    @validator("DATABASE_URL", pre=True, allow_reuse=True)
    def valid_db_connection(cls, value: str):
        "Validate that the connection string starts with sqlite and has the check_same_thread argument."
        if value.startswith("sqlite:///"):
            if not value.endswith("?check_same_thread=false"):
                raise ValueError("check_same_thread should be false")
        elif value.startswith("postgresql"):
            if " " in value:
                raise ValueError("pgsql database url should not contain spaces")
        else:
            raise ValueError("Invalid database URL. Should be either a valid sqlite or pgsql url")

        return value

    DEBUG: bool

    DATA_PATH: Path = Path("data")

    SECRET: str

    @validator("SECRET", pre=True, allow_reuse=True)
    def valid_secret(cls, value: str):
        "Validate that the data hash secret string contains no spaces."
        if " " in value:
            raise ValueError("Secret must not contain spaces")
        if len(value) != 64:
            raise ValueError(f"Secret {value} must be 64 characters long. This one is {len(value)}")
        return value

    UPLOAD_PORT: int = 55851  #  Was: pPort
    RPC_PORT: int = 55853  #  Was: gPort

    API_V1_STR: str = "/api/v1"
    API_SECRET: str = secrets.token_urlsafe(32)
    API_JWT_ALGORITHM: str = "HS256"
    API_TOKEN_EXPIRE: int = 7 * 24 * 60  # 7 days in minutes

    AUTH_REDIRECT_URI: str

    class Config:
        "Default configuration"
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
