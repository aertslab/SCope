from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert, func
from sqlalchemy.orm import joinedload, selectinload
from typing import List, Optional
from uuid import UUID
import os
import shutil
from app.api import deps
from app.models.project import Project, ProjectShare, ProjectVisibility, ProjectPermission, project_dataset
from app.models.dataset import Dataset
from app.models.user import User
from app.models.group import GroupMember
from app.schemas import project as project_schema
from app.schemas import dataset as dataset_schema
from app.core.security import get_password_hash, verify_password
from app.services.permissions import get_user_project_permission

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
        selectinload(Project.datasets)
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
                if verify_password(password, project.password_hash):
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
    project = Project(**project_in.dict(exclude={"password"}), owner_id=current_user.id)
    if project_in.password:
        project.password_hash = get_password_hash(project_in.password)
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    # Re-fetch with eager loading
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.shares),
            selectinload(Project.datasets)
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
    
    update_data = project_in.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        project.password_hash = get_password_hash(update_data["password"])
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(project, field, value)
        
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

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
        selectinload(Project.datasets)
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
    except Exception:
        await db.rollback()
        
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
    
    share = ProjectShare(project_id=project_id, **share_in.dict())
    db.add(share)
    await db.commit()
    await db.refresh(share)
    
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
    
    await db.delete(project)
    
    if delete_orphans:
        for dataset in orphaned_datasets:
            # Delete files from disk
            if dataset.file_path and os.path.exists(dataset.file_path):
                try:
                    os.remove(dataset.file_path)
                except Exception as e:
                    print(f"Error deleting file {dataset.file_path}: {e}")
                    
            if dataset.converted_path and os.path.exists(dataset.converted_path):
                try:
                    if os.path.isdir(dataset.converted_path):
                        shutil.rmtree(dataset.converted_path)
                    else:
                        os.remove(dataset.converted_path)
                except Exception as e:
                    print(f"Error deleting converted file {dataset.converted_path}: {e}")

            await db.delete(dataset)
            
    await db.commit()
    return {"status": "success"}
