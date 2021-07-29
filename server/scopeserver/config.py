""" Server configuration handling. """

from pathlib import Path

from pydantic import BaseSettings, validator


def translate_config_key(key: str) -> str:
    "Translate 'old' style config names into 'new' style names."
    translate = {"PPORT": "UPLOAD_PORT", "GPORT": "DATA_PORT", "MPORT": "HTTP_PORT", "XPORT": "PROXY_PORT_DEPRECATED"}

    if key in translate:
        return translate[key]

    return key


class Settings(BaseSettings):
    """Global settings for the SCope server application."""

    # pylint: disable=no-self-argument
    # pylint: disable=no-self-use
    # pylint: disable=missing-class-docstring
    # pylint: disable=too-few-public-methods

    DATABASE_URL: str = ""

    @validator("DATABASE_URL", pre=True, allow_reuse=True)
    def sqlite_conn(cls, value: str):  # pylint: disable=no-self-argument
        "Validate that the connection string starts with sqlite and has the check_same_thread argument."
        if not value.startswith("sqlite:///"):
            raise ValueError("Not connecting to a sqlite database")
        if not value.endswith("?check_same_thread=false"):
            raise ValueError("check_same_thread should be false")

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

    ORCID_CLIENT_ID: str = "APP-1QNL921F7P9FC3S4"
    ORCID_CLIENT_SECRET: str
    ORCID_REDIRECT_URI: str

    class Config:
        env_file = Path("..") / ".env"
        env_file_encoding = "utf-8"


settings = Settings()
