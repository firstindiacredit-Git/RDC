const { contextBridge, ipcRenderer } = require('electron');

// Add this debug log at the start
console.log('Preload script starting...');

contextBridge.exposeInMainWorld('electron', {
    getScreenSources: () => ipcRenderer.invoke('GET_SCREEN_SOURCES'),
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
});

// Add this to verify the API is exposed
console.log('Preload script completed. electron API should be available.');

// Add a check to ensure the preload script is running
console.log('Preload script loaded successfully');
