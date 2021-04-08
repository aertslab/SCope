" SCope REST API version 1. "

from fastapi import APIRouter

from scopeserver.api.v1 import projects, users

api_v1_router = APIRouter()
api_v1_router.include_router(projects.router, prefix="/project", tags=["projects"])
api_v1_router.include_router(users.router, prefix="/user", tags=["users"])
