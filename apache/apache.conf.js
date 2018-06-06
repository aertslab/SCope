const fs = require('fs');
const path = require('path');
const exec = require('child_process').execSync;

class ApacheConf {

    constructor() {
        this._config = null
    }

    setApachePaths() {
        this.apacheConfdDir = path.join(this._config.apacheHttpdDir,"conf.d")
        this.apacheConfigFilePath = path.join(this.apacheConfdDir,"scope.conf")
        this.apacheTempConfFilePath = path.join("apache","template.conf")
        this.apacheSCopeConfigFilePath = path.join("apache","scope.conf")
    }

    loadConfig() {
        if (fs.existsSync("config.json")) {
            this._config = require("../apache/config.json");
        } else {
            console.log("config.json file not found at root of project. Please create one.")
            process.exit()
        }
    }

    copyConf() {
        return new Promise((resolve) => {
            exec("cp -f "+ this.apacheSCopeConfigFilePath +" "+ this.apacheConfdDir, (error, stdout, stderr) => {
                if (error) return resolve(false);
                if (stderr) return resolve(false);
                resolve(true);
            });
        })
    }

    set() {
        if(fs.existsSync(this._config.apacheHttpdDir)) {
            console.log("Copying SCope HTTP Apache web server config file "+ this.apacheSCopeConfigFilePath +" to "+ this.apacheConfdDir)
            console.log("Done!")
            return this.copyConf()
        }
        return new Promise((resolve) => {
            console.log("Apache "+ this.apacheConfdDir +" directory not found! Please check if Apache Web Server is correctly installed.")
            resolve(false)
        })
    }

    make() {
        return new Promise((resolve) => {
            console.log("Making SCope HTTP Apache web server config file...")
            fs.readFile(this.apacheTempConfFilePath, 'utf8', (err,data) => {
                if (err) {
                    console.log(err);
                    resolve(false)
                }
                let tmp = data.replace(/SCOPE_SERVER_DOMAIN_NAME/g, this._config.domainName);
                tmp = tmp.replace(/SCOPE_SERVERS_HOSTNAME/g, "127.0.0.1")
                tmp = tmp.replace(/SCOPE_P_SERVER_PORT/g, this._config.pPort)
                tmp = tmp.replace(/SCOPE_X_SERVER_PORT/g, this._config.xPort)
                tmp = tmp.replace(/APACHE_LOG_DIR/g, this._config.apacheLogDir)
                tmp = tmp.replace(/APACHE_HTML_DIR/g, this._config.apacheHtmlDir)
                fs.writeFile(this.apacheSCopeConfigFilePath, tmp, 'utf8', (err) => {
                    if (err) {
                        console.log(err)
                        resolve(false)
                    }
                    console.log("Done!")
                    resolve(true)
                });
            });
        })
    }

    init() {
        this.loadConfig()
        this.setApachePaths()
        return this.make().then(() => this.set())
    }

}

exports.ApacheConf = ApacheConf