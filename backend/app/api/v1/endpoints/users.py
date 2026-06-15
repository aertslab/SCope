from typing import Any, List
import logging
import os
import shutil
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
from fastapi import Response

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.email import send_email
from app.core.limiter import limiter
from app.models.user import User
from app.models.oauth_account import OAuthAccount
from app.models.dataset import Dataset
from app.models.project import Project, ProjectShare
from app.models.group import Group, GroupMember, GroupRole
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate, UserUpdateMe, PublicUser
from app.schemas.oauth_account import OAuthAccount as OAuthAccountSchema
from app.schemas.personal_access_token import (
    PersonalAccessToken as PATSchema,
    PersonalAccessTokenCreate,
    PersonalAccessTokenWithSecret,
)
from app.models.personal_access_token import PersonalAccessToken
from app.api.deps import PAT_PREFIX, _hash_pat
import secrets as _secrets
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/search", response_model=List[PublicUser])
async def search_users(
    query: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Search users by email or name. Returns lean public profiles only.
    """
    stmt = select(User).where(
        User.is_active.is_(True),
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
@limiter.limit("5/minute")
async def create_user(
    *,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user (public self-signup).

    Note: `is_superuser` from the request body is intentionally ignored here.
    Promotion to superuser must go through an authenticated admin endpoint.
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
        hashed_password=await security.get_password_hash_async(user_in.password),
        full_name=user_in.full_name,
        is_superuser=False,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    # Fire off a verification email. Failures are logged inside send_email
    # so signup never breaks because of mail issues.
    try:
        from app.services import email_tokens

        token = await email_tokens.issue_token(db, db_user, "email_verification")
        link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
        await send_email(
            to=db_user.email,
            subject="Verify your SCope email address",
            text=(
                "Welcome to SCope! Please confirm your email address by opening:\n"
                f"{link}\n\nThe link expires in "
                f"{settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS}h."
            ),
        )
    except Exception:
        logger.exception("Failed to issue verification email for new user %s", db_user.id)

    return db_user

@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.get("/me/stats")
async def read_user_me_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Aggregate counts and disk usage for the current user."""
    dataset_count = await db.scalar(
        select(func.count(Dataset.id)).where(Dataset.owner_id == current_user.id)
    )
    project_count = await db.scalar(
        select(func.count(Project.id)).where(Project.owner_id == current_user.id)
    )
    group_count = await db.scalar(
        select(func.count(GroupMember.user_id)).where(
            GroupMember.user_id == current_user.id
        )
    )
    owned_groups_count = await db.scalar(
        select(func.count(Group.id)).where(Group.owner_id == current_user.id)
    )
    total_uploaded = await db.scalar(
        select(func.coalesce(func.sum(Dataset.file_size), 0)).where(
            Dataset.owner_id == current_user.id
        )
    )
    total_converted = await db.scalar(
        select(func.coalesce(func.sum(Dataset.converted_size), 0)).where(
            Dataset.owner_id == current_user.id
        )
    )
    shared_with_me = await db.scalar(
        select(func.count(ProjectShare.id)).where(
            ProjectShare.user_id == current_user.id
        )
    )
    return {
        "dataset_count": int(dataset_count or 0),
        "project_count": int(project_count or 0),
        "group_count": int(group_count or 0),
        "owned_groups_count": int(owned_groups_count or 0),
        "shared_projects_count": int(shared_with_me or 0),
        "total_uploaded_bytes": int(total_uploaded or 0),
        "total_converted_bytes": int(total_converted or 0),
        "total_disk_usage": int((total_uploaded or 0) + (total_converted or 0)),
    }

@router.delete("/me", status_code=200)
async def delete_user_me(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete the current user's account.

    Blocks if the user owns groups that still have other members or projects
    that are shared with others. The user must hand off or clean up first.
    Cascades: owned (sole-member) groups, owned projects (and dataset files),
    own datasets, OAuth links.
    """
    if current_user.is_superuser:
        # Refuse to let the last superuser delete themselves.
        admin_count = await db.scalar(
            select(func.count(User.id)).where(User.is_superuser.is_(True))
        )
        if (admin_count or 0) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last remaining superuser account.",
            )

    blockers: list[str] = []

    owned_groups_q = await db.execute(
        select(Group).where(Group.owner_id == current_user.id)
    )
    owned_groups = list(owned_groups_q.scalars().all())
    for grp in owned_groups:
        member_count = await db.scalar(
            select(func.count(GroupMember.user_id)).where(
                GroupMember.group_id == grp.id,
                GroupMember.user_id != current_user.id,
            )
        )
        if (member_count or 0) > 0:
            blockers.append(
                f"Group '{grp.name}' has other members; transfer ownership or remove them first."
            )

    owned_projects_q = await db.execute(
        select(Project).where(Project.owner_id == current_user.id)
    )
    owned_projects = list(owned_projects_q.scalars().all())
    for proj in owned_projects:
        share_count = await db.scalar(
            select(func.count(ProjectShare.id)).where(
                ProjectShare.project_id == proj.id
            )
        )
        if (share_count or 0) > 0:
            blockers.append(
                f"Project '{proj.name}' is still shared; revoke shares or delete the project first."
            )

    if blockers:
        raise HTTPException(status_code=409, detail={"message": "Cannot delete account", "blockers": blockers})

    # Delete owned datasets and their files
    datasets_q = await db.execute(
        select(Dataset).where(Dataset.owner_id == current_user.id)
    )
    for dataset in list(datasets_q.scalars().all()):
        for path in (dataset.file_path, dataset.converted_path):
            if path and os.path.exists(path):
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except Exception:
                    logger.exception("Failed to remove dataset file %s", path)
        await db.delete(dataset)

    # Delete owned (sole-member) groups
    for grp in owned_groups:
        await db.delete(grp)

    # Delete owned projects (cascade clears shares; many-to-many association handled by SA)
    for proj in owned_projects:
        await db.delete(proj)

    await db.delete(current_user)
    await db.commit()
    return {"status": "success"}

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


@router.get("/me/tokens", response_model=List[PATSchema])
async def list_personal_access_tokens(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List the current user's PATs (without exposing the plaintext)."""
    result = await db.execute(
        select(PersonalAccessToken)
        .where(PersonalAccessToken.user_id == current_user.id)
        .order_by(PersonalAccessToken.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/me/tokens",
    response_model=PersonalAccessTokenWithSecret,
    status_code=201,
)
@limiter.limit("10/hour")
async def create_personal_access_token(
    request: Request,
    token_in: PersonalAccessTokenCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mint a new PAT.

    The plaintext is returned exactly once in this response. Only the SHA-256
    hash is persisted, so a database leak does not yield usable tokens.
    Rate-limited to deter mass minting.
    """
    plaintext = f"{PAT_PREFIX}{_secrets.token_urlsafe(32)}"
    expires_at = None
    if token_in.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=token_in.expires_in_days)

    pat = PersonalAccessToken(
        user_id=current_user.id,
        name=token_in.name.strip(),
        token_hash=_hash_pat(plaintext),
        expires_at=expires_at,
    )
    db.add(pat)
    await db.commit()
    await db.refresh(pat)

    return PersonalAccessTokenWithSecret(
        id=pat.id,
        name=pat.name,
        last_used_at=pat.last_used_at,
        expires_at=pat.expires_at,
        created_at=pat.created_at,
        token=plaintext,
    )


@router.delete("/me/tokens/{token_id}", status_code=204)
async def revoke_personal_access_token(
    token_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """Revoke a PAT. Only the owning user can delete their own tokens."""
    result = await db.execute(
        select(PersonalAccessToken).where(
            PersonalAccessToken.id == token_id,
            PersonalAccessToken.user_id == current_user.id,
        )
    )
    pat = result.scalars().first()
    if not pat:
        raise HTTPException(status_code=404, detail="Token not found")
    await db.delete(pat)
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
        if not await security.verify_password_async(user_in.current_password, current_user.hashed_password):
             raise HTTPException(
                status_code=400,
                detail="Incorrect password."
            )
        current_user.hashed_password = await security.get_password_hash_async(user_in.password)
        # A successful password change must invalidate any outstanding
        # sessions: anyone holding the old cookie/token loses access.
        from datetime import datetime as _dt, timezone as _tz
        current_user.tokens_invalidated_after = _dt.now(_tz.utc)

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
        hashed_password = await security.get_password_hash_async(update_data["password"])
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
