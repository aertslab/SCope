from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload
from typing import List, Optional
from uuid import UUID
import logging
import os
import shutil
from app.api import deps
from app.models.project import Project, ProjectShare, ProjectVisibility, ProjectPermission, project_dataset
from app.models.dataset import Dataset
from app.models.user import User
from app.models.group import GroupMember
from app.models.tag import Tag, project_tag
from app.schemas import project as project_schema
from app.schemas import dataset as dataset_schema
from app.schemas import tag as tag_schema
from app.core.security import (
    get_password_hash_async,
    verify_password_async,
)
from app.services.permissions import get_user_project_permission
from app.services import notifications as notifications_service
from app.services.audit import record_audit
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

async def check_project_permission(
    project_id: UUID, 
    user: Optional[User], 
    db: AsyncSession, 
    required_permissions: List[ProjectPermission],
    password: Optional[str] = None
):
    # Fetch project with shares
    query = select(Project).options(
        selectinload(Project.shares).joinedload(ProjectShare.user),
        selectinload(Project.shares).joinedload(ProjectShare.group),
        selectinload(Project.datasets),
        selectinload(Project.tags),
    ).where(Project.id == project_id)
    
    result = await db.execute(query)
    project = result.scalars().first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # 1. Check User-based permissions (if logged in)
    user_perm = await get_user_project_permission(project, user, db)
    if user_perm:
        # Check if the user's permission satisfies the requirement
        # Hierarchy: ADMIN > EDIT > VIEW
        
        # If user has ADMIN, they can do anything
        if user_perm == ProjectPermission.ADMIN:
            return project
            
        # If user has EDIT, they can EDIT or VIEW
        if user_perm == ProjectPermission.EDIT:
            if ProjectPermission.EDIT in required_permissions or ProjectPermission.VIEW in required_permissions:
                return project
                
        # If user has VIEW, they can only VIEW
        if user_perm == ProjectPermission.VIEW:
            if ProjectPermission.VIEW in required_permissions:
                return project

    # 2. Check Public/Password Access (Only for VIEW permission)
    if ProjectPermission.VIEW in required_permissions:
        if project.visibility == ProjectVisibility.PUBLIC:
            return project
            
        if project.visibility == ProjectVisibility.PASSWORD:
            if password and project.password_hash:
                if await verify_password_async(password, project.password_hash):
                    return project
                else:
                    raise HTTPException(status_code=403, detail="Invalid password")
            elif not password:
                 raise HTTPException(status_code=403, detail="Password required")

    # If we get here, no permission
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    raise HTTPException(status_code=403, detail="Not enough permissions")


@router.post("/", response_model=project_schema.Project)
async def create_project(
    project_in: project_schema.ProjectCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    project = Project(**project_in.model_dump(exclude={"password"}), owner_id=current_user.id)
    if project_in.password:
        project.password_hash = await get_password_hash_async(project_in.password)
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    # Re-fetch with eager loading
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares),
            selectinload(Project.datasets),
            selectinload(Project.tags),
        )
        .where(Project.id == project.id)
    )
    project_result = result.scalars().first()
    if not project_result:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_result

@router.put("/{project_id}", response_model=project_schema.Project)
async def update_project(
    project_id: UUID,
    project_in: project_schema.ProjectUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    project = await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])
    
    update_data = project_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        project.password_hash = await get_password_hash_async(update_data["password"])
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(project, field, value)

    db.add(project)
    await db.commit()

    # Re-fetch with eager loading so the response model can serialize shares/datasets
    # without triggering lazy IO under the async session.
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares).joinedload(ProjectShare.user),
            selectinload(Project.shares).joinedload(ProjectShare.group),
            selectinload(Project.datasets),
            selectinload(Project.tags),
        )
        .where(Project.id == project.id)
    )
    refreshed = result.scalars().first()
    if not refreshed:
        raise HTTPException(status_code=404, detail="Project not found")
    return refreshed

