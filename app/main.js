const { app, BrowserWindow, desktopCapturer, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const winControl = require('./utils/winControl');

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
        },
    });

    // Add screen capture handler
    ipcMain.handle('GET_SCREEN_SOURCES', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 1920, height: 1080 }
            });
            return sources;
        } catch (error) {
            console.error('Error getting sources:', error);
            throw error;
        }
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

    // File operations
    ipcMain.handle('CREATE_FILE', async (event, { path, content }) => {
        try {
            await fs.writeFile(path, content);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('READ_FILE', async (event, path) => {
        try {
            const content = await fs.readFile(path, 'utf8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('LIST_FILES', async (event, dirPath) => {
        try {
            const files = await fs.readdir(dirPath);
            return { success: true, files };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // System commands
    ipcMain.handle('EXECUTE_COMMAND', async (event, command) => {
        return new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                resolve({ success: !error, output: stdout, error: stderr });
            });
        });
    });

    // Mouse control with improved error handling
    ipcMain.handle('MOUSE_MOVE', async (event, { x, y }) => {
        try {
            console.log(`Setting mouse position to: ${x}, ${y}`);
            await winControl.moveMouse(x, y);
            return { success: true };
        } catch (error) {
            console.error('Mouse move error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('MOUSE_SCROLL', async (event, { deltaY }) => {
        try {
            console.log(`Mouse scroll: deltaY=${deltaY}`);
            await winControl.mouseScroll(deltaY);
            return { success: true };
        } catch (error) {
            console.error('Mouse scroll error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('MOUSE_CLICK', async (event, { button = 'left', double = false }) => {
        try {
            console.log(`Mouse click: ${button}, double: ${double}`);
            await winControl.mouseClick(button, double);
            return { success: true };
        } catch (error) {
            console.error('Mouse click error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key handling
    ipcMain.handle('KEY_PRESS', async (event, { key, isSpecial }) => {
        try {
            console.log(`Key press: ${key}, isSpecial: ${isSpecial}`);
            await winControl.sendKey(key, isSpecial);
            return { success: true };
        } catch (error) {
            console.error('Key press error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('KEY_COMBO', async (event, { keys }) => {
        try {
            console.log(`Key combo: ${keys.join('+')}`);
            await winControl.sendKeyCombination(keys);
            return { success: true };
        } catch (error) {
            console.error('Key combo error:', error);
            return { success: false, error: error.message };
        }
    });

    // Clipboard operations
    ipcMain.handle('READ_CLIPBOARD', () => {
        return clipboard.readText();
    });

    ipcMain.handle('WRITE_CLIPBOARD', (event, text) => {
        clipboard.writeText(text);
        return { success: true };
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
