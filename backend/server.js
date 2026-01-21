/**
 * Tosh-Qaychi-Qog'oz Multiplayer Server - Tokensiz Admin Versiyasi
 * Telegram Mini App + WebSocket + MongoDB
 * 
 * @version 2.1.0
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

// ==================== KONFIGURATSIYA ====================
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-mini-app-domain.com';

// Admin uchun oddiy parol (faqat bitta parol)
const ADMIN_PASSWORD = 'admin123'; // Siz o'zingiz xohlagan parolni yozasiz

// Timeout konfiguratsiyalari
const HEARTBEAT_INTERVAL = 30000;
const GAME_TIMEOUT = 60000;
const CLEANUP_INTERVAL = 60000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ==================== DATABASE ====================
mongoose.connect(MONGODB_URI || 'mongodb://localhost:27017/rockpaperscissors', {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  // MongoDB bo'lmasa ham server ishlaydi
});

// ==================== SCHEMA ====================
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  gameStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    elo: { type: Number, default: 1000 },
  },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  player1: { 
    id: Number, 
    username: String, 
    firstName: String, 
    choice: String,
    score: { type: Number, default: 0 }
  },
  player2: { 
    id: Number, 
    username: String, 
    firstName: String, 
    choice: String,
    score: { type: Number, default: 0 }
  },
  status: { type: String, default: 'playing' },
  mode: { type: String, default: 'casual' },
  result: String,
  winnerId: Number,
  rounds: { type: Number, default: 3 },
  currentRound: { type: Number, default: 1 },
  roundResults: [{
    round: Number,
    player1Choice: String,
    player2Choice: String,
    result: String
  }],
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);

// ==================== IN-MEMORY STATE ====================
const playerSessions = new Map(); // userId → session
const matchmakingQueue = []; // [{userId, socket, username, firstName}]
const activeGames = new Map(); // gameId → game
const systemLogs = []; // loglar uchun

// ==================== TELEGRAM BOT ====================
if (BOT_TOKEN) {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const { id, first_name, username } = msg.from;
    
    try {
      await User.findOneAndUpdate(
        { telegramId: id },
        { 
          telegramId: id, 
          firstName: first_name, 
          username: username,
          lastSeen: new Date()
        },
        { upsert: true, new: true }
      );
      
      bot.sendMessage(msg.chat.id, `Salom ${first_name}! 👋\nO'yinni boshlash uchun quyidagi tugmani bosing:`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🎮 O'ynash", web_app: { url: WEB_APP_URL } }]]
        }
      });
    } catch (error) {
      console.error('Bot start error:', error);
    }
  });

  console.log('✅ Telegram bot started');
}

// ==================== WEBSOCKET SERVER ====================
wss.on('connection', (ws) => {
  console.log('[WS] New connection');
  let userId = null;

  ws.on('message', async (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      
      switch (data.type) {
        case 'register':
          if (!data.userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'userId talab qilinadi' }));
            return;
          }
          userId = data.userId;
          playerSessions.set(userId, ws);
          
          // User ma'lumotlarini yangilash
          await User.findOneAndUpdate(
            { telegramId: userId },
            { 
              telegramId: userId,
              firstName: data.firstName || `User_${userId}`,
              username: data.username,
              isOnline: true,
              lastSeen: new Date()
            },
            { upsert: true, new: true }
          );
          
          ws.send(JSON.stringify({ 
            type: 'registered', 
            userId: userId 
          }));
          break;
          
        case 'join_queue':
          if (matchmakingQueue.some(p => p.userId === userId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Siz allaqachon navbatdasiz' }));
            return;
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
          
        case 'leave_queue':
          const index = matchmakingQueue.findIndex(p => p.userId === userId);
          if (index !== -1) {
            matchmakingQueue.splice(index, 1);
            ws.send(JSON.stringify({ type: 'left_queue' }));
          }
          break;
          
        case 'make_choice':
          const game = activeGames.get(data.gameId);
          if (!game) {
            ws.send(JSON.stringify({ type: 'error', message: 'O\'yin topilmadi' }));
            return;
          }
          
          if (game.player1.id === userId) {
            game.player1.choice = data.choice;
          } else if (game.player2?.id === userId) {
            game.player2.choice = data.choice;
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Siz bu o\'yinda emassiz' }));
            return;
          }
          
          // Raqibga xabar
          const opponentId = game.player1.id === userId ? game.player2?.id : game.player1.id;
          const opponentWs = playerSessions.get(opponentId);
          if (opponentWs?.readyState === WebSocket.OPEN) {
            opponentWs.send(JSON.stringify({ type: 'opponent_choice_made' }));
          }
          
          // Ikkalasi ham tanlagan bo'lsa
          if (game.player1.choice && game.player2?.choice) {
            await finalizeGame(data.gameId);
          }
          
          ws.send(JSON.stringify({ type: 'choice_accepted', choice: data.choice }));
          break;
          
        case 'heartbeat':
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
          break;
      }
    } catch (err) {
      console.error('[WS] Message error:', err.message);
    }
  });

  ws.on('close', () => {
    if (userId) {
      playerSessions.delete(userId);
      const queueIndex = matchmakingQueue.findIndex(p => p.userId === userId);
      if (queueIndex !== -1) matchmakingQueue.splice(queueIndex, 1);
      
      // User offline qilish
      User.updateOne(
        { telegramId: userId },
        { isOnline: false, lastSeen: new Date() }
      ).catch(console.error);
    }
  });
});

// ==================== GAME FUNCTIONS ====================
function attemptMatchmaking() {
  while (matchmakingQueue.length >= 2) {
    const playerA = matchmakingQueue.shift();
    const playerB = matchmakingQueue.shift();
    
    const gameId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const game = {
      gameId,
      player1: { 
        id: playerA.userId, 
        username: playerA.username, 
        firstName: playerA.firstName, 
        choice: null,
        score: 0 
      },
      player2: { 
        id: playerB.userId, 
        username: playerB.username, 
        firstName: playerB.firstName, 
        choice: null,
        score: 0 
      },
      status: 'playing',
      rounds: 3,
      currentRound: 1,
      roundResults: [],
      createdAt: new Date()
    };
    
    activeGames.set(gameId, game);
    
    // O'yinchilarga xabar
    playerA.socket.send(JSON.stringify({
      type: 'match_found',
      gameId,
      opponent: { 
        id: playerB.userId, 
        username: playerB.username, 
        firstName: playerB.firstName 
      }
    }));
    
    playerB.socket.send(JSON.stringify({
      type: 'match_found',
      gameId,
      opponent: { 
        id: playerA.userId, 
        username: playerA.username, 
        firstName: playerA.firstName 
      }
    }));
    
    // Game timeout
    setTimeout(() => {
      const currentGame = activeGames.get(gameId);
      if (currentGame && currentGame.status === 'playing') {
        endGameTimeout(gameId);
      }
    }, GAME_TIMEOUT);
  }
}

function determineRoundResult(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) {
    return 'player1_win';
  }
  
  return 'player2_win';
}

async function finalizeGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  const result = determineRoundResult(game.player1.choice, game.player2.choice);
  
  // Hisobni yangilash
  if (result === 'player1_win') {
    game.player1.score++;
  } else if (result === 'player2_win') {
    game.player2.score++;
  }
  
  game.roundResults.push({
    round: game.currentRound,
    player1Choice: game.player1.choice,
    player2Choice: game.player2.choice,
    result: result
  });
  
  // Keyingi raund yoki o'yin tugashi
  game.currentRound++;
  game.player1.choice = null;
  game.player2.choice = null;
  
  if (game.currentRound > game.rounds) {
    // O'yin tugadi
    game.status = 'finished';
    game.finishedAt = new Date();
    
    let winnerId = null;
    if (game.player1.score > game.player2.score) {
      game.result = 'player1_win';
      winnerId = game.player1.id;
    } else if (game.player2.score > game.player1.score) {
      game.result = 'player2_win';
      winnerId = game.player2.id;
    } else {
      game.result = 'draw';
    }
    game.winnerId = winnerId;
    
    // Database'ga saqlash
    try {
      const gameRecord = new Game(game);
      await gameRecord.save();
      
      // User statistikasini yangilash
      await Promise.all([
        User.updateOne(
          { telegramId: game.player1.id },
          { 
            $inc: { 
              'gameStats.totalGames': 1,
              'gameStats.wins': game.result === 'player1_win' ? 1 : 0,
              'gameStats.losses': game.result === 'player2_win' ? 1 : 0,
              'gameStats.draws': game.result === 'draw' ? 1 : 0
            }
          }
        ),
        User.updateOne(
          { telegramId: game.player2.id },
          { 
            $inc: { 
              'gameStats.totalGames': 1,
              'gameStats.wins': game.result === 'player2_win' ? 1 : 0,
              'gameStats.losses': game.result === 'player1_win' ? 1 : 0,
              'gameStats.draws': game.result === 'draw' ? 1 : 0
            }
          }
        )
      ]);
    } catch (error) {
      console.error('Save game error:', error);
    }
    
    // Natijani yuborish
    const resultPayload = {
      type: 'game_result',
      gameId,
      result: game.result,
      winnerId,
      scores: {
        player1: game.player1.score,
        player2: game.player2.score
      },
      roundResults: game.roundResults
    };
    
    const player1Ws = playerSessions.get(game.player1.id);
    const player2Ws = playerSessions.get(game.player2.id);
    
    if (player1Ws?.readyState === WebSocket.OPEN) player1Ws.send(JSON.stringify(resultPayload));
    if (player2Ws?.readyState === WebSocket.OPEN) player2Ws.send(JSON.stringify(resultPayload));
    
    // O'yinni tozalash
    setTimeout(() => activeGames.delete(gameId), 30000);
  } else {
    // Keyingi raund
    setTimeout(() => {
      const currentGame = activeGames.get(gameId);
      if (currentGame && currentGame.status === 'playing') {
        const nextRoundPayload = {
          type: 'next_round',
          gameId,
          round: currentGame.currentRound,
          scores: {
            player1: currentGame.player1.score,
            player2: currentGame.player2.score
          }
        };
        
        const p1Ws = playerSessions.get(currentGame.player1.id);
        const p2Ws = playerSessions.get(currentGame.player2.id);
        
        if (p1Ws?.readyState === WebSocket.OPEN) p1Ws.send(JSON.stringify(nextRoundPayload));
        if (p2Ws?.readyState === WebSocket.OPEN) p2Ws.send(JSON.stringify(nextRoundPayload));
      }
    }, 2000);
  }
}

function endGameTimeout(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  game.status = 'finished';
  game.result = 'timeout';
  game.finishedAt = new Date();
  
  const timeoutPayload = { type: 'game_timeout', gameId };
  
  const player1Ws = playerSessions.get(game.player1.id);
  const player2Ws = playerSessions.get(game.player2.id);
  
  if (player1Ws?.readyState === WebSocket.OPEN) player1Ws.send(JSON.stringify(timeoutPayload));
  if (player2Ws?.readyState === WebSocket.OPEN) player2Ws.send(JSON.stringify(timeoutPayload));
  
  activeGames.delete(gameId);
}

// ==================== ADMIN PANEL (TOKENSIZ) ====================

// Admin login sahifasi
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Server Admin</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .login-container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          width: 90%;
        }
        h2 {
          color: #333;
          margin-bottom: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        input {
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 16px;
          box-sizing: border-box;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 5px;
          cursor: pointer;
          width: 100%;
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          transition: background 0.3s;
        }
        button:hover {
          background: #764ba2;
        }
        #error {
          color: red;
          margin-top: 10px;
          min-height: 20px;
        }
        .info {
          color: #666;
          font-size: 14px;
          margin-top: 20px;
          text-align: left;
          background: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
        }
        .info strong {
          color: #333;
        }
        .default-password {
          background: #e3f2fd;
          padding: 8px;
          border-radius: 5px;
          margin: 10px 0;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>🎮 Game Server Admin</h2>
        
        <div class="default-password">
          🔑 Default Password: <strong>${ADMIN_PASSWORD}</strong>
        </div>
        
        <input type="password" id="password" placeholder="Enter Admin Password" autocomplete="off">
        <button onclick="login()">Login to Admin Panel</button>
        <div id="error"></div>
        
        <div class="info">
          <strong>Server Info:</strong><br>
          • Port: ${PORT}<br>
          • WebSocket: ws://${req.hostname}<br>
          • Health: <a href="/health" target="_blank">/health</a><br>
          • Stats: <a href="/api/stats" target="_blank">/api/stats</a>
        </div>
      </div>
      
      <script>
        function login() {
          const password = document.getElementById('password').value.trim();
          const errorDiv = document.getElementById('error');
          const correctPassword = '${ADMIN_PASSWORD}';
          
          if (!password) {
            errorDiv.textContent = 'Please enter password';
            return;
          }
          
          if (password === correctPassword) {
            // Parol to'g'ri, dashboardga o'tish
            localStorage.setItem('adminLoggedIn', 'true');
            window.location.href = '/admin/dashboard';
          } else {
            errorDiv.textContent = '❌ Incorrect password! Try: ' + correctPassword;
          }
        }
        
        document.getElementById('password').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') login();
        });
        
        // Agar avval login qilgan bo'lsa
        if (localStorage.getItem('adminLoggedIn') === 'true') {
          window.location.href = '/admin/dashboard';
        }
      </script>
    </body>
    </html>
  `);
});

// Admin dashboard (parol bilan himoyalangan)
app.get('/admin/dashboard', (req, res) => {
  // Oddiy parol tekshirish
  const password = req.query.password || req.headers['x-password'];
  
  if (password !== ADMIN_PASSWORD && !req.session?.adminLoggedIn) {
    // Login sahifasiga qaytarish
    return res.redirect('/admin');
  }
  
  // Dashboard HTML
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Game Server Dashboard</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: #f5f5f5;
          color: #333;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          background: white;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }
        
        .header h1 {
          color: #2c3e50;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          background: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
          color: #7f8c8d;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .online { color: #27ae60; }
        .queue { color: #f39c12; }
        .games { color: #3498db; }
        .users { color: #9b59b6; }
        
        .table-container {
          background: white;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        
        th {
          background: #f8f9fa;
          color: #7f8c8d;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 1px;
        }
        
        tr:hover {
          background: #f8f9fa;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .badge.online { background: #27ae60; color: white; }
        .badge.offline { background: #95a5a6; color: white; }
        .badge.playing { background: #3498db; color: white; }
        .badge.queued { background: #f39c12; color: white; }
        
        .controls {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }
        
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .btn-warning { background: #f39c12; color: white; }
        .btn-danger { background: #e74c3c; color: white; }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .refresh-btn {
          background: #2c3e50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .logout-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #7f8c8d;
        }
        
        .error {
          color: #e74c3c;
          padding: 10px;
          background: #ffeaea;
          border-radius: 5px;
          margin: 10px 0;
        }
        
        .success {
          color: #27ae60;
          padding: 10px;
          background: #eafaf1;
          border-radius: 5px;
          margin: 10px 0;
        }
        
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            text-align: center;
          }
          
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .controls {
            justify-content: center;
          }
        }
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>
            <i class="fas fa-gamepad"></i>
            Tosh-Qaychi-Qog'oz Dashboard
          </h1>
          <div style="display: flex; gap: 10px; align-items: center;">
            <div id="serverStatus" style="padding: 5px 15px; background: #27ae60; color: white; border-radius: 20px; font-weight: bold;">
              Online
            </div>
            <div id="serverTime">--:--:--</div>
            <button class="refresh-btn" onclick="loadAllData()">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <h3><i class="fas fa-users"></i> Online Players</h3>
            <div class="stat-value online" id="onlinePlayers">0</div>
          </div>
          
          <div class="stat-card">
            <h3><i class="fas fa-clock"></i> In Queue</h3>
            <div class="stat-value queue" id="queuedPlayers">0</div>
          </div>
          
          <div class="stat-card">
            <h3><i class="fas fa-trophy"></i> Active Games</h3>
            <div class="stat-value games" id="activeGames">0</div>
          </div>
          
          <div class="stat-card">
            <h3><i class="fas fa-database"></i> Total Users</h3>
            <div class="stat-value users" id="totalUsers">0</div>
          </div>
        </div>
        
        <!-- Online Players -->
        <div class="table-container">
          <h3 style="margin-bottom: 15px; color: #2c3e50;">
            <i class="fas fa-user-clock"></i> Online Players
          </h3>
          <div id="playersLoading" class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading players...
          </div>
          <table id="playersTable" style="display: none;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Status</th>
                <th>Wins/Losses</th>
                <th>ELO</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody id="playersBody"></tbody>
          </table>
        </div>
        
        <!-- Active Games -->
        <div class="table-container">
          <h3 style="margin-bottom: 15px; color: #2c3e50;">
            <i class="fas fa-play-circle"></i> Active Games
          </h3>
          <div id="gamesLoading" class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading games...
          </div>
          <table id="gamesTable" style="display: none;">
            <thead>
              <tr>
                <th>Game ID</th>
                <th>Player 1</th>
                <th>Player 2</th>
                <th>Round</th>
                <th>Score</th>
                <th>Started</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="gamesBody"></tbody>
          </table>
        </div>
        
        <!-- Controls -->
        <div class="table-container">
          <h3 style="margin-bottom: 15px; color: #2c3e50;">
            <i class="fas fa-cogs"></i> Server Controls
          </h3>
          <div class="controls">
            <button class="btn-primary" onclick="sendBroadcast()">
              <i class="fas fa-bullhorn"></i> Broadcast Message
            </button>
            <button class="btn-success" onclick="clearQueue()">
              <i class="fas fa-trash"></i> Clear Queue
            </button>
            <button class="btn-warning" onclick="restartServer()">
              <i class="fas fa-redo"></i> Restart Matchmaking
            </button>
            <button class="btn-danger" onclick="logout()">
              <i class="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      </div>
      
      <!-- Logout Button -->
      <button class="logout-btn btn-danger" onclick="logout()" style="position: fixed; bottom: 20px; right: 20px; padding: 10px 20px;">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>
      
      <script>
        // Configuration
        const SERVER_URL = window.location.origin;
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
          loadAllData();
          setInterval(loadAllData, 5000); // Auto-refresh every 5 seconds
          setInterval(updateServerTime, 1000);
        });
        
        function updateServerTime() {
          const now = new Date();
          document.getElementById('serverTime').textContent = 
            now.toLocaleTimeString('en-US', {hour12: false});
        }
        
        async function loadAllData() {
          await loadStats();
          await loadPlayers();
          await loadGames();
        }
        
        async function loadStats() {
          try {
            const response = await fetch(SERVER_URL + '/api/stats');
            const data = await response.json();
            
            if (data.success) {
              document.getElementById('onlinePlayers').textContent = data.stats.onlineNow || 0;
              document.getElementById('queuedPlayers').textContent = data.stats.inQueue || 0;
              document.getElementById('activeGames').textContent = data.stats.activeGames || 0;
              document.getElementById('totalUsers').textContent = data.stats.totalUsers || 0;
            }
          } catch (error) {
            console.error('Error loading stats:', error);
          }
        }
        
        async function loadPlayers() {
          try {
            const response = await fetch(SERVER_URL + '/api/online-players');
            const data = await response.json();
            
            const loading = document.getElementById('playersLoading');
            const table = document.getElementById('playersTable');
            const body = document.getElementById('playersBody');
            
            if (data.success) {
              loading.style.display = 'none';
              table.style.display = 'table';
              body.innerHTML = '';
              
              if (!data.players || data.players.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">No players online</td></tr>';
                return;
              }
              
              data.players.forEach(player => {
                const lastSeen = new Date(player.lastSeen);
                const timeDiff = Math.floor((Date.now() - lastSeen) / 1000);
                const lastSeenStr = timeDiff < 60 ? 'Just now' : 
                  timeDiff < 3600 ? \`\${Math.floor(timeDiff / 60)}m ago\` : 
                  \`\${Math.floor(timeDiff / 3600)}h ago\`;
                
                const row = \`
                  <tr>
                    <td>\${player.telegramId}</td>
                    <td><strong>\${player.firstName || 'Unknown'}</strong></td>
                    <td>@\${player.username || 'no-username'}</td>
                    <td><span class="badge \${player.isOnline ? 'online' : 'offline'}">\${player.isOnline ? 'Online' : 'Offline'}</span></td>
                    <td>\${player.gameStats?.wins || 0}/\${player.gameStats?.losses || 0}</td>
                    <td>\${player.gameStats?.elo || 1000}</td>
                    <td>\${lastSeenStr}</td>
                  </tr>
                \`;
                body.innerHTML += row;
              });
            }
          } catch (error) {
            console.error('Error loading players:', error);
            document.getElementById('playersLoading').innerHTML = '<div class="error">Failed to load players</div>';
          }
        }
        
        async function loadGames() {
          try {
            const response = await fetch(SERVER_URL + '/api/active-games');
            const data = await response.json();
            
            const loading = document.getElementById('gamesLoading');
            const table = document.getElementById('gamesTable');
            const body = document.getElementById('gamesBody');
            
            if (data.success) {
              loading.style.display = 'none';
              table.style.display = 'table';
              body.innerHTML = '';
              
              if (!data.games || data.games.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">No active games</td></tr>';
                return;
              }
              
              data.games.forEach(game => {
                const startedTime = Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000);
                const startedStr = startedTime < 60 ? \`\${startedTime}s ago\` : 
                  \`\${Math.floor(startedTime / 60)}m ago\`;
                
                const row = \`
                  <tr>
                    <td><small>\${game.gameId?.substring(0, 12) || 'N/A'}...</small></td>
                    <td>\${game.player1?.firstName || 'Player1'}</td>
                    <td>\${game.player2?.firstName || 'Waiting...'}</td>
                    <td>\${game.currentRound || 1}/\${game.rounds || 3}</td>
                    <td><strong>\${game.player1?.score || 0}</strong> - <strong>\${game.player2?.score || 0}</strong></td>
                    <td>\${startedStr}</td>
                    <td><span class="badge playing">\${game.status || 'playing'}</span></td>
                  </tr>
                \`;
                body.innerHTML += row;
              });
            }
          } catch (error) {
            console.error('Error loading games:', error);
            document.getElementById('gamesLoading').innerHTML = '<div class="error">Failed to load games</div>';
          }
        }
        
        async function sendBroadcast() {
          const message = prompt('Enter broadcast message:');
          if (!message) return;
          
          try {
            const response = await fetch(SERVER_URL + '/api/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                message,
                password: '${ADMIN_PASSWORD}'
              })
            });
            
            const data = await response.json();
            alert(data.success ? '✅ Message sent!' : '❌ Failed to send message');
          } catch (error) {
            alert('Error sending broadcast');
          }
        }
        
        async function clearQueue() {
          if (!confirm('Clear all players from matchmaking queue?')) return;
          
          try {
            const response = await fetch(SERVER_URL + '/api/clear-queue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: '${ADMIN_PASSWORD}' })
            });
            
            const data = await response.json();
            alert(data.success ? '✅ Queue cleared!' : '❌ Failed to clear queue');
            loadAllData();
          } catch (error) {
            alert('Error clearing queue');
          }
        }
        
        async function restartServer() {
          if (!confirm('Restart matchmaking service?')) return;
          
          try {
            const response = await fetch(SERVER_URL + '/api/restart-matchmaking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: '${ADMIN_PASSWORD}' })
            });
            
            const data = await response.json();
            alert(data.success ? '✅ Matchmaking restarted!' : '❌ Failed to restart');
          } catch (error) {
            alert('Error restarting matchmaking');
          }
        }
        
        function logout() {
          localStorage.removeItem('adminLoggedIn');
          window.location.href = '/admin';
        }
      </script>
    </body>
    </html>
  `);
});

// ==================== API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    },
    connections: {
      onlinePlayers: playerSessions.size,
      queuedPlayers: matchmakingQueue.length,
      activeGames: activeGames.size
    },
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Stats API
app.get('/api/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    
    res.json({
      success: true,
      stats: {
        onlineNow: playerSessions.size,
        inQueue: matchmakingQueue.length,
        activeGames: activeGames.size,
        totalUsers: totalUsers,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Online players API
app.get('/api/online-players', async (req, res) => {
  try {
    const onlineUserIds = Array.from(playerSessions.keys());
    const players = await User.find({ 
      telegramId: { $in: onlineUserIds } 
    }).limit(100);
    
    res.json({
      success: true,
      players: players.map(user => ({
        telegramId: user.telegramId,
        firstName: user.firstName,
        username: user.username,
        gameStats: user.gameStats,
        isOnline: true,
        lastSeen: user.lastSeen
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Active games API
app.get('/api/active-games', (req, res) => {
  const games = Array.from(activeGames.values()).map(game => ({
    gameId: game.gameId,
    player1: game.player1,
    player2: game.player2,
    status: game.status,
    currentRound: game.currentRound,
    rounds: game.rounds,
    scores: {
      player1: game.player1.score,
      player2: game.player2.score
    },
    createdAt: game.createdAt
  }));
  
  res.json({
    success: true,
    games: games
  });
});

// Broadcast API
app.post('/api/broadcast', (req, res) => {
  const { message, password } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message required' });
  }
  
  let sentCount = 0;
  playerSessions.forEach((ws, userId) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'admin_broadcast',
          message: message,
          timestamp: Date.now()
        }));
        sentCount++;
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    }
  });
  
  res.json({
    success: true,
    sentTo: sentCount,
    message: 'Broadcast sent'
  });
});

// Clear queue API
app.post('/api/clear-queue', (req, res) => {
  const { password } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const clearedCount = matchmakingQueue.length;
  matchmakingQueue.length = 0; // Clear array
  
  res.json({
    success: true,
    cleared: clearedCount,
    message: 'Queue cleared'
  });
});

// Restart matchmaking API
app.post('/api/restart-matchmaking', (req, res) => {
  const { password } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  // Matchmaking avtomatik ishlaydi, shunchaki response qaytaramiz
  res.json({
    success: true,
    message: 'Matchmaking service active'
  });
});

// Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await User.find()
      .sort({ 'gameStats.elo': -1 })
      .limit(20)
      .select('telegramId firstName username gameStats')
      .lean();
    
    res.json({
      success: true,
      leaderboard: topPlayers.map((user, index) => ({
        rank: index + 1,
        id: user.telegramId,
        name: user.firstName,
        username: user.username,
        stats: user.gameStats
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== SERVER START ====================
server.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │ 🎮 Tosh-Qaychi-Qog'oz Server v2.1.0                    │
  │                                                         │
  │ 📊 Port:        ${PORT.toString().padEnd(37)}│
  │ 🔌 WebSocket:   ws://localhost:${PORT}                 │
  │ 📈 Admin Panel: http://localhost:${PORT}/admin         │
  │ 🔑 Admin Pass:  ${ADMIN_PASSWORD.padEnd(35)}│
  │ 📊 Health:      http://localhost:${PORT}/health        │
  └─────────────────────────────────────────────────────────┘
  `);
});

// Cleanup interval
setInterval(() => {
  // Eski sessionlarni tozalash
  const now = Date.now();
  playerSessions.forEach((ws, userId) => {
    // Agar connection yopilgan bo'lsa
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      playerSessions.delete(userId);
    }
  });
  
  console.log(`[Cleanup] Players: ${playerSessions.size}, Queue: ${matchmakingQueue.length}, Games: ${activeGames.size}`);
}, CLEANUP_INTERVAL);