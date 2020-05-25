#!/usr/bin/env node
let shell = require('shelljs');
console.log('Installing SCope Bind Server');
shell.cd('opt/scopeserver/bindserver');
shell.exec('npm install');
shell.cd('../../../');
let commandExists = require('command-exists');

commandExists('poetry')
    .then(() => {
        console.log('Installing SCope Data Server...');
        shell.exec('cd opt && poetry install');
    })
    .catch(function () {
        console.log(
            'The poetry program does not exist. Abort. Please install it.'
        );
    });
