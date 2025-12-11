from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
import uuid
from jose import jwt, JWTError
from pydantic import ValidationError

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.oauth import oauth
from app.models.user import User
from app.models.oauth_account import OAuthAccount
from app.schemas.token import Token, TokenPayload
from app.schemas.user import User as UserSchema

router = APIRouter()

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
    
    # Redirect to frontend with token
    # Assuming frontend is at localhost:3000/auth/callback?token=...
    # You might want to make this configurable
    frontend_url = "http://127.0.0.1:3000/auth/callback" 
    return RedirectResponse(url=f"{frontend_url}?token={access_token}")

@router.get("/link/orcid")
async def link_orcid(
    request: Request, 
    token: str,
    db: AsyncSession = Depends(deps.get_db)
):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
        
    result = await db.execute(select(User).where(User.id == token_data.sub))
    current_user = result.scalars().first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    redirect_uri = str(request.url_for('login_orcid_callback')).replace('localhost', '127.0.0.1')
    resp = await oauth.orcid.authorize_redirect(request, redirect_uri)
    # Set a cookie to identify the user during callback
    resp.set_cookie(key="orcid_link_user_id", value=str(current_user.id), httponly=True, max_age=300)
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
    frontend_url = "http://127.0.0.1:3000/auth/callback"

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
        return RedirectResponse(url=f"{frontend_url}?token={access_token}")

    # If we are here, it means:
    # 1. Not linking (no cookie)
    # 2. No existing link found
    # We should fail and tell user to link account first
    return RedirectResponse(url=f"{frontend_url}?error=no_orcid_link")

@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            {"sub": str(user.id)}, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

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
            hashed_password=security.get_password_hash(str(uuid.uuid4())),
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
