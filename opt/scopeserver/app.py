# -*- coding: utf-8 -*-
""" Main entrypoint for the SCope server. """

import os

from flask import Flask
from flask_restful import Resource, Api

from scopeserver.scope.config import from_file

APP = Flask(__name__)
API = Api(APP)

CONFIG = from_file(os.environ.get("SCOPE_CONFIG"))

def start():
    """ Start the SCope server. """
    APP.run(debug=bool(CONFIG.get("debug")))

if __name__ == "__main__":
    start()
