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

    // Special key mapping - simplified to only include needed keys
    const specialKeyMap = {
        'Enter': Key.RETURN,
        'Backspace': Key.BACKSPACE,
        'Shift': Key.SHIFT,
        'CapsLock': Key.CAPS_LOCK,
        'Tab': Key.TAB
    };

    // Track last key press time
    let lastKeyPressTime = 0;
    const KEY_PRESS_DELAY = 200; // Increased delay to prevent repeats

    // Key combo handler (for keyboard shortcuts)
    ipcMain.handle('KEY_COMBO', async (event, { keys }) => {
        try {
            console.log(`Key combo: ${keys.join('+')}`);
            
            // Helper function to get the key object 
            const getKeyObject = (key) => {
                if (specialKeyMap[key]) {
                    return specialKeyMap[key];
                }
                return key; // For regular characters
            };
            
            // Get mapped keys
            const keyObjects = keys.map(key => getKeyObject(key));
            
            // Press all keys in sequence
            for (const key of keyObjects) {
                await keyboard.pressKey(key);
                console.log(`Pressed key: ${key}`);
            }
            
            // Small delay to ensure the keys are registered
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Release keys in reverse order
            for (let i = keyObjects.length - 1; i >= 0; i--) {
                await keyboard.releaseKey(keyObjects[i]);
                console.log(`Released key: ${keyObjects[i]}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key combo error:', error);
            return { success: false, error: error.message };
        }
    });

    // Improved key press handler
    ipcMain.handle('KEY_PRESS', async (event, { key, isSpecial }) => {
        try {
            // Check if enough time has passed since last key press
            const currentTime = Date.now();
            if (currentTime - lastKeyPressTime < KEY_PRESS_DELAY) {
                return { success: true };
            }
            lastKeyPressTime = currentTime;

            console.log(`Key press: ${key}, isSpecial: ${isSpecial}`);
            
            if (isSpecial) {
                const mappedKey = specialKeyMap[key];
                if (mappedKey) {
                    await keyboard.pressKey(mappedKey);
                    console.log(`Pressed special key: ${key} -> ${mappedKey}`);
                } else {
                    console.warn(`No mapping found for special key: ${key}`);
                }
            } else {
                // For regular characters (a-z, 0-9)
                if (/^[a-z0-9]$/.test(key)) {
                    console.log(`Typing character: "${key}"`);
                    try {
                        // Use type with a small delay
                        await keyboard.type(key, { delay: 100 });
                    } catch (typeError) {
                        console.error(`Error typing character "${key}":`, typeError);
                        // Try using pressKey as fallback
                        try {
                            const keyObj = Key[key.toUpperCase()];
                            if (keyObj) {
                                await keyboard.pressKey(keyObj);
                                await new Promise(resolve => setTimeout(resolve, 100));
                                await keyboard.releaseKey(keyObj);
                            }
                        } catch (fallbackError) {
                            console.error('Fallback error:', fallbackError);
                        }
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
            console.log(`Key release: ${key}, isSpecial: ${isSpecial}`);
            
            if (isSpecial) {
                const mappedKey = specialKeyMap[key];
                if (mappedKey) {
                    await keyboard.releaseKey(mappedKey);
                    console.log(`Released special key: ${key} -> ${mappedKey}`);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key release error:', error);
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

    // Initialize keyboard configuration
    keyboard.config.autoDelayMs = 200;
    keyboard.config.autoDelayMin = 100;
    keyboard.config.autoDelayMax = 300;

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

