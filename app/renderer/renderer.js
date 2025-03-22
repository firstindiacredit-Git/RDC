const socket = io('http://192.168.29.83:3000', {
    reconnectionAttempts: 5,
    timeout: 20000,
    transports: ['polling', 'websocket'],
    secure: false,
    rejectUnauthorized: false,
});

let isConnected = false;
let reconnectAttempts = 0;

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

socket.on("session-joined", (sessionID) => {
    alert(`Connected to session: ${sessionID}`);
});

socket.on("client-connected", (sessionID) => {
    startScreenShare(sessionID);
});

// Add this at the start of your file to verify the electron API is available
console.log('Checking electron API availability:', !!window.electron);

async function startScreenShare(sessionID) {
    try {
        console.log('Starting screen share...');
        
        // Verify electron API is available
        if (!window.electron) {
            throw new Error('Electron API not available');
        }

        if (!window.electron.getSources) {
            throw new Error('getSources method not available');
        }

        const sources = await window.electron.getSources();
        console.log('Available sources:', sources);

        if (!sources || sources.length === 0) {
            throw new Error('No screen sources found');
        }

        const source = sources[0]; // Get the first source
        console.log('Selected source:', source.id);

        const stream = await navigator.mediaDevices.getUserMedia({
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

        const videoElement = document.getElementById('screen-share');
        if (videoElement) {
            videoElement.srcObject = stream;
            console.log('Stream attached to video element');
        }

        const peer = new RTCPeerConnection();
        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('candidate', { sessionID, candidate: event.candidate });
            }
        };

        socket.on('offer', async (offer) => {
            await peer.setRemoteDescription(offer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('answer', { sessionID, answer });
        });

        socket.on('candidate', async (data) => {
            await peer.addIceCandidate(data.candidate);
        });

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('offer', { sessionID, offer });
    } catch (error) {
        console.error('Error in startScreenShare:', error);
        alert(`Failed to start screen sharing: ${error.message}`);
    }
}

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

document.addEventListener("keydown", (event) => {
    const sessionID = document.getElementById("session-id").innerText;
    socket.emit("key-press", { sessionID, key: event.key });
});
