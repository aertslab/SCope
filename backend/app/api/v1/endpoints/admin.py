from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.dataset import Dataset

router = APIRouter()

@router.get("/processing-datasets")
async def read_processing_datasets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get datasets that are pending, processing, or failed.
    """
    query = select(Dataset).options(
        selectinload(Dataset.owner),
        selectinload(Dataset.projects)
    ).where(
        or_(
            Dataset.status == "pending",
            Dataset.status.like("processing%"),
            Dataset.status == "failed"
        )
    ).order_by(Dataset.created_at.desc())
    
    result = await db.execute(query)
    datasets = result.scalars().all()
    
    return [
        {
            "id": ds.id,
            "name": ds.name,
            "status": ds.status,
            "created_at": ds.created_at,
            "owner_email": ds.owner.email if ds.owner else "Unknown",
            "projects": [p.name for p in ds.projects]
        }
        for ds in datasets
    ]

@router.get("/stats")
async def read_admin_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get admin statistics.
    """
    users_count = await db.scalar(select(func.count(User.id)))
    datasets_count = await db.scalar(select(func.count(Dataset.id)))
    
    return {
        "total_users": users_count,
        "total_datasets": datasets_count,
        "system_status": "Healthy"
    }

@router.get("/disk-usage")
async def read_disk_usage(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get disk usage per user.
    """
    stmt = select(
        User.id,
        User.email,
        User.full_name,
        func.sum(func.coalesce(Dataset.file_size, 0)).label("total_uploaded"),
        func.sum(func.coalesce(Dataset.converted_size, 0)).label("total_converted"),
        func.count(Dataset.id).label("dataset_count")
    ).outerjoin(Dataset, User.id == Dataset.owner_id).group_by(User.id)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        {
            "user_id": row.id,
            "email": row.email,
            "full_name": row.full_name,
            "total_uploaded": row.total_uploaded or 0,
            "total_converted": row.total_converted or 0,
            "total_usage": (row.total_uploaded or 0) + (row.total_converted or 0),
            "dataset_count": row.dataset_count
        }
        for row in rows
    ]
