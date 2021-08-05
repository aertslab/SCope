" Abstractions over OpenID Connect APIs "

from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone

import httpx
import jose

from scopeserver import schemas
from scopeserver.config import settings

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
