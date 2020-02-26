#!/usr/bin/env node
var shell = require("shelljs");
console.log("Installing SCope Bind Server")
shell.cd('opt/scopeserver/bindserver')
shell.exec('npm install');
shell.cd('../../../')
var commandExists = require('command-exists');


commandExists('poetry').then(function (command) {
  console.log("Installing SCope Data Server...")
  shell.exec('cd opt && poetry install')
}).catch(function () {
  console.log("The poetry program does not exist. Abort. Please install it.")
});