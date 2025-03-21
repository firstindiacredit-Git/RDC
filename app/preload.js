const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getSources: async () => {
        try {
            if (!desktopCapturer) {
                throw new Error('desktopCapturer is not available');
            }
            return await desktopCapturer.getSources({ types: ['screen'] });
        } catch (error) {
            console.error('Error getting sources:', error);
            return [];
        }
    },
    send: (channel, data) => {
        try {
            ipcRenderer.send(channel, data);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    },
    receive: (channel, callback) => {
        try {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        } catch (error) {
            console.error('Error setting up receiver:', error);
        }
    }
});

// Add a check to ensure the preload script is running
console.log('Preload script loaded successfully');

console.log('desktopCapturer:', desktopCapturer); // Debugging line
