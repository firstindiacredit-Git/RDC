const { contextBridge, ipcRenderer } = require('electron');

// Add this debug log at the start
console.log('Preload script starting...');

contextBridge.exposeInMainWorld('electron', {
    getScreenSources: () => ipcRenderer.invoke('GET_SCREEN_SOURCES'),
    createFile: (path, content) => ipcRenderer.invoke('CREATE_FILE', { path, content }),
    readFile: (path) => ipcRenderer.invoke('READ_FILE', path),
    writeFile: (path, content) => ipcRenderer.invoke('WRITE_FILE', { path, content }),
    deleteFile: (path) => ipcRenderer.invoke('DELETE_FILE', path),
    listFiles: (path) => ipcRenderer.invoke('LIST_FILES', path),
    executeCommand: (command) => ipcRenderer.invoke('EXECUTE_COMMAND', command),
    openApp: (appName) => ipcRenderer.invoke('OPEN_APP', appName),
    readClipboard: () => ipcRenderer.invoke('READ_CLIPBOARD'),
    writeClipboard: (text) => ipcRenderer.invoke('WRITE_CLIPBOARD', text),
    sendMouseClick: (button, double) => ipcRenderer.invoke('MOUSE_CLICK', { button, double }),
    sendMouseMove: (x, y) => ipcRenderer.invoke('MOUSE_MOVE', { x, y }),
    sendKeyPress: (key) => ipcRenderer.invoke('KEY_PRESS', key),
    sendKeyCombo: (keys) => ipcRenderer.invoke('KEY_COMBO', keys),
    minimizeWindow: () => ipcRenderer.invoke('MINIMIZE_WINDOW'),
    maximizeWindow: () => ipcRenderer.invoke('MAXIMIZE_WINDOW'),
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
    send: (channel, data) => ipcRenderer.send(channel, data),
});

// Add this to verify the API is exposed
console.log('Preload script completed. electron API should be available.');

// Add a check to ensure the preload script is running
console.log('Preload script loaded successfully');
