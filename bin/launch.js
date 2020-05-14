#!/usr/bin/env node

// Load node dependencies
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load custom dependencies
const apache = require('../apache/apache.conf.js');
const utils = require('../bin/utils.js');
const figlet = require('figlet');

// Declare variables
const isWin = process.platform === 'win32';
const isAWS = process.argv.includes('--aws') || false;
const isDaemon = process.argv.includes('--daemon') || isAWS;
const isDev =
    process.argv.includes('--dev') || !process.argv.includes('--prod');

class Launcher {
    constructor() {
        this._config = null;
        this.scopeServerActivated = false;
    }

    printSCope() {
        console.log(figlet.textSync('SCope', 'Big Money-ne'));
        console.log('');
    }

    loadConfig() {
        // Import config file
        if (isAWS) {
            this._config = require('../apache/config.json');
        } else {
            this._config = require('../config.json');
        }
    }

    printSettings() {
        console.log('-------- running settings --------');
        console.log(
            'Running on ' +
                process.platform.charAt(0).toUpperCase() +
                process.platform.slice(1)
        );
        console.log('Running in AWS: ' + isAWS);
        console.log('Running as daemon: ' + isDaemon);
        if (!isDev) {
            console.log('Running in production mode: ' + !isDev);
        } else {
            console.log('Running in development mode: ' + isDev);
            console.log(
                "   *** please run in production mode except if it's for testing purposes."
            );
        }
        console.log('----------------------------------');
        console.log('');
    }

    // begin sanity checks

    checkPublicHostAddress() {
        console.log('- Checking public host address...');
        return new Promise((resolve) => {
            if (this._config.publicHostAddress == '') {
                throw new Error(
                    'No public host address set in apache/config.json. Please set one.'
                );
            }
            resolve(true);
        });
    }