@router.get("/", response_model=List[project_schema.Project])
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    query = select(Project).options(
        selectinload(Project.shares).joinedload(ProjectShare.user),
        selectinload(Project.shares).joinedload(ProjectShare.group),
        selectinload(Project.datasets),
        selectinload(Project.tags),
    )

    if not current_user.is_superuser:
        user_groups = select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
        query = query.outerjoin(ProjectShare).where(
            (Project.owner_id == current_user.id) |
            (ProjectShare.user_id == current_user.id) |
            (ProjectShare.group_id.in_(user_groups))
            # Note: We intentionally do NOT include PUBLIC projects here unless the user has "attached" them (via share)
        )

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/public", response_model=List[tag_schema.PublicProject])
@limiter.limit("60/minute")
async def read_public_projects(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(deps.get_db),
):
    """Public-discovery gallery. Returns only projects with ``visibility=PUBLIC``.

    No authentication is required. Optional ``search`` does a case-insensitive
    substring match against name and description; optional ``tag`` filters by
    tag slug. The lean ``PublicProject`` response intentionally omits shares,
    password hashes, and dataset internals so anonymous callers can't enumerate
    private metadata.
    """
    if search is not None:
        search = search.strip()
        if 0 < len(search) < 2:
            # Single-character substring searches scan the whole catalog
            # and are dominated by false positives. Reject them rather
            # than serve a hot path to anonymous clients.
            raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
        if not search:
            search = None
    query = (
        select(Project)
        .options(selectinload(Project.tags))
        .where(Project.visibility == ProjectVisibility.PUBLIC)
    )

    if search:
        like = f"%{search}%"
        query = query.where(
            (Project.name.ilike(like)) | (Project.description.ilike(like))
        )

    if tag:
        slug = tag_schema.slugify(tag)
        if slug:
            # Restrict to projects that have the given tag via a subquery on
            # the M2M; this keeps the SQL portable and indexable.
            tagged_ids = (
                select(project_tag.c.project_id)
                .join(Tag, Tag.id == project_tag.c.tag_id)
                .where(Tag.slug == slug)
            )
            query = query.where(Project.id.in_(tagged_ids))

    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    projects = result.scalars().all()

    if not projects:
        return []

    # Compute dataset counts in one round-trip.
    counts_res = await db.execute(
        select(project_dataset.c.project_id, func.count(project_dataset.c.dataset_id))
        .where(project_dataset.c.project_id.in_([p.id for p in projects]))
        .group_by(project_dataset.c.project_id)
    )
    counts = {pid: cnt for pid, cnt in counts_res.all()}

    return [
        tag_schema.PublicProject(
            id=p.id,
            name=p.name,
            description=p.description,
            owner_id=p.owner_id,
            created_at=p.created_at,
            dataset_count=counts.get(p.id, 0),
            tags=[tag_schema.Tag.model_validate(t) for t in p.tags],
        )
        for p in projects
    ]


