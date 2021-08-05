" Test fixtures for the HTTP API "

from pathlib import Path
from urllib.parse import parse_qs
import shutil
import tempfile
from datetime import datetime

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import jose.jwt as jwt
import jose.jwk as jwk

from main import scope_api
from scopeserver import models
from scopeserver.config import settings
from scopeserver.database import Base
from scopeserver.api.deps import get_db, get_http_client

TEST_DATABASE_NAME = "test.db"
SQLALCHEMY_DATABASE_URI = f"sqlite:///./{TEST_DATABASE_NAME}"

client = TestClient(scope_api)


def mock_http_handler(request):
    print(f"Got a mock request: {request.url.path}")
    if request.url.path == "/.well-known/openid-configuration":
        return httpx.Response(
            200,
            json={
                "jwks_uri": "http://localhost:8080/jwks",
                "token_endpoint": "http://localhost:8080/token",
                "userinfo_endpoint": "http://localhost:8080/userinfo",
                "authorization_endpoint": "http://localhost:8080/auth",
            },
        )
    if request.url.path == "/jwks":
        return httpx.Response(
            200,
            json={"keys": [jwk.construct("test", algorithm="HS256").to_dict()]},
        )
    if request.url.path == "/token":
        params = {key: val[0] for key, val in parse_qs(request.stream.read().decode("utf8")).items()}
        checks = [
            params["grant_type"] == "authorization_code",
            params["redirect_uri"] == "http://localhost/",
            params["client_id"] == "test",
            params["client_secret"] == "123",
        ]
        if all(checks):
            token = jwt.encode(
                {"sub": "1", "name": "Test", "iat": "1", "iss": "http://localhost:8080"}, key="test", algorithm="HS256"
            )
            return httpx.Response(200, json={"access_token": token, "token_type": "bearer", "id_token": token})

        return httpx.Response(401, json={"error": "Error", "error_description": "Error"})
    return httpx.Response(404, json={"error": "Unimplemented"})


def mock_http_error_handler(request):
    print(f"Got a mock request for error: {request.url.path}")
    return httpx.Response(404, json={"error": "This is an intentional failure for testing purposes"})


def mock_http_token_fails(request):
    print(f"Got a mock request for bad-tonen mock: {request.url.path}")

    if request.url.path == "/.well-known/openid-configuration":
        return httpx.Response(
            200,
            json={
                "jwks_uri": "http://localhost:8080/jwks",  # This will be a success
                "token_endpoint": "http://localhost-token-error:8080/token",
                "userinfo_endpoint": "http://localhost-token-error:8080/userinfo",
                "authorization_endpoint": "http://localhost-token-error:8080/auth",
            },
        )
    return httpx.Response(404, json={"error": "Test", "error_description": "Intentional test error message"})


def mock_http_bad_key(request):
    print(f"Got a mock request for bad-tonen mock: {request.url.path}")
    if request.url.path == "/.well-known/openid-configuration":
        return httpx.Response(
            200,
            json={
                "jwks_uri": "http://localhost-bad-key:8080/jwks",
                "token_endpoint": "http://localhost:8080/token",  # This will be a success
                "userinfo_endpoint": "http://localhost:8080/userinfo",  # This will be a success
                "authorization_endpoint": "http://localhost:8080/auth",  # This will be a success
            },
        )

    if request.url.path == "/jwks":
        return httpx.Response(
            200,
            json={"keys": [jwk.construct("wrong-key-value", algorithm="HS256").to_dict()]},
        )


@pytest.fixture(scope="module")
def my_tmp_path():
    path = Path(tempfile.mkdtemp())
    yield path
    shutil.rmtree(path)


