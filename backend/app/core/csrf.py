"""Double-submit cookie CSRF protection.

Strategy
--------
The browser-facing auth path puts the JWT in an HttpOnly cookie. Without
extra protection, any cross-origin (or cross-site, depending on
``SameSite``) navigation that triggers an unsafe HTTP verb is enough to
ride the user's session.

We pair the auth cookie with a *non*-HttpOnly companion cookie
``scope_csrf`` containing a random token. The SPA reads it from
``document.cookie`` and echoes it back as ``X-CSRF-Token`` on every
mutating request. Because the malicious site cannot read the cookie
(same-origin policy on JS reads of cookies it doesn't own) and cannot
fabricate the header on a forged form post, the matching pair proves
the request really came from our own origin.

Bearer/PAT clients (CLI, automation) are *not* affected by CSRF — the
attacker cannot induce a victim's browser to send a header it doesn't
own — so we deliberately skip the check whenever ``Authorization`` is
present. This preserves the script-friendly path while locking the
cookie path down.
"""
from __future__ import annotations

import hmac
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import settings


CSRF_COOKIE_NAME = "scope_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Endpoints that are unsafe verbs but legitimately can't carry the header
# (e.g. multipart form posts initiated by anonymous browsers, OAuth-style
# redirects). Currently empty — all unsafe verbs are XHR/JSON from the SPA
# which routes through axios. Add prefixes here if a future flow can't
# attach the header.
EXEMPT_PATH_PREFIXES: tuple[str, ...] = ()
TOKEN_BYTES = 32


def _generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def _set_csrf_cookie(response: Response, token: str) -> None:
    # Intentionally NOT HttpOnly — the SPA must read it to echo it back.
    # Same Secure/SameSite/Domain as the auth cookie so the pair behaves
    # identically across redirects and subdomains.
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


class CSRFMiddleware(BaseHTTPMiddleware):
    """Enforce double-submit CSRF tokens on cookie-authenticated mutations."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        method = request.method.upper()
        path = request.url.path
        existing_token = request.cookies.get(CSRF_COOKIE_NAME)

        if method not in SAFE_METHODS:
            # Bearer/PAT auth is not browser-driven and not vulnerable to CSRF.
            auth_header = request.headers.get("authorization", "")
            uses_bearer = auth_header.lower().startswith("bearer ")
            # Skip exempt paths (configured above) — currently none, but the
            # hook is here for OAuth-style flows that can't attach the header.
            exempt = any(path.startswith(p) for p in EXEMPT_PATH_PREFIXES)

            if not uses_bearer and not exempt:
                # Only enforce when the request actually carries the auth
                # cookie. Anonymous mutations (e.g. /forgot-password) don't
                # need CSRF since there's no session to ride.
                if request.cookies.get(settings.AUTH_COOKIE_NAME):
                    submitted = request.headers.get(CSRF_HEADER_NAME)
                    if (
                        not submitted
                        or not existing_token
                        or not hmac.compare_digest(submitted, existing_token)
                    ):
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "CSRF token missing or invalid"},
                        )

        response = await call_next(request)

        # Seed (or refresh) the cookie on safe responses so the SPA always
        # has a fresh token to echo. Skip if one is already present and
        # this is an unsafe response (avoid clobbering a token we just
        # validated against).
        if not existing_token:
            _set_csrf_cookie(response, _generate_token())

        return response
