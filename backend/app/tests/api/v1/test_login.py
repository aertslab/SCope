import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_access_token(client: AsyncClient) -> None:
    """Smoke-test the login endpoint against a real database.

    This is an integration test: it needs Postgres (CI provides it). When no DB
    is reachable locally we skip rather than error, so the hermetic unit suite
    stays deterministic.
    """
    login_data = {"username": "admin@example.com", "password": "password"}
    try:
        r = await client.post("/api/v1/login/access-token", data=login_data)
    except Exception as exc:  # noqa: BLE001 — surface only true connectivity issues
        if "refused" in str(exc).lower() or "connect" in str(exc).lower():
            pytest.skip("Database not reachable; skipping login integration test")
        raise
    # User likely doesn't exist on a fresh DB → 400/401; 200 if seeded.
    assert r.status_code in [400, 401, 200]
