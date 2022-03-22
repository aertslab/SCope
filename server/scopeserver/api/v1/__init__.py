" SCope REST API version 1. "

from fastapi import APIRouter

from scopeserver.api.v1 import auth, datasets, projects, users, legacy

api_v1_router = APIRouter()
api_v1_router.include_router(projects.router, prefix="/project", tags=["projects"])
api_v1_router.include_router(users.router, prefix="/user", tags=["users"])
api_v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(legacy.router, prefix="/legacy", tags=["legacy"])
api_v1_router.include_router(datasets.router, prefix="/dataset", tags=["datasets"])
