// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public')); // agar frontend fayllaringiz bo‘lsa

// ────────────────────────────────────────────────
//  MongoDB ulanish
// ────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rps_game', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB ulandi'))
  .catch(err => console.error('MongoDB ulanish xatosi:', err));

// Oddiy User modeli (statistika uchun)
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
});
const User = mongoose.model('User', UserSchema);

// ────────────────────────────────────────────────
//  Global holatlar
// ────────────────────────────────────────────────
const queue = [];                       // [{userId, socket, name, ...}]
const games = new Map();                // gameId → {player1, player2, ...}
const sockets = new Map();              // userId → ws

// ────────────────────────────────────────────────
//  Telegram Bot (minimal /start uchun)
// ────────────────────────────────────────────────
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const { id, first_name, username } = msg.from;
  bot.sendMessage(msg.chat.id, `Salom ${first_name}! 🎮 O‘yinni boshlash uchun veb-ilovani oching.`, {
    reply_markup: {
      inline_keyboard: [[{ text: "O‘ynash", web_app: { url: process.env.WEB_APP_URL || 'https://your-domain.com' } }]]
    }
  });
});

// ────────────────────────────────────────────────
//  WebSocket server
// ────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('➕ Yangi ulanish');

  let myUserId = null;

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      // ─── Register ───────────────────────────────────────
      if (data.type === 'register') {
        myUserId = data.userId;
        sockets.set(myUserId, ws);
        ws.send(JSON.stringify({ type: 'registered' }));
        console.log(`Registered: ${myUserId}`);
        return;
      }

      if (!myUserId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Avval register bo‘ling' }));
        return;
      }

      // ─── Join queue ─────────────────────────────────────
      if (data.type === 'join_queue') {
        if (queue.some(p => p.userId === myUserId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Siz allaqachon navbatdasiz' }));
          return;
        }

        queue.push({
          userId: myUserId,
          socket: ws,
          name: data.firstName || data.username || 'Player'
        });

        ws.send(JSON.stringify({ type: 'joined_queue' }));
        console.log(`Navbatga qo‘shildi: ${myUserId} | queue uzunligi: ${queue.length}`);

        // Juftlashtirish
        if (queue.length >= 2) {
          const p1 = queue.shift();
          const p2 = queue.shift();

          const gameId = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

          const game = {
            gameId,
            player1: { id: p1.userId, name: p1.name, choice: null },
            player2: { id: p2.userId, name: p2.name, choice: null },
            createdAt: Date.now()
          };

          games.set(gameId, game);

          // ikkalasiga ham xabar
          [p1, p2].forEach(p => {
            p.socket.send(JSON.stringify({
              type: 'match_found',
              gameId,
              opponent: p === p1 ? game.player2 : game.player1
            }));
          });

          console.log(`O‘yin boshlandi: ${p1.userId} vs ${p2.userId} → ${gameId}`);
        }
        return;
      }

      // ─── Leave queue ────────────────────────────────────
      if (data.type === 'leave_queue') {
        const idx = queue.findIndex(p => p.userId === myUserId);
        if (idx !== -1) queue.splice(idx, 1);
        ws.send(JSON.stringify({ type: 'left_queue' }));
        return;
      }

      // ─── Make choice ────────────────────────────────────
      if (data.type === 'make_choice') {
        const game = games.get(data.gameId);
        if (!game) return ws.send(JSON.stringify({ type: 'error', message: 'O‘yin topilmadi' }));

        if (game.player1.id === myUserId) {
          game.player1.choice = data.choice;
        } else if (game.player2.id === myUserId) {
          game.player2.choice = data.choice;
        } else {
          return ws.send(JSON.stringify({ type: 'error', message: 'Bu o‘yin sizniki emas' }));
        }

        // raqibga "tanlov qildi" xabari
        const opp = game.player1.id === myUserId ? game.player2 : game.player1;
        const oppWs = sockets.get(opp.id);
        if (oppWs?.readyState === WebSocket.OPEN) {
          oppWs.send(JSON.stringify({ type: 'opponent_chose' }));
        }

        // ikkalasi ham tanlagan bo‘lsa → natija
        if (game.player1.choice && game.player2.choice) {
          let result, winnerId;

          if (game.player1.choice === game.player2.choice) {
            result = 'draw';
          } else if (
            (game.player1.choice === 'rock'     && game.player2.choice === 'scissors') ||
            (game.player1.choice === 'paper'    && game.player2.choice === 'rock')     ||
            (game.player1.choice === 'scissors' && game.player2.choice === 'paper')
          ) {
            result = 'player1_win';
            winnerId = game.player1.id;
          } else {
            result = 'player2_win';
            winnerId = game.player2.id;
          }

          // ikkalasiga natija yuborish
          [game.player1, game.player2].forEach(pl => {
            const plWs = sockets.get(pl.id);
            if (plWs?.readyState === WebSocket.OPEN) {
              plWs.send(JSON.stringify({
                type: 'game_result',
                result,
                winnerId,
                myChoice: pl.choice,
                opponentChoice: pl === game.player1 ? game.player2.choice : game.player1.choice
              }));
            }
          });

          games.delete(data.gameId);
        }

        return;
      }

      // ─── Chat xabari ────────────────────────────────────
      if (data.type === 'chat_message') {
        const game = games.get(data.gameId);
        if (!game) return;

        const opp = game.player1.id === myUserId ? game.player2 : game.player1;
        const oppWs = sockets.get(opp.id);

        if (oppWs?.readyState === WebSocket.OPEN) {
          oppWs.send(JSON.stringify({
            type: 'chat_message',
            senderId: myUserId,
            text: data.text
          }));
        }

        // o‘ziga ham qaytarib yuboramiz (frontendda darhol ko‘rinishi uchun)
        ws.send(JSON.stringify({
          type: 'chat_message',
          senderId: myUserId,
          text: data.text
        }));

        return;
      }

      ws.send(JSON.stringify({ type: 'error', message: 'Noma‘lum buyruq' }));

    } catch (err) {
      console.error('WS xato:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('─ ulanish uzildi');
    // queue dan o‘chirish
    const qIdx = queue.findIndex(p => p.socket === ws);
    if (qIdx !== -1) queue.splice(qIdx, 1);

    // o‘yin bo‘lsa raqibga xabar berish
    for (const [gameId, game] of games.entries()) {
      if (game.player1.id === myUserId || game.player2.id === myUserId) {
        const oppId = game.player1.id === myUserId ? game.player2.id : game.player1.id;
        const oppWs = sockets.get(oppId);
        if (oppWs?.readyState === WebSocket.OPEN) {
          oppWs.send(JSON.stringify({ type: 'opponent_disconnected' }));
        }
        games.delete(gameId);
        break;
      }
    }

    sockets.delete(myUserId);
  });
});

// ────────────────────────────────────────────────
//  Serverni ishga tushirish
// ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishlamoqda`);
  console.log(`WebSocket → ws://localhost:${PORT}`);
});