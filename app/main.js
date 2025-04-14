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
        'Enter': Key.RETURN,
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
            
            if (isSpecial) {
                // Handle special keys
                switch(key) {
                    case 'Enter':
                        await keyboard.pressKey(Key.RETURN);
                        break;
                    case 'Backspace':
                        await keyboard.pressKey(Key.BACKSPACE);
                        break;
                    case 'Tab':
                        await keyboard.pressKey(Key.TAB);
                        break;
                    case 'Shift':
                        await keyboard.pressKey(Key.SHIFT);
                        break;
                    case 'Control':
                        await keyboard.pressKey(Key.CONTROL);
                        break;
                    case 'Alt':
                        await keyboard.pressKey(Key.ALT);
                        break;
                    case 'Meta':
                        await keyboard.pressKey(Key.META);
                        break;
                    case 'CapsLock':
                        await keyboard.pressKey(Key.CAPS_LOCK);
                        break;
                    case 'Delete':
                        await keyboard.pressKey(Key.DELETE);
                        break;
                    case 'Escape':
                        await keyboard.pressKey(Key.ESCAPE);
                        break;
                    case 'ArrowUp':
                        await keyboard.pressKey(Key.UP);
                        break;
                    case 'ArrowDown':
                        await keyboard.pressKey(Key.DOWN);
                        break;
                    case 'ArrowLeft':
                        await keyboard.pressKey(Key.LEFT);
                        break;
                    case 'ArrowRight':
                        await keyboard.pressKey(Key.RIGHT);
                        break;
                    default:
                        console.warn(`Unmapped special key: ${key}`);
                        if (specialKeyMap[key]) {
                            console.log(`Using fallback from map: ${specialKeyMap[key]}`);
                            await keyboard.pressKey(specialKeyMap[key]);
                        }
                }
            } else {
                // For regular characters, just type them
                if (key.length === 1) {
                    console.log(`Typing regular character: "${key}"`);
                    try {
                        await keyboard.type(key);
                    } catch (typeError) {
                        console.error(`Error typing character "${key}":`, typeError);
                        // Fallback method
                        try {
                            const keyObj = Key[key.toUpperCase()];
                            if (keyObj) {
                                console.log(`Using fallback key object: ${keyObj}`);
                                await keyboard.pressKey(keyObj);
                                await keyboard.releaseKey(keyObj);
                            } else {
                                console.error(`No fallback found for character "${key}"`);
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
            
            // Only release special keys
            if (isSpecial) {
                switch(key) {
                    case 'Enter':
                        await keyboard.releaseKey(Key.RETURN);
                        break;
                    case 'Backspace':
                        await keyboard.releaseKey(Key.BACKSPACE);
                        break;
                    case 'Tab':
                        await keyboard.releaseKey(Key.TAB);
                        break;
                    case 'Shift':
                        await keyboard.releaseKey(Key.SHIFT);
                        break;
                    case 'Control':
                        await keyboard.releaseKey(Key.CONTROL);
                        break;
                    case 'Alt':
                        await keyboard.releaseKey(Key.ALT);
                        break;
                    case 'Meta':
                        await keyboard.releaseKey(Key.META);
                        break;
                    case 'CapsLock':
                        await keyboard.releaseKey(Key.CAPS_LOCK);
                        break;
                    case 'Delete':
                        await keyboard.releaseKey(Key.DELETE);
                        break;
                    case 'Escape':
                        await keyboard.releaseKey(Key.ESCAPE);
                        break;
                    case 'ArrowUp':
                        await keyboard.releaseKey(Key.UP);
                        break;
                    case 'ArrowDown':
                        await keyboard.releaseKey(Key.DOWN);
                        break;
                    case 'ArrowLeft':
                        await keyboard.releaseKey(Key.LEFT);
                        break;
                    case 'ArrowRight':
                        await keyboard.releaseKey(Key.RIGHT);
                        break;
                    default:
                        console.warn(`Unmapped special key for release: ${key}`);
                        if (specialKeyMap[key]) {
                            console.log(`Using fallback from map for release: ${specialKeyMap[key]}`);
                            await keyboard.releaseKey(specialKeyMap[key]);
                        }
                }
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
            
            // Helper function to get the key object 
            const getKeyObject = (key) => {
                switch(key) {
                    case 'Enter': return Key.RETURN;
                    case 'Backspace': return Key.BACKSPACE;
                    case 'Tab': return Key.TAB;
                    case 'Shift': return Key.SHIFT;
                    case 'Control': return Key.CONTROL;
                    case 'Alt': return Key.ALT;
                    case 'Meta': return Key.META;
                    case 'CapsLock': return Key.CAPS_LOCK;
                    case 'Delete': return Key.DELETE;
                    case 'Escape': return Key.ESCAPE;
                    case 'ArrowUp': return Key.UP;
                    case 'ArrowDown': return Key.DOWN;
                    case 'ArrowLeft': return Key.LEFT;
                    case 'ArrowRight': return Key.RIGHT;
                    default: 
                        if (specialKeyMap[key]) {
                            return specialKeyMap[key];
                        }
                        return key; // For regular characters
                }
            };
            
            // Get mapped keys
            const modifierIndices = [];
            const keyObjects = [];
            
            // Map all keys and track modifiers
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                keyObjects.push(getKeyObject(key));
                
                // Track modifier keys (all except the last if it's a combo)
                if (i < keys.length - 1 && ['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                    modifierIndices.push(i);
                }
            }
            
            // Press all modifier keys first
            for (let i = 0; i < modifierIndices.length; i++) {
                await keyboard.pressKey(keyObjects[modifierIndices[i]]);
                console.log(`Pressed modifier: ${keys[modifierIndices[i]]}`);
            }
            
            // Press the main key (last key)
            const lastKey = keyObjects[keyObjects.length - 1];
            const lastKeyName = keys[keys.length - 1];
            
            if (typeof lastKey === 'string' && lastKey.length === 1) {
                console.log(`Typing character: ${lastKey}`);
                await keyboard.type(lastKey);
            } else {
                console.log(`Pressing key: ${lastKeyName}`);
                await keyboard.pressKey(lastKey);
                await keyboard.releaseKey(lastKey);
            }
            
            // Release modifier keys in reverse order
            for (let i = modifierIndices.length - 1; i >= 0; i--) {
                await keyboard.releaseKey(keyObjects[modifierIndices[i]]);
                console.log(`Released modifier: ${keys[modifierIndices[i]]}`);
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

