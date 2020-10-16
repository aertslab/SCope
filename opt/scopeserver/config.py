# -*- coding: utf-8 -*-
""" Server configuration handling. """

from typing import Dict, Optional, Union
from pathlib import Path
from collections import defaultdict
from pydantic import BaseSettings
import json
import secrets

Config = Dict[str, Union[str, int, bool, Path]]


def default_validator():
    """ The default validator does not check its argument, assumes it is valid. """
    return lambda arg: True


def validate(config: Config) -> Config:
    """ Check a config has valid keys and values and strips invalid values. """

    validators = defaultdict(default_validator, [("dataHashSecret", lambda secret: not secret.isspace())])

    return {key: value for key, value in config.items() if validators[key](value)}


def defaults() -> Config:
    """ Default configuration values. """
    return {
        "app_mode": False,
        "debug": True,
        "pPort": 55851,
        "xPort": 55852,
        "gPort": 55853,
        "dataHashSecret": secrets.token_hex(32),
        "data": Path("data"),
    }


def from_string(config: str) -> Config:
    """ Read configuration from a string. """
    return {**defaults(), **validate(json.loads(config))}


def from_file(config_filename: Optional[Union[Path, str]]) -> Config:
    """
    Read configuration from a provided file.
    If the configuration filename is not provided. Returns default values.
    """

    if config_filename is not None:
        with open(config_filename) as config_file:
            return from_string(config_file.read())

    return defaults()


class Settings(BaseSettings):

    DATABASE_URL: str

    class Config:
        env_file = Path("..") / ".env"
        env_file_encoding = "utf-8"


settings = Settings()
