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


log_ascii_header()
SCopeServer(CONFIG).start_scope_server()