@router.post("/{project_id}/transfer-ownership", response_model=project_schema.Project)
async def transfer_project_ownership(
    project_id: UUID,
    transfer_in: project_schema.ProjectTransferOwnership,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Transfer project ownership. Only the current owner (or a superuser) can do this."""
    project = await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])

    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")

    new_owner = await db.get(User, transfer_in.new_owner_id)
    if not new_owner or not new_owner.is_active:
        raise HTTPException(status_code=404, detail="New owner not found")

    if new_owner.id == project.owner_id:
        raise HTTPException(status_code=400, detail="User is already the owner")

    project.owner_id = new_owner.id
    db.add(project)
    await record_audit(
        db,
        actor=current_user,
        action="project.ownership.transfer",
        resource_type="project",
        resource_id=project.id,
        extra={
            "name": project.name,
            "new_owner_id": str(new_owner.id),
            "new_owner_email": new_owner.email,
        },
    )
    await notifications_service.create(
        db,
        user_id=new_owner.id,
        type="project_ownership_transferred",
        title="Project ownership transferred to you",
        message=f'You are now the owner of "{project.name}".',
        link=f"/projects/{project.id}",
        payload={"project_id": str(project.id), "project_name": project.name},
    )
    await db.commit()

    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares).joinedload(ProjectShare.user),
            selectinload(Project.shares).joinedload(ProjectShare.group),
            selectinload(Project.datasets),
            selectinload(Project.tags),
        )
        .where(Project.id == project.id)
    )
    refreshed = result.scalars().first()
    if not refreshed:
        raise HTTPException(status_code=404, detail="Project not found")
    return refreshed

@router.get("/{project_id}", response_model=project_schema.Project)
async def read_project(
    project_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
):
    return await check_project_permission(
        project_id, 
        current_user, 
        db, 
        [ProjectPermission.VIEW, ProjectPermission.EDIT, ProjectPermission.ADMIN],
        password=x_project_password
    )

@router.post("/{project_id}/attach")
async def attach_project(
    project_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Verify access first
    await check_project_permission(
        project_id, 
        current_user, 
        db, 
        [ProjectPermission.VIEW], 
        password=x_project_password
    )
    
    # Check if share already exists
    existing_share = await db.execute(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.user_id == current_user.id
        )
    )
    if existing_share.scalars().first():
        return {"status": "already_attached"}
        
    # Create share
    share = ProjectShare(
        project_id=project_id,
        user_id=current_user.id,
        permission=ProjectPermission.VIEW
    )
    db.add(share)
    await db.commit()
    return {"status": "success"}

@router.delete("/{project_id}/attach")
async def detach_project(
    project_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Find share
    result = await db.execute(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.user_id == current_user.id
        )
    )
    share = result.scalars().first()
    
    if share:
        await db.delete(share)
        await db.commit()
        
    return {"status": "success"}

@router.post("/{project_id}/datasets/{dataset_id}")
async def add_dataset_to_project(
    project_id: UUID,
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    await check_project_permission(project_id, current_user, db, [ProjectPermission.EDIT, ProjectPermission.ADMIN])
    
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    stmt = insert(project_dataset).values(project_id=project_id, dataset_id=dataset_id)
    try:
        await db.execute(stmt)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Composite PK collision — the row already exists. This is the common
        # "add the dataset twice" race; treat it as idempotent.
        return {"status": "already_attached"}
    except Exception:
        await db.rollback()
        logger.exception("Failed to attach dataset %s to project %s", dataset_id, project_id)
        raise HTTPException(status_code=500, detail="Failed to attach dataset")

    return {"status": "success"}

@router.delete("/{project_id}/datasets/{dataset_id}")
async def remove_dataset_from_project(
    project_id: UUID,
    dataset_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    await check_project_permission(project_id, current_user, db, [ProjectPermission.EDIT, ProjectPermission.ADMIN])
    
    stmt = delete(project_dataset).where(
        project_dataset.c.project_id == project_id,
        project_dataset.c.dataset_id == dataset_id
    )
    await db.execute(stmt)
    await db.commit()
    
    # Check for orphans
    count_query = select(func.count()).select_from(project_dataset).where(project_dataset.c.dataset_id == dataset_id)
    count = await db.scalar(count_query)
    
    if count == 0:
        pass
    
    return {"status": "success"}

@router.post("/{project_id}/share", response_model=project_schema.ProjectShare)
async def share_project(
    project_id: UUID,
    share_in: project_schema.ProjectShareCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])

    # Enforce the disjoint-FK invariant in code as well as in the new DB CHECK
    # constraint, so the client gets a friendly 400 rather than a 500.
    if (share_in.user_id is None) == (share_in.group_id is None):
        raise HTTPException(
            status_code=400,
            detail="Exactly one of user_id or group_id must be provided",
        )

    share = ProjectShare(project_id=project_id, **share_in.model_dump())
    db.add(share)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This user or group is already shared on this project",
        )
    await db.refresh(share)

    # Notify recipients of the new share. For group shares we fan out to all
    # current group members. Failures here are logged but never break the
    # share itself — the row is already committed above.
    try:
        project_obj = await db.get(Project, project_id)
        project_name = project_obj.name if project_obj else "a project"
        recipient_ids: list = []
        if share_in.user_id is not None:
            recipient_ids.append(share_in.user_id)
        elif share_in.group_id is not None:
            members_q = await db.execute(
                select(GroupMember.user_id).where(GroupMember.group_id == share_in.group_id)
            )
            recipient_ids.extend(members_q.scalars().all())
        for rid in recipient_ids:
            if rid == current_user.id:
                continue
            await notifications_service.create(
                db,
                user_id=rid,
                type="project_share",
                title="A project was shared with you",
                message=f'"{project_name}" was shared with you ({share_in.permission.value} access).',
                link=f"/projects/{project_id}",
                payload={
                    "project_id": str(project_id),
                    "project_name": project_name,
                    "permission": share_in.permission.value,
                },
            )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to emit project_share notifications for project %s", project_id)

    # Re-fetch with eager loading
    result = await db.execute(
        select(ProjectShare)
        .options(joinedload(ProjectShare.user), joinedload(ProjectShare.group))
        .where(ProjectShare.id == share.id)
    )
    share_result = result.scalars().first()
    if not share_result:
        raise HTTPException(status_code=404, detail="Share not found")
    
    return share_result

@router.get("/{project_id}/datasets", response_model=List[dataset_schema.Dataset])
async def read_project_datasets(
    project_id: UUID,
    x_project_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
):
    await check_project_permission(
        project_id, 
        current_user, 
        db, 
        [ProjectPermission.VIEW, ProjectPermission.EDIT, ProjectPermission.ADMIN],
        password=x_project_password
    )
    
    # Fetch datasets with their projects to determine highest visibility
    query = select(Dataset).options(selectinload(Dataset.projects)).join(project_dataset).where(project_dataset.c.project_id == project_id)
    result = await db.execute(query)
    datasets = result.scalars().all()
    
    # Calculate highest visibility for each dataset
    for dataset in datasets:
        highest = ProjectVisibility.PRIVATE
        for proj in dataset.projects:
            if proj.visibility == ProjectVisibility.PUBLIC:
                highest = ProjectVisibility.PUBLIC
                break # Can't get higher than public
            elif proj.visibility == ProjectVisibility.PASSWORD:
                if highest != ProjectVisibility.PUBLIC:
                    highest = ProjectVisibility.PASSWORD
        
        # We need to attach this to the response. 
        # Since Pydantic models are strict, we might need to use a dynamic attribute or update the schema.
        # For now, let's assume the schema allows extra fields or we monkey patch it for the frontend.
        # Ideally, we should update the Dataset schema to include 'highest_visibility'.
        setattr(dataset, 'highest_visibility', highest)
        
    return datasets

@router.get("/{project_id}/shares", response_model=List[project_schema.ProjectShare])
async def read_project_shares(
    project_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])
    
    # Include user and group details
    query = select(ProjectShare).options(
        joinedload(ProjectShare.user),
        joinedload(ProjectShare.group)
    ).where(ProjectShare.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/{project_id}/shares/{share_id}")
async def revoke_project_share(
    project_id: UUID,
    share_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Revoke a single user/group share on a project. Project ADMIN only."""
    await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])

    result = await db.execute(
        select(ProjectShare).where(
            ProjectShare.id == share_id,
            ProjectShare.project_id == project_id,
        )
    )
    share = result.scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)
    await db.commit()
    return {"status": "success"}

