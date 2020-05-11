from pathlib import Path

import pytest
from json.decoder import JSONDecodeError

import scopeserver.scope.config as config


def test_defaults():
    cfg = config.defaults()

    assert cfg["app_mode"] == False
    assert cfg["debug"]
    assert cfg["pPort"] == 55851
    assert cfg["xPort"] == 55852
    assert cfg["gPort"] == 55853


def test_load_from_file():
    cfg = config.from_file(Path("test") / Path("data") / Path("config.json"))

    # Check unchanged defaults are the same
    assert cfg["app_mode"] == False
    assert cfg["pPort"] == 55851
    assert cfg["xPort"] == 55852
    assert cfg["gPort"] == 55853

    # Check new values
    assert cfg["extra setting"] == "value"


def test_load_from_nonexistant_file():
    with pytest.raises(FileNotFoundError):
        config.from_file("this_file_does_not_exist.txt")


def test_load_malformed_json():
    with pytest.raises(JSONDecodeError):
        config.from_file(Path("test") / Path("data") / Path("malformed_config.json"))
