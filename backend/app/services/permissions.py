from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.project import Project, ProjectShare, ProjectPermission
from app.models.group import GroupMember

async def get_user_project_permission(
    project: Project,
    user: Optional[User],
    db: AsyncSession
) -> Optional[ProjectPermission]:
    """
    Returns the highest permission level a user has for a project.
    Returns None if no explicit permission (via ownership or share).
    Does NOT check Public/Password visibility.
    """
    if not user:
        return None
        
    if project.owner_id == user.id or user.is_superuser:
        return ProjectPermission.ADMIN
        
    # Check shares
    # We use a subquery for groups to avoid fetching them all into memory if not needed,
    # but here we are inside an async function so we can just build the query.
    user_groups = select(GroupMember.group_id).where(GroupMember.user_id == user.id)
    
    share_query = select(ProjectShare).where(
        ProjectShare.project_id == project.id,
        (ProjectShare.user_id == user.id) | (ProjectShare.group_id.in_(user_groups))
    )
    shares = (await db.execute(share_query)).scalars().all()
    
    max_perm = None
    
    for share in shares:
        if share.permission == ProjectPermission.ADMIN:
            return ProjectPermission.ADMIN
        
        if share.permission == ProjectPermission.EDIT:
            # If we already have ADMIN (handled above), we wouldn't be here.
            # If we have VIEW, upgrade to EDIT.
            # If we have None, set to EDIT.
            max_perm = ProjectPermission.EDIT
            
        if share.permission == ProjectPermission.VIEW:
            if max_perm is None:
                max_perm = ProjectPermission.VIEW
            
    return max_perm
