"""
Main entry point to the SCope API implementation.
"""

import os
from typing import Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scopeserver.config import from_file
from scopeserver import message_of_the_day, LegacySCopeServer, SCopeServer
from scopeapi import SCopeAPI
from scopeapi.model import Error
from scopeapi.model import GetUUID
from scopeapi.model import GetRemainingUUIDTime, GetDatasets

scope_api = FastAPI()
scope_api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG = from_file(os.environ.get("SCOPE_CONFIG"))

scope_server = SCopeServer(config=CONFIG)
scope_server_legacy = LegacySCopeServer(config=CONFIG, new_server=scope_server)
scope_api = SCopeAPI(server=scope_server)


@scope_api.get("/session/uuid/", response_model=GetUUID)
def get_uuid(ip: str):
    get_uuid_reply = scope_api.get_uuid(ip=ip)
    """ A HTTP API endpoint to retrieve a new UUID. """
    return get_uuid_reply


@scope_api.get("/session/{session_id}/info/", response_model=GetRemainingUUIDTime)
def get_session_info(session_id, ip: str, mouse_events: int):
    get_remaining_uuid_time_reply = scope_api.get_remaining_uuid_time(
        session_uuid=session_id, ip=ip, mouse_events=mouse_events
    )
    """ A HTTP API endpoint to retrieve a new UUID. """
    return get_remaining_uuid_time_reply


@scope_api.get("/session/{session_id}/datasets/", response_model=GetDatasets)
def get_datasets(session_id, dataset_file_name: str = None):
    get_datasets_reply = scope_api.get_datasets(session_uuid=session_id, dataset_file_name=dataset_file_name)
    """ A HTTP API endpoint to retrieve a list of datasets. """
    return get_datasets_reply


@scope_api.on_event("startup")
def startup():
    """ Start the legacy server. """
    message_of_the_day(str(CONFIG["data"]))
    scope_server_legacy.start_scope_server()


@scope_api.on_event("shutdown")
def shutdown():
    """ Stop the legacy server. """
    scope_server_legacy.stop_servers()