    checkApacheConf() {
        console.log('- Checking Apache configuration...');
        if (isAWS)
            return new apache.ApacheConf().setDevelopmentMode(isDev).init();
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    checkDirs() {
        console.log('- Checking directories (assets)...');
        return new Promise((resolve) => {
            const assetsDir = './assets';
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir);
            }
            resolve(true);
        });
    }

    checkTmuxExists() {
        console.log('- Checking tmux...');
        return new Promise((resolve) => {
            if (isDaemon) {
                if (!utils._commandExists('tmux')) {
                    console.log('Please install tmux.');
                    resolve(false);
                }
            }
            resolve(true);
        });
    }

    checkSCopePoetryEnvExists() {
        console.log('- Checking SCope poetry environment...');
        return new Promise((resolve, reject) => {
            exec('cd opt; poetry env list', (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
                if (!this.scopeServerActivated) {
                    if (stdout.includes('scopeserver')) {
                        throw new Error(
                            "SCope Server is installed but not activated. Please activate your 'scope' poetry environment using either 'cd opt; poetry shell; cd ..;' command."
                        );
                    } else {
                        throw new Error(
                            "SCope Server is not installed. Please install SCope Server using 'npm install'."
                        );
                    }
                } else {
                    console.log('SCope Server is installed and activated!');
                    resolve(true);
                }
            });
        });
    }

    checkSCopeServerCommandExists() {
        console.log('- Checking SCope Server...');
        return new Promise((resolve) => {
            if (!utils._commandExists('scope-server')) {
                resolve(false);
            } else {
                this.scopeServerActivated = true;
                resolve(true);
            }
        });
    }

    checkSCopeServer() {
        return this.checkSCopeServerCommandExists().then(() =>
            this.checkSCopePoetryEnvExists()
        );
    }

    checkPoetryExists() {
        // conda
        return new Promise((resolve) => {
            if (!utils._commandExists('poetry')) {
                console.log('Please install poetry.');
                process.exit();
            }
            resolve();
        });
    }

    runSanityChecks() {
        console.log('--------- sanity checks ----------');
        return this.checkPoetryExists()
            .then(() => this.checkSCopeServer())
            .then(() => this.checkTmuxExists())
            .then(() => this.checkDirs())
            .then(() => this.checkApacheConf())
            .then(() => this.checkPublicHostAddress())
            .then(() => this.endSanityChecks());
    }

    endSanityChecks() {
        return new Promise((resolve) => {
            console.log('----------------------------------');
            console.log('');
            resolve(true);
        });
    }

    // end sanity checks

    showSCopeInstanceInformation() {
        return new Promise((resolve) => {
            console.log(
                'A SCope instance is running at http://' +
                    this._config.publicHostAddress
            );
            console.log('----------------------------------');
            console.log('');
            resolve(true);
        });
    }

    openSCopeClient() {
        if (isDev & !isAWS) {
            console.log('Open SCope in browser @ http://localhost:8080...');
        }
    }

    runDev() {
        console.log('Starting SCope Client as Dev Server...');
        return utils.runSimpleCommandAsPromise('npm run dev');
    }

    runBuild() {
        console.log('Compiling SCope Client...');
        return utils.runSimpleCommandAsPromise('npm run build');
    }

    runDevAWS() {
        console.log('Running SCope Client...');
        let scopeClientStartCmd = 'npm run dev-aws';
        scopeClientStartCmd =
            'tmux new-session -d -s scope-client "' + scopeClientStartCmd + '"';
        console.log('SCope Client started as daemon!');
        console.log(
            "It can be accessed using 'tmux a -t scope-client' command."
        );
        return new Promise((resolve, reject) => {
            exec(scopeClientStartCmd, (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
            });
            resolve(true);
        });
    }

    runBuildAWS() {
        console.log('Compiling SCope Client...');
        return utils.runSimpleCommandAsPromise('npm run build-aws');
    }

    copySCopeToApacheHTMLDir() {
        return new Promise((resolve) => {
            if (fs.existsSync(this._config.apacheHtmlDir)) {
                console.log('Copying SCope to Apache Web Server directory...');
                exec(
                    'cp -rf . ' + this._config.apacheHtmlDir,
                    (error, stdout, stderr) => {
                        if (error) return resolve(false);
                        if (stderr) return resolve(false);
                        resolve(true);
                    }
                );
            } else {
                console.log(
                    'Cannot find ' +
                        this._config.apacheHtmlDir +
                        '. Please install HTTP Apache Web Server.'
                );
                resolve(false);
            }
        });
    }

    startSCopeClient() {
        if (isAWS) {
            if (!isDev) {
                return this.runBuildAWS().then(() =>
                    this.copySCopeToApacheHTMLDir()
                );
            } else {
                return this.runDevAWS();
            }
        } else {
            if (!isDev) {
                return this.runBuild();
            } else {
                return this.runDev();
            }
        }
    }

    startSCopeServer() {
        let scopeStartCmd = 'hypercorn opt/main:scope_api';
        if (!this.scopeServerActivated) {
            console.log('SCope Server installed but not activated');
            scopeStartCmd =
                'cd opt && poetry shell && cd .. &&' + scopeStartCmd;
            console.log('Activating and starting SCope Server...');
        } else {
            console.log('Starting SCope Server...');
        }
        if (isDaemon && !isWin) {
            scopeStartCmd =
                'tmux new-session -d -s scope-server "' + scopeStartCmd + '"';
            console.log('SCope Server started as daemon!');
            console.log(
                "It can be accessed using 'tmux a -t scope-server' command."
            );
        }
        return new Promise((resolve, reject) => {
            exec(scopeStartCmd, (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
            });
            resolve(true);
        });
    }

    init() {
        console.log('--------- running scope ----------');
        console.log('Starting SCope...');
        return this.startSCopeServer()
            .then(() => this.startSCopeClient())
            .then(() => this.showSCopeInstanceInformation());
    }

    start() {
        this.printSCope();
        this.loadConfig();
        this.printSettings();
        this.runSanityChecks()
            .then(() => this.init())
            .then(() => this.openSCopeClient());
    }
}

let launcher = new Launcher();
launcher.start();
