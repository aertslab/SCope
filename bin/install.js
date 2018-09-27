#!/usr/bin/env node
var shell = require("shelljs");
console.log("Installing SCope Bind Server")
shell.exec('npm install opt/scopeserver/bindserver');
console.log("Installing SCope Data Server...")
shell.exec('cd opt && python3 setup.py develop')