"""
Main entry point to the SCope API implementation.
"""

import os

from fastapi import FastAPI

from scopeserver.scope.config import from_file
from scopeserver import log_ascii_header, SCopeServer

scope_api = FastAPI()
CONFIG = from_file(os.environ.get("SCOPE_CONFIG"))


@scope_api.get("/echo/{value}")
def echo(value):
    """ A testing HTTP API endpoint that echoes the request parameter. """
    return {"echo": value}


scope_legacy = SCopeServer(CONFIG)

@scope_api.on_event("startup")
def startup():
    """ Start the legacy server. """
    log_ascii_header()
    scope_legacy.start_scope_server()

@scope_api.on_event("shutdown")
def shutdown():
    """ Stop the legacy server. """
    scope_legacy.stop_servers()

