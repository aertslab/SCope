#!/bin/bash

echo "****************************************************************************************"
echo "* WARNING: THIS SCRIPT SHOULD ONLY BE USED TO SET UP AND RUN A DEVELOPMENT ENVIRONMENT *"
echo "*                      !! DO NOT USE THIS SCRIPT IN PRODUCTION !!                      *"
echo "****************************************************************************************"

export ORCID_REDIRECT_URI="http://127.0.0.1/"

if [ x"${ORCID_CLIENT_SECRET}" = x"" ]; then
    export ORCID_CLIENT_SECRET="this-is-a-fake-secret"
fi

poetry run bash ./compile-proto.sh

poetry run alembic upgrade head

# Add the keycloak identity provider
poetry run scope-console add-identity-provider --issuer "http://localhost:8080/auth/realms/SCope" --clientid "scope" --secret "4e979b39-9386-45a3-b3f8-e47461b03e3e" --name "Keycloak (Dev only)"

# Add an admin
poetry run scope-console create-admin --iss 1 --sub "5e349424-520e-436f-904b-18369a9a9033" Administrator

# Allow loom files up to 1 GiB
poetry run scope-console add-upload-limit --mime="application/vnd.loom" --size=1073741824

poetry run hypercorn --log-level=debug main:scope_api --reload
