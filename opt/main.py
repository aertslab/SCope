"""
Main entry point to the SCope API implementation.
"""

import os

from fastapi import FastAPI

from scopeserver.config import from_file
from scopeserver import message_of_the_day, LegacySCopeServer, SCopeServer
from scopeapi import SCopeAPI
from scopeapi.model import GetDatasets

scope_api = FastAPI()
CONFIG = from_file(os.environ.get("SCOPE_CONFIG"))

__scope_server = SCopeServer(config=CONFIG)
__scope_server_legacy = LegacySCopeServer(config=CONFIG, new_server=__scope_server)
__scope_api = SCopeAPI(server=__scope_server)


@scope_api.get("/echo/{value}/")
def echo(value):
    """ A testing HTTP API endpoint that echoes the request parameter. """
    return {"echo": value}


@scope_api.get("/session/{session_id}/datasets/", response_model=GetDatasets)
def get_datasets(session_id):
    get_datasets_reply = __scope_api.get_datasets(session_uuid=session_id)
    """ A HTTP API endpoint to retrieve a list of datasets. """
    return get_datasets_reply


@scope_api.on_event("startup")
def startup():
    """ Start the legacy server. """
    message_of_the_day(str(CONFIG["data"]))
    __scope_server_legacy.start_scope_server()


@scope_api.on_event("shutdown")
def shutdown():
    """ Stop the legacy server. """
    __scope_server_legacy.stop_servers()
