const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const fs = require('fs-extra')
const process = require("process")

/* Create SCope data directories */
const home = process.env['HOME']
const dataDirs = ['my-looms','my-gene-sets','my-aucell-rankings']

dataDirs.forEach(function(value){
  fs.mkdirp(path.join(home, '.scope', 'data', value))
});

/*************************************************************
 * Data Server process
 *************************************************************/

const SCOPESERVER_DIST_FOLDER = 'opt/scopeserver/dist'
const SCOPESERVER_FOLDER = '__init__'
const SCOPESERVER_MODULE = '__init__' // without .py suffix

let scopeServerProc = null

const isPackaged = () => {
  const fullPath = path.join(__dirname, SCOPESERVER_DIST_FOLDER)
  return require('fs').existsSync(fullPath)
}

const getScopeServerScriptPath = () => {
  if (!isPackaged()) {
    return path.join(__dirname, SCOPESERVER_FOLDER, SCOPESERVER_MODULE + '.py')
  }
  if (process.platform === 'win32') {
    return path.join(__dirname, SCOPESERVER_DIST_FOLDER, SCOPESERVER_MODULE, SCOPESERVER_MODULE + '.exe')
  }
  return path.join(__dirname, SCOPESERVER_DIST_FOLDER, SCOPESERVER_MODULE, SCOPESERVER_MODULE)
}

const startScopeServer = () => {
  let script = getScopeServerScriptPath()
  if (isPackaged()) {
    scopeServerProc = require('child_process').execFile(script, [], (err, stdout, stderr) => {
      if (err) throw err;
      console.log(stdout, stderr);
    });
  } else {
    scopeServerProc = require('child_process').spawn('python', [script])
  }
  if (scopeServerProc != null) {
    console.log('Scope Server started!')
  }
}

const stopScopeServer = () => {
  scopeServerProc.kill()
  scopeServerProc = null
  scopeServerProc = null
}

/*************************************************************
 * Bind Server process
 *************************************************************/

const BINDSERVER_FOLDER = 'opt/scopeserver/bindserver'
const BINDSERVER_MODULE = 'server.js'

let bindServerProc = null
let bindServerPort = 8081

const getBindServerScriptPath = () => {
  return path.join(__dirname, BINDSERVER_FOLDER, BINDSERVER_MODULE)
}

const getBindServerPort = () => {
  return bindServerPort
}

const startBindServer = () => {
  const exec = require('child_process').exec;
  const bindServerProc = exec('cd '+ BINDSERVER_FOLDER +'; node '+ BINDSERVER_MODULE +" "+ getBindServerPort(), (e, stdout, stderr)=> {
      if (e instanceof Error) {
          // Error when loading .loom file: Error: stdout maxBuffer exceeded
          // console.error(e);
          // throw e;
      }
      // console.log('stdout ', stdout);
      // console.log('stderr ', stderr);
  });
  if (bindServerProc != null) {
    //console.log(pyProc)
    console.log('Bind Server started!')
  }
}

const stopBindServer = () => {
  bindServerProc.kill()
  bindServerProc = null
  bindServerProc = null
}

const startServers = () => {
  // Start Data Server
  startScopeServer()
  // Start Bind Server
  startBindServer()
}


const stopServers = () => {
  // Start Data Server
  stopScopeServer()
  // Start Bind Server
  stopBindServer()
}

app.on('ready', startServers)
app.on('will-quit', stopServers)


/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null

const createWindow = () => {
  // Set the size of the window to the size of the available screen
  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({width: width, height: height, webPreferences: {
    devTools: false
  }})
  mainWindow.loadURL(require('url').format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})