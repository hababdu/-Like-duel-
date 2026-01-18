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

// ==================== MONGODB ====================
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB ulandi'))
  .catch(err => console.error('❌ MongoDB xatosi:', err));

// User va Game modellari (oldingi kodingizdan olingan, o‘zgartirishsiz)
const userSchema = new mongoose.Schema({ /* ... oldingi schemalaringiz ... */ });
const gameSchema = new mongoose.Schema({ /* ... oldingi schemalaringiz ... */ });
const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);

// ==================== GLOBAL O‘ZGARUVCHILAR ====================
const matchmakingQueue = [];           // [{ userId, socket, username, firstName }]
const activeGames = new Map();          // gameId → game object
const playerSockets = new Map();        // userId → WebSocket

// ==================== TELEGRAM BOT ====================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const { id, first_name, username } = msg.from;
  await saveOrUpdateUser({ id, first_name, username });

  bot.sendMessage(msg.chat.id, `Salom, ${first_name}! 👋\nO'yinni boshlash uchun tugmani bosing:`, {
    reply_markup: {
      inline_keyboard: [[{ text: "🎮 O'ynash", web_app: { url: process.env.WEB_APP_URL } }]]
    }
  });
});

// boshqa bot handlerlarini shu yerga qo‘shishingiz mumkin (/stats, /game va h.k.)

// ==================== WEBSOCKET LOGIKASI ====================
wss.on('connection', (ws) => {
  console.log('➡️ Yangi WebSocket ulandi');
  let currentUserId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'register') {
        currentUserId = data.userId;
        playerSockets.set(currentUserId, ws);
        ws.send(JSON.stringify({ type: 'registered', userId: currentUserId }));
      }

      await handleWebSocketMessage(ws, data, currentUserId);
    } catch (err) {
      console.error('Message parse xatosi:', err);
    }
  });

  ws.on('close', () => {
    console.log('WS yopildi →', currentUserId);
    // Navbatdan chiqarish
    const idx = matchmakingQueue.findIndex(p => p.socket === ws);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);

    playerSockets.delete(currentUserId);

    // Agar o‘yinda bo‘lsa — raqibga xabar
    for (const [gameId, game] of activeGames.entries()) {
      if (game.player1?.id === currentUserId || game.player2?.id === currentUserId) {
        const opponentId = game.player1?.id === currentUserId ? game.player2?.id : game.player1?.id;
        const opponentWs = playerSockets.get(opponentId);
        if (opponentWs?.readyState === WebSocket.OPEN) {
          opponentWs.send(JSON.stringify({ type: 'opponent_disconnected', gameId }));
        }
        activeGames.delete(gameId);
        break;
      }
    }
  });
});

