#!/usr/bin/env node
// Load node dependencies
const launcher = require( 'launch-browser' );
const exec = require('child_process').execSync;
const fs = require('fs');
const path = require('path');

// Load custom dependencies
const apache = require("../apache/make_scope_conf.js");
const utils = require("../bin/utils.js")

// Declare variables
const isWin = process.platform === "win32";
const isAWS = process.argv.includes("--aws") || false
const isDaemon = process.argv.includes("--daemon") || isAWS
const isProd = process.argv.includes("--prod") || isAWS

// Import conig giles
let _config;
if(isAWS) {
    _config = require('../apache/config.json');
} else {
    _config = require('../config.json');
}

console.log("-------- running settings --------")
console.log("Windows: "+ isWin)
console.log("Running in AWS: "+ isAWS)
console.log("Running as Daemon: "+ isDaemon)
console.log("Production Mode: "+ isProd)
console.log("----------------------------------")
console.log("")
console.log("---------- sanity checks ---------")
// Check if programs are installed

// conda
if(!utils._commandExists("conda")) {
    console.log("Please install miniconda3.")
    process.exit()
} else {
    checkSCopeServer()
}

// scope-server
var scopeServerActivated;
function checkSCopeServer() {
    if(!utils._commandExists("scope-server")) {
        let scopeServerInstalled = false
        require("child_process").exec("conda info --envs", {stdio:[0,1,2]}, (error, stdout, stderr) => {
            if(stdout.includes("scope")) {
                console.log("SCope Server is installed but not activated.")
                scopeServerActivated = false
                checkTmux()
            } else {
            console.log("Please install SCope Server.")
                process.exit()
            }
        });
    } else {
    console.log("SCope Server is installed and activated!")
    scopeServerActivated = true
    checkTmux()
    }
}

// tmux
function checkTmux() {
    if(isDaemon) {
        if(!utils._commandExists("tmux")) {
            console.log("Please install tmux.")
            process.exit()
        }
    }
    createDirs()
}

// Create folders
function createDirs() {
    const assetsDir = './assets';
    if (!fs.existsSync(assetsDir)){
        fs.mkdirSync(assetsDir);
    }
    makeApacheConf()
}

// Make Apache .conf
function makeApacheConf() {
    const apacheConfigFilePath = path.join(_config.apacheHttpdDir,"conf.d","scope.config")
    if (!fs.existsSync(apacheConfigFilePath)) {
        apache.makeConfig()
    }
    endSanityChecks()
}

function endSanityChecks() {
   console.log("----------------------------------")
   launchSCope()
}

var scopeServer, scopeClient;

function startSCopeServer() {
    let scopeStartCmd = "scope-server"
    if(!scopeServerActivated) {
        console.log("SCope Server installed but not activated")
        scopeStartCmd = "source activate scope &&"+ scopeStartCmd 
        console.log("Activating and starting SCope Server...")
    } else {
        console.log("Starting SCope Server...")
    }
    if(isDaemon && !isWin) {
        const tmuxScopeStartCmd = 'tmux new-session -d -s scope "'+ scopeStartCmd +'"'
        scopeServer = utils.runCheckCommand(tmuxScopeStartCmd)
	    console.log("SCope Server started as daemon!")
        console.log("It can be accessed using 'tmux a -t scope' command.")
    } else {
        scopeServer = utils.runCheckCommand(scopeStartCmd)
    }
}

function startSCopeClient() {
    if(isAWS) {
	    console.log("Compiling SCope Client...")
        utils.runCheckCommand("npm run build-aws")
        if (fs.existsSync(_config.apacheHtmlDir)) {
            console.log("Copying SCope to Apache Web Server directory...")
            utils.runCheckCommand("cp -rf . "+ _config.apacheHtmlDir);
        } else {
            console.log("Cannot find "+ _config.apacheHtmlDir +". Please install HTTP Apache Web Server.")
        }
    } else {
        if(isProd) {
            console.log("Compiling SCope Client...")
            utils.runCheckCommand('npm run build');
        } else {
	    console.log("Starting SCope Client as Dev Server...")
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

function launchSCope() {
    console.log("Launching SCope...")
    startSCopeServer()
    startSCopeClient()
    openSCopeClient()
}
