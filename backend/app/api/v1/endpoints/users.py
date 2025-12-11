from typing import Any, List
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from fastapi import Response

from app.api import deps
from app.core import security
from app.models.user import User
from app.models.oauth_account import OAuthAccount
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate, UserUpdateMe
from app.schemas.oauth_account import OAuthAccount as OAuthAccountSchema

router = APIRouter()

@router.get("/search", response_model=List[UserSchema])
async def search_users(
    query: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Search users by email or name.
    """
    stmt = select(User).where(
        (User.email.ilike(f"%{query}%")) | (User.full_name.ilike(f"%{query}%"))
    ).limit(10)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve users.
    """
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=UserSchema)
async def create_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user.
    """
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    db_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_superuser=user_in.is_superuser,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.get("/me/oauth-accounts", response_model=List[OAuthAccountSchema])
async def read_user_oauth_accounts(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user's OAuth accounts.
    """
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == current_user.id))
    return result.scalars().all()

@router.delete("/me/oauth-accounts/{account_id}", status_code=204)
async def delete_user_oauth_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """
    Unlink an OAuth account.
    """
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.id == account_id, OAuthAccount.user_id == current_user.id))
    oauth_account = result.scalars().first()
    
    if not oauth_account:
        raise HTTPException(status_code=404, detail="OAuth account not found")
        
    await db.delete(oauth_account)
    await db.commit()
    return None

@router.put("/me", response_model=UserSchema)
async def update_user_me(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserUpdateMe,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own user.
    """
    if user_in.email and user_in.email != current_user.email:
        # Check if linked to google
        result = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == current_user.id))
        oauth_accounts = result.scalars().all()
        for account in oauth_accounts:
            if account.provider == 'google':
                raise HTTPException(
                    status_code=400,
                    detail="Cannot change email when linked to Google account."
                )
        
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        user = result.scalars().first()
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system.",
            )
        current_user.email = user_in.email

    if user_in.full_name:
        current_user.full_name = user_in.full_name

    if user_in.password:
        if not current_user.has_password:
             raise HTTPException(
                status_code=400,
                detail="Cannot change password for OAuth-only account."
            )
        if not user_in.current_password:
             raise HTTPException(
                status_code=400,
                detail="Current password is required to set new password."
            )
        if not security.verify_password(user_in.current_password, current_user.hashed_password):
             raise HTTPException(
                status_code=400,
                detail="Incorrect password."
            )
        current_user.hashed_password = security.get_password_hash(user_in.password)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("/{user_id}", response_model=UserSchema)
async def read_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_active_superuser),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Get a specific user by id.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    return user

@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: uuid.UUID,
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update a user.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    
    update_data = user_in.model_dump(exclude_unset=True)
    if update_data.get("password"):
        hashed_password = security.get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["hashed_password"] = hashed_password
        
    for field, value in update_data.items():
        setattr(user, field, value)
        
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/{user_id}/oauth-accounts", response_model=List[OAuthAccountSchema])
async def read_user_oauth_accounts_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get a specific user's OAuth accounts.
    """
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == user_id))
    return result.scalars().all()

@router.delete("/{user_id}/oauth-accounts/{account_id}", status_code=204)
async def delete_user_oauth_account_by_id(
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> None:
    """
    Unlink an OAuth account for a specific user.
    """
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.id == account_id, OAuthAccount.user_id == user_id))
    oauth_account = result.scalars().first()
    
    if not oauth_account:
        raise HTTPException(status_code=404, detail="OAuth account not found")
        
    await db.delete(oauth_account)
    await db.commit()
    return None
