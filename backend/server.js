// server.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── MongoDB ────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://....';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema (qisqartirilgan)
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  photoUrl: String,
  coins: { type: Number, default: 1000 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  lastActive: Date
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ─── Game State ─────────────────────────────────────────────
const waitingQueue = [];                // [{userId, socket, name, ...}]
const activeGames = new Map();          // gameId → game object
const playerConnections = new Map();    // userId → socket

// ─── WebSocket ──────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('New WS connection');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'register':
          playerConnections.set(data.userId, ws);
          await updateUser(data);
          ws.send(JSON.stringify({ type: 'registered', userId: data.userId }));
          break;

        case 'join_multiplayer':
          await handleJoinMultiplayer(ws, data);
          break;

        case 'make_choice':
          await handlePlayerChoice(ws, data);
          break;

        case 'leave_game':
        case 'disconnect':
          handlePlayerDisconnect(ws, data?.userId);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    handlePlayerDisconnect(ws);
  });
});

// ─── Multiplayer Logic ──────────────────────────────────────

async function handleJoinMultiplayer(ws, data) {
  const { userId, firstName, username } = data;

  // Already in game?
  for (const game of activeGames.values()) {
    if (game.player1?.id === userId || game.player2?.id === userId) {
      ws.send(JSON.stringify({ type: 'error', msg: 'Siz allaqachon oʻyindasiz' }));
      return;
    }
  }

  // Already in queue?
  if (waitingQueue.some(p => p.userId === userId)) {
    ws.send(JSON.stringify({ type: 'already_waiting' }));
    return;
  }

  waitingQueue.push({ userId, socket: ws, firstName, username });

  ws.send(JSON.stringify({ type: 'searching_opponent' }));

  tryMatchPlayers();
}

function tryMatchPlayers() {
  while (waitingQueue.length >= 2) {
    const p1 = waitingQueue.shift();
    const p2 = waitingQueue.shift();

    const gameId = `g_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

    const game = {
      gameId,
      player1: { id: p1.userId, name: p1.firstName || p1.username, choice: null, ready: false },
      player2: { id: p2.userId, name: p2.firstName || p2.username, choice: null, ready: false },
      status: 'countdown',
      created: Date.now(),
      timer: null,
      result: null
    };

    activeGames.set(gameId, game);

    // Notify both players
    const msg = {
      type: 'match_found',
      gameId,
      opponent: game.player1.id === p1.userId ? game.player2 : game.player1,
      youAre: game.player1.id === p1.userId ? 'player1' : 'player2'
    };

    if (p1.socket.readyState === WebSocket.OPEN) p1.socket.send(JSON.stringify(msg));
    if (p2.socket.readyState === WebSocket.OPEN) p2.socket.send(JSON.stringify(msg));

    startCountdown(gameId);
  }
}

function startCountdown(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  let sec = 5;
  game.timer = setInterval(() => {
    sec--;
    broadcast(gameId, { type: 'countdown', seconds: sec });

    if (sec <= 0) {
      clearInterval(game.timer);
      game.status = 'playing';
      broadcast(gameId, { type: 'game_start' });
      startChoicePhase(gameId);
    }
  }, 1000);
}

function startChoicePhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  let time = 25;
  game.timer = setInterval(() => {
    time--;
    broadcast(gameId, { type: 'time_left', seconds: time });

    if (time <= 0) {
      clearInterval(game.timer);
      finishGame(gameId, 'timeout');
    }
  }, 1000);
}

async function handlePlayerChoice(ws, data) {
  const { userId, gameId, choice } = data;
  const game = activeGames.get(gameId);
  if (!game || game.status !== 'playing') return;

  if (game.player1.id === userId) {
    game.player1.choice = choice;
  } else if (game.player2.id === userId) {
    game.player2.choice = choice;
  } else return;

  broadcast(gameId, {
    type: 'choice_made',
    by: userId === game.player1.id ? 'player1' : 'player2'
  });

  if (game.player1.choice && game.player2.choice) {
    clearInterval(game.timer);
    await finishGame(gameId);
  }
}

async function finishGame(gameId, reason = 'normal') {
  const game = activeGames.get(gameId);
  if (!game) return;

  let result;

  if (reason === 'timeout') {
    result = 'timeout';
  } else if (game.player1.choice === game.player2.choice) {
    result = 'draw';
  } else if (
    (game.player1.choice === 'rock' && game.player2.choice === 'scissors') ||
    (game.player1.choice === 'paper' && game.player2.choice === 'rock') ||
    (game.player1.choice === 'scissors' && game.player2.choice === 'paper')
  ) {
    result = 'p1_win';
  } else {
    result = 'p2_win';
  }

  game.result = result;
  game.status = 'finished';

  broadcast(gameId, {
    type: 'game_result',
    result,
    choices: {
      p1: game.player1.choice,
      p2: game.player2.choice
    }
  });

  // TODO: update coins, stats in MongoDB

  setTimeout(() => activeGames.delete(gameId), 10000);
}

function broadcast(gameId, message) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const payload = JSON.stringify(message);

  const s1 = playerConnections.get(game.player1.id);
  const s2 = playerConnections.get(game.player2.id);

  if (s1?.readyState === WebSocket.OPEN) s1.send(payload);
  if (s2?.readyState === WebSocket.OPEN) s2.send(payload);
}

function handlePlayerDisconnect(ws, userIdFromMsg) {
  let userId;

  for (const [uid, socket] of playerConnections.entries()) {
    if (socket === ws) {
      userId = uid;
      playerConnections.delete(uid);
      break;
    }
  }

  if (!userId) userId = userIdFromMsg;

  // remove from queue
  const qIndex = waitingQueue.findIndex(p => p.userId === userId);
  if (qIndex !== -1) waitingQueue.splice(qIndex, 1);

  // check active games
  for (const [gameId, game] of activeGames.entries()) {
    if (game.player1.id === userId || game.player2.id === userId) {
      broadcast(gameId, { type: 'opponent_left' });
      clearInterval(game.timer);
      activeGames.delete(gameId);
    }
  }
}

// ─── Telegram Bot (minimal) ────────────────────────────────

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const { id, first_name, username } = msg.from;
  bot.sendMessage(msg.chat.id, `Salom ${first_name}! 🎮`, {
    reply_markup: {
      inline_keyboard: [[
        { text: "O'ynash", web_app: { url: process.env.WEBAPP_URL } }
      ]]
    }
  });
});

// ─── Express ────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok', games: activeGames.size }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});