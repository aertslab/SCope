"""
Tests for the scopeserver.config module
"""

import os

from json.decoder import JSONDecodeError
from pathlib import Path, PureWindowsPath

import pytest

import scopeserver.config as config


def test_defaults():
    cfg = config.defaults()

    assert not cfg["app_mode"]
    assert cfg["debug"]
    assert cfg["pPort"] == 55851
    assert cfg["xPort"] == 55852
    assert cfg["gPort"] == 55853
    assert len(cfg["dataHashSecret"]) == 64 and not cfg["dataHashSecret"].isspace()
    assert Path(cfg["data"]) == Path("data")


def test_load_from_file():
    cfg = config.from_file(Path("test") / Path("data") / Path("config.json"))

    # Check unchanged defaults are the same
    assert not cfg["app_mode"]
    assert not cfg["debug"]
    assert cfg["pPort"] == 55851
    assert cfg["xPort"] == 55852
    assert cfg["gPort"] == 55853
    assert len(cfg["dataHashSecret"]) == 64 and not cfg["dataHashSecret"].isspace()
    assert PureWindowsPath(cfg["data"]) == PureWindowsPath("C:/User/SCope data")

    # Check new values
    assert cfg["extra setting"] == "value"


def test_blank_dataHashSecret():
    cfg = config.from_string('{"dataHashSecret": "    "}')

    assert len(cfg["dataHashSecret"]) == 64 and not cfg["dataHashSecret"].isspace()


def test_load_from_nonexistant_file():
    with pytest.raises(FileNotFoundError):
        config.from_file("this_file_does_not_exist.txt")


def test_load_malformed_json():
    with pytest.raises(JSONDecodeError):
        config.from_file(Path("test") / Path("data") / Path("malformed_config.json"))
