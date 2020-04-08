import os

from flask import Flask
from flask_restful import Resource, Api

from scope.config import from_file

app = Flask(__name__)
api = Api(app)

config = from_file(os.environ.get("SCOPE_CONFIG"))

if __name__ == "__main__":
    app.run(debug=bool(config.get("debug")))
