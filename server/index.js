// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('offer', (data) => {
//         socket.broadcast.emit('offer', data);
//     });

//     socket.on('answer', (data) => {
//         socket.broadcast.emit('answer', data);
//     });

//     socket.on('candidate', (data) => {
//         socket.broadcast.emit('candidate', data);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });

// server.listen(3000, () => {
//     console.log('Signaling server running on http://localhost:3000');
// });


// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const robot = require('robotjs');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('mouse-move', (data) => {
//         robot.moveMouse(data.x, data.y);
//     });

//     socket.on('mouse-click', () => {
//         robot.mouseClick();
//     });

//     socket.on('key-press', (key) => {
//         robot.keyTap(key);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });

// server.listen(3000, () => {
//     console.log('Signaling server running on http://localhost:3000');
// });


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const robot = require('robotjs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Add Express routes first
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Add this near your other routes
app.get('/test', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Enable CORS for Express
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const server = http.createServer(app);

// Socket.IO setup with updated configuration
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    path: '/socket.io/',
    serveClient: true
});

// Add this for debugging
io.engine.on("connection_error", (err) => {
    console.log('Connection error:', err.code, err.message, err.context);
});

let sessions = {}; // Stores { sessionID: { host, client } }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    socket.onAny((event, ...args) => {
        console.log(`Event: ${event}`, args);
    });

    socket.on('create-session', () => {
        const sessionID = uuidv4().split('-')[0]; // Short unique ID
        sessions[sessionID] = { host: socket.id, client: null };
        socket.emit('session-created', sessionID);
        console.log(`Session Created: ${sessionID}`);
    });

    socket.on('join-session', (sessionID) => {
        if (sessions[sessionID] && !sessions[sessionID].client) {
            sessions[sessionID].client = socket.id;
            io.to(sessions[sessionID].host).emit('client-connected', sessionID);
            socket.emit('session-joined', sessionID);
            console.log(`Client joined session: ${sessionID}`);
        } else {
            socket.emit('error', 'Invalid or already connected session.');
        }
    });

    socket.on('mouse-move', (data) => {
        if (!sessions[data.sessionID]) {
            console.error(`Session ID ${data.sessionID} does not exist.`);
            return; // Exit if the session does not exist
        }
        if (sessions[data.sessionID]?.host === socket.id) return; // Prevent host control
        io.to(sessions[data.sessionID].host).emit('mouse-move', data);
    });

    socket.on('mouse-click', (sessionID) => {
        if (!sessions[sessionID]) {
            console.error(`Session ID ${sessionID} does not exist.`);
            return; // Exit if the session does not exist
        }
        if (sessions[sessionID]?.host === socket.id) return; // Prevent host control
        io.to(sessions[sessionID].host).emit('mouse-click');
    });

    socket.on('key-press', (data) => {
        if (sessions[data.sessionID]?.host === socket.id) return;
        io.to(sessions[data.sessionID].host).emit('key-press', data.key);
    });

    socket.on('offer', (data) => {
        // Send offer only to the client in the specific session
        const targetSession = sessions[data.sessionID];
        if (targetSession && targetSession.client) {
            io.to(targetSession.client).emit('offer', data);
        }
    });

    socket.on('answer', (data) => {
        // Send answer only to the host in the specific session
        const targetSession = sessions[data.sessionID];
        if (targetSession && targetSession.host) {
            io.to(targetSession.host).emit('answer', data);
        }
    });

    socket.on('candidate', (data) => {
        // Send ICE candidate to the other peer in the session
        const targetSession = sessions[data.sessionID];
        if (targetSession) {
            const targetId = socket.id === targetSession.host ? 
                targetSession.client : targetSession.host;
            if (targetId) {
                io.to(targetId).emit('candidate', data);
            }
        }
    });

    socket.on('remote-control', (data) => {
        const targetSession = sessions[data.sessionID];
        if (targetSession) {
            // Forward the command to the host
            io.to(targetSession.host).emit('remote-control', data);
        }
    });

    socket.on('disconnect', () => {
        Object.keys(sessions).forEach((sessionID) => {
            if (sessions[sessionID].host === socket.id || sessions[sessionID].client === socket.id) {
                delete sessions[sessionID];
                console.log(`Session ${sessionID} ended`);
            }
        });
    });
});

// Start server
server.listen(3000, '0.0.0.0', () => {
    console.log('Signaling server running on http://192.168.29.83:3000');
});
