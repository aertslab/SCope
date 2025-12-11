import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.core.config import settings

# Use a separate database for testing or the same one (be careful)
# For simplicity, we'll use the same one but maybe we should use a test db.
# But since we are in docker, we can just use the main one for now, 
# or ideally create a test db.
# For this environment, let's just use the main one but be aware it might clear data if we configured it to.
# Actually, let's just test the API endpoints that don't require DB or use the existing DB.

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest_asyncio.fixture(scope="module")
async def client() -> AsyncGenerator:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
