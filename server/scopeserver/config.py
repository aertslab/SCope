""" Server configuration handling. """

from typing import Any, Dict
import os
import json
from pathlib import Path

from pydantic import BaseSettings, validator


def translate_config_key(key: str) -> str:
    "Translate 'old' style config names into 'new' style names."
    translate = {"PPORT": "UPLOAD_PORT", "GPORT": "DATA_PORT", "MPORT": "HTTP_PORT", "XPORT": "PROXY_PORT_DEPRECATED"}

    if key in translate:
        return translate[key]

    return key


def json_config_settings_source(_s: BaseSettings) -> Dict[str, Any]:
    """
    Read configuration from a provided file.
    If the configuration filename is not provided. Returns default values.
    """

    json_config = {}
    filename = os.environ.get("SCOPE_CONFIG")
    if filename and Path(filename).is_file():
        with open(filename) as config_file:
            json_config = {translate_config_key(key.upper()): val for key, val in json.load(config_file).items()}

    return json_config


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

    DATAHASHSECRET: str

    @validator("DATAHASHSECRET", pre=True, allow_reuse=True)
    def valid_secret(cls, value: str):
        "Validate that the data hash secret string contains no spaces."
        if " " in value:
            raise ValueError("Secret must not contain spaces")
        if len(value) != 64:
            raise ValueError(f"Secret {value} must be 64 characters long. This one is {len(value)}")
        return value

    HTTP_PORT: int = 55850  #  Was: mPort
    UPLOAD_PORT: int = 55851  #  Was: pPort
    DATA_PORT: int = 55853  #  Was: gPort
    PROXY_PORT_DEPRECATED: int = 55852  # Was: xPort

    API_V1_STR: str = "/api/v1"

    # Other unused config

    WSPROTOCOL: str
    HTTPPROTOCOL: str
    LOCALHOSTADDRESS: str
    PUBLICHOSTADDRESS: str

    ORCIDAPICLIENTID: str
    ORCIDAPICLIENTSECRET: str
    ORCIDAPIREDIRECTURI: str

    REVERSEPROXYON: bool

    class Config:
        env_file = Path("..") / ".env"
        env_file_encoding = "utf-8"

        @classmethod
        def customise_sources(
            cls,
            init_settings,
            env_settings,
            file_secret_settings,
        ):
            "Add a JSON source for settings."
            return (
                init_settings,
                json_config_settings_source,
                env_settings,
                file_secret_settings,
            )


settings = Settings()
