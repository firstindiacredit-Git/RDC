const socket = io('http://192.168.29.140:3000', {
    reconnectionAttempts: 5,
    timeout: 20000,
    transports: ['polling', 'websocket'],
    secure: false,
    rejectUnauthorized: false,
});

let isConnected = false;
let reconnectAttempts = 0;
let peerConnection;
let localStream;
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    console.log('Transport:', socket.io.engine.transport.name);
    isConnected = true;
    reconnectAttempts = 0;
    document.getElementById('session-id').innerText = socket.id;
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    isConnected = false;
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Failed to connect to the server. Please ensure the server is running.');
    console.log('Error details:', error);
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}`);
    
    if (socket.io.engine) {
        console.log('Current transport:', socket.io.engine.transport.name);
    }
});

// Add retry logic with exponential backoff
setInterval(() => {
    if (!isConnected) {
        const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        console.log(`Attempting to reconnect in ${backoffTime}ms...`);
        setTimeout(() => {
            console.log('Attempting reconnection...');
            socket.connect();
        }, backoffTime);
    }
}, 5000);

// Test connection immediately
socket.connect();

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById("start-session");
    const joinButton = document.getElementById("join-session");
    const sessionIdSpan = document.getElementById("session-id");
    const joinSessionInput = document.getElementById("join-session-id");

    console.log('Elements found:', {
        startButton: !!startButton,
        joinButton: !!joinButton,
        sessionIdSpan: !!sessionIdSpan,
        joinSessionInput: !!joinSessionInput
    });

    if (startButton) {
        startButton.addEventListener("click", () => {
            console.log('Requesting session creation...');
            socket.emit("create-session");
        });
    }

    // ... rest of your event listeners
});

socket.on("session-created", (sessionID) => {
    console.log('Session created:', sessionID);
    document.getElementById("session-id").innerText = sessionID;
});

// Add error event handler
socket.on('error', (error) => {
    console.error('Socket error:', error);
    alert('Error: ' + error);
});

document.getElementById("join-session").addEventListener("click", () => {
    const sessionID = document.getElementById("join-session-id").value;
    socket.emit("join-session", sessionID);
});

socket.on("session-joined", async (sessionID) => {
    try {
        // This PC is the client (viewing screen)
        console.log('Joined session, setting up viewer...');
        
        // Add fullscreen mode
        document.body.classList.add('in-session');
        document.getElementById('current-session-id').textContent = `Session: ${sessionID}`;
        
        // Create peer connection for receiving
        peerConnection = new RTCPeerConnection(configuration);
        
        // Set up video element for remote stream
        const videoElement = document.getElementById('screen-share');
        
        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            if (videoElement.srcObject !== event.streams[0]) {
                videoElement.srcObject = event.streams[0];
                console.log('Set remote stream to video element');
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('candidate', { sessionID, candidate: event.candidate });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = (event) => {
            console.log('Connection state:', peerConnection.connectionState);
        };

    } catch (error) {
        console.error('Error setting up viewer:', error);
        alert(`Failed to set up viewer: ${error.message}`);
    }
});

socket.on("client-connected", async (sessionID) => {
    try {
        const button = document.getElementById("start-session");
        button.disabled = true;
        button.textContent = "Starting screen share...";
        
        // This PC is the host (sharing screen)
        await startScreenShare(sessionID);
        
        button.textContent = "Screen sharing active";
    } catch (error) {
        console.error('Failed to start screen sharing:', error);
        button.disabled = false;
        button.textContent = "Start Remote Access";
        alert(`Failed to start screen sharing: ${error.message}`);
    }
});

// Add this at the start of your file to verify the electron API is available
console.log('Checking electron API availability:', !!window.electron);

async function startScreenShare(sessionID) {
    try {
        console.log('Starting screen share...');
        
        if (!window.electron?.getScreenSources) {
            throw new Error('Screen capture API not available');
        }

        const sources = await window.electron.getScreenSources();
        console.log('Available sources:', sources);

        if (!sources || sources.length === 0) {
            throw new Error('No screen sources found');
        }

        const source = sources[0];
        console.log('Selected source:', source.id);

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id,
                    minWidth: 1280,
                    maxWidth: 1920,
                    minHeight: 720,
                    maxHeight: 1080
                }
            }
        });

        // Create peer connection for sending
        peerConnection = new RTCPeerConnection(configuration);
        
        // Add tracks to the peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('candidate', { sessionID, candidate: event.candidate });
            }
        };

        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { sessionID, offer });
        
        console.log('Sent offer to client');
    } catch (error) {
        console.error('Error in startScreenShare:', error);
        throw error;
    }
}

// Update WebRTC signal handlers
socket.on('offer', async (data) => {
    try {
        if (!peerConnection) {
            console.error('No peer connection available');
            return;
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { sessionID: data.sessionID, answer });
        
        console.log('Sent answer to host');
    } catch (error) {
        console.error('Error handling offer:', error);
    }
});

socket.on('answer', async (data) => {
    try {
        if (!peerConnection) {
            console.error('No peer connection available');
            return;
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('Set remote description from answer');
    } catch (error) {
        console.error('Error handling answer:', error);
    }
});

socket.on('candidate', async (data) => {
    try {
        if (!peerConnection) {
            console.error('No peer connection available');
            return;
        }
        
        if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('Added ICE candidate');
        }
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
});

// Clean up function
function cleanupConnection() {
    document.body.classList.remove('in-session');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Add cleanup on window unload
window.addEventListener('beforeunload', cleanupConnection);

// Handle Remote Control Events
document.addEventListener("mousemove", (event) => {
    const sessionID = document.getElementById("session-id").innerText;
    if (sessionID) {
        socket.emit("mouse-move", { sessionID, x: event.clientX, y: event.clientY });
    } else {
        console.error("No session ID found.");
    }
});

document.addEventListener("click", () => {
    const sessionID = document.getElementById("session-id").innerText;
    if (sessionID) {
        socket.emit("mouse-click", sessionID);
    } else {
        console.error("No session ID found.");
    }
});

// Track pressed keys to prevent double typing
const pressedKeys = new Set();

// Special keys that need different handling
const specialKeys = new Set([
    'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 
    'Tab', 'Enter', 'Backspace', 'Delete', 'Escape',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown', 'Insert',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 
    'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

document.addEventListener('keydown', (event) => {
    const sessionID = document.getElementById('join-session-id').value;
    if (!sessionID) return;

    // Prevent default for special keys
    if (specialKeys.has(event.key)) {
        event.preventDefault();
    }

    // If the key is already pressed, ignore it (prevents double typing)
    if (pressedKeys.has(event.key)) {
        return;
    }

    // Add the key to pressed keys
    pressedKeys.add(event.key);

    console.log('Key down:', event.key, 'Code:', event.code);

    socket.emit('remote-control', {
        sessionID,
        type: 'key-press',
        data: { 
            key: event.key,
            code: event.code,
            isSpecial: specialKeys.has(event.key)
        }
    });
});

document.addEventListener('keyup', (event) => {
    const sessionID = document.getElementById('join-session-id').value;
    if (!sessionID) return;

    // Remove the key from pressed keys
    pressedKeys.delete(event.key);

    // Only emit keyup for special keys
    if (specialKeys.has(event.key)) {
        socket.emit('remote-control', {
            sessionID,
            type: 'key-release',
            data: { key: event.key, code: event.code }
        });
    }
});

// Improved mouse movement handling
async function handleRemoteControl(event, sessionID) {
    try {
        // Get the video element and its dimensions
        const videoElement = document.getElementById('screen-share');
        const rect = videoElement.getBoundingClientRect();
        
        // Calculate position within the video element
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Get the actual dimensions of the video content (might differ from element size)
        const videoWidth = videoElement.videoWidth || rect.width;
        const videoHeight = videoElement.videoHeight || rect.height;
        
        // Calculate relative position (0-1)
        const relativeX = x / rect.width;
        const relativeY = y / rect.height;
        
        // Use fixed screen resolution for host (e.g., 1920x1080)
        // If you know the actual resolution, use that instead
        const targetWidth = 1920;  // Estimated target screen width
        const targetHeight = 1080; // Estimated target screen height
        
        // Calculate absolute position on target screen
        const absoluteX = Math.round(relativeX * targetWidth);
        const absoluteY = Math.round(relativeY * targetHeight);
        
        // Add a small log for debugging
        console.log(`Mouse coords: rel(${relativeX.toFixed(2)}, ${relativeY.toFixed(2)}) -> abs(${absoluteX}, ${absoluteY})`);
        
        socket.emit('remote-control', {
            sessionID,
            type: 'mouse-move',
            data: { x: absoluteX, y: absoluteY }
        });
    } catch (error) {
        console.error('Error in remote control:', error);
    }
}

// Make sure we have throttling to prevent too many mouse events
let lastMouseMoveTime = 0;
const MOUSE_MOVE_THROTTLE = 16; // ~60fps (1000ms / 60)

document.getElementById('screen-share').addEventListener('mousemove', (event) => {
    const now = Date.now();
    
    // Throttle mouse move events to avoid overwhelming the connection
    if (now - lastMouseMoveTime >= MOUSE_MOVE_THROTTLE) {
        lastMouseMoveTime = now;
        const sessionID = document.getElementById('join-session-id').value;
        handleRemoteControl(event, sessionID);
    }
});

document.getElementById('screen-share').addEventListener('click', async (event) => {
    const sessionID = document.getElementById('join-session-id').value;
    socket.emit('remote-control', {
        sessionID,
        type: 'mouse-click',
        data: { button: 'left' }
    });
});

// राइट क्लिक के लिए इवेंट लिसनर जोड़ें
document.getElementById('screen-share').addEventListener('contextmenu', async (event) => {
    event.preventDefault(); // ब्राउज़र का डिफॉल्ट कांटेक्स्ट मेनू नहीं दिखाने के लिए
    const sessionID = document.getElementById('join-session-id').value;
    socket.emit('remote-control', {
        sessionID,
        type: 'mouse-click',
        data: { button: 'right' }
    });
});

// Improved wheel event listener
document.getElementById('screen-share').addEventListener('wheel', async (event) => {
    event.preventDefault(); // Prevent default browser scrolling
    const sessionID = document.getElementById('join-session-id').value;
    
    // Send raw deltaY to give more natural scrolling feel
    socket.emit('remote-control', {
        sessionID,
        type: 'mouse-scroll',
        data: { deltaY: event.deltaY }
    });
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
                console.log('Processing key press:', data.data.key);
                await window.electron.sendKeyPress(data.data.key, data.data.isSpecial);
                break;
            case 'key-combo':
                console.log('Processing key combo:', data.data.keys);
                await window.electron.sendKeyCombo(data.data.keys);
                break;
            case 'key-release':
                console.log('Processing key release:', data.data.key);
                await window.electron.sendKeyRelease(data.data.key);
                break;
            case 'execute-command':
                await window.electron.executeCommand(data.data.command);
                break;
            // Add more cases as needed
        }
    } catch (error) {
        console.error('Error executing remote control command:', error);
        console.error('Error details:', error.message);
    }
});

// Add exit fullscreen handler
document.getElementById('exit-fullscreen').addEventListener('click', () => {
    document.body.classList.remove('in-session');
    cleanupConnection();
    socket.disconnect();
    location.reload(); // पेज को रीफ्रेश करें
});

// ESC key handler
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('in-session')) {
        document.getElementById('exit-fullscreen').click();
    }
});





