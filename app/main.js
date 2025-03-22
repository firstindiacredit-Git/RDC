// const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
// const path = require('path');

// let mainWindow;

// app.whenReady().then(() => {
//     mainWindow = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//             preload: path.join(__dirname, 'preload.js'),
//             nodeIntegration: false,
//             contextIsolation: true,
//         },
//     });

//     mainWindow.loadFile('renderer/index.html');
// });


const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            enableWebRTC: true
        },
    });

    // Add this to verify preload script loading
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded');
    });

    // Add this to catch preload script errors
    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
        console.error('Preload error:', error);
    });

    // Add error handler
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    // Add screen capture permissions
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        } else {
            callback(false);
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// Handle window management
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
