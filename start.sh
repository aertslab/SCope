#/usr/env/bash

# Upgrade DB and start SCope Server
poetry run alembic upgrade head && \
    poetry run hypercorn --bind 0.0.0.0 main:scope_api