@pytest.fixture(scope="module")
def database_engine(my_tmp_path):
    engine = create_engine(SQLALCHEMY_DATABASE_URI, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    async def override_get_http_client():
        try:
            override = {
                "all://localhost": httpx.MockTransport(mock_http_handler),
                "all://localhost-error": httpx.MockTransport(mock_http_error_handler),
                "all://localhost-token-error": httpx.MockTransport(mock_http_token_fails),
                "all://localhost-bad-key": httpx.MockTransport(mock_http_bad_key),
            }
            http_client = httpx.AsyncClient(mounts=override)
            yield http_client
        finally:
            await http_client.aclose()

    scope_api.dependency_overrides[get_db] = override_get_db
    scope_api.dependency_overrides[get_http_client] = override_get_http_client

    saved_data_path = settings.DATA_PATH
    settings.DATA_PATH = my_tmp_path

    Base.metadata.create_all(bind=engine)

    yield engine
    Base.metadata.drop_all(bind=engine)
    Path(TEST_DATABASE_NAME).unlink(missing_ok=True)
    settings.DATA_PATH = saved_data_path


@pytest.fixture
def database(database_engine):
    session = sessionmaker(autocommit=False, autoflush=False, bind=database_engine)

    connection = database_engine.connect()
    transaction = connection.begin()
    for table in Base.metadata.tables.values():
        connection.execute(table.delete())
    transaction.commit()
    connection.close()

    return session


@pytest.fixture
def guest(database):
    response = client.post("/api/v1/user/new")
    return response.json()


@pytest.fixture
def user(database):
    response = client.post("/api/v1/user/new")
    user_user = response.json()
    db = database()
    myuser = db.query(models.User).filter(models.User.id == user_user["user"]["id"]).first()
    myuser.role = "user"
    myuser.iss = "http://localhost:8080"
    myuser.sub = user_user["user"]["id"]
    db.commit()
    db.flush()
    user_user["user"]["role"] = "user"
    yield user_user
    db.close()


@pytest.fixture
def admin(database):
    response = client.post("/api/v1/user/new")
    admin_user = response.json()
    db = database()
    myadmin = db.query(models.User).filter(models.User.id == admin_user["user"]["id"]).first()
    myadmin.role = "admin"
    myadmin.iss = "http://localhost:8080"
    myadmin.sub = str(admin_user["user"]["id"])
    db.commit()
    db.flush()
    admin_user["user"]["role"] = "admin"
    yield admin_user
    db.close()


@pytest.fixture
def identity_provider(database):
    db = database()
    provider = models.IdentityProvider(name="Test", issuer="http://localhost:8080", clientid="test", secret="123")
    db.add(provider)
    db.flush()
    db.refresh(provider)
    db.commit()
    yield provider
    db.close()


@pytest.fixture
def invalid_identity_provider(database):
    db = database()
    provider = models.IdentityProvider(name="Test", issuer="http://localhost-error:8080", clientid="test", secret="123")
    db.add(provider)
    db.flush()
    db.refresh(provider)
    db.commit()
    yield provider
    db.close()


@pytest.fixture
def identity_provider_token_fails(database):
    db = database()
    provider = models.IdentityProvider(
        name="Test", issuer="http://localhost-token-error:8080", clientid="test", secret="123"
    )
    db.add(provider)
    db.flush()
    db.refresh(provider)
    db.commit()
    yield provider
    db.close()


@pytest.fixture
def identity_provider_bad_key(database):
    db = database()
    provider = models.IdentityProvider(
        name="Test", issuer="http://localhost-bad-key:8080", clientid="test", secret="123"
    )
    db.add(provider)
    db.flush()
    db.refresh(provider)
    db.commit()
    yield provider
    db.close()


@pytest.fixture
def expired_admin_token():
    def gen_token(uid: int) -> str:
        user = {"id": uid, "name": "Admin", "role": "admin", "exp": datetime(2000, 1, 1)}
        return jwt.encode(user, settings.API_SECRET, settings.API_JWT_ALGORITHM)

    return gen_token


@pytest.fixture
def spoofed_admin_token():
    def gen_token(uid: int) -> str:
        user = {"id": uid, "name": "Admin", "role": "admin", "exp": datetime(3000, 1, 1)}
        return jwt.encode(user, "some-fake-key", settings.API_JWT_ALGORITHM)

    return gen_token
