#!/usr/bin/env node
var shell = require('shelljs');
console.log('Installing SCope Bind Server');
shell.cd('opt/scopeserver/bindserver');
shell.exec('npm install');
shell.cd('../../../');
var commandExists = require('command-exists');

try {
  var output = execSync('python3 -c "import sys; print(sys.version)"', { encoding: 'utf-8' });
  var python = 'python3'
} catch(e) {
    var output = execSync('python -c "import sys; print(sys.version)"', { encoding: 'utf-8' });
    var python = 'python'
} finally {
    console.log(output);
    if (!(/^3.[6-8].[0-9].*/.test(output))) {
        throw("Compatible python version not found!")
   }
}

console.log("Installing SCope Data Server...")
shell.exec('cd opt && ' + python + ' poetry install')
