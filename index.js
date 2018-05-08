const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const fs = require('fs-extra')
const process = require("process")
const getPorts = require('get-ports')

/* Create SCope data directories */
const home = process.env['HOME']
const dataDirs = ['my-looms','my-gene-sets','my-aucell-rankings']

dataDirs.forEach(function(value){
  fs.mkdirp(path.join(home, '.scope', 'data', value))
});

var bindServerPort
var gServerPort
var pServerPort

/*************************************************************
 * Data Server process
 *************************************************************/

// const DATASERVER_DIST_FOLDER = 'opt/scopeserver/dataserver/dist'
const DATASERVER_DIST_FOLDER = path.join(/*app.getAppPath(), */"opt", "scopeserver", "dataserver", "dist")
const DATASERVER_FOLDER = '__init__'
const DATASERVER_MODULE = '__init__' // without .py suffix

let dataServerProc = null

const isPackaged = () => {
  const fullPath = path.join(DATASERVER_DIST_FOLDER)
  return require('fs').existsSync(fullPath)
}

const getScopeServerScriptPath = () => {
  if (!isPackaged()) {
    return path.join(DATASERVER_FOLDER, DATASERVER_MODULE + '.py')
  }
  if (process.platform === 'win32') {
    return path.join(DATASERVER_DIST_FOLDER, DATASERVER_MODULE, DATASERVER_MODULE + '.exe')
  }
  return path.join(DATASERVER_DIST_FOLDER, DATASERVER_MODULE, DATASERVER_MODULE)
}

const startDataServer = () => {
  let script = getScopeServerScriptPath()
  if(isPackaged()) {
    console.log("SCope Server Packaged.")
    dataServerProc = require('child_process').execFile(script, ["-g_port", gServerPort, "-p_port", pServerPort, "-x_port", bindServerPort], (err, stdout, stderr) => {
      if (err) throw err;
      console.log(stdout, stderr);
    });
  } else {
    dataServerProc = require('child_process').spawn('python', [script, "-g_port", gServerPort, "-p_port", pServerPort, "-x_port", bindServerPort])
  }
  if (dataServerProc != null) {
    console.log('Scope Server started!')
    dataServerProc.stdout.on('data', (chunk) => {
      console.log(`Received ${chunk.length} bytes of data.`);
      console.log(chunk)
    })
  }
}

const stopDataServer = () => {
  dataServerProc.kill('SIGINT')
  dataServerProc = null
  dataServerProc = null
}

/*************************************************************
 * Bind Server process
 *************************************************************/

// const BINDSERVER_FOLDER = 'opt/scopeserver/bindserver'
const BINDSERVER_FOLDER = path.join(/*app.getAppPath(), */"opt", "scopeserver", "bindserver")
const BINDSERVER_MODULE = 'server.js'

let bindServerProc = null

const getBindServerScriptPath = () => {
  return path.join(__dirname, BINDSERVER_FOLDER, BINDSERVER_MODULE)
}

const startBindServer = () => {
  const exec = require('child_process').exec;
  // const bindServerProc = exec('cd '+ BINDSERVER_FOLDER +'; node '+ BINDSERVER_MODULE +" "+ getBindServerPort(), (e, stdout, stderr)=> {
  bindServerProc = exec('cd '+ BINDSERVER_FOLDER +'; node '+ BINDSERVER_MODULE +" "+ bindServerPort, (e, stdout, stderr)=> {
      if (e instanceof Error) {
      }
      console.log('stderr: ', stderr);
  });
  if (bindServerProc != null) {
    console.log('Bind Server started!')
  }
}

const stopBindServer = () => {
  bindServerProc.kill()
}

const startSCopeServer = () => {
  getPorts([ 9081, 50951, 50952 ], function (err, ports) {
    if (err) {
      throw new Error('could not open servers')
    }
    bindServerPort = ports[0]
    gServerPort = ports[1]
    pServerPort = ports[2]
    console.log(bindServerPort, gServerPort, pServerPort)
    startDataServer()
    startBindServer()
    createWindow()

  })
}

const stopSCopeServer = () => {
  stopDataServer()
  stopBindServer()
}

app.on('ready', () => {
  startSCopeServer()
})

app.on('will-quit', stopSCopeServer)


/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null

const createWindow = () => {
  // Set the size of the window to the size of the available screen
  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({width: width, height: height, webPreferences: {
    devTools: true
  }})
  mainWindow.loadURL(require('url').format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  // }))
  }) + "?WSport=" + bindServerPort + "&XHRport=" + gServerPort + "&RPCport=" + pServerPort)
  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// app.on('ready', createWindow)

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
