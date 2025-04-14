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
            // Ensure coordinates are valid numbers
            const validX = Math.max(0, Math.round(Number(x) || 0));
            const validY = Math.max(0, Math.round(Number(y) || 0));
            
            // Set the mouse position directly to absolute coordinates
            console.log(`Setting mouse position to: ${validX}, ${validY}`);
            
            try {
                await mouse.setPosition({ x: validX, y: validY });
            } catch (error) {
                console.error('Error setting mouse position:', error);
                // Try alternative method as fallback
                console.log('Using fallback mouse position method');
                await mouse.move([{ x: validX, y: validY }]);
            }
            
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
        'enter': Key.RETURN,
        'backspace': Key.BACKSPACE,
        'shift': Key.SHIFT,
        'capslock': Key.CAPS_LOCK,
        'tab': Key.TAB,
        'alt': Key.ALT,
        'control': Key.CONTROL,
        'meta': Key.META
    };

    // Track pressed keys in main process
    const mainPressedKeys = new Set();

    // Improved key press handler
    ipcMain.handle('KEY_PRESS', async (event, { key, isSpecial }) => {
        try {
            // Don't process if key is already pressed
            if (mainPressedKeys.has(key)) {
                return { success: true };
            }
            
            mainPressedKeys.add(key);
            
            if (isSpecial) {
                const mappedKey = specialKeyMap[key.toLowerCase()];
                if (mappedKey) {
                    await keyboard.pressKey(mappedKey);
                } else {
                    console.warn(`No mapping found for special key: ${key}`);
                }
            } else {
                // For regular characters (letters and numbers)
                if (key.length === 1) {
                    try {
                        // For alphabet characters, use type directly
                        if (/^[a-zA-Z]$/.test(key)) {
                            await keyboard.type(key);
                        } else {
                            // For other characters, try the Key enum
                            const keyObj = Key[key.toUpperCase()];
                            if (keyObj) {
                                await keyboard.pressKey(keyObj);
                            } else {
                                await keyboard.type(key);
                            }
                        }
                    } catch (error) {
                        console.error(`Error handling key "${key}":`, error);
                    }
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key press error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key release handler
    ipcMain.handle('KEY_RELEASE', async (event, { key, isSpecial }) => {
        try {
            // Don't process if key wasn't pressed
            if (!mainPressedKeys.has(key)) {
                return { success: true };
            }
            
            mainPressedKeys.delete(key);
            
            if (isSpecial) {
                const mappedKey = specialKeyMap[key.toLowerCase()];
                if (mappedKey) {
                    await keyboard.releaseKey(mappedKey);
                }
            } else {
                // For regular characters
                if (key.length === 1) {
                    const keyObj = Key[key.toUpperCase()];
                    if (keyObj) {
                        await keyboard.releaseKey(keyObj);
                    }
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key release error:', error);
            return { success: false, error: error.message }; 
        }
    });

    // Clean up on window close
    mainWindow.on('closed', () => {
        // Release all pressed keys when window closes
        const keysToRelease = Array.from(mainPressedKeys);
        keysToRelease.forEach(key => {
            const isSpecial = Object.keys(specialKeyMap).includes(key.toLowerCase());
            const mappedKey = isSpecial ? specialKeyMap[key.toLowerCase()] : Key[key.toUpperCase()];
            if (mappedKey) {
                keyboard.releaseKey(mappedKey).catch(console.error);
            }
        });
        mainPressedKeys.clear();
    });

    // Clipboard operations
    ipcMain.handle('READ_CLIPBOARD', () => {
        return clipboard.readText();
    });

    ipcMain.handle('WRITE_CLIPBOARD', (event, text) => {
        clipboard.writeText(text);
        return { success: true };
    });

    // Initialize keyboard configuration
    keyboard.config.autoDelayMs = 50;
    keyboard.config.autoDelayMin = 20;
    keyboard.config.autoDelayMax = 100;

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

