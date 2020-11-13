#!/usr/bin/env node
let shell = require('shelljs');
console.log('Installing SCope Bind Server');
shell.cd('opt/scopeserver/bindserver');
shell.exec('npm install');
shell.cd('../../../');
