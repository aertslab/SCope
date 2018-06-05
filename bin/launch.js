#!/usr/bin/env node
// Load node dependencies
const launcher = require( 'launch-browser' );
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

// Load custom dependencies
const apache = require("./apache/make_scope_conf.js");
const utils = require("./bin/utils.js")

// Import conig giles
const _config = require('./config.json');

// Declare variables
const isWin = process.platform === "win32";
const isAWS = process.argv.includes("--aws") || false
const isDaemon = process.argv.includes("--daemon") || isAWS
const isProd = process.argv.includes("--prod") || isAWS

console.log("Windows: "+ isWin)
console.log("Running in AWS: "+ isAWS)
console.log("Running as Daemon: "+ isDaemon)
console.log("Production Mode: "+ isProd)

// Check if programs are installed
// scope-server
if(!utils._commandExists("scope-server")) {
    console.log("Please install scope-server.")
    process.exit()
}
// tmux
if(isDaemon) {
    if(utils._commandExists("tmux")) {
        console.log("Please install tmux.")
        process.exit()
    }
}

// Create folders
const assetsDir = './assets';
if (!fs.existsSync(assetsDir)){
    fs.mkdirSync(assetsDir);
}

console.log("Launching SCope...")
let scopeServer, scopeClient;

function startSCopeServer() {
    console.log("Starting SCope Server...")
    const scopeStartCmd = "scope-server"
    if(isDaemon && !isWin) {
        const tmuxScopeStartCmd = 'tmux new-session -d -s scope "'+ scopeStartCmd +'"'
        scopeServer = utils.runCheckCommand(tmuxScopeStartCmd)
    } else {
        scopeServer = utils.runCheckCommand(scopeStartCmd)
        console.log("SCope Server started as daemon with PID: "+ scopeServer.pid +"!")
        console.log("SCope Server daemon can be accessed using 'tmux a -t scope'")
    }
}

function startSCopeClient() {
    console.log("Starting SCope Client...")
    if(isAWS) {
        utils.runCheckCommand("npm run build-aws")
        if (fs.existsSync(_config.apacheHtmlDir)) {
            console.log("Copying SCope to Apache Web Server directory...")
            utils.runCheckCommand("cp -r . "+ _config.apacheHtmlDir);
        } else {
            console.log("Cannot find "+ _config.apacheHtmlDir +". Please install HTTP Apache Web Server.")
        }
    } else {
        if(isProd) {
            console.log("Compiling SCope Client...")
            utils.runCheckCommand('npm run build');
        } else {
            scopeClient = utils.runCheckCommand("npm run dev")
            console.log("SCope Client started with PID: "+ scopeClient.pid +"!")
        }
    }
}

function openSCopeClient() {
    if(!isProd) {
        console.log("Open SCope in browser...")
        launcher('http://localhost:8080', { browser: ['chrome', 'firefox', 'safari'] }, (e, browser) => {
            if(e) return console.log(e);
            browser.on('stop', (code) => {
                console.log("Stopping SCope Server...")
                scopeServer.kill('SIGINT')
                scopeServer = null
                console.log("Stopping SCope Client...")
                scopeClient.kill('SIGINT')
                scopeClient = null
                console.log("SCope stopped running!")
                process.exit()
            });
            
        })
    }
}

const apacheConfigFilePath = path.join(_config.apacheHttpdDir,"conf.d","scope.config")
if (!fs.existsSync(apacheConfigFilePath)) {
    apache.makeApacheConfig()
}
startSCopeServer()
startSCopeClient()
openSCopeClient()