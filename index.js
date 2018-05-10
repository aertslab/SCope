const EventEmitter = require( 'events' );
const electron = require('electron')
const path = require('path')
const fs = require('fs-extra')
const process = require("process")
const cp = require('child_process');

/* Create SCope data directories */
const home = process.env['HOME']
const dataDirs = ['my-looms','my-gene-sets','my-aucell-rankings']

dataDirs.forEach(function(value){
  fs.mkdirp(path.join(home, '.scope', 'data', value))
});

/*************************************************************
 * SCope Server
 *************************************************************/

class SCopeServer extends EventEmitter {

  constructor() {
    super()
    this.dataServer = null;
    this.bindServer = null;
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
    this.handleMessage = this.handleMessage.bind(this);
  }

  start() {
    this.dataServer = new DataServer(this);
    this.dataServer.start();
  }

  stop() {
    // Stop Bind Server
    this.bindServer.stop()
    // Stop Data Server
    this.dataServer.stop()
  }

  handleMessage(msg) {
    if(msg.hasOwnProperty('origin')) {
      this.dataServer.setStarted(msg)
      // Start the bind server if 
      // 1) Not already started
      // 2) Data Server has started
      if(this.bindServer == null & this.dataServer.isStarted()) {
        console.log("Bind Server can start now...")
        console.log("Starting the Bind Server...")
        this.bindServer = new BindServer();
        this.bindServer.start()
        this.emit('started', true)
      }
    }
  }

}

/*************************************************************
 * Data Server
 *************************************************************/

// const DATASERVER_DIST_FOLDER = 'opt/scopeserver/dataserver/dist'
const DATASERVER_DIST_FOLDER = path.join(/*app.getAppPath(), */"opt", "scopeserver", "dataserver", "dist")
const DATASERVER_FOLDER = '__init__'
const DATASERVER_MODULE = '__init__' // without .py suffix

class DataServer {

  constructor(scopeServer) {
    this.scopeServer = scopeServer
    this.proc = null
    this.isGServerStarted = false;
    this.isPServerStarted = false;
    this.isPackaged = this.isPackaged.bind(this)
    this.getExecPath = this.getExecPath.bind(this)
    this.setGServerStarted = this.setGServerStarted.bind(this)
    this.setPServerStarted = this.setPServerStarted.bind(this)
    this.setStarted = this.setStarted.bind(this)
    this.isStarted = this.isStarted.bind(this)
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
  }

  isPackaged() {
    const fullPath = path.join(DATASERVER_DIST_FOLDER)
    return require('fs').existsSync(fullPath)
  }

  getExecPath() {
    if (!this.isPackaged()) {
      return path.join(DATASERVER_FOLDER, DATASERVER_MODULE + '.py')
    }
    if (process.platform === 'win32') {
      return path.join(DATASERVER_DIST_FOLDER, DATASERVER_MODULE, DATASERVER_MODULE + '.exe')
    }
    return path.join(DATASERVER_DIST_FOLDER, DATASERVER_MODULE, DATASERVER_MODULE)
  }

  setGServerStarted() {
    this.isGServerStarted = true
  }

  setPServerStarted() {
    this.isPServerStarted = true
  }

  setStarted(msg) {
    switch(msg['origin']) {
      case "GServer":
          console.log("GServer is on!")
          this.setGServerStarted()
          break;
      case "PServer":
          console.log("PServer is on!")
          this.setPServerStarted()
          break;
      default:
          // nothing
    }
  }

  isStarted() {
    return this.isGServerStarted & this.isPServerStarted;
  }

  start() {
    let script = this.getExecPath()
    if(this.isPackaged()) {
      console.log("SCope Server Packaged.")
      this.proc = cp.spawn(script, [], {});
      this.proc.stdout.on('data', (data) => {
        let buff = new Buffer(data).toString('utf8');
        let buff_json ;
        // console.log(buff)
        try {
          let buff_json = JSON.parse(buff);
          if(buff_json.hasOwnProperty('msg')) {
            this.scopeServer.handleMessage(buff_json['msg'])
          }
        } catch (e) { 
          // do nothing
          // console.log(e)
        }
      });
    } else {
      this.proc = cp.spawn('python', [script])
    }
    if (this.proc == null) {
      throw "Null pointer exception for Data Server."
    }
  }

  stop() {
    this.proc.kill()
    this.proc = null
  }

}

/*************************************************************
 * Bind Server
 *************************************************************/

// const BINDSERVER_FOLDER = 'opt/scopeserver/bindserver'
const BINDSERVER_FOLDER = path.join(/*app.getAppPath(), */"opt", "scopeserver", "bindserver")
const BINDSERVER_MODULE = 'server.js'

class BindServer {

  constructor() {
    this.proc = null
    this.port = 8081
    this.started = false
    this.setStarted = this.setStarted.bind(this)
    this.isStarted = this.isStarted.bind(this)
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
  }

  setStarted() {
    this.started = true
  }

  isStarted() {
    return this.started;
  }

  start() {
    const exec = cp.exec;
    this.proc = exec('cd '+ BINDSERVER_FOLDER +'; node '+ BINDSERVER_MODULE +" "+ this.port, (e, stdout, stderr) => {
        if (e instanceof Error) {
            // Error when loading .loom file: Error: stdout maxBuffer exceeded
            // console.error(e);
            // throw e;
        }
    });
    if (this.proc == null) {
      throw "Null pointer exception for Bind Server."
    }
    console.log("Bind Server has started.")
    this.setStarted()
  }

  stop() {
    this.proc.kill()
    this.proc = null
  }

}

/*************************************************************
 * SCope
 *************************************************************/

class SCope {

  constructor() {
    this.model = null
    this.view = null
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
  }

  start() {
    let model = new SCopeServer();
    model.start()
    model.on('started', (isStarted) => {
      if(isStarted) {
        this.createView()
      }
    })
  }

  stop() {
    this.model.stop()
  }

  createView() {
    // Set the size of the window to the size of the available screen
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
    this.view = new electron.BrowserWindow({width: width, height: height, webPreferences: {
      devTools: false
    }})
    this.view.loadURL(require('url').format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }))
    this.view.webContents.openDevTools()

    this.view.on('closed', () => {
      this.view = null
    })
  }

}


/*************************************************************
 * Electron App
 *************************************************************/

const scope = new SCope();
const app = electron.app
app.on('ready', scope.start)
app.on('will-quit', scope.stop)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// app.on('activate', () => {
//   if (mainWindow === null) {
//     createWindow()
//   }
// })