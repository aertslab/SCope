#!/bin/bash

echo "****************************************************************************************"
echo "* WARNING: THIS SCRIPT SHOULD ONLY BE USED TO SET UP AND RUN A DEVELOPMENT ENVIRONMENT *"
echo "*                      !! DO NOT USE THIS SCRIPT IN PRODUCTION !!                      *"
echo "****************************************************************************************"

export SECRET="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab"
export ORCID_REDIRECT_URI="http://127.0.0.1/"

if [ x"${ORCID_CLIENT_SECRET}" = x"" ]; then
    export ORCID_CLIENT_SECRET="this-is-a-fake-secret"
fi

poetry run bash ./compile-proto.sh

poetry run dotenv run alembic upgrade head

poetry run dotenv run hypercorn --log-level=debug main:scope_api --reload
