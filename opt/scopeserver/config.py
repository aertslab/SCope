# -*- coding: utf-8 -*-
""" Server configuration handling. """

from typing import Dict, Optional, Union
from pathlib import Path
import json


def defaults() -> Dict[str, Union[str, int, bool]]:
    """ Default configuration values. """
    return {
        "app_mode": True,
        "debug": True,
        "pPort": 55851,
        "xPort": 55852,
        "gPort": 55853,
    }


def from_file(config_filename: Optional[Union[Path, str]]) -> Dict[str, Union[str, int, bool]]:
    """ Read configuration from a provided file.

    If the configuration filename is not provided. Returns default values.
    """

    config = defaults()
    if config_filename is not None:
        with open(config_filename) as config_file:
            config = {**config, **json.loads(config_file.read())}

    return config
