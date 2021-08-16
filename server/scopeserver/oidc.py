" Abstractions over OpenID Connect APIs "

from typing import Any, Dict, Optional, TypedDict
from datetime import datetime, timedelta, timezone
import base64
from binascii import Error as Base64DecodeError
import json
from json.decoder import JSONDecodeError
from urllib.parse import urlencode

import httpx
import jose

from scopeserver import schemas
from scopeserver.config import settings
from scopeserver.result import Result, ok, err

ResponseType = Dict[Any, Any]


class TokenRequestBuilder:
    "Builder for OpenID Connect token requests"
    _request: Dict[str, Optional[str]] = {
        "client_id": "",
        "client_secret": "",
        "grant_type": "authorization_code",
        "code": "",
        "state": "",
        "scope": None,
        "redirect_uri": settings.AUTH_REDIRECT_URI,
    }

    def with_clientid(self, clientid: str):
        "Client id for requester (us)"
        self._request.update({"client_id": clientid})
        return self

    def with_secret(self, secret: str):
        "API provided secret"
        self._request.update({"client_secret": secret})
        return self

    def with_grant_type(self, grant_type: str):
        "Related to the type of flow used. Probably 'authorization_code'"
        self._request.update({"grant_type": grant_type})
        return self

    def with_code(self, code: str):
        "Code previously obtained from the authorisation endpoint"
        self._request.update({"code": code})
        return self

    def with_state(self, state: str):
        "State used by us to track anything we need between requests"
        self._request.update({"state": state})
        return self

    def with_scope(self, scope: str):
        "Scopes for the token"
        self._request.update({"scope": scope})
        return self

    def with_redirect_uri(self, redirect_uri: str):
        "The registered redirect URI after authentication"
        self._request.update({"redirect_uri": redirect_uri})
        return self

    def build(self) -> Dict[str, Optional[str]]:
        "Build the configuration after setting up"
        return self._request.copy()


async def configuration(client: httpx.AsyncClient, provider: str) -> Optional[ResponseType]:
    "Fetch a providers well-known openid configuration."
    response = await client.get(f"{provider}/.well-known/openid-configuration")
    if response.status_code == 200:
        config = response.json()
        if isinstance(config, dict):
            return config

    return None


async def jwks(client: httpx.AsyncClient, config: Dict[str, str]) -> ResponseType:
    "Fetch Json Web Key information."
    response = await client.get(config["jwks_uri"])

    keys = response.json()
    if isinstance(keys, dict):
        return keys

    return {}


async def token(
    client: httpx.AsyncClient, config: Dict[str, str], token_request: Dict[str, Optional[str]]
) -> ResponseType:
    "Access the token endpoint"
    response = await client.post(config["token_endpoint"], data=token_request)

    tkn = response.json()
    if isinstance(tkn, dict):
        return tkn

    return {}


async def userinfo(client: httpx.AsyncClient, config: Dict[str, str], access_token: str) -> ResponseType:
    "Access the userinfo endpoint."
    header = {"Authorization": f"Bearer {access_token}"}
    response = await client.get(config["userinfo_endpoint"], headers=header)

    info = response.json()
    if isinstance(info, dict):
        return info

    return {}


def create_access_token(*, data: schemas.UserResponse) -> bytes:
    "Create an API access token for use with SCope."
    to_encode = data.dict()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.API_TOKEN_EXPIRE)
    to_encode.update({"exp": expire})
    return jose.jwt.encode(to_encode, settings.API_SECRET, settings.API_JWT_ALGORITHM)


class OidcState(TypedDict):
    "The state object passed between the auth provider, the client and us."
    provider: int


def encode_state(provider: int) -> str:
    "Encode a state object in a URL safe way"
    state: OidcState = {"provider": provider}

    return base64.urlsafe_b64encode(json.dumps(state).encode("utf8")).decode()


def decode_state(encoded: str) -> Result[OidcState, str]:
    "Decode a URL encoded state object"
    try:
        decoded = json.loads(base64.urlsafe_b64decode(encoded))
    except JSONDecodeError as json_error:
        return err(f"Could not decode state: {json_error.msg}")
    except Base64DecodeError as base64_error:
        return err(f"Could not decode state: {base64_error}")
    except UnicodeDecodeError as unicode_error:
        return err(f"Could not decode state: {unicode_error}")
    else:
        return ok(decoded)


def login_url(auth_endpoint: str, provider: schemas.Provider) -> str:
    "Format a login URL for a provider"
    params = {
        "client_id": provider.clientid,
        "redirect_uri": settings.AUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile",
        "state": encode_state(provider=provider.id),
    }
    return f"{auth_endpoint}?{urlencode(params)}"
