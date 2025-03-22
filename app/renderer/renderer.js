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

socket.on("client-connected", async (sessionID) => {
    try {
        const button = document.getElementById("start-session");
        button.disabled = true;
        button.textContent = "Starting screen share...";
        
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

        // Get screen sources from main process
        const sources = await window.electron.getScreenSources();
        console.log('Available sources:', sources);

        if (!sources || sources.length === 0) {
            throw new Error('No screen sources found');
        }

        // Get the first source
        const source = sources[0];
        console.log('Selected source:', source.id);

        // Request media stream
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

        // Display the stream
        const videoElement = document.getElementById('screen-share');
        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.play().catch(console.error);
            console.log('Stream attached to video element');
        }

        // Set up WebRTC
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // Add tracks to the peer connection
        stream.getTracks().forEach(track => {
            peerConnection.addTrack(track, stream);
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

        // Handle incoming WebRTC signals
        socket.on('answer', async (answer) => {
            await peerConnection.setRemoteDescription(answer);
        });

        socket.on('candidate', async (data) => {
            if (data.candidate) {
                await peerConnection.addIceCandidate(data.candidate);
            }
        });

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
