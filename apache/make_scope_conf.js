const fs = require('fs');
const path = require('path');
const exec = require('child_process').execSync;

let _config;
if (fs.existsSync("config.json")) {
    _config = require("../apache/config.json");
} else {
    console.log("config.json file not found at root of project. Please create one.")
    process.exit()
}

const apacheConfdDir = path.join(_config.apacheHttpdDir,"conf.d")
const apacheConfigFilePath = path.join(apacheConfdDir,"scope.conf")
const apacheTempConfFilePath = path.join("apache","template.conf")
const apacheSCopeConfigFilePath = path.join("apache","scope.conf")

function makeConfig() {
    console.log("Making SCope HTTP Apache web server config file...")
    fs.readFile(apacheTempConfFilePath, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        let tmp = data.replace(/SCOPE_SERVER_DOMAIN_NAME/g, _config.domainName);
        tmp = tmp.replace(/SCOPE_SERVERS_HOSTNAME/g, "127.0.0.1")
        tmp = tmp.replace(/SCOPE_P_SERVER_PORT/g, _config.pPort)
        tmp = tmp.replace(/SCOPE_X_SERVER_PORT/g, _config.xPort)
        tmp = tmp.replace(/APACHE_LOG_DIR/g, _config.apacheLogDir)
        tmp = tmp.replace(/APACHE_HTML_DIR/g, _config.apacheHtmlDir)
        fs.writeFile(apacheSCopeConfigFilePath, tmp, 'utf8', function (err) {
            if (err) return console.log(err);
        });
        console.log("Done!")
        setApachConfig()
    });
}

function setApachConfig() {
    if (fs.existsSync(_config.apacheHttpdDir)) {
        console.log("Copying SCope HTTP Apache web server config file "+ apacheSCopeConfigFilePath +" to "+ apacheConfdDir)
        exec("sudo cp -f "+ apacheSCopeConfigFilePath +" "+ apacheConfdDir, (error, stdout, stderr) => {
            if (error) {
                return console.log(error);
            }
        });
        console.log("Done!")
    } else {
        console.log("Apache "+ apacheConfdDir +" directory not found! Please check if Apache Web Server is correctly installed.")
    }
}

exports.makeConfig = makeConfig