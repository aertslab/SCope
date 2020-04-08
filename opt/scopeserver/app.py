# -*- coding: utf-8 -*-
""" Main entrypoint for the SCope server. """

import os

from flask import Flask
from flask_restful import Resource, Api

from scopeserver.scope.config import from_file
from scopeserver import log_ascii_header, SCopeServer

APP = Flask(__name__)
API = Api(APP)

CONFIG = from_file(os.environ.get("SCOPE_CONFIG"))

def werkzeug_has_restarted():
    """ Check if werkzeug has restarted yet.

    Only applicable if starting Flask in debug mode.
    """
    pidfile = "scope.pid"
    if not os.path.exists(pidfile):
        with open(pidfile, 'w') as pid:
            pid.write(str(os.getpid()))
        return False
    return True

def start_old_server():
    """ Start the old version of the server. """
    if bool(CONFIG.get("debug")) and werkzeug_has_restarted():
        log_ascii_header()

        old_scope_server = SCopeServer(CONFIG)
        old_scope_server.start_scope_server()

def start():
    """ Start the SCope server. """
    start_old_server()

    APP.run(debug=bool(CONFIG.get("debug")))

if __name__ == "__main__":
    start()
