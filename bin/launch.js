#!/usr/bin/env node

// Load node dependencies
const launcherBrowser = require( 'launch-browser' );
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

// Load custom dependencies
const apache = require("../apache/apache.conf.js");
const utils = require("../bin/utils.js")
const figlet = require('figlet');

// Declare variables
const isWin = process.platform === "win32";
const isAWS = process.argv.includes("--aws") || false
const isDaemon = process.argv.includes("--daemon") || isAWS
const isProd = process.argv.includes("--prod") || isAWS

class Launcher {

    constructor() {
        this._config = null
        this.scopeServerActivated = false
    }

    printSCope() { 
        console.log(figlet.textSync("SCope","Big Money-ne"));
        console.log("")
    }

    loadConfig() {
        // Import config file
        if(isAWS) {
            this._config = require('../apache/config.json');
        } else {
            this._config = require('../config.json');
        }
    }

    printSettings() {
        console.log("-------- running settings --------")
        console.log("Running on "+ process.platform.charAt(0).toUpperCase() + process.platform.slice(1))
        console.log("Running in AWS: "+ isAWS)
        console.log("Running as daemon: "+ isDaemon)
        console.log("Running in production mode: "+ isProd)
        console.log("----------------------------------")
        console.log("")
    }

    checkApacheConf() {
        if(isAWS)
            return new apache.ApacheConf().init()
        return new Promise((resolve) => {
            resolve(true)
        })
    }

    // Check if programs are installed
    checkDirs() {
        return new Promise((resolve) => {
            const assetsDir = './assets';
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir);
            }
            resolve(true)
        })
    }

    checkTmuxExists() {
        return new Promise((resolve) => {
            if(isDaemon) {
                if(!utils._commandExists("tmux")) {
                    console.log("Please install tmux.")
                    resolve(false)
                }
            }
            resolve(true)
        })
    }

    checkSCopeCondaEnvExists() {
        return new Promise((resolve, reject) => {
            exec("conda info --envs", {stdio:[0,1,2]}, (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
                if(!this.scopeServerActivated) {
                    if(stdout.includes("scope")) {
                        console.log("SCope Server is installed but not activated.")
                        resolve(true)
                    } else {
                        console.log("Please install SCope Server.")
                        resolve(false)
                    }
                } else {
                    console.log("SCope Server is installed and activated!")
                    resolve(true)
                }
            });
        });
    }

    checkSCopeServerCommandExists() {
        return new Promise((resolve) => {
            if(!utils._commandExists("scope-server")) {
                resolve(true)
            } else {
                this.scopeServerActivated = true
                resolve(true)
            }
        })
    }

    checkSCopeServer() {
        return this.checkSCopeServerCommandExists()
            .then(() => this.checkSCopeCondaEnvExists())
    }

    checkCondaExists() {
        // conda
        return new Promise((resolve) => {
            if(!utils._commandExists("conda")) {
                console.log("Please install miniconda3.")
                process.exit()
            }
            resolve()
        })
    }

    runSanityChecks() {
        console.log("--------- sanity checks ----------")
        return this.checkCondaExists()
            .then(() => this.checkSCopeServer())
            .then(() => this.checkTmuxExists())
            .then(() => this.checkDirs())
            .then(() => this.checkApacheConf())
            .then(() => this.endSanityChecks())

    }

    endSanityChecks() {
        return new Promise((resolve) => {
            console.log("----------------------------------")
            console.log("")
            resolve(true)
        })
    }

    // end sanity checks

    openSCopeClient() {
        if(!isProd) {
            console.log("Open SCope in browser...")
            launcherBrowser('http://localhost:8080', { browser: ['chrome', 'firefox', 'safari'] }, (e, browser) => {
                if(e) return console.log(e);
                browser.on('stop', (code) => {
                    // console.log("Stopping SCope Server...")
                    // scopeServer.kill('SIGINT')
                    // scopeServer = null
                    // console.log("Stopping SCope Client...")
                    // scopeClient.kill('SIGINT')
                    // scopeClient = null
                    // console.log("SCope stopped running!")
                    process.exit()
                });
                
            })
        }
    }

    runDev() {
        console.log("Starting SCope Client as Dev Server...")
        return utils.runSimpleCommandAsPromise("npm run dev")
    }

    runBuild() {
        console.log("Compiling SCope Client...")
        return utils.runSimpleCommandAsPromise("npm run build")
    }

    runBuildAWS() {
        console.log("Compiling SCope Client...")
        return utils.runSimpleCommandAsPromise("npm run build-aws")
    }

    copySCopeToApacheHTMLDir() {
        return new Promise((resolve) => {
            if (fs.existsSync(_config.apacheHtmlDir)) {
                console.log("Copying SCope to Apache Web Server directory...")
                exec("cp -rf . "+ _config.apacheHtmlDir, (error, stdout, stderr) => {
                    if (error) return resolve(false);
                    if (stderr) return resolve(false);
                    resolve(true);
                });
            } else {
                console.log("Cannot find "+ _config.apacheHtmlDir +". Please install HTTP Apache Web Server.")
                resolve(false)
            }
        })
    }

    startSCopeClient() {
        if(isAWS) {
            return this.runBuildAWS().then(() => this.copySCopeToApacheHTMLDir())
        } else {
            if(isProd) {
                return this.runBuild()
            } else {
                return this.runDev()
            }
        }
    }

    startSCopeServer() {
        let scopeStartCmd = "scope-server"
        if(!this.scopeServerActivated) {
            console.log("SCope Server installed but not activated")
            scopeStartCmd = "source activate scope &&"+ scopeStartCmd 
            console.log("Activating and starting SCope Server...")
        } else {
            console.log("Starting SCope Server...")
        }
        if(isDaemon && !isWin) {
            scopeStartCmd = 'tmux new-session -d -s scope "'+ scopeStartCmd +'"'
            console.log("SCope Server started as daemon!")
            console.log("It can be accessed using 'tmux a -t scope' command.")
        }
        return new Promise((resolve, reject) => {
            exec(scopeStartCmd, {stdio:[0,1,2]}, (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
            });
            resolve(true)
        });
    }

    init() {
        console.log("Starting SCope...")
        return this.startSCopeServer()
            .then(() => this.startSCopeClient())
    }

    start() {
        this.printSCope()
        this.loadConfig()
        this.printSettings()
        this.runSanityChecks()
            .then(() => this.init())
            .then(() => this.openSCopeClient())
    }
}