@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    delete_orphans: bool = False,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    project = await check_project_permission(project_id, current_user, db, [ProjectPermission.ADMIN])
    
    # Only owner can delete
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only owner can delete project")

    # Check for orphaned datasets
    # Get all datasets in this project
    datasets_query = select(Dataset).join(project_dataset).where(project_dataset.c.project_id == project_id)
    datasets = (await db.execute(datasets_query)).scalars().all()
    
    orphaned_datasets = []
    for dataset in datasets:
        # Check if dataset is in any other project
        count_query = select(func.count()).select_from(project_dataset).where(
            project_dataset.c.dataset_id == dataset.id,
            project_dataset.c.project_id != project_id
        )
        count = await db.scalar(count_query)
        if count == 0:
            orphaned_datasets.append(dataset)
            
    if orphaned_datasets and not delete_orphans:
        return JSONResponse(
            status_code=409, 
            content={
                "detail": "Orphaned datasets found", 
                "orphaned_datasets": [d.name for d in orphaned_datasets]
            }
        )
        
    # Delete project (cascade should handle shares, but we need to handle datasets)
    # project_dataset association will be deleted by cascade if configured, or we delete manually
    # SQLAlchemy many-to-many usually handles association table deletion if cascade is set on relationship
    # But let's be safe and delete association first if needed, though 'secondary' usually handles it.
    
    deleted_name = project.name
    deleted_id = project.id
    await db.delete(project)
    await record_audit(
        db,
        actor=current_user,
        action="project.delete",
        resource_type="project",
        resource_id=deleted_id,
        extra={
            "name": deleted_name,
            "orphaned_dataset_count": len(orphaned_datasets) if delete_orphans else 0,
        },
    )
    
    if delete_orphans:
        for dataset in orphaned_datasets:
            # Delete files from disk
            if dataset.file_path and os.path.exists(dataset.file_path):
                try:
                    os.remove(dataset.file_path)
                except Exception:
                    logger.exception("Error deleting file %s", dataset.file_path)

            if dataset.converted_path and os.path.exists(dataset.converted_path):
                try:
                    if os.path.isdir(dataset.converted_path):
                        shutil.rmtree(dataset.converted_path)
                    else:
                        os.remove(dataset.converted_path)
                except Exception:
                    logger.exception("Error deleting converted file %s", dataset.converted_path)

            await db.delete(dataset)
            
    await db.commit()
    return {"status": "success"}


