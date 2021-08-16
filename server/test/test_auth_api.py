" Tests for the /auth/ section of the HTTP API "

import base64

import httpx

from scopeserver.config import settings
from scopeserver.oidc import decode_state, encode_state

from test.api_fixture import (
    client,
    my_tmp_path,
    database_engine,
    database,
    identity_provider,
    invalid_identity_provider,
    identity_provider_token_fails,
    identity_provider_bad_key,
    user,
    admin,
)


def test_empty_loginurl(database):
    response = client.get("/api/v1/auth/loginurl")
    assert response.status_code == 200
    providers = response.json()
    assert len(providers) == 0


def test_loginurl(identity_provider):
    response = client.get("/api/v1/auth/loginurl")
    assert response.status_code == 200
    providers = response.json()
    assert len(providers) == 1
    assert providers[0]["name"] == identity_provider.name
    url = httpx.URL(providers[0]["url"])

    state = decode_state(url.params["state"]).with_default({"provider": -1})
    print(state)

    assert url.params["client_id"] == identity_provider.clientid
    assert url.params["redirect_uri"] == settings.AUTH_REDIRECT_URI
    assert state["provider"] == identity_provider.id
    assert url.path == "/auth"
    assert url.params["response_type"] == "code"
    assert url.params["scope"] == "openid profile"


def test_loginurl_config_fetch_fails(invalid_identity_provider):
    response = client.get("/api/v1/auth/loginurl")
    assert response.status_code == 500
    error = response.json()
    assert error["detail"] == "Could not get identity provider configuration"


def test_authorize_new_user(identity_provider):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 200
    token = response.json()
    assert token["token_type"] == "bearer"
    assert token["user"] == {"name": "Test", "role": "user", "id": 1}


def test_authorize_existing_user(user, identity_provider):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 200
    token = response.json()
    assert token["token_type"] == "bearer"
    assert token["user"] == user["user"]


def test_authorize_no_provider(user):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 400
    error = response.json()
    assert error["detail"] == "No provider with id=1"


def test_authorize_invalid_provider(user):
    state = encode_state(provider=500)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 400
    error = response.json()
    assert error["detail"] == "No provider with id=500"


def test_authorize_config_fetch_fails(invalid_identity_provider):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 500
    error = response.json()
    assert error["detail"] == "Could not query identity provider"


def test_authorize_token_request_fails(identity_provider_token_fails):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 401
    error = response.json()
    assert error["detail"] == "Intentional test error message"


def test_authorize_token_bad_key(identity_provider_bad_key):
    state = encode_state(provider=1)
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 401
    error = response.json()
    assert error["detail"] == "Signature verification failed."


def test_authorize_bad_state_invalid_base64(user):
    response = client.post("/api/v1/auth/authorize", json={"state": "garbage", "code": ""})
    assert response.status_code == 400
    assert response.json()["detail"] == "Could not decode state: Incorrect padding"


def test_authorize_bad_state_invalid_json(user):
    response = client.post(
        "/api/v1/auth/authorize", json={"state": base64.urlsafe_b64encode(b"garbage").decode(), "code": ""}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Could not decode state: Expecting value"


def test_authorize_bad_state_no_provider(user):
    state = base64.urlsafe_b64encode("{}".encode("utf8")).decode()
    response = client.post("/api/v1/auth/authorize", json={"state": state, "code": ""})
    assert response.status_code == 400
    assert response.json()["detail"] == "No provider with id=None"
