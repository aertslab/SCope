#!/usr/bin/env node
const shell = require("shelljs");
const launcher = require( 'launch-browser' );
var exec = require('child_process').exec;
var fs = require('fs');

const isWin = process.platform === "win32";
const isAWS = process.argv.includes("--aws") || false
const isDaemon = process.argv.includes("--daemon") || isAWS
const isProd = process.argv.includes("--prod") || isAWS

console.log("Launching SCope...")
let scopeServer, scopeClient;

function startSCopeServer() {
    console.log("Starting SCope Server...")
    if(isDaemon && !isWin) {
        scopeServer = exec('tmux new-session -d -s scope scope-server', (error, stdout, stderr) => {
            // result
        });
    } else {
        scopeServer = exec('scope-server', (error, stdout, stderr) => {
            // result
        });
        console.log("SCope Server started as daemon with PID: "+ scopeServer.pid +"!")
        console.log("SCope Server daemon can be accessed using 'tmux a -t scope'")
    }
}

function startSCopeClient() {
    console.log("Starting SCope Client...")
    if(isProd) {
        console.log("Compiling SCope Client...")
        shell.exec('npm run build');
        if(isAWS) {
            const path = "/var/www/html"
            if (fs.existsSync(path)) {
                console.log("Copying SCope to Apache Web Server directory...")
                shell.exec('sudo cp * '+ path);
            } else {
                console.log("Cannot find "+ path +". Please install Apache Web Server.")
            }
        }
    } else {
        scopeClient = exec('npm run dev', (error, stdout, stderr) => {
            // result
        });
        console.log("SCope Client started with PID: "+ scopeClient.pid +"!")
    }
}

function openSCopeClient() {
    console.log("Open SCope in browser...")
    if(!isProd) {
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

startSCopeServer()
startSCopeClient()
openSCopeClient()