let launcher = new Launcher()
launcher.start()

// function startSCopeClient() {
//     if(isAWS) {
// 	    console.log("Compiling SCope Client...")
//         utils.runCheckCommand("npm run build-aws")
//         if (fs.existsSync(_config.apacheHtmlDir)) {
//             console.log("Copying SCope to Apache Web Server directory...")
//             utils.runCheckCommand("cp -rf . "+ _config.apacheHtmlDir);
//         } else {
//             console.log("Cannot find "+ _config.apacheHtmlDir +". Please install HTTP Apache Web Server.")
//         }
//     } else {
//         if(isProd) {
//             console.log("Compiling SCope Client...")
//             utils.runCheckCommand('npm run build');
//         } else {
// 	    console.log("Starting SCope Client as Dev Server...")
//             scopeClient = utils.runCheckCommand("npm run dev")
//             console.log("SCope Client started with PID: "+ scopeClient.pid +"!")
//         }
//     }
// }

// function openSCopeClient() {
//     if(!isProd) {
//         console.log("Open SCope in browser...")
//         launcherBrowser('http://localhost:8080', { browser: ['chrome', 'firefox', 'safari'] }, (e, browser) => {
//             if(e) return console.log(e);
//             browser.on('stop', (code) => {
//                 console.log("Stopping SCope Server...")
//                 scopeServer.kill('SIGINT')
//                 scopeServer = null
//                 console.log("Stopping SCope Client...")
//                 scopeClient.kill('SIGINT')
//                 scopeClient = null
//                 console.log("SCope stopped running!")
//                 process.exit()
//             });
            
//         })
//     }
// }

// function launchSCope() {
//     console.log("Launching SCope...")
//     startSCopeServer()
//     startSCopeClient()
//     openSCopeClient()
// }
