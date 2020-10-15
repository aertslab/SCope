# settings.py
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path("..") / ".env"
load_dotenv(dotenv_path=env_path)


def get(key: str):
    env = os.environ[key]
    if not env:
        raise Exception(f"{key} environment variable not found.")
    return env
