import os

# Set safe test-only env BEFORE importing any app module, since app.core.config
# fail-closes on the default/empty secret at import time. CI may override these.
os.environ.setdefault("ALLOW_INSECURE_SECRETS", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest_asyncio.fixture(scope="module")
async def client() -> AsyncGenerator:
    # Imported lazily so hermetic unit tests (which build their own in-memory
    # SQLite session and import only the modules under test) don't require the
    # full app and every runtime dependency to be installed.
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
