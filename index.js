const http = require('http');
const path = require('path');
const express = require('express');
const ws = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });
let activeCellIndex = null;
let activeRound = 0;
let nextPlayerId = 1;

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

let waitingplayers = [];

wss.on('connection', (socket) => {
    if (waitingplayers.length > 0) {
        const opponent = waitingplayers.shift();
        // Implement game logic for two players
    }

    waitingplayers.push(socket);
    console.log('Client connected');
    socket.playerId = nextPlayerId++;
    socket.score = 0;
    socket.lastScoredRound = 0;
    socket.send(JSON.stringify({ action: 'playerAssigned', playerId: socket.playerId }));
    broadcastPlayerScores();

    socket.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        } catch (error) {
            console.error('Received invalid WebSocket message:', error.message);
            return;
        }

        if (data.action === 'cellClicked') {
            if (!Number.isInteger(data.cellIndex) || data.cellIndex < 0 || data.cellIndex >= 36) {
                return;
            }

            if (data.cellIndex === activeCellIndex && socket.lastScoredRound !== activeRound) {
                socket.score += 1;
                socket.lastScoredRound = activeRound;
                broadcastPlayerScores();
                console.log(`Cell ${data.cellIndex} hit. Player score: ${socket.score}`);
            }
        }
    });

    socket.on('close', () => {
        broadcastPlayerScores();
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
            client.send(message);
        }
    });
}

function broadcastPlayerScores() {
    const players = Array.from(wss.clients)
        .filter((client) => client.readyState === ws.OPEN && Number.isInteger(client.playerId))
        .map((client) => ({
            playerId: client.playerId,
            score: client.score
        }));

    broadcast({ action: 'playersUpdate', players });
}

setInterval(() => {
    const cellIndex = Math.floor(Math.random() * 36);
    activeCellIndex = cellIndex;
    activeRound += 1;
    const round = activeRound;
    broadcast({ action: 'highlightCell', cellIndex });

    setTimeout(() => {
        if (activeRound !== round) return;
        activeCellIndex = null;
        broadcast({ action: 'clearCell', cellIndex });
    }, 1000);
}, 3000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server is running on http://localhost:${PORT}`);
});