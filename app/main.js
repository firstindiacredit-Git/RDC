const { app, BrowserWindow, desktopCapturer, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { mouse, keyboard, Key } = require('@nut-tree/nut-js');

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

    // Mouse control with better precision using @nut-tree/nut-js
    ipcMain.handle('MOUSE_MOVE', async (event, { x, y }) => {
        try {
            // Set the mouse position directly to absolute coordinates
            console.log(`Setting mouse position to: ${x}, ${y}`);
            await mouse.setPosition({ x, y });
            return { success: true };
        } catch (error) {
            console.error('Mouse move error:', error);
            return { success: false, error: error.message };
        }
    });

    // Very fast scrolling implementation
    ipcMain.handle('MOUSE_SCROLL', async (event, { deltaY }) => {
        try {
            console.log(`Mouse scroll: deltaY=${deltaY}`);
            
            // Much more aggressive scrolling
            // Using a very small divisor and higher maximum
            const scrollAmount = Math.min(Math.abs(Math.ceil(deltaY / 5)), 20);
            
            if (deltaY > 0) {
                await mouse.scrollDown(scrollAmount);
            } else {
                await mouse.scrollUp(scrollAmount);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Mouse scroll error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('MOUSE_CLICK', async (event, { button = 'left', double = false }) => {
        try {
            console.log(`Mouse click: ${button}, double: ${double}`);
            if (double) {
                await mouse.doubleClick(button === 'left' ? 0 : 1);
            } else {
                if (button === 'left') {
                    await mouse.leftClick();
                } else if (button === 'right') {
                    await mouse.rightClick();
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Mouse click error:', error);
            return { success: false, error: error.message };
        }
    });

    // Special key mapping
    const specialKeyMap = {
        'Enter': Key.ENTER,
        'Backspace': Key.BACKSPACE,
        'Tab': Key.TAB,
        'Shift': Key.SHIFT,
        'Control': Key.CONTROL,
        'Alt': Key.ALT,
        'Meta': Key.META,
        'CapsLock': Key.CAPS_LOCK,
        'Delete': Key.DELETE,
        'Escape': Key.ESCAPE,
        'ArrowUp': Key.UP,
        'ArrowDown': Key.DOWN,
        'ArrowLeft': Key.LEFT,
        'ArrowRight': Key.RIGHT,
        'Home': Key.HOME,
        'End': Key.END,
        'PageUp': Key.PAGE_UP,
        'PageDown': Key.PAGE_DOWN,
        'Insert': Key.INSERT,
        'F1': Key.F1,
        'F2': Key.F2,
        'F3': Key.F3,
        'F4': Key.F4,
        'F5': Key.F5,
        'F6': Key.F6,
        'F7': Key.F7,
        'F8': Key.F8,
        'F9': Key.F9,
        'F10': Key.F10,
        'F11': Key.F11,
        'F12': Key.F12,
        ' ': Key.SPACE
    };

    // Improved key press handler
    ipcMain.handle('KEY_PRESS', async (event, { key, isSpecial }) => {
        try {
            console.log(`Key press: ${key}, isSpecial: ${isSpecial}`);
            
            if (key === 'Backspace') {
                // Special handling for Backspace
                await keyboard.pressKey(Key.BACKSPACE);
                await keyboard.releaseKey(Key.BACKSPACE);
            } else if (isSpecial) {
                // Handle other special keys
                if (specialKeyMap[key]) {
                    await keyboard.pressKey(specialKeyMap[key]);
                } else {
                    console.warn(`Unmapped special key: ${key}`);
                }
            } else {
                // For regular characters
                if (key.length === 1) {
                    await keyboard.type(key);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key press error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key release handler
    ipcMain.handle('KEY_RELEASE', async (event, { key }) => {
        try {
            console.log(`Key release: ${key}`);
            
            // Only release special keys
            if (specialKeyMap[key]) {
                await keyboard.releaseKey(specialKeyMap[key]);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key release error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key combo handler (for keyboard shortcuts)
    ipcMain.handle('KEY_COMBO', async (event, { keys }) => {
        try {
            console.log(`Key combo: ${keys.join('+')}`);
            
            // Map all keys in the combo
            const keyObjects = keys.map(key => specialKeyMap[key] || key);
            
            // Validate that we have valid keys
            if (keyObjects.some(k => k === undefined)) {
                console.warn('Some keys in the combo could not be mapped:', keys);
                return { success: false, error: 'Invalid key in combo' };
            }
            
            // Press all keys in sequence
            for (const key of keyObjects) {
                if (typeof key === 'string' && key.length === 1) {
                    // For character keys
                    await keyboard.pressKey(key);
                } else {
                    // For special keys
                    await keyboard.pressKey(key);
                }
            }
            
            // Release all keys in reverse order
            for (let i = keyObjects.length - 1; i >= 0; i--) {
                const key = keyObjects[i];
                if (typeof key === 'string' && key.length === 1) {
                    await keyboard.releaseKey(key);
                } else {
                    await keyboard.releaseKey(key);
                }
            }
            
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
