/**
 * Tosh-Qaychi-Qog'oz Multiplayer Server
 * Telegram Mini App + WebSocket + MongoDB
 * 
 * @version 1.1.0
 * @date 2026-01
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-mini-app-domain.com';

// ==================== DATABASE ====================
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas (minimal working version)
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  gameStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
  },
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  player1: { id: Number, username: String, firstName: String, choice: String },
  player2: { id: Number, username: String, firstName: String, choice: String },
  status: { type: String, default: 'waiting' }, // waiting | playing | finished
  result: String, // draw | player1_win | player2_win | timeout
  winnerId: Number,
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);

// ==================== IN-MEMORY STATE ====================
const matchmakingQueue = [];           // [{ userId, socket, username, firstName }]
const activeGames = new Map();          // gameId → game object
const playerSockets = new Map();        // userId → WebSocket

// ==================== TELEGRAM BOT ====================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const { id, first_name, username } = msg.from;

  await User.findOneAndUpdate(
    { telegramId: id },
    { telegramId: id, firstName: first_name, username },
    { upsert: true, new: true }
  );

  bot.sendMessage(msg.chat.id, `Assalomu alaykum, ${first_name}! 👋\nTosh-Qaychi-Qog‘oz o‘yinini boshlash uchun quyidagi tugmani bosing:`, {
    reply_markup: {
      inline_keyboard: [[{ text: "🎮 O‘ynash", web_app: { url: WEB_APP_URL } }]]
    },
    parse_mode: 'HTML'
  });
});

// ==================== WEBSOCKET SERVER ====================
wss.on('connection', (ws) => {
  console.log('[WS] New connection established');

  let authenticatedUserId = null;

  ws.on('message', async (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());

      // 1. Register – user identifikatsiyasi
      if (data.type === 'register') {
        if (!data.userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'userId talab qilinadi' }));
          return;
        }
        authenticatedUserId = data.userId;
        playerSockets.set(authenticatedUserId, ws);
        ws.send(JSON.stringify({ type: 'registered', userId: authenticatedUserId }));
        return;
      }

      // Auth tekshiruvi (registerdan keyin)
      if (!authenticatedUserId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Avval register qiling' }));
        return;
      }

      await handleMessage(ws, data, authenticatedUserId);
    } catch (err) {
      console.error('[WS] Message parse error:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Connection closed | user: ${authenticatedUserId} | code: ${code}`);

    // Navbatdan chiqarish
    const queueIndex = matchmakingQueue.findIndex(p => p.userId === authenticatedUserId);
    if (queueIndex !== -1) matchmakingQueue.splice(queueIndex, 1);

    playerSockets.delete(authenticatedUserId);

    // O‘yindagi raqibga xabar berish
    for (const [gameId, game] of activeGames.entries()) {
      if (game.player1?.id === authenticatedUserId || game.player2?.id === authenticatedUserId) {
        const opponentId = game.player1?.id === authenticatedUserId ? game.player2?.id : game.player1?.id;
        const opponentWs = playerSockets.get(opponentId);

        if (opponentWs?.readyState === WebSocket.OPEN) {
          opponentWs.send(JSON.stringify({
            type: 'opponent_disconnected',
            gameId,
            message: 'Raqib uzildi. O‘yin yakunlandi.'
          }));
        }

        activeGames.delete(gameId);
        break;
      }
    }
  });
});

/**
 * Asosiy xabarlar protsessori
 */
async function handleMessage(ws, data, userId) {
  switch (data.type) {
    case 'join_queue': {
      if (matchmakingQueue.some(p => p.userId === userId)) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Siz allaqachon navbatdasiz' }));
      }

      matchmakingQueue.push({
        userId,
        socket: ws,
        username: data.username || `User_${userId}`,
        firstName: data.firstName || 'Player'
      });

      ws.send(JSON.stringify({ type: 'joined_queue' }));

      attemptMatchmaking();
      break;
    }

    case 'leave_queue': {
      const index = matchmakingQueue.findIndex(p => p.userId === userId);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        ws.send(JSON.stringify({ type: 'left_queue' }));
      }
      break;
    }

    case 'make_choice': {
      const game = activeGames.get(data.gameId);
      if (!game) return ws.send(JSON.stringify({ type: 'error', message: 'O‘yin topilmadi' }));

      if (game.player1.id === userId) {
        game.player1.choice = data.choice;
      } else if (game.player2?.id === userId) {
        game.player2.choice = data.choice;
      } else {
        return ws.send(JSON.stringify({ type: 'error', message: 'Siz bu o‘yinda emassiz' }));
      }

      activeGames.set(data.gameId, game);

      // Raqibga bildirish
      const opponentId = game.player1.id === userId ? game.player2.id : game.player1.id;
      const opponentWs = playerSockets.get(opponentId);
      if (opponentWs?.readyState === WebSocket.OPEN) {
        opponentWs.send(JSON.stringify({ type: 'opponent_choice_made' }));
      }

      // Ikkalasida ham tanlov bo‘lsa — natija
      if (game.player1.choice && game.player2?.choice) {
        await finalizeGame(data.gameId);
      }

      ws.send(JSON.stringify({ type: 'choice_accepted', choice: data.choice }));
      break;
    }

    case 'chat_message': {
      const game = activeGames.get(data.gameId);
      if (!game) return;

      const receiverId = game.player1.id === userId ? game.player2.id : game.player1.id;
      const receiverWs = playerSockets.get(receiverId);

      if (receiverWs?.readyState === WebSocket.OPEN) {
        receiverWs.send(JSON.stringify({
          type: 'chat_message',
          senderId: userId,
          text: data.text.trim().slice(0, 500), // xavfsizlik uchun limit
        }));
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Noma’lum xabar turi' }));
  }
}

