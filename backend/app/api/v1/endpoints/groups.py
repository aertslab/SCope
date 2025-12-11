from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from typing import List
from uuid import UUID
from app.api import deps
from app.models.group import Group, GroupMember, GroupRole
from app.models.user import User
from app.schemas import group as group_schema

router = APIRouter()

@router.post("/", response_model=group_schema.Group)
async def create_group(
    group_in: group_schema.GroupCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    group = Group(**group_in.dict(), owner_id=current_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    # Add owner as admin member
    member = GroupMember(group_id=group.id, user_id=current_user.id, role=GroupRole.OWNER)
    db.add(member)
    await db.commit()
    
    return group

@router.get("/", response_model=List[group_schema.Group])
async def read_groups(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    if current_user.is_superuser:
        query = select(Group).offset(skip).limit(limit)
    else:
        # Return groups where user is a member or owner
        query = select(Group).join(GroupMember).where(GroupMember.user_id == current_user.id).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{group_id}", response_model=group_schema.Group)
async def read_group(
    group_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check permission
    member_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    member = member_result.scalars().first()
    if not member and not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not enough permissions")
         
    return group

@router.post("/{group_id}/members", response_model=group_schema.GroupMember)
async def add_group_member(
    group_id: UUID,
    member_in: group_schema.GroupMemberCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check if current user is admin/owner
    result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    current_member = result.scalars().first()
    
    if not current_member or current_member.role not in [GroupRole.OWNER, GroupRole.ADMIN]:
        if not current_user.is_superuser:
             raise HTTPException(status_code=403, detail="Not enough permissions")

    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == member_in.user_id))
    if not user_result.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")

    member = GroupMember(group_id=group_id, **member_in.dict())
    db.add(member)
    try:
        await db.commit()
        await db.refresh(member)
        
        # Re-fetch with user
        result = await db.execute(
            select(GroupMember)
            .options(joinedload(GroupMember.user))
            .where(GroupMember.group_id == group_id, GroupMember.user_id == member_in.user_id)
        )
        member_result = result.scalars().first()
        if not member_result:
            raise HTTPException(status_code=404, detail="Member not found")
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="User already in group")
        
    return member_result

@router.delete("/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check permissions
    result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    current_member = result.scalars().first()
    
    has_permission = False
    if current_user.is_superuser:
        has_permission = True
    elif current_member and current_member.role in [GroupRole.OWNER, GroupRole.ADMIN]:
        has_permission = True
        
    if not has_permission:
         raise HTTPException(status_code=403, detail="Not enough permissions")
             
    # Cannot remove owner if you are not owner (or maybe owner cannot be removed at all)
    target_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id))
    target_member = target_result.scalars().first()
    
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if target_member.role == GroupRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove owner")

    await db.delete(target_member)
    await db.commit()
    return {"status": "success"}

@router.get("/{group_id}/members", response_model=List[group_schema.GroupMember])
async def read_group_members(
    group_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check permission (must be a member of the group)
    member_check = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    if not member_check.scalars().first() and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Fetch members with user details
    query = select(GroupMember).options(joinedload(GroupMember.user)).where(GroupMember.group_id == group_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.put("/{group_id}/members/{user_id}", response_model=group_schema.GroupMember)
async def update_group_member_role(
    group_id: UUID,
    user_id: UUID,
    member_in: group_schema.GroupMemberUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check permissions
    result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    current_member = result.scalars().first()
    
    has_permission = False
    if current_user.is_superuser:
        has_permission = True
    elif current_member and current_member.role in [GroupRole.OWNER, GroupRole.ADMIN]:
        has_permission = True

    if not has_permission:
         raise HTTPException(status_code=403, detail="Not enough permissions")

    # Cannot change own role if downgrading
    if user_id == current_user.id and current_member:
        # If I am admin, I cannot make myself member?
        # Prompt: "users cannot downgrade themselves"
        # If I am Owner, I cannot change my role here (must use transfer)
        if current_member.role == GroupRole.OWNER:
             raise HTTPException(status_code=400, detail="Owner cannot change role directly. Use transfer ownership.")
        if member_in.role == GroupRole.MEMBER and current_member.role == GroupRole.ADMIN:
             raise HTTPException(status_code=400, detail="Cannot downgrade yourself")

    # Fetch target member
    target_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id))
    target_member = target_result.scalars().first()
    
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if target_member.role == GroupRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot change owner role")

    target_member.role = member_in.role # type: ignore
    db.add(target_member)
    await db.commit()
    await db.refresh(target_member)
    
    # Re-fetch with user
    result = await db.execute(
        select(GroupMember)
        .options(joinedload(GroupMember.user))
        .where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    return result.scalars().first()

@router.post("/{group_id}/transfer-ownership", response_model=group_schema.Group)
async def transfer_group_ownership(
    group_id: UUID,
    transfer_in: group_schema.GroupTransferOwnership,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check permissions - Only Owner can transfer
    result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    current_member = result.scalars().first()
    
    has_permission = False
    if current_user.is_superuser:
        has_permission = True
    elif current_member and current_member.role == GroupRole.OWNER:
        has_permission = True
        
    if not has_permission:
         raise HTTPException(status_code=403, detail="Only owner can transfer ownership")

    # Fetch new owner member
    target_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == transfer_in.new_owner_id))
    target_member = target_result.scalars().first()
    
    if not target_member:
        raise HTTPException(status_code=404, detail="New owner must be a member of the group")

    # Update roles
    current_member.role = GroupRole.ADMIN # type: ignore # Downgrade old owner to Admin
    target_member.role = GroupRole.OWNER # type: ignore # Upgrade new owner
    
    # Update Group owner_id
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.owner_id = transfer_in.new_owner_id # type: ignore
    
    db.add(current_member)
    db.add(target_member)
    db.add(group)
    
    await db.commit()
    await db.refresh(group)
    return group

@router.delete("/{group_id}")
async def delete_group(
    group_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Check permissions - Only Owner can delete
    result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    current_member = result.scalars().first()
    
    if not current_member or current_member.role != GroupRole.OWNER:
         if not current_user.is_superuser:
             raise HTTPException(status_code=403, detail="Only owner can delete group")

    # Fetch group
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalars().first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Delete group
    # Cascade should handle members and shares if configured in models
    await db.delete(group)
    await db.commit()
    
    return {"status": "success"}
