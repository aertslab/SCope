from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    datasets,
    users,
    admin,
    groups,
    projects,
    sessions,
    notifications,
    invitations,
    tags,
)

api_router = APIRouter()
api_router.include_router(auth.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
# Invitations span both /groups/{id}/invitations and /invitations/me, so we
# mount this router at the API root rather than under a single prefix.
api_router.include_router(invitations.router, tags=["invitations"])