/**
 * Navbatdan juft topish va o‘yin yaratish
 */
function attemptMatchmaking() {
  while (matchmakingQueue.length >= 2) {
    const playerA = matchmakingQueue.shift();
    const playerB = matchmakingQueue.shift();

    const gameId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const game = {
      gameId,
      player1: { id: playerA.userId, username: playerA.username, firstName: playerA.firstName, choice: null },
      player2: { id: playerB.userId, username: playerB.username, firstName: playerB.firstName, choice: null },
      status: 'playing',
      createdAt: new Date(),
    };

    activeGames.set(gameId, game);

    // Ikkalasiga o‘yin boshlanganligi haqida xabar
    playerA.socket.send(JSON.stringify({
      type: 'match_found',
      gameId,
      opponent: { id: playerB.userId, username: playerB.username, firstName: playerB.firstName }
    }));

    playerB.socket.send(JSON.stringify({
      type: 'match_found',
      gameId,
      opponent: { id: playerA.userId, username: playerA.username, firstName: playerA.firstName }
    }));

    // 60 soniyalik taymer
    setGameTimeout(gameId);
  }
}

/**
 * O‘yin natijasini hisoblash va yuborish
 */
async function finalizeGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const { player1, player2 } = game;
  let result, winnerId;

  if (player1.choice === player2.choice) {
    result = 'draw';
  } else if (
    (player1.choice === 'rock' && player2.choice === 'scissors') ||
    (player1.choice === 'paper' && player2.choice === 'rock') ||
    (player1.choice === 'scissors' && player2.choice === 'paper')
  ) {
    result = 'player1_win';
    winnerId = player1.id;
  } else {
    result = 'player2_win';
    winnerId = player2.id;
  }

  game.result = result;
  game.winnerId = winnerId;
  game.status = 'finished';
  game.finishedAt = new Date();

  activeGames.set(gameId, game);

  // Statistikani yangilash (oddiy versiya)
  await Promise.all([
    User.updateOne({ telegramId: player1.id }, { $inc: { 'gameStats.totalGames': 1, ...(result === 'player1_win' ? { 'gameStats.wins': 1 } : result === 'draw' ? { 'gameStats.draws': 1 } : { 'gameStats.losses': 1 }) } }),
    User.updateOne({ telegramId: player2.id }, { $inc: { 'gameStats.totalGames': 1, ...(result === 'player2_win' ? { 'gameStats.wins': 1 } : result === 'draw' ? { 'gameStats.draws': 1 } : { 'gameStats.losses': 1 }) } }),
  ]);

  // Natijani yuborish
  const resultPayload = {
    type: 'game_result',
    gameId,
    result,
    winnerId,
    choices: { player1: player1.choice, player2: player2.choice }
  };

  [player1.id, player2.id].forEach(id => {
    const ws = playerSockets.get(id);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(resultPayload));
    }
  });

  // O‘yinni tozalash
  setTimeout(() => activeGames.delete(gameId), 30000);
}

/**
 * O‘yin uchun 60 soniyalik taymer
 */
function setGameTimeout(gameId) {
  setTimeout(async () => {
    const game = activeGames.get(gameId);
    if (game && game.status === 'playing') {
      game.status = 'finished';
      game.result = 'timeout';
      game.finishedAt = new Date();

      const payload = { type: 'game_timeout', gameId };

      [game.player1.id, game.player2?.id].forEach(id => {
        const ws = playerSockets.get(id);
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      });

      activeGames.delete(gameId);
    }
  }, 60_000);
}

// ==================== HEALTH CHECK & BASIC ROUTES ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    activeGames: activeGames.size,
    queuedPlayers: matchmakingQueue.length,
    connectedPlayers: playerSockets.size,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ==================== SERVER START ====================
server.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────────────────┐
  │  Tosh-Qaychi-Qog‘oz Multiplayer Server               │
  │  Port:          ${PORT.toString().padEnd(40)}│
  │  WebSocket:     wss://your-domain.onrender.com/ws    │
  │  Health:        http://localhost:${PORT}/health       │
  └──────────────────────────────────────────────────────┘
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  wss.close();
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('Server stopped');
      process.exit(0);
    });
  });
});