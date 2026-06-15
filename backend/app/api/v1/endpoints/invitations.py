"""Group invitation endpoints — invite, list, accept, decline, revoke."""
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api import deps
from app.models.group import Group, GroupMember, GroupRole
from app.models.group_invitation import GroupInvitation, InvitationStatus
from app.models.user import User
from app.schemas.group_invitation import (
    GroupInvitation as GroupInvitationSchema,
    GroupInvitationCreate,
)
from app.services import notifications as notifications_service


router = APIRouter()


async def _require_group_admin(
    db: AsyncSession, group_id: UUID, current_user: User
) -> Group:
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if current_user.is_superuser:
        return group
    member_q = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    member = member_q.scalars().first()
    if not member or member.role not in (GroupRole.OWNER, GroupRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return group


@router.post(
    "/groups/{group_id}/invitations",
    response_model=GroupInvitationSchema,
    status_code=status.HTTP_201_CREATED,
)
async def invite_user_to_group(
    group_id: UUID,
    invite_in: GroupInvitationCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Owner/admin sends a pending invitation to a user.

    Owners can't be invited as owners (ownership is transferred separately).
    Existing members are rejected with 409, as are duplicate pending invites.
    """
    group = await _require_group_admin(db, group_id, current_user)

    if invite_in.role == GroupRole.OWNER:
        raise HTTPException(
            status_code=400,
            detail="Cannot invite as owner; use transfer-ownership instead",
        )

    invitee = await db.get(User, invite_in.user_id)
    if not invitee or not invitee.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    if invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    existing_member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == invitee.id,
        )
    )
    if existing_member.scalars().first():
        raise HTTPException(status_code=409, detail="User is already a member")

    invitation = GroupInvitation(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        role=invite_in.role.value,
        status=InvitationStatus.PENDING.value,
    )
    db.add(invitation)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An invitation already exists for this user",
        )

    await notifications_service.create(
        db,
        user_id=invitee.id,
        type="group_invitation",
        title=f"Invitation to join {group.name}",
        message=f"{current_user.full_name or current_user.email} invited you to join the group \"{group.name}\".",
        link="/profile?tab=invitations",
        payload={
            "group_invitation_id": str(invitation.id),
            "group_id": str(group_id),
            "group_name": group.name,
            "role": invite_in.role.value,
        },
    )

    await db.commit()
    # Re-fetch with joined relationships for the response.
    result = await db.execute(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.group), joinedload(GroupInvitation.inviter))
        .where(GroupInvitation.id == invitation.id)
    )
    return result.scalars().first()


@router.get(
    "/groups/{group_id}/invitations",
    response_model=List[GroupInvitationSchema],
)
async def list_group_invitations(
    group_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """List pending invitations for a group (admins/owners only)."""
    await _require_group_admin(db, group_id, current_user)
    result = await db.execute(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.group), joinedload(GroupInvitation.inviter))
        .where(
            GroupInvitation.group_id == group_id,
            GroupInvitation.status == InvitationStatus.PENDING.value,
        )
        .order_by(GroupInvitation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/invitations/me", response_model=List[GroupInvitationSchema])
async def list_my_invitations(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """All pending invitations addressed to the current user."""
    result = await db.execute(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.group), joinedload(GroupInvitation.inviter))
        .where(
            GroupInvitation.invitee_id == current_user.id,
            GroupInvitation.status == InvitationStatus.PENDING.value,
        )
        .order_by(GroupInvitation.created_at.desc())
    )
    return result.scalars().all()


@router.post("/invitations/{invitation_id}/accept", response_model=GroupInvitationSchema)
async def accept_invitation(
    invitation_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    invitation = await db.get(GroupInvitation, invitation_id)
    if not invitation or invitation.invitee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Invitation is no longer pending")

    # Check the user isn't already a member (race-safe via unique PK on
    # group_members; we still check first for a friendlier error).
    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == invitation.group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not existing.scalars().first():
        member = GroupMember(
            group_id=invitation.group_id,
            user_id=current_user.id,
            role=invitation.role,
        )
        db.add(member)

    invitation.status = InvitationStatus.ACCEPTED.value  # type: ignore[assignment]
    invitation.responded_at = datetime.now(timezone.utc)  # type: ignore[assignment]

    # Notify the inviter (if still around) that the invite was accepted.
    if invitation.inviter_id is not None:
        group = await db.get(Group, invitation.group_id)
        await notifications_service.create(
            db,
            user_id=invitation.inviter_id,
            type="group_invitation_accepted",
            title="Invitation accepted",
            message=f"{current_user.full_name or current_user.email} joined {group.name if group else 'the group'}.",
            link=f"/groups/{invitation.group_id}",
            payload={"group_id": str(invitation.group_id)},
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Could not accept invitation")

    result = await db.execute(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.group), joinedload(GroupInvitation.inviter))
        .where(GroupInvitation.id == invitation_id)
    )
    return result.scalars().first()


@router.post("/invitations/{invitation_id}/decline", response_model=GroupInvitationSchema)
async def decline_invitation(
    invitation_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    invitation = await db.get(GroupInvitation, invitation_id)
    if not invitation or invitation.invitee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Invitation is no longer pending")

    invitation.status = InvitationStatus.DECLINED.value  # type: ignore[assignment]
    invitation.responded_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    await db.commit()

    result = await db.execute(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.group), joinedload(GroupInvitation.inviter))
        .where(GroupInvitation.id == invitation_id)
    )
    return result.scalars().first()


@router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_invitation(
    invitation_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Group admin/owner cancels a pending invitation."""
    invitation = await db.get(GroupInvitation, invitation_id)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await _require_group_admin(db, invitation.group_id, current_user)
    if invitation.status != InvitationStatus.PENDING.value:
        # Already responded — nothing to revoke. Treat as idempotent.
        return None
    await db.delete(invitation)
    await db.commit()
    return None
