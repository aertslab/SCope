" API endpoints dealing with authentication and authorization. "

from typing import List

import httpx
import jose
from fastapi import APIRouter, Depends, HTTPException, status
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
from sqlalchemy.orm import Session

from scopeserver import crud, oidc, schemas
from scopeserver.api import deps
from scopeserver.result import Result, raise_

router = APIRouter()


@router.get("/loginurl", summary="Get login urls for each identity provider", response_model=List[schemas.LoginUrl])
async def get_login_url(
    database: Session = Depends(deps.get_db), http_client: httpx.AsyncClient = Depends(deps.get_http_client)
):
    "Get login URLs for each identity provider"
    providers = crud.get_identity_providers(database)

    urls = []
    for provider in providers:
        if (config := await oidc.configuration(http_client, provider.issuer)) is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not get identity provider configuration",
            )
        urls.append(oidc.login_url(config["authorization_endpoint"], schemas.Provider.from_orm(provider)))

    return [
        schemas.LoginUrl(id=provider.id, name=provider.name, issuer=provider.issuer, url=url, icon=provider.icon)
        for provider, url in zip(providers, urls)
    ]


@router.post("/authorize", summary="Get an API access token", response_model=schemas.Token)
async def verify_authorization(
    body: schemas.AuthorizationResponse,
    database: Session = Depends(deps.get_db),
    http_client: httpx.AsyncClient = Depends(deps.get_http_client),
) -> schemas.Token:
    "Submit the 'code' from the authorization service to get an API access token."
    provider = (
        oidc.decode_state(body.state)
        .and_then(
            lambda state: Result.from_optional(
                crud.get_provider_by_id(database, state.get("provider")), f"No provider with id={state.get('provider')}"
            )
        )
        .match(
            on_success=lambda provider: provider,
            on_error=lambda error: raise_(HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)),
        )
    )

    if (config := await oidc.configuration(http_client, provider.issuer)) is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not query identity provider"
        )

    keys = await oidc.jwks(http_client, config)

    token_request = (
        oidc.TokenRequestBuilder()
        .with_clientid(provider.clientid)
        .with_secret(provider.secret)
        .with_code(body.code)
        .build()
    )

    if "error" in (response := await oidc.token(http_client, config, token_request)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=response.get("error_description"))

    try:
        id_token = jose.jwt.decode(
            response["id_token"], keys, audience=provider.clientid, access_token=response["access_token"]
        )
    except (JWTError, JWTClaimsError, ExpiredSignatureError) as err:
        raise HTTPException(  # pylint: disable=raise-missing-from
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(err)
        )

    userinfo = await oidc.userinfo(http_client, config, access_token=response["access_token"])
    user = schemas.ORCIDUser(**{**id_token, **userinfo})

    if (db_user := crud.get_user_by_identity(database, issuer=user.iss, subject=user.sub)) is None:
        # Create a new user in the database
        db_user = crud.create_user(database, user=schemas.UserCreate(**user.dict(), role="user"))

    authed_user = schemas.UserResponse.from_orm(db_user)
    access_token = oidc.create_access_token(data=authed_user)

    return schemas.Token(  # nosemgrep: gitlab.bandit.B106
        access_token=access_token,
        token_type="bearer",
        user=authed_user,
    )
