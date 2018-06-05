function _commandExists(command) {
    if(commandExistsSync(command)) {
        console.log(command +" installed.")
        return true
    } else {
	    console.log(command +" not installed.")
        return false
    };
}

function commandsExist(commands) {
    return commands.every(_commandExists)
}

function runCheckCommand(command, checkCommandList = []) {
    if(checkCommandList.length > 0) {
        if(!commandsExist(checkList)) {
            console.log("Some programs are not installed.")
            process.exit()
        }
    }
    proc = exec(command, (error, stdout, stderr) => {
        // result
        if(error) {
            console.log(error)
            process.exit()
        }
    });
    return proc
}

export const _commandExists = _commandExists;
export const commandsExist = commandsExist;
export const runCheckCommand = runCheckCommand;