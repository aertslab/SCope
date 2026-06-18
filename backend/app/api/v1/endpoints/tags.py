from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.tag import Tag, project_tag
from app.models.project import Project, ProjectVisibility
from app.schemas import tag as tag_schema
from app.core.limiter import limiter


router = APIRouter()


@router.get("/", response_model=List[tag_schema.TagWithCount])
@limiter.limit("60/minute")
async def list_tags(
    request: Request,
    public_only: bool = True,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(deps.get_db),
):
    """List tags with project counts.

    By default ``public_only=True`` so anonymous gallery callers only see
    counts of tags actually attached to public projects (private-project
    tag counts shouldn't leak to the unauthenticated audience). Pass
    ``public_only=false`` to see every tag's total project count — useful
    when authenticated users browse their own dashboard.
    """
    join = project_tag.join(Project, Project.id == project_tag.c.project_id)
    count_q = (
        select(project_tag.c.tag_id, func.count(project_tag.c.project_id).label("cnt"))
        .select_from(join)
    )
    if public_only:
        count_q = count_q.where(Project.visibility == ProjectVisibility.PUBLIC)
    count_q = count_q.group_by(project_tag.c.tag_id)

    counts_res = await db.execute(count_q)
    counts = {tag_id: cnt for tag_id, cnt in counts_res.all()}

    # Only return tags that have at least one matching project — there's
    # no value in showing zero-count tags in a discovery facet.
    if not counts:
        return []

    tags_res = await db.execute(
        select(Tag)
        .where(Tag.id.in_(counts.keys()))
        .order_by(Tag.name.asc())
        .offset(offset)
        .limit(limit)
    )
    return [
        tag_schema.TagWithCount(
            id=t.id,
            name=t.name,
            slug=t.slug,
            created_at=t.created_at,
            project_count=counts.get(t.id, 0),
        )
        for t in tags_res.scalars().all()
    ]