async function handleWebSocketMessage(ws, data, userId) {
  switch (data.type) {
    case 'join_queue':
      if (matchmakingQueue.some(p => p.userId === data.userId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Alla qachon navbatdasiz' }));
        return;
      }

      matchmakingQueue.push({
        userId: data.userId,
        socket: ws,
        username: data.username,
        firstName: data.firstName
      });

      ws.send(JSON.stringify({ type: 'joined_queue' }));

      // Juftlashtirish
      while (matchmakingQueue.length >= 2) {
        const p1 = matchmakingQueue.shift();
        const p2 = matchmakingQueue.shift();

        const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const game = {
          gameId,
          player1: { id: p1.userId, username: p1.username, firstName: p1.firstName, choice: null },
          player2: { id: p2.userId, username: p2.username, firstName: p2.firstName, choice: null },
          status: 'playing',
          createdAt: new Date(),
          moves: []
        };

        activeGames.set(gameId, game);

        // MongoDB ga saqlash (ixtiyoriy, lekin yaxshi)
        await new Game({
          gameId,
          player1: game.player1,
          player2: game.player2,
          status: 'playing',
          createdAt: game.createdAt
        }).save();

        // Xabar yuborish
        p1.socket.send(JSON.stringify({
          type: 'match_found',
          gameId,
          opponent: { id: p2.userId, username: p2.username, firstName: p2.firstName }
        }));

        p2.socket.send(JSON.stringify({
          type: 'match_found',
          gameId,
          opponent: { id: p1.userId, username: p1.username, firstName: p1.firstName }
        }));

        startGameTimer(gameId);
      }
      break;

    case 'make_choice':
      const game = activeGames.get(data.gameId);
      if (!game) return ws.send(JSON.stringify({ type: 'error', message: 'O‘yin topilmadi' }));

      if (game.player1.id === data.userId) {
        game.player1.choice = data.choice;
      } else if (game.player2.id === data.userId) {
        game.player2.choice = data.choice;
      } else {
        return ws.send(JSON.stringify({ type: 'error', message: 'Siz bu o‘yinda emassiz' }));
      }

      activeGames.set(data.gameId, game);

      // Raqibga xabar
      const opponentId = game.player1.id === data.userId ? game.player2.id : game.player1.id;
      const opponentWs = playerSockets.get(opponentId);
      if (opponentWs) {
        opponentWs.send(JSON.stringify({ type: 'opponent_choice_made' }));
      }

      // Ikkovi ham tanlagan bo‘lsa — natija hisoblash
      if (game.player1.choice && game.player2.choice) {
        await calculateGameResult(data.gameId);
      }

      ws.send(JSON.stringify({ type: 'choice_accepted', choice: data.choice }));
      break;

    case 'chat_message':
      const chatGame = activeGames.get(data.gameId);
      if (!chatGame) return;

      const receiverId = chatGame.player1.id === data.userId ? chatGame.player2.id : chatGame.player1.id;
      const receiverWs = playerSockets.get(receiverId);

      if (receiverWs) {
        receiverWs.send(JSON.stringify({
          type: 'chat_message',
          senderId: data.userId,
          text: data.text
        }));
      }
      break;

    case 'leave_queue':
      const index = matchmakingQueue.findIndex(p => p.userId === data.userId);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        ws.send(JSON.stringify({ type: 'left_queue' }));
      }
      break;
  }
}

// Natija hisoblash funksiyasi (to'liq)
async function calculateGameResult(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const c1 = game.player1.choice;
  const c2 = game.player2.choice;

  let result, winnerId;

  if (c1 === c2) {
    result = 'draw';
  } else if (
    (c1 === 'rock' && c2 === 'scissors') ||
    (c1 === 'paper' && c2 === 'rock') ||
    (c1 === 'scissors' && c2 === 'paper')
  ) {
    result = 'player1_win';
    winnerId = game.player1.id;
  } else {
    result = 'player2_win';
    winnerId = game.player2.id;
  }

  game.result = result;
  game.winnerId = winnerId;
  game.status = 'finished';
  game.finishedAt = new Date();

  activeGames.set(gameId, game);

  // Statistika + koin (agar qo‘shgan bo‘lsangiz)
  await updateGameStats(game.player1.id, game.player2.id, result);

  // Natijani ikkalasiga yuborish
  const msg = {
    type: 'game_result',
    gameId,
    result,
    winnerId,
    choices: { player1: c1, player2: c2 }
  };

  const ws1 = playerSockets.get(game.player1.id);
  const ws2 = playerSockets.get(game.player2.id);

  if (ws1) ws1.send(JSON.stringify(msg));
  if (ws2) ws2.send(JSON.stringify(msg));

  // 30 soniyadan keyin o‘chirish
  setTimeout(() => activeGames.delete(gameId), 30000);
}

function startGameTimer(gameId) {
  setTimeout(() => {
    const game = activeGames.get(gameId);
    if (game && game.status === 'playing') {
      game.status = 'finished';
      game.result = 'timeout';

      const msg = { type: 'game_timeout', gameId };
      const ws1 = playerSockets.get(game.player1.id);
      const ws2 = playerSockets.get(game.player2.id);

      if (ws1) ws1.send(JSON.stringify(msg));
      if (ws2) ws2.send(JSON.stringify(msg));

      activeGames.delete(gameId);
    }
  }, 60000); // 60 soniya
}

// ==================== EXPRESS + STATIC ====================
app.use(express.static(path.join(__dirname, 'public'))); // agar frontend fayllaringiz bo‘lsa

app.get('/health', (req, res) => res.json({ status: 'ok', games: activeGames.size }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ==================== SERVERNI ISHGA TUSHIRISH ====================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishlamoqda`);
  console.log(`WebSocket → wss://your-domain.onrender.com/ws`);
});