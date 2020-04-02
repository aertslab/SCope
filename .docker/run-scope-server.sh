#!/bin/bash

FIRST_RUN_FILE=${HOME}/scope.first-run

cd ${HOME}/opt

if [ ! -f ${FIRST_RUN_FILE} ]; then
    echo "Installing the bind server"

    pushd .
    cd scopeserver/bindserver
    npm install
    popd

    echo "Installing SCope server"
    poetry install
    touch ${FIRST_RUN_FILE}
fi

echo "Running SCope"
poetry run scope-server
