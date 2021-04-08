#!/bin/bash

poetry run dotenv run alembic upgrade head

poetry run dotenv run hypercorn --log-level=debug main:scope_api
