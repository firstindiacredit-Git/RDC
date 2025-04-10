const { app, BrowserWindow, desktopCapturer, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const robot = require('robotjs');

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

    // Mouse control with RobotJS
    ipcMain.handle('MOUSE_MOVE', async (event, { x, y }) => {
        try {
            // Set the mouse position directly to absolute coordinates
            console.log(`Setting mouse position to: ${x}, ${y}`);
            robot.moveMouse(x, y);
            return { success: true };
        } catch (error) {
            console.error('Mouse move error:', error);
            return { success: false, error: error.message };
        }
    });

    // Mouse scrolling with RobotJS
    ipcMain.handle('MOUSE_SCROLL', async (event, { deltaY }) => {
        try {
            console.log(`Mouse scroll: deltaY=${deltaY}`);
            
            // Calculate scroll amount
            const scrollAmount = Math.min(Math.abs(Math.ceil(deltaY / 5)), 10);
            
            if (deltaY > 0) {
                robot.scrollMouse(0, -scrollAmount); // RobotJS scrolls in opposite direction
            } else {
                robot.scrollMouse(0, scrollAmount);
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
                robot.mouseClick(button, true);
            } else {
                robot.mouseClick(button);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Mouse click error:', error);
            return { success: false, error: error.message };
        }
    });

    // Special key mapping for RobotJS
    const specialKeyMap = {
        'Enter': 'enter',
        'Backspace': 'backspace',
        'Tab': 'tab',
        'Shift': 'shift',
        'Control': 'control',
        'Alt': 'alt',
        'Meta': 'command', // or 'win' on Windows
        'CapsLock': 'capslock',
        'Delete': 'delete',
        'Escape': 'escape',
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'Home': 'home',
        'End': 'end',
        'PageUp': 'pageup',
        'PageDown': 'pagedown',
        'Insert': 'insert',
        'F1': 'f1',
        'F2': 'f2',
        'F3': 'f3',
        'F4': 'f4',
        'F5': 'f5',
        'F6': 'f6',
        'F7': 'f7',
        'F8': 'f8',
        'F9': 'f9',
        'F10': 'f10',
        'F11': 'f11',
        'F12': 'f12',
        ' ': 'space'
    };

    // Key press handler with RobotJS
    ipcMain.handle('KEY_PRESS', async (event, { key, isSpecial }) => {
        try {
            console.log(`Key press: ${key}, isSpecial: ${isSpecial}`);
            
            if (isSpecial) {
                // Handle special keys
                if (specialKeyMap[key]) {
                    console.log(`Pressing special key: ${key} -> ${specialKeyMap[key]}`);
                    robot.keyToggle(specialKeyMap[key], 'down');
                    
                    // For backspace, we need to press and release quickly
                    if (key === 'Backspace') {
                        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
                        robot.keyToggle(specialKeyMap[key], 'up');
                    }
                } else {
                    console.warn(`Unmapped special key: ${key}`);
                }
            } else {
                // For regular characters, just type them
                if (key.length === 1) {
                    robot.typeString(key);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key press error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key release handler with RobotJS
    ipcMain.handle('KEY_RELEASE', async (event, { key }) => {
        try {
            console.log(`Key release: ${key}`);
            
            // Only release special keys
            if (specialKeyMap[key]) {
                robot.keyToggle(specialKeyMap[key], 'up');
            }
            
            return { success: true };
        } catch (error) {
            console.error('Key release error:', error);
            return { success: false, error: error.message };
        }
    });

    // Key combo handler with RobotJS
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
                    robot.keyToggle(key.toLowerCase(), 'down');
                } else {
                    // For special keys
                    robot.keyToggle(key, 'down');
                }
            }
            
            // Release all keys in reverse order
            for (let i = keyObjects.length - 1; i >= 0; i--) {
                const key = keyObjects[i];
                if (typeof key === 'string' && key.length === 1) {
                    robot.keyToggle(key.toLowerCase(), 'up');
                } else {
                    robot.keyToggle(key, 'up');
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

// Update remote-control handler
socket.on('remote-control', async (data) => {
    try {
        switch (data.type) {
            case 'mouse-move':
                await window.electron.sendMouseMove(data.data.x, data.data.y);
                break;
            case 'mouse-click':
                console.log('Mouse click:', data.data.button);
                await window.electron.sendMouseClick(data.data.button || 'left', false);
                break;
            case 'mouse-scroll':
                console.log('Mouse scroll: deltaY =', data.data.deltaY);
                await window.electron.sendMouseScroll(data.data.deltaY);
                break;
            case 'key-press':
                console.log('Processing key press:', data.data.key, 'isSpecial:', data.data.isSpecial);
                if (data.data.isSpecial) {
                    // For special keys like backspace
                    await window.electron.sendKeyPress(data.data.key, true);
                } else {
                    // For regular keys
                    await window.electron.sendKeyPress(data.data.key, false);
                }
                break;
            case 'key-release':
                console.log('Processing key release:', data.data.key);
                await window.electron.sendKeyRelease(data.data.key);
                break;
            case 'execute-command':
                await window.electron.executeCommand(data.data.command);
                break;
        }
    } catch (error) {
        console.error('Error executing remote control command:', error);
        console.error('Error details:', error.message);
    }
});
