const cp = require('child_process');
const exec = cp.exec;
const execSync = cp.execSync;
const commandExists = require('command-exists').sync;

function _commandExists(command) {
    if (commandExists(command)) {
        console.log(command + ' command found.');
        return true;
    } else {
        console.log(command + ' cannot be found.');
        return false;
    }
}

function commandsExist(commands) {
    return commands.every(_commandExists);
}

function runCheckCommand(
    command,
    callback = null,
    sync = false,
    checkCommandList = []
) {
    if (checkCommandList.length > 0) {
        if (!commandsExist(checkList)) {
            console.log('Some programs are not installed.');
            process.exit();
        }
    }
    if (sync) {
        proc = execSync(command, (error, stdout, _) => {
            if (error) {
                console.log(error);
                process.exit();
            }
            if (stdout.length > 0) {
                console.log(stdout);
            }
        });
    } else {
        proc = exec(command, (error, stdout, _) => {
            if (error) {
                console.log(error);
                process.exit();
            }
            if (stdout.length > 0) {
                console.log(stdout);
                if (callback === null) {
                    console.log(
                        'Callback function should be specified when executing a command asynchronously.'
                    );
                    process.exit();
                }
                callback();
            }
        });
        return proc;
    }
}

function runSimpleCommandAsPromise(command) {
    return new Promise((resolve, _) => {
        exec(command, { stdio: [0, 1, 2] }, (error, stdout, stderr) => {
            if (error) return resolve(false);
            if (stderr) return resolve(false);
            console.log(stdout);
            if (stdout.length > 0) {
                console.log('Done!');
                resolve(true);
            }
        });
    });
}

exports._commandExists = _commandExists;
exports.commandsExist = commandsExist;
exports.runCheckCommand = runCheckCommand;
exports.runSimpleCommandAsPromise = runSimpleCommandAsPromise;
