const EventEmitter = require( 'events' );
const electron = require('electron');
const path = require('path');
const fs = require('fs-extra');
const process = require("process");
const cp = require('child_process');
const getPorts = require('get-ports');
const fixPath = require('fix-path');
const glob = require('glob');
const appdirs = require('appdirs')

if (process.platform == 'darwin') {
  fixPath();
}

const app = electron.app
const Menu = electron.Menu
const dataDir = appdirs.userDataDir(appname='SCope', appauthor='Aertslab')

const home = process.env['HOME'];

/*************************************************************
 * SCope Server
 *************************************************************/

class SCopeServer extends EventEmitter {

  constructor() {
    super()
    this.dataServer = null;
    this.bindServer = null;
    this.xPort = 9081;
    this.gPort = 50951;
    this.pPort = 50952;
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.setPorts()
  }

  setPorts() {
    getPorts([ this.xPort, this.gPort, this.pPort ], (err, ports) => {
      if (err) {
        throw new Error('could not open servers');
      }
      this.xPort = ports[0];
      this.gPort = ports[1];
      this.pPort = ports[2];
      console.log(this.xPort, this.gPort, this.pPort);
    })
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
        this.bindServer = new BindServer(this);
        this.bindServer.start()
        this.emit('started', true)
      }
    }
  }

}

/*************************************************************
 * Data Server
 *************************************************************/

try {
  if (process.argv[2] == 'electronTest') {
    var DATASERVER_FOLDER = path.join("opt", "scopeserver", "dataserver");
  } else {
    throw 'Not testing'
  }
} catch (e) {
  var DATASERVER_FOLDER = path.join(app.getAppPath(), "opt", "scopeserver", "dataserver", "dist", "__init__");
}
// const DATASERVER_FOLDER = '__init__';
const DATASERVER_MODULE = '__init__'; // without .py suffix

class DataServer {

  constructor(scopeServer) {
    this.scopeServer = scopeServer;
    this.gPort = this.scopeServer.gPort;
    this.pPort = this.scopeServer.pPort;
    this.xPort = this.scopeServer.xPort;
    this.proc = null;
    this.isGServerStarted = false;
    this.isPServerStarted = false;
    this.isPackaged = this.isPackaged.bind(this);
    this.getExecPath = this.getExecPath.bind(this);
    this.setGServerStarted = this.setGServerStarted.bind(this);
    this.setPServerStarted = this.setPServerStarted.bind(this);
    this.setStarted = this.setStarted.bind(this);
    this.isStarted = this.isStarted.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
  }

  isPackaged() {
    const fullPath = path.join(DATASERVER_FOLDER)
    return require('fs').existsSync(fullPath)
  }

  getExecPath() {
    if (!this.isPackaged() | (process.argv[2] == 'electronTest')) {
      return path.join(DATASERVER_FOLDER, DATASERVER_MODULE + '.py')
    }
    if (process.platform === 'win32') {
      return path.join(DATASERVER_FOLDER, DATASERVER_MODULE + '.exe')
    }
    return path.join(DATASERVER_FOLDER, DATASERVER_MODULE)
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
    console.log(script)
    if (this.isPackaged() & process.argv[2] != 'electronTest') {
      console.log("SCope Server Packaged.")
      this.proc = cp.spawn(script, ["-g_port", this.gPort, "-p_port", this.pPort, "-x_port", this.xPort, '--app_mode'], {});
    } else {
      console.log("SCope Server Not packaged or electronTest.")
      this.proc = cp.spawn('python3', [script, "-g_port", this.gPort, "-p_port", this.pPort, "-x_port", this.xPort, '--app_mode', '--dev_env'], {});
    }
    this.proc.stdout.on('data', (data) => {
      let buff = new Buffer(data).toString('utf8');
      let buff_json ;
      console.log(buff)
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
    if (this.proc == null) {
      throw "Null pointer exception for Data Server."
    }
  }

  stop() {
    this.proc.kill('SIGINT')
    this.proc = null
  }

}

/*************************************************************
 * Bind Server
 *************************************************************/

// const BINDSERVER_FOLDER = 'opt/scopeserver/bindserver'
try {
  if (process.argv[2] == 'electronTest') {
    var BINDSERVER_FOLDER = path.join("opt", "scopeserver", "bindserver")
  } else {
    throw 'Not testing'
  }
} catch (e) {
  var BINDSERVER_FOLDER = path.join(app.getAppPath(), "opt", "scopeserver", "bindserver")
}
const BINDSERVER_MODULE = 'server.js'

class BindServer {

  constructor(scopeServer) {
    this.scopeServer = scopeServer
    this.port = this.scopeServer.xPort
    this.proc = null
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
    this.proc = cp.spawn('node', [path.join(BINDSERVER_FOLDER, BINDSERVER_MODULE), this.port])
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

  install() {
    return new Promise((resolve) => {
      console.log("Installing SCope...")
      cp.execSync("cd resources/app; npm rebuild");
      fs.writeFile("INSTALLED", "", function(err) {
        console.log("Successfully installed!");
      });
      resolve(true);
    })
  }

  check_install() {
    if(!fs.existsSync("INSTALLED")) {
      return this.install()
    } else {
      return new Promise((resolve) => { resolve(true) })
    }
  }

  start() {
    this.model = new SCopeServer();
    this.model.start()
    this.model.on('started', (isStarted) => {
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
    this.view = new electron.BrowserWindow({width: width, height: height, icon:'images/SCope_Icon.png', webPreferences: {
      devTools: false
    }})
    this.view.loadURL(require('url').format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }) + "?WSport=" + this.model.xPort + "&XHRport=" + this.model.pPort + "&RPCport=" + this.model.gPort)
    this.view.webContents.openDevTools()
    this.view.webContents.on('new-window', (e, url) => {
      e.preventDefault();
      electron.shell.openExternal(url);
    });

    this.view.on('closed', () => {
      this.view = null
    })
  }

}

/*************************************************************
 * Electron App
 *************************************************************/

const scope = new SCope();

function setMainMenu() {
  const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Loom Folder',
            click () {glob(path.join(dataDir, 'my-looms', 'SCopeApp_*'), (er, files) => {
              electron.shell.openItem(files[0])
            })}
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {role: 'undo'},
          {role: 'redo'},
          {type: 'separator'},
          {role: 'cut'},
          {role: 'copy'},
          {role: 'paste'},
          {role: 'pasteandmatchstyle'},
          {role: 'delete'},
          {role: 'selectall'}
        ]
      },
      {
        label: 'View',
        submenu: [
          {role: 'reload'},
          {role: 'forcereload'},
          {role: 'toggledevtools'},
          {type: 'separator'},
          {role: 'resetzoom'},
          {role: 'zoomin'},
          {role: 'zoomout'},
          {type: 'separator'},
          {role: 'togglefullscreen'}
        ]
      },
      {
        role: 'window',
        submenu: [
          {role: 'minimize'},
          {role: 'close'}
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click () { require('electron').shell.openExternal('https://electronjs.org') }
          }
        ]
      }
    ]

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          {role: 'about'},
          {type: 'separator'},
          {role: 'services', submenu: []},
          {type: 'separator'},
          {role: 'hide'},
          {role: 'hideothers'},
          {role: 'unhide'},
          {type: 'separator'},
          {role: 'quit'}
        ]
      })

      // Window menu
      template[4].submenu = [
        {role: 'close'},
        {role: 'minimize'},
        {role: 'zoom'},
        {type: 'separator'},
        {role: 'front'}
      ]
    }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('ready', () => {
  scope.check_install().then(() => scope.start())
  setMainMenu()
})

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
