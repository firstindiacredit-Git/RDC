const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Add this debug log at the start
console.log('Preload script starting...');

// Verify desktopCapturer is available
if (!desktopCapturer) {
    console.error('desktopCapturer is not available in preload');
}

contextBridge.exposeInMainWorld(
    'electron',
    {
        getSources: () => {
            console.log('getSources called from preload');
            return desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 1920, height: 1080 }
            }).catch(error => {
                console.error('Error in getSources:', error);
                throw error;
            });
        },
        send: (channel, data) => {
            ipcRenderer.send(channel, data);
        },
        receive: (channel, func) => {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
);

// Add this to verify the API is exposed
console.log('Preload script completed. electron API should be available.');

// Add a check to ensure the preload script is running
console.log('Preload script loaded successfully');

console.log('desktopCapturer:', desktopCapturer); // Debugging line
