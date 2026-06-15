"""Helpers for issuing and clearing the auth cookie that carries the JWT.

Centralising cookie config here keeps Set-Cookie attributes consistent across
the password-login endpoint, the OAuth callbacks, and logout.
"""
from typing import Optional

from fastapi import Response

from app.core.config import settings


def set_auth_cookie(response: Response, token: str, max_age: Optional[int] = None) -> None:
    if max_age is None:
        max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )
