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

// Track pressed keys
const pressedKeys = new Set();

// Special keys that need different handling
const specialKeys = new Set([
    'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Enter', 'Backspace', 'CapsLock'
]);

// Track active modifier keys
const activeModifiers = new Set();

// Function to check if a key is a modifier
const isModifierKey = (key) => ['Shift', 'Control', 'Alt', 'Meta'].includes(key);

// Function to send key events
const sendKeyEvent = (type, key, isSpecial) => {
    // Don't process if key is already pressed for press events
    if (type === 'press' && pressedKeys.has(key)) {
        return;
    }
    
    // Don't process if key wasn't pressed for release events
    if (type === 'release' && !pressedKeys.has(key)) {
        return;
    }
    
    // Update pressed keys state
    if (type === 'press') {
        pressedKeys.add(key);
    } else {
        pressedKeys.delete(key);
    }
    
    // Send the event
    if (type === 'press') {
        window.electron.sendKeyPress(key, isSpecial);
    } else {
        window.electron.sendKeyRelease(key, isSpecial);
    }
};

// Handle keydown events
document.addEventListener('keydown', (event) => {
    // Ignore keydown events if the key is already pressed
    if (pressedKeys.has(event.key)) {
        return;
    }

    const key = event.key;
    const isSpecial = specialKeys.has(key);
    
    // Prevent default for special keys
    if (isSpecial) {
        event.preventDefault();
    }
    
    // Update modifier state
    if (isModifierKey(key)) {
        activeModifiers.add(key);
    }
    
    // Send key press for all keys except session ID input
    if (!event.target.matches('#join-session-id')) {
        sendKeyEvent('press', key, isSpecial);
    }
});

// Handle keyup events
document.addEventListener('keyup', (event) => {
    const key = event.key;
    const isSpecial = specialKeys.has(key);
    
    // Prevent default for special keys
    if (isSpecial) {
        event.preventDefault();
    }
    
    // Update modifier state
    if (isModifierKey(key)) {
        activeModifiers.delete(key);
    }
    
    // Send key release for all keys except session ID input
    if (!event.target.matches('#join-session-id')) {
        sendKeyEvent('release', key, isSpecial);
    }
});

// Handle session ID input
const sessionIdInput = document.getElementById('join-session-id');
if (sessionIdInput) {
    sessionIdInput.addEventListener('keydown', (event) => {
        // Allow numbers, letters, and backspace
        if (!/^[a-zA-Z0-9]$/.test(event.key) && event.key !== 'Backspace') {
            event.preventDefault();
        }
    });
}

// Handle window blur to clean up key states
window.addEventListener('blur', () => {
    // Release all pressed keys when window loses focus
    const keysToRelease = Array.from(pressedKeys);
    keysToRelease.forEach(key => {
        const isSpecial = specialKeys.has(key);
        window.electron.sendKeyRelease(key, isSpecial);
    });
    pressedKeys.clear();
    activeModifiers.clear();
});

// Handle window focus to reset key states
window.addEventListener('focus', () => {
    pressedKeys.clear();
    activeModifiers.clear();
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
                await window.electron.sendMouseClick(data.data.button || 'left', false);
                break;
            case 'mouse-scroll':
                await window.electron.sendMouseScroll(data.data.deltaY);
                break;
            case 'key-press':
                await window.electron.sendKeyPress(data.data.key, data.data.isSpecial);
                break;
            case 'key-release':
                await window.electron.sendKeyRelease(data.data.key, data.data.isSpecial);
                break;
        }
    } catch (error) {
        console.error('Error executing remote control command:', error);
    }
});





