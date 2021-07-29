#!/bin/bash

echo "****************************************************************************************"
echo "* WARNING: THIS SCRIPT SHOULD ONLY BE USED TO SET UP AND RUN A DEVELOPMENT ENVIRONMENT *"
echo "*                      !! DO NOT USE THIS SCRIPT IN PRODUCTION !!                      *"
echo "****************************************************************************************"

export DATAHASHSECRET="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab"

bash ./compile-proto.sh

poetry run dotenv run alembic upgrade head

poetry run dotenv run hypercorn --log-level=debug main:scope_api --reload
