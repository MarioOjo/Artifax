const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

// The Windows (Squirrel) installer runs the app with --squirrel-* flags on install, update and
// uninstall so it can create or remove shortcuts; quit straight away instead of opening a window.
if (require('electron-squirrel-startup')) {
  app.quit()
}

// Serve the packaged build from app://artifax instead of file:// so requests to the
// API carry a real Origin the backend's CORS policy can allow (file:// sends "null").
const APP_ORIGIN = 'app://artifax'
const buildDir = path.join(__dirname, 'build')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const filePath = path.normalize(path.join(buildDir, decodeURIComponent(pathname)))

    // Never serve anything outside the build folder
    if (filePath !== buildDir && !filePath.startsWith(buildDir + path.sep)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, // Slightly wider to accommodate DevTools neatly
    height: 800,
    // build/ holds a copy of public/ and is the folder that ships with the packaged app
    icon: path.join(buildDir, 'artifax-logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  // 1. CHECK IF RUNNING IN DEVELOPMENT MODE
  // Vite usually runs on 5173, Create-React-App/Webpack usually runs on 3000
  // Adjust the port number below to match your terminal's local server port
  const isDev = !app.isPackaged;
  const devServerUrl = 'http://localhost:3000'; 

  if (isDev) {
    // Load the live development server with hot-reloading active
    mainWindow.loadURL(devServerUrl).catch(() => {
      console.log("Failed to connect to dev server, falling back to build file.");
      mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    });
  } else {
    // Load the static bundled files for the packaged production build
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }
}

app.whenReady().then(() => {
  registerAppProtocol()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})