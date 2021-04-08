"""
Main entry point to the SCope API implementation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scopeserver.api.v1 import api_v1_router
from scopeserver.config import settings
from scopeserver import message_of_the_day, SCopeServer

scope_api = FastAPI()

scope_api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# HTTP API
scope_api.include_router(api_v1_router, prefix=settings.API_V1_STR)

scope_legacy = SCopeServer(settings.dict())


@scope_api.on_event("startup")
def startup():
    """ Start the legacy server. """
    message_of_the_day(settings.DATA_PATH)
    scope_legacy.start_scope_server()


@scope_api.on_event("shutdown")
def shutdown():
    """ Stop the legacy server. """
    scope_legacy.stop_servers()