@router.put("/{project_id}/tags", response_model=project_schema.Project)
async def set_project_tags(
    project_id: UUID,
    body: tag_schema.ProjectTagsUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Replace the full set of tags on a project.

    Caller must hold ADMIN permission on the project. Tag names are
    deduplicated by slug; missing tags are created on the fly. Tags removed
    from the project remain in the global vocabulary so they continue to
    appear for other projects and the gallery's facet list.
    """
    project = await check_project_permission(
        project_id, current_user, db, [ProjectPermission.ADMIN]
    )

    # Build slug -> display-name map, preserving the first-seen casing.
    desired: dict[str, str] = {}
    for raw in body.tags:
        cleaned = (raw or "").strip()
        slug = tag_schema.slugify(cleaned)
        if not slug:
            continue
        desired.setdefault(slug, cleaned)

    if desired:
        existing_res = await db.execute(
            select(Tag).where(Tag.slug.in_(list(desired.keys())))
        )
        existing = {t.slug: t for t in existing_res.scalars().all()}

        new_tags: list[Tag] = []
        for slug, name in desired.items():
            if slug not in existing:
                new = Tag(name=name, slug=slug, created_by=current_user.id)
                db.add(new)
                new_tags.append(new)
        if new_tags:
            await db.flush()

        all_tags = [*existing.values(), *new_tags]
    else:
        all_tags = []

    project.tags = all_tags
    db.add(project)
    await db.commit()

    refreshed_res = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares).joinedload(ProjectShare.user),
            selectinload(Project.shares).joinedload(ProjectShare.group),
            selectinload(Project.datasets),
            selectinload(Project.tags),
        )
        .where(Project.id == project_id)
    )
    refreshed = refreshed_res.scalars().first()
    if not refreshed:
        raise HTTPException(status_code=404, detail="Project not found")
    return refreshed

