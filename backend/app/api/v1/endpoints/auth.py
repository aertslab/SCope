from datetime import timedelta, datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
import uuid
from jose import jwt, JWTError
from pydantic import ValidationError
from app.core.limiter import limiter

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.cookies import clear_auth_cookie, set_auth_cookie
from app.core.email import send_email
from app.core.oauth import oauth
from app.models.user import User
from app.models.oauth_account import OAuthAccount
from app.schemas.token import Token, TokenPayload
from app.schemas.user import (
    User as UserSchema,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services import email_tokens

router = APIRouter()


def _frontend_callback_url() -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback"


def _redirect_with_auth_cookie(token: str, target_url: str) -> RedirectResponse:
    resp = RedirectResponse(url=target_url)
    set_auth_cookie(resp, token)
    return resp

@router.get("/login/google")
async def login_google(request: Request):
    redirect_uri = str(request.url_for('login_google_callback')).replace('localhost', '127.0.0.1')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/login/google/callback")
async def login_google_callback(request: Request, db: AsyncSession = Depends(deps.get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    if not user_info:
        # Try to fetch userinfo if not in token
        user_info = await oauth.google.userinfo(token=token)
    
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")

    email = user_info.get('email')
    name = user_info.get('name')
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in Google account")

    user = await get_or_create_oauth_user(db, "google", user_info["sub"], email, name)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        {"sub": str(user.id)}, expires_delta=access_token_expires
    )

    # Issue token via HttpOnly cookie; do not place it in the redirect URL.
    return _redirect_with_auth_cookie(access_token, _frontend_callback_url())

@router.get("/link/orcid")
async def link_orcid(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Begin ORCiD linking. Authenticated via the auth cookie / Bearer header."""
    redirect_uri = str(request.url_for('login_orcid_callback')).replace('localhost', '127.0.0.1')
    resp = await oauth.orcid.authorize_redirect(request, redirect_uri)
    # Set a short-lived cookie to identify the user during callback
    resp.set_cookie(
        key="orcid_link_user_id",
        value=str(current_user.id),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=300,
        path="/",
    )
    return resp

@router.get("/login/orcid/callback")
async def login_orcid_callback(request: Request, db: AsyncSession = Depends(deps.get_db)):
    token = await oauth.orcid.authorize_access_token(request)
    
    # Try to get user info from OIDC token
    user_info = token.get('userinfo')
    if not user_info:
        try:
            user_info = await oauth.orcid.userinfo(token=token)
        except Exception:
            pass
            
    orcid_id = None
    name = None
    email = None

    if user_info:
        orcid_id = user_info.get('sub')
        name = user_info.get('name') or f"{user_info.get('given_name', '')} {user_info.get('family_name', '')}".strip()
        email = user_info.get('email')

    # Fallback to legacy/token fields if OIDC failed or fields missing
    if not orcid_id:
        orcid_id = token.get('orcid')
    if not name:
        name = token.get('name')
    
    if not orcid_id:
        raise HTTPException(status_code=400, detail="Failed to get ORCiD iD")

    # Check for linking cookie
    linking_user_id = request.cookies.get("orcid_link_user_id")
    frontend_url = _frontend_callback_url()

    if linking_user_id:
        # LINKING FLOW
        try:
            user_uuid = uuid.UUID(linking_user_id)
            result = await db.execute(select(User).where(User.id == user_uuid))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=400, detail="User not found for linking")
            
            # Check if this ORCiD is already linked to another user
            result = await db.execute(select(OAuthAccount).where(
                OAuthAccount.provider == 'orcid',
                OAuthAccount.provider_account_id == orcid_id
            ))
            existing_link = result.scalars().first()
            
            if existing_link:
                if existing_link.user_id != user.id:
                     return RedirectResponse(url=f"{frontend_url}?error=orcid_already_linked")
                # Already linked to this user, just update last login
                existing_link.last_login = func.now()
                await db.commit()
            else:
                # Create new link
                oauth_account = OAuthAccount(
                    user_id=user.id,
                    provider='orcid',
                    provider_account_id=orcid_id
                )
                db.add(oauth_account)
                await db.commit()

            # Clear cookie and redirect
            resp = RedirectResponse(url=f"{frontend_url}?success=orcid_linked")
            resp.delete_cookie("orcid_link_user_id")
            return resp
            
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid user ID in cookie")

    # LOGIN FLOW
    # Check if OAuth account exists
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == 'orcid',
            OAuthAccount.provider_account_id == orcid_id
        )
    )
    oauth_account = result.scalars().first()

    if oauth_account:
        # Update last login
        oauth_account.last_login = func.now()
        await db.commit()
        
        result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = result.scalars().first()
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            {"sub": str(user.id)}, expires_delta=access_token_expires
        )
        return _redirect_with_auth_cookie(access_token, frontend_url)

    # If we are here, it means:
    # 1. Not linking (no cookie)
    # 2. No existing link found
    # We should fail and tell user to link account first
    return RedirectResponse(url=f"{frontend_url}?error=no_orcid_link")

@router.post("/login/access-token", response_model=Token)
@limiter.limit("10/minute")
async def login_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login.

    Issues the JWT both as an HttpOnly cookie (preferred for browser clients)
    and in the response body (preserved for OAuth2 password-flow tooling).
    """
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    if not user or not await security.verify_password_async(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        {"sub": str(user.id)}, expires_delta=access_token_expires
    )
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> None:
    """Clear the auth cookie and invalidate prior tokens.

    Bumping ``tokens_invalidated_after`` causes the auth dependency to
    reject any JWT issued before this moment, so a leaked cookie can't be
    replayed after the user logs out. Anonymous callers still get a clean
    cookie wipe \u2014 useful for clearing stale state in the browser.
    """
    if current_user is not None:
        current_user.tokens_invalidated_after = datetime.now(timezone.utc)  # type: ignore[assignment]
        db.add(current_user)
        await db.commit()
    clear_auth_cookie(response)
    return None

@router.get("/login/orcid")
async def login_orcid(request: Request):
    redirect_uri = str(request.url_for('login_orcid_callback')).replace('localhost', '127.0.0.1')
    return await oauth.orcid.authorize_redirect(request, redirect_uri)

async def get_or_create_oauth_user(
    db: AsyncSession, provider: str, provider_id: str, email: str, name: str
) -> User:
    # Check if OAuth account exists
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_account_id == provider_id
        )
    )
    oauth_account = result.scalars().first()

    if oauth_account:
        # Update last login
        oauth_account.last_login = func.now()
        await db.commit()
        # Return associated user
        # We need to fetch the user because oauth_account.user might be lazy loaded and we are in async
        # But we can just query the user by id
        result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = result.scalars().first()
        return user

    # Check if user exists by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        # Create new user
        user = User(
            email=email,
            full_name=name,
            hashed_password=await security.get_password_hash_async(str(uuid.uuid4())),
            is_active=True,
            has_password=False
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create OAuth account
    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_account_id=provider_id
    )
    db.add(oauth_account)
    await db.commit()
    
    return user


# ---------------------------------------------------------------------------
# Password reset & email verification
# ---------------------------------------------------------------------------


def _build_link(path: str, token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}{path}?token={token}"


@router.post("/forgot-password", status_code=204)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> None:
    """Begin a password reset.

    Always returns 204 to avoid leaking whether an email is registered.
    If the address belongs to an active user with a password, an email is
    queued; OAuth-only accounts (no password) are skipped silently.
    """
    res = await db.execute(select(User).where(User.email == payload.email))
    user = res.scalars().first()
    if user and user.is_active and user.has_password:
        token = await email_tokens.issue_token(db, user, "password_reset")
        link = _build_link("/reset-password", token)
        await send_email(
            to=user.email,
            subject="Reset your SCope password",
            text=(
                "We received a request to reset your password.\n\n"
                f"Open this link within {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS}h "
                f"to choose a new password:\n{link}\n\n"
                "If you didn't request this, you can ignore this email."
            ),
        )
    return None


@router.post("/reset-password", status_code=204)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> None:
    user = await email_tokens.consume_token(db, payload.token, "password_reset")
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.hashed_password = await security.get_password_hash_async(payload.new_password)
    user.has_password = True
    # Invalidate every existing JWT for this user. Anyone holding a stolen
    # cookie loses access the moment the password reset commits.
    user.tokens_invalidated_after = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()
    return None


@router.post("/send-verification-email", status_code=204)
@limiter.limit("3/minute")
async def send_verification_email(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """(Re)send the email-verification link for the current user."""
    if current_user.email_verified_at is not None:
        return None
    token = await email_tokens.issue_token(db, current_user, "email_verification")
    link = _build_link("/verify-email", token)
    await send_email(
        to=current_user.email,
        subject="Verify your SCope email address",
        text=(
            "Welcome to SCope! Please confirm this is your email address by "
            f"opening:\n{link}\n\nThe link expires in "
            f"{settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS}h."
        ),
    )
    return None


@router.post("/verify-email", status_code=204)
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> None:
    user = await email_tokens.consume_token(db, payload.token, "email_verification")
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
        db.add(user)
        await db.commit()
    return None
