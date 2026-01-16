// server.js - Telegram Bot va O'yin Serveri
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

// Yangi global navbat (queue)
const matchmakingQueue = [];          // [{ userId, socket, username, firstName }, ...]
const playerToGame = new Map();        // userId → gameId   (qidirishni tezlashtirish uchun)

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== MONGODB ULANISHI ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_bot_game?retryWrites=true&w=majority&appName=Cluster0';

console.log('📡 MongoDB URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, default: 'User' },
  lastName: String,
  username: String,
  languageCode: { type: String, default: 'en' },
  isBot: { type: Boolean, default: false },
  joinDate: { type: Date, default: () => new Date() },
  lastActivity: { type: Date, default: () => new Date() },
  visitCount: { type: Number, default: 0 },
  gameStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }
  }
}, { timestamps: false });

const User = mongoose.model('User', userSchema);

// Game Schema
const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  player1: {
    id: Number,
    username: String,
    firstName: String,
    choice: String,
    ready: Boolean,
    connected: Boolean
  },
  player2: {
    id: Number,
    username: String,
    firstName: String,
    choice: String,
    ready: Boolean,
    connected: Boolean
  },
  status: { type: String, default: 'waiting' }, // waiting, playing, finished
  result: String, // player1_win, player2_win, draw, timeout
  winnerId: Number,
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
  moves: [{
    playerId: Number,
    choice: String,
    timestamp: Date
  }]
}, { timestamps: true });

const Game = mongoose.model('Game', gameSchema);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB ga ulandi');
  console.log('📊 Connection state:', mongoose.connection.readyState);
})
.catch((err) => {
  console.error('❌ MongoDB ulanish xatosi:', err.message);
});

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID';

console.log('🤖 Bot token:', BOT_TOKEN ? 'Mavjud' : 'Yo\'q');

// Bot yaratish
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 1000,
    autoStart: false,
    params: { timeout: 10 }
  }
});

let botPollingActive = false;

const startBotPolling = async () => {
  if (botPollingActive) {
    console.log('⚠️  Bot allaqachon ishlayapti');
    return;
  }
  
  try {
    await bot.stopPolling();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🚀 Bot polling ishga tushirilmoqda...');
    
    bot.startPolling({ restart: true });
    botPollingActive = true;
    console.log('✅ Bot polling muvaffaqiyatli ishga tushdi');
  } catch (error) {
    console.error('❌ Bot polling xatosi:', error.message);
    
    if (error.message.includes('409 Conflict')) {
      console.log('🔄 10 soniya kutib qayta urinilmoqda...');
      botPollingActive = false;
      setTimeout(startBotPolling, 10000);
    }
  }
};

setTimeout(() => {
  startBotPolling();
}, 3000);

// ==================== O'YIN LOGIKASI ====================
const activeGames = new Map(); // gameId -> game data
const waitingPlayers = new Map(); // userId -> {socket, gameId}
const playerSockets = new Map(); // userId -> WebSocket

// WebSocket server
wss.on('connection', (ws, req) => {
  console.log('✅ WebSocket ulandi');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('❌ WebSocket xatosi:', error);
    }
  });
  
  wss.on('connection', (ws, req) => {
    console.log('➡️ Yangi WebSocket ulanish');
  
    // Har bir ulanish uchun vaqtinchalik identifikator (keyin register bilan almashtiriladi)
    let currentUserId = null;
  
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'register') {
          currentUserId = data.userId;
        }
        await handleWebSocketMessage(ws, data);
      } catch (err) {
        console.error('Xato parse qilishda:', err);
      }
    });
  
    ws.on('close', (code, reason) => {
      console.log(`❌ WS uzildi → code: ${code}, reason: ${reason || 'noma\'lum'}`);
  
      // 1. Navbatdan o‘chirish
      const queueIndex = matchmakingQueue.findIndex(p => p.socket === ws);
      if (queueIndex !== -1) {
        console.log(`Navbatdan o‘chirildi: userId ${matchmakingQueue[queueIndex].userId}`);
        matchmakingQueue.splice(queueIndex, 1);
      }
  
      // 2. Agar o'yinda bo'lsa – o'yinni topib, raqibga xabar berish
      if (currentUserId && playerToGame.has(currentUserId)) {
        const gameId = playerToGame.get(currentUserId);
        const game = activeGames.get(gameId);
  
        if (game) {
          const isPlayer1 = game.player1.id === currentUserId;
          const opponentId = isPlayer1 ? game.player2?.id : game.player1?.id;
          const opponentSocket = playerSockets.get(opponentId);
  
          // O'yinni "abandoned" holatiga o'tkazish yoki timeout qilish
          game.status = 'abandoned';
          game.finishedAt = new Date();
  
          // Raqibga xabar
          if (opponentSocket && opponentSocket.readyState === WebSocket.OPEN) {
            opponentSocket.send(JSON.stringify({
              type: 'opponent_disconnected',
              gameId,
              message: 'Raqib uzildi. O‘yin to‘xtatildi.'
            }));
          }
  
          // Keyinchalik cleanup qilish uchun vaqtinchalik saqlab turish
          setTimeout(() => {
            activeGames.delete(gameId);
            playerToGame.delete(currentUserId);
            if (opponentId) playerToGame.delete(opponentId);
          }, 60000); // 1 daqiqa ichida tozalash
        }
      }
  
      // 3. Global ro'yxatlardan o'chirish
      playerSockets.delete(currentUserId);
    });
  // Navbatdan chiqarish (foydalanuvchi tugmani bosganda yoki cancel qilganda)
async function handleLeaveQueue(ws, data) {
  const { userId } = data;

  const index = matchmakingQueue.findIndex(p => p.userId === userId || p.socket === ws);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
    ws.send(JSON.stringify({
      type: 'left_queue',
      message: 'Qidiruv to‘xtatildi'
    }));
  }
}

// O'yindan chiqish xabari uchun (masalan: "opponent_disconnected")
    ws.on('error', (err) => {
      console.error('WebSocket xatosi:', err);
    });
  });
});

async function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'join_queue':
      await handleJoinQueue(ws, data);
      break;

    case 'make_choice':
      await handleMakeChoice(ws, data);
      break;

    case 'register':
      await handlePlayerRegistration(ws, data);
      break;

    case 'leave_queue':
    case 'disconnect':
      await handleLeaveQueue(ws, data);
      break;
    case 'register':
      await handlePlayerRegistration(ws, data);
      break;
      
    case 'create_game':
      await handleCreateGame(ws, data);
      break;
      
    case 'find_opponent':
      await handleFindOpponent(ws, data);
      break;
      
    case 'make_choice':
      await handleMakeChoice(ws, data);
      break;
      
    case 'player_ready':
      await handlePlayerReady(ws, data);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

async function handlePlayerRegistration(ws, data) {
  const { userId, username, firstName } = data;
  
  playerSockets.set(userId, ws);
  
  // Foydalanuvchini saqlash/yangilash
  await saveOrUpdateUser({
    id: userId,
    username: username,
    first_name: firstName
  });
  
  ws.send(JSON.stringify({
    type: 'registered',
    userId: userId,
    timestamp: new Date().toISOString()
  }));
}

async function handleCreateGame(ws, data) {
  const { userId, username, firstName } = data;
  const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const gameData = {
    gameId,
    player1: { id: userId, username, firstName, choice: null, ready: false, connected: true },
    player2: null,
    status: 'waiting',
    createdAt: new Date()
  };
  
  activeGames.set(gameId, gameData);
  waitingPlayers.set(userId, { socket: ws, gameId });
  
  // MongoDB'ga saqlash
  const game = new Game({
    gameId: gameId,
    player1: gameData.player1,
    status: 'waiting'
  });
  
  await game.save();
  
  ws.send(JSON.stringify({
    type: 'game_created',
    gameId: gameId,
    status: 'waiting'
  }));
}

async function handleFindOpponent(ws, data) {
  const { userId, gameId } = data;
  
  // O'yinni topish
  const game = activeGames.get(gameId);
  if (!game) {
    ws.send(JSON.stringify({ type: 'error', message: 'O\'yin topilmadi' }));
    return;
  }
  
  // Raqib qidirish
  let opponent = null;
  for (const [opponentId, playerData] of waitingPlayers.entries()) {
    if (opponentId !== userId && playerData.gameId && !activeGames.get(playerData.gameId)?.player2) {
      opponent = { id: opponentId, socket: playerData.socket, gameId: playerData.gameId };
      break;
    }
  }
  
  if (opponent) {
    // Raqib topildi - o'yinlarni birlashtirish
    const opponentGame = activeGames.get(opponent.gameId);
    
    // O'yin 1: Hozirgi o'yin
    game.player2 = opponentGame.player1;
    game.status = 'playing';
    
    // O'yin 2: Raqibning o'yini
    opponentGame.player2 = game.player1;
    opponentGame.status = 'playing';
    
    // Waiting ro'yxatidan o'chirish
    waitingPlayers.delete(userId);
    waitingPlayers.delete(opponent.id);
    
    // O'yinlarni yangilash
    activeGames.set(gameId, game);
    activeGames.set(opponent.gameId, opponentGame);
    
    // MongoDB'da yangilash
    await Game.updateOne(
      { gameId: gameId },
      { 
        player2: game.player2,
        status: 'playing'
      }
    );
    
    await Game.updateOne(
      { gameId: opponent.gameId },
      { 
        player2: opponentGame.player2,
        status: 'playing'
      }
    );
    
    // Har ikkala o'yinchiga xabar
    const player1Message = {
      type: 'opponent_found',
      gameId: gameId,
      opponent: {
        id: game.player2.id,
        username: game.player2.username,
        firstName: game.player2.firstName
      },
      status: 'playing'
    };
    
    const player2Message = {
      type: 'opponent_found',
      gameId: opponent.gameId,
      opponent: {
        id: game.player1.id,
        username: game.player1.username,
        firstName: game.player1.firstName
      },
      status: 'playing'
    };
    
    ws.send(JSON.stringify(player1Message));
    if (opponent.socket) {
      opponent.socket.send(JSON.stringify(player2Message));
    }
    
    // Taymer boshlash
    startGameTimer(gameId);
    startGameTimer(opponent.gameId);
    
  } else {
    // Raqib topilmadi
    ws.send(JSON.stringify({
      type: 'waiting_for_opponent',
      gameId: gameId,
      status: 'waiting'
    }));
  }
}
async function handleJoinQueue(ws, data) {
  const { userId, username, firstName } = data;

  // Agar allaqachon navbatda bo‘lsa yoki o‘yinda bo‘lsa → rad etamiz
  if (matchmakingQueue.some(p => p.userId === userId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Siz allaqachon navbatdasiz' }));
    return;
  }

  if (playerToGame.has(userId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Siz hozir o‘yindasiz' }));
    return;
  }

  // Navbatga qo‘shish
  matchmakingQueue.push({
    userId,
    socket: ws,
    username,
    firstName
  });

  ws.send(JSON.stringify({ type: 'joined_queue' }));

  // Agar navbatda 2 yoki undan ko‘p odam bo‘lsa → juftlashtiramiz
  while (matchmakingQueue.length >= 2) {
    const playerA = matchmakingQueue.shift();
    const playerB = matchmakingQueue.shift();

    const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const game = {
      gameId,
      player1: { 
        id: playerA.userId, 
        username: playerA.username, 
        firstName: playerA.firstName,
        choice: null,
        ready: false 
      },
      player2: { 
        id: playerB.userId, 
        username: playerB.username, 
        firstName: playerB.firstName,
        choice: null,
        ready: false 
      },
      status: 'playing',
      createdAt: new Date(),
      moves: []
    };

    activeGames.set(gameId, game);
    playerToGame.set(playerA.userId, gameId);
    playerToGame.set(playerB.userId, gameId);

    // MongoDB ga saqlash (ixtiyoriy, lekin tavsiya etiladi)
    await new Game({
      gameId,
      player1: game.player1,
      player2: game.player2,
      status: 'playing',
      createdAt: game.createdAt
    }).save();

    // Ikkalasiga xabar
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

    // Taymer boshlash
    startGameTimer(gameId);
  }
}

async function handleLeaveQueue(ws, data) {
  const index = matchmakingQueue.findIndex(p => p.socket === ws);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
  }
}
async function handleMakeChoice(ws, data) {
  const { userId, gameId, choice } = data;
  
  const game = activeGames.get(gameId);
  if (!game) {
    ws.send(JSON.stringify({ type: 'error', message: 'O\'yin topilmadi' }));
    return;
  }
  
  // Tanlovni saqlash
  let isPlayer1 = game.player1.id === userId;
  let isPlayer2 = game.player2 && game.player2.id === userId;
  
  if (!isPlayer1 && !isPlayer2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Siz bu o\'yinda emassiz' }));
    return;
  }
  
  if (isPlayer1) {
    game.player1.choice = choice;
    game.player1.ready = true;
  } else if (isPlayer2) {
    game.player2.choice = choice;
    game.player2.ready = true;
  }
  
  // Harakatni saqlash
  game.moves = game.moves || [];
  game.moves.push({
    playerId: userId,
    choice: choice,
    timestamp: new Date()
  });
  
  activeGames.set(gameId, game);
  
  // Raqibga tanlov haqida xabar
  const opponentId = isPlayer1 ? game.player2?.id : game.player1?.id;
  const opponentSocket = playerSockets.get(opponentId);
  
  if (opponentSocket) {
    opponentSocket.send(JSON.stringify({
      type: 'opponent_choice_made',
      gameId: gameId
    }));
  }
  
  // Ikkala o'yinchi ham tanlaganini tekshirish
  if (game.player1.ready && game.player2?.ready) {
    await calculateGameResult(gameId);
  }
  
  ws.send(JSON.stringify({
    type: 'choice_accepted',
    choice: choice,
    gameId: gameId
  }));
}

async function handlePlayerReady(ws, data) {
  const { userId, gameId } = data;
  
  const game = activeGames.get(gameId);
  if (!game) return;
  
  if (game.player1.id === userId) {
    game.player1.connected = true;
  } else if (game.player2?.id === userId) {
    game.player2.connected = true;
  }
}

async function calculateGameResult(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  const choice1 = game.player1.choice;
  const choice2 = game.player2.choice;
  
  const rules = {
    rock: { beats: 'scissors', loses: 'paper' },
    paper: { beats: 'rock', loses: 'scissors' },
    scissors: { beats: 'paper', loses: 'rock' }
  };
  
  let result, winnerId;
  
  if (choice1 === choice2) {
    result = 'draw';
    winnerId = null;
  } else if (rules[choice1].beats === choice2) {
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
  
  // Statistikalarni yangilash
  await updateGameStats(game.player1.id, game.player2.id, result);
  
  // MongoDB'da yangilash
  await Game.updateOne(
    { gameId: gameId },
    {
      result: result,
      winnerId: winnerId,
      status: 'finished',
      finishedAt: new Date(),
      moves: game.moves
    }
  );
  
  // O'yinchilarga natija haqida xabar
  const player1Socket = playerSockets.get(game.player1.id);
  const player2Socket = playerSockets.get(game.player2.id);
  
  const resultMessage = {
    type: 'game_result',
    gameId: gameId,
    result: result,
    winnerId: winnerId,
    choices: {
      player1: choice1,
      player2: choice2
    },
    players: {
      player1: game.player1,
      player2: game.player2
    }
  };
  
  if (player1Socket) player1Socket.send(JSON.stringify(resultMessage));
  if (player2Socket) player2Socket.send(JSON.stringify(resultMessage));
  
  // Faol o'yinlardan o'chirish
  setTimeout(() => {
    activeGames.delete(gameId);
  }, 30000); // 30 soniyadan keyin
}

async function updateGameStats(player1Id, player2Id, result) {
  try {
    const updatePromises = [];
    
    if (result === 'player1_win') {
      updatePromises.push(
        User.updateOne(
          { telegramId: player1Id },
          { $inc: { 'gameStats.wins': 1, 'gameStats.totalGames': 1 } }
        ),
        User.updateOne(
          { telegramId: player2Id },
          { $inc: { 'gameStats.losses': 1, 'gameStats.totalGames': 1 } }
        )
      );
    } else if (result === 'player2_win') {
      updatePromises.push(
        User.updateOne(
          { telegramId: player2Id },
          { $inc: { 'gameStats.wins': 1, 'gameStats.totalGames': 1 } }
        ),
        User.updateOne(
          { telegramId: player1Id },
          { $inc: { 'gameStats.losses': 1, 'gameStats.totalGames': 1 } }
        )
      );
    } else { // draw
      updatePromises.push(
        User.updateOne(
          { telegramId: player1Id },
          { $inc: { 'gameStats.draws': 1, 'gameStats.totalGames': 1 } }
        ),
        User.updateOne(
          { telegramId: player2Id },
          { $inc: { 'gameStats.draws': 1, 'gameStats.totalGames': 1 } }
        )
      );
    }
    
    await Promise.all(updatePromises);
    
    // Win rate'ni yangilash
    await updateWinRate(player1Id);
    await updateWinRate(player2Id);
    
  } catch (error) {
    console.error('❌ Statistika yangilash xatosi:', error);
  }
}

async function updateWinRate(userId) {
  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user || !user.gameStats) return;
    
    const stats = user.gameStats;
    if (stats.totalGames > 0) {
      const winRate = Math.round((stats.wins / stats.totalGames) * 100);
      await User.updateOne(
        { telegramId: userId },
        { $set: { 'gameStats.winRate': winRate } }
      );
    }
  } catch (error) {
    console.error('❌ Win rate yangilash xatosi:', error);
  }
}

function startGameTimer(gameId) {
  setTimeout(async () => {
    const game = activeGames.get(gameId);
    if (!game || game.status !== 'playing') return;
    
    // Vaqt tugadi
    game.status = 'finished';
    game.result = 'timeout';
    game.finishedAt = new Date();
    
    // MongoDB'da yangilash
    await Game.updateOne(
      { gameId: gameId },
      {
        result: 'timeout',
        status: 'finished',
        finishedAt: new Date()
      }
    );
    
    // O'yinchilarga xabar
    const player1Socket = playerSockets.get(game.player1.id);
    const player2Socket = playerSockets.get(game.player2?.id);
    
    const timeoutMessage = {
      type: 'game_timeout',
      gameId: gameId,
      result: 'timeout'
    };
    
    if (player1Socket) player1Socket.send(JSON.stringify(timeoutMessage));
    if (player2Socket) player2Socket.send(JSON.stringify(timeoutMessage));
    
    // Faol o'yinlardan o'chirish
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 30000);
    
  }, 60000); // 60 soniya
}

// ==================== FOYDALANUVCHI FUNKSIYALARI ====================
async function saveOrUpdateUser(telegramUser) {
  try {
    console.log(`👤 Foydalanuvchi saqlanmoqda: ${telegramUser.id} - ${telegramUser.first_name}`);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB ulanmagan');
      return null;
    }
    
    const currentDate = new Date();
    const userData = {
      telegramId: Number(telegramUser.id),
      firstName: telegramUser.first_name || 'User',
      lastName: telegramUser.last_name || '',
      username: telegramUser.username || '',
      languageCode: telegramUser.language_code || 'en',
      isBot: telegramUser.is_bot || false,
      lastActivity: currentDate
    };
    
    const existingUser = await User.findOne({ telegramId: userData.telegramId });
    
    if (existingUser) {
      existingUser.visitCount = (existingUser.visitCount || 0) + 1;
      existingUser.lastActivity = currentDate;
      existingUser.firstName = userData.firstName;
      if (userData.username) existingUser.username = userData.username;
      
      await existingUser.save();
      console.log(`✅ Foydalanuvchi yangilandi: ${userData.telegramId}`);
      return existingUser;
    } else {
      const newUser = new User({
        ...userData,
        joinDate: currentDate,
        visitCount: 1
      });
      
      await newUser.save();
      console.log(`✅ Yangi foydalanuvchi saqlandi: ${userData.telegramId}`);
      return newUser;
    }
  } catch (error) {
    console.error('❌ Saqlash xatosi:', error.message);
    return null;
  }
}

// ==================== TELEGRAM BOT HANDLERS ====================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await saveOrUpdateUser(user);
  
  const keyboard = {
    inline_keyboard: [[
      { text: "🎮 O'ynash", web_app: { url: process.env.APP_URL || "https://your-frontend.onrender.com" } }
    ]]
  };
  
  bot.sendMessage(chatId, 
    `Salom ${user.first_name}! 👋\n` +
    `🎮 **Tosh-Qaychi-Qog'oz** o'yiniga xush kelibsiz!\n\n` +
    `O'yinni boshlash uchun tugmani bosing:`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    }
  );
});

bot.onText(/\/game/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await saveOrUpdateUser(user);
  
  const keyboard = {
    inline_keyboard: [[
      { text: "🎮 O'yinni boshlash", web_app: { url: `${process.env.APP_URL || "https://your-frontend.onrender.com"}?start_game=true` } }
    ]]
  };
  
  bot.sendMessage(chatId,
    `🎮 **O'YIN PANELI**\n\n` +
    `O'yinni boshlash uchun quyidagi tugmani bosing.\n` +
    `Sizga raqib topiladi va o'yin boshlanadi.`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    }
  );
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const dbUser = await User.findOne({ telegramId: user.id });
    const stats = dbUser?.gameStats || { wins: 0, losses: 0, draws: 0, totalGames: 0, winRate: 0 };
    
    const totalGames = await Game.countDocuments({
      $or: [
        { 'player1.id': user.id },
        { 'player2.id': user.id }
      ],
      status: 'finished'
    });
    
    const wins = await Game.countDocuments({
      $or: [
        { 'player1.id': user.id, result: 'player1_win' },
        { 'player2.id': user.id, result: 'player2_win' }
      ]
    });
    
    bot.sendMessage(chatId,
      `📊 **O'YIN STATISTIKASI**\n\n` +
      `👤 ${user.first_name}\n` +
      `🎮 Jami o'yinlar: ${totalGames}\n` +
      `🏆 G'alabalar: ${wins}\n` +
      `😔 Mag'lubiyatlar: ${stats.losses}\n` +
      `🤝 Durranglar: ${stats.draws}\n` +
      `📈 G'alaba foizi: ${stats.winRate}%\n\n` +
      `O'yinni boshlash: /game`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    bot.sendMessage(chatId, '❌ Statistika olishda xato');
  }
});

bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const topPlayers = await User.find({ 'gameStats.totalGames': { $gt: 0 } })
      .sort({ 'gameStats.winRate': -1 })
      .limit(10);
    
    let leaderboard = '🏆 **TOP 10 O\'YINCHILAR**\n\n';
    
    topPlayers.forEach((player, index) => {
      const stats = player.gameStats || { wins: 0, losses: 0, draws: 0, totalGames: 0, winRate: 0 };
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      
      leaderboard += `${medals[index] || `${index + 1}.`} ${player.firstName}\n`;
      leaderboard += `   ${stats.wins}✅ ${stats.losses}❌ ${stats.draws}🤝 (${stats.winRate}%)\n\n`;
    });
    
    bot.sendMessage(chatId, leaderboard, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Reyting jadvalini yuklashda xato');
  }
});

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (user.id.toString() !== ADMIN_ID.toString()) {
    return bot.sendMessage(chatId, '❌ Siz admin emassiz!');
  }
  
  const activeGameCount = activeGames.size;
  const waitingPlayerCount = waitingPlayers.size;
  const connectedPlayerCount = playerSockets.size;
  
  const totalGames = await Game.countDocuments();
  const finishedGames = await Game.countDocuments({ status: 'finished' });
  const todayGames = await Game.countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
  });
  
  bot.sendMessage(chatId,
    `👑 **ADMIN PANEL**\n\n` +
    `🤖 Bot holati: ${botPollingActive ? '✅ Ishlamoqda' : '❌ To\'xtatilgan'}\n` +
    `🎮 Faol o'yinlar: ${activeGameCount}\n` +
    `⏳ Kutayotgan o'yinchilar: ${waitingPlayerCount}\n` +
    `🔗 Ulangan o'yinchilar: ${connectedPlayerCount}\n\n` +
    `📊 O'yin statistikasi:\n` +
    `   • Jami o'yinlar: ${totalGames}\n` +
    `   • Tugagan o'yinlar: ${finishedGames}\n` +
    `   • Bugungi o'yinlar: ${todayGames}\n\n` +
    `🔄 Database: ${mongoose.connection.readyState === 1 ? '✅ Ulangan' : '❌ Ulanmagan'}`,
    { parse_mode: 'HTML' }
  );
});

// ==================== EXPRESS API ENDPOINTS ====================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Telegram Game Bot',
    bot: botPollingActive ? 'running' : 'stopped',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    games: {
      active: activeGames.size,
      waiting: waitingPlayers.size,
      connected: playerSockets.size
    },
    endpoints: {
      home: '/',
      admin: '/admin',
      api_stats: '/api/stats',
      api_games: '/api/games',
      api_leaderboard: '/api/leaderboard',
      health: '/health',
      ws: 'ws://' + req.get('host') + '/ws'
    }
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: botPollingActive,
    database: mongoose.connection.readyState === 1,
    games: activeGames.size,
    timestamp: new Date().toISOString()
  });
});

// API: O'yin statistikasi
app.get('/api/stats/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId ? parseInt(req.params.userId) : null;
    
    let userStats = null;
    if (userId) {
      const user = await User.findOne({ telegramId: userId });
      if (user) {
        userStats = user.gameStats;
      }
    }
    
    const totalGames = await Game.countDocuments();
    const activeGamesCount = activeGames.size;
    const todayGames = await Game.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    res.json({
      success: true,
      stats: {
        user: userStats,
        global: {
          totalGames,
          activeGames: activeGamesCount,
          todayGames,
          connectedPlayers: playerSockets.size
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: O'yinlar ro'yxati
app.get('/api/games/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId ? parseInt(req.params.userId) : null;
    const limit = parseInt(req.query.limit) || 20;
    
    let query = { status: 'finished' };
    if (userId) {
      query = {
        ...query,
        $or: [
          { 'player1.id': userId },
          { 'player2.id': userId }
        ]
      };
    }
    
    const games = await Game.find(query)
      .sort({ finishedAt: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      games: games.map(game => ({
        gameId: game.gameId,
        player1: game.player1,
        player2: game.player2,
        result: game.result,
        winnerId: game.winnerId,
        finishedAt: game.finishedAt,
        duration: game.finishedAt - game.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Reyting jadvali
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await User.find({ 'gameStats.totalGames': { $gte: 5 } })
      .sort({ 'gameStats.winRate': -1, 'gameStats.wins': -1 })
      .limit(20)
      .select('telegramId firstName username gameStats');
    
    res.json({
      success: true,
      leaderboard: topPlayers.map((player, index) => ({
        rank: index + 1,
        id: player.telegramId,
        name: player.firstName,
        username: player.username,
        stats: player.gameStats
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: O'yin yaratish (WebSocket alternativa)
app.post('/api/create-game', async (req, res) => {
  try {
    const { userId, username, firstName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId talab qilinadi' });
    }
    
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const gameData = {
      gameId,
      player1: { id: userId, username, firstName, choice: null, ready: false, connected: true },
      player2: null,
      status: 'waiting',
      createdAt: new Date()
    };
    
    activeGames.set(gameId, gameData);
    
    // MongoDB'ga saqlash
    const game = new Game({
      gameId: gameId,
      player1: gameData.player1,
      status: 'waiting'
    });
    
    await game.save();
    
    res.json({
      success: true,
      gameId: gameId,
      status: 'waiting'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Tanlov qilish
app.post('/api/make-choice', async (req, res) => {
  try {
    const { userId, gameId, choice } = req.body;
    
    if (!userId || !gameId || !choice) {
      return res.status(400).json({ success: false, error: 'Barcha maydonlar talab qilinadi' });
    }
    
    const game = activeGames.get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: 'O\'yin topilmadi' });
    }
    
    let isPlayer1 = game.player1.id === userId;
    let isPlayer2 = game.player2 && game.player2.id === userId;
    
    if (!isPlayer1 && !isPlayer2) {
      return res.status(403).json({ success: false, error: 'Siz bu o\'yinda emassiz' });
    }
    
    if (isPlayer1) {
      game.player1.choice = choice;
      game.player1.ready = true;
    } else if (isPlayer2) {
      game.player2.choice = choice;
      game.player2.ready = true;
    }
    
    // MongoDB'da yangilash
    await Game.updateOne(
      { gameId: gameId },
      isPlayer1 ? { 'player1.choice': choice, 'player1.ready': true } : { 'player2.choice': choice, 'player2.ready': true }
    );
    
    // Ikkala o'yinchi ham tanlaganini tekshirish
    if (game.player1.ready && game.player2?.ready) {
      await calculateGameResult(gameId);
    }
    
    res.json({
      success: true,
      choice: choice,
      gameId: gameId,
      status: 'choice_accepted'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==================== ADMIN PANEL API ENDPOINTS ====================
// (Bu kodni '// 404 handler' qismidan oldin qo'ying)

// 1. /api/debug - Server holati haqida batafsil ma'lumot
app.get('/api/debug', async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = mongoose.connection.readyState;

  // MongoDB collection'larini olish
  let dbInfo = {};
  try {
    if (dbState === 1) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      dbInfo.collections = collections.map(c => c.name);
      dbInfo.usersCount = await User.countDocuments();
      dbInfo.gamesCount = await Game.countDocuments({});
    }
  } catch (err) {
    dbInfo.error = err.message;
  }

  // Bot haqida ma'lumot olish
  let botInfo = {};
  try {
    botInfo = await bot.getMe();
  } catch (err) {
    botInfo = { error: err.message };
  }

  res.json({
    mongodb: {
      state: dbState,
      status: states[dbState] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      database: mongoose.connection.db?.databaseName || 'N/A',
      collections: dbInfo.collections || []
    },
    bot: {
      polling: botPollingActive,
      token: BOT_TOKEN ? 'set' : 'not set',
      adminId: ADMIN_ID || 'not set',
      info: botInfo
    },
    game: {
      activeGames: Array.from(activeGames?.values() || []).length,
      waitingPlayers: Array.from(waitingPlayers?.values() || []).length
    },
    environment: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '10000'
      }
    },
    counts: {
      users: dbInfo.usersCount || 0,
      games: dbInfo.gamesCount || 0
    }
  });
});

// 2. /api/users - Foydalanuvchilar ro'yxati (PAGINATION bilan)
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let users = [];
    let totalUsers = 0;

    if (mongoose.connection.readyState === 1) {
      // Foydalanuvchilarni bazadan olish
      users = await User.find()
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit);

      totalUsers = await User.countDocuments();
    }

    // Frontendga yuborish uchun formatlash
    const formattedUsers = users.map(user => ({
      id: user.telegramId,
      name: `${user.firstName} ${user.lastName || ''}`.trim() || 'Noma\'lum',
      username: user.username,
      joinDate: user.joinDate,
      lastActivity: user.lastActivity,
      visits: user.visitCount,
      isBot: user.isBot,
      gameStats: user.gameStats || {
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        winRate: 0
      }
    }));

    res.json({
      success: true,
      page: page,
      limit: limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      databaseConnected: mongoose.connection.readyState === 1,
      users: formattedUsers
    });

  } catch (error) {
    console.error('❌ /api/users xatosi:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: mongoose.connection.readyState === 1
    });
  }
});

// 3. /api/stats - Umumiy statistika (Bu sizda bor, lekin to'liq versiyasi)
app.get('/api/stats', async (req, res) => {
  try {
    let totalUsers = 0;
    let newToday = 0;
    let activeToday = 0;
    let totalGames = 0;
    let activeGamesCount = 0;

    if (mongoose.connection.readyState === 1) {
      totalUsers = await User.countDocuments();

      // Bugungi sana
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Bugun qo'shilganlar
      newToday = await User.countDocuments({ joinDate: { $gte: today } });

      // So'nggi 24 soatdagi faollar
      activeToday = await User.countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      // O'yin statistikasi
      totalGames = await Game.countDocuments({});
      activeGamesCount = await Game.countDocuments({ status: 'playing' });
    }

    // Faol o'yinlar (xotiradagi)
    const memoryActiveGames = activeGames ? activeGames.size : 0;
    const memoryWaitingPlayers = waitingPlayers ? waitingPlayers.size : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        activeToday,
        totalGames,
        activeGames: Math.max(activeGamesCount, memoryActiveGames),
        waitingPlayers: memoryWaitingPlayers,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        botStatus: botPollingActive ? 'running' : 'stopped'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ /api/stats xatosi:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        totalUsers: 0,
        newToday: 0,
        activeToday: 0,
        totalGames: 0,
        activeGames: 0,
        waitingPlayers: 0,
        databaseStatus: 'error',
        botStatus: 'unknown'
      }
    });
  }
});

// 4. /api/games - O'yinlar ro'yxati
app.get('/api/games', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    let games = [];
    let totalGames = 0;

    if (mongoose.connection.readyState === 1) {
      games = await Game.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      totalGames = await Game.countDocuments();
    }

    // Faol o'yinlarni qo'shish (agar mavjud bo'lsa)
    let activeGamesList = [];
    if (activeGames) {
      activeGamesList = Array.from(activeGames.values()).map(game => ({
        gameId: game.gameId,
        player1: game.player1,
        player2: game.player2,
        status: game.status,
        createdAt: game.createdAt,
        type: 'active'
      }));
    }

    res.json({
      success: true,
      page,
      limit,
      total: totalGames,
      activeCount: activeGamesList.length,
      databaseConnected: mongoose.connection.readyState === 1,
      games: games.map(game => ({
        gameId: game.gameId,
        player1: game.player1,
        player2: game.player2,
        status: game.status,
        result: game.result,
        winnerId: game.winnerId,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        type: 'completed'
      })),
      activeGames: activeGamesList
    });

  } catch (error) {
    console.error('❌ /api/games xatosi:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: mongoose.connection.readyState === 1
    });
  }
});

// 5. /api/leaderboard - Reyting jadvali
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await User.find({ 'gameStats.totalGames': { $gt: 0 } })
      .sort({ 'gameStats.winRate': -1, 'gameStats.wins': -1 })
      .limit(10)
      .select('telegramId firstName username gameStats');

    res.json({
      success: true,
      leaderboard: topPlayers.map((player, index) => ({
        rank: index + 1,
        id: player.telegramId,
        name: player.firstName,
        username: player.username,
        stats: player.gameStats || {
          wins: 0,
          losses: 0,
          draws: 0,
          totalGames: 0,
          winRate: 0
        }
      }))
    });

  } catch (error) {
    console.error('❌ /api/leaderboard xatosi:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. /api/endpoints - Barcha mavjud endpoint'lar ro'yxati
app.get('/api/endpoints', (req, res) => {
  res.json({
    endpoints: [
      { method: 'GET', path: '/', description: 'Bosh sahifa' },
      { method: 'GET', path: '/admin', description: 'Admin panel sahifasi' },
      { method: 'GET', path: '/health', description: 'Server holati' },
      { method: 'GET', path: '/api/users', description: 'Foydalanuvchilar ro\'yxati' },
      { method: 'GET', path: '/api/stats', description: 'Statistika' },
      { method: 'GET', path: '/api/games', description: 'O\'yinlar ro\'yxati' },
      { method: 'GET', path: '/api/debug', description: 'Debug ma\'lumotlari' },
      { method: 'GET', path: '/api/endpoints', description: 'Barcha endpoint\'lar' },
      { method: 'GET', path: '/api/leaderboard', description: 'Reyting jadvali' },
      { method: 'POST', path: '/api/create-game', description: 'Yangi o\'yin yaratish' },
      { method: 'GET', path: '/api/game-status/:gameId', description: 'O\'yin holati' },
      { method: 'POST', path: '/api/make-choice', description: 'Tanlov qilish' }
    ],
    description: 'Telegram Bot Game API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ==================== 404 HANDLER (BU QISMI O'ZGARMASIN) ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: [
      '/', '/admin', '/health',
      '/api/users', '/api/stats', '/api/games',
      '/api/debug', '/api/endpoints', '/api/leaderboard',
      '/api/create-game', '/api/game-status/:gameId', '/api/make-choice'
    ]
  });
});
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: ['/', '/admin', '/api/stats', '/api/games', '/api/leaderboard', '/health']
  });
});
// ==================== API ENDPOINTS ====================

// 1. Foydalanuvchilar ro'yxati
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    let users = [];
    let totalUsers = 0;
    
    if (mongoose.connection.readyState === 1) {
      users = await User.find()
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit);
      
      totalUsers = await User.countDocuments();
    }
    
    res.json({
      success: true,
      page,
      limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      databaseConnected: mongoose.connection.readyState === 1,
      users: users.map(user => ({
        id: user.telegramId,
        name: `${user.firstName} ${user.lastName || ''}`.trim() || 'Noma\'lum',
        username: user.username,
        joinDate: user.joinDate,
        lastActivity: user.lastActivity,
        visits: user.visitCount,
        isBot: user.isBot,
        gameStats: user.gameStats || {
          wins: 0,
          losses: 0,
          draws: 0,
          totalGames: 0,
          winRate: 0
        }
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: mongoose.connection.readyState === 1
    });
  }
});

// 2. Statistika
app.get('/api/stats', async (req, res) => {
  try {
    let totalUsers = 0;
    let newToday = 0;
    let activeToday = 0;
    let totalGames = 0;
    let activeGamesCount = 0;
    
    if (mongoose.connection.readyState === 1) {
      totalUsers = await User.countDocuments();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      newToday = await User.countDocuments({ joinDate: { $gte: today } });
      activeToday = await User.countDocuments({ 
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
      });
      
      totalGames = await Game.countDocuments();
      activeGamesCount = (await Game.countDocuments({ status: 'playing' })) || 0;
    }
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        activeToday,
        totalGames,
        activeGames: activeGamesCount,
        waitingPlayers: waitingPlayers.size,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        botStatus: botPollingActive ? 'running' : 'stopped'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        totalUsers: 0,
        newToday: 0,
        activeToday: 0,
        totalGames: 0,
        activeGames: 0,
        waitingPlayers: 0,
        databaseStatus: 'error',
        botStatus: 'unknown'
      }
    });
  }
});

// 3. O'yinlar ro'yxati
app.get('/api/games', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    let games = [];
    let totalGames = 0;
    
    if (mongoose.connection.readyState === 1) {
      games = await Game.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      totalGames = await Game.countDocuments();
    }
    
    // Faol o'yinlarni qo'shish
    const activeGamesList = Array.from(activeGames.values()).map(game => ({
      gameId: game.gameId,
      player1: game.player1,
      player2: game.player2,
      status: game.status,
      createdAt: game.createdAt,
      type: 'active'
    }));
    
    res.json({
      success: true,
      page,
      limit,
      total: totalGames,
      activeCount: activeGames.size,
      databaseConnected: mongoose.connection.readyState === 1,
      games: games.map(game => ({
        gameId: game.gameId,
        player1: game.player1,
        player2: game.player2,
        status: game.status,
        result: game.result,
        winnerId: game.winnerId,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        type: 'completed'
      })),
      activeGames: activeGamesList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: mongoose.connection.readyState === 1
    });
  }
});

// 4. Debug ma'lumotlari
app.get('/api/debug', async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  // Database ma'lumotlari
  let dbInfo = {};
  if (mongoose.connection.readyState === 1) {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      dbInfo = {
        collections: collections.map(c => c.name),
        usersCount: await User.countDocuments(),
        gamesCount: await Game.countDocuments()
      };
    } catch (err) {
      dbInfo = { error: err.message };
    }
  }
  
  // Bot ma'lumotlari
  let botInfo = {};
  try {
    botInfo = await bot.getMe();
  } catch (err) {
    botInfo = { error: err.message };
  }
  
  res.json({
    mongodb: {
      state: mongoose.connection.readyState,
      status: states[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      database: mongoose.connection.db?.databaseName || 'N/A',
      collections: dbInfo.collections || []
    },
    bot: {
      polling: botPollingActive,
      token: BOT_TOKEN ? 'set' : 'not set',
      adminId: ADMIN_ID || 'not set',
      botInfo: botInfo
    },
    game: {
      activeGames: activeGames.size,
      waitingPlayers: waitingPlayers.size,
      memoryGames: Array.from(activeGames.keys())
    },
    environment: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 'not set'
      }
    },
    counts: {
      users: dbInfo.usersCount || 0,
      games: dbInfo.gamesCount || 0
    },
    endpoints: {
      home: '/',
      admin: '/admin',
      api_users: '/api/users',
      api_stats: '/api/stats',
      api_games: '/api/games',
      api_debug: '/api/debug',
      health: '/health',
      create_game: 'POST /api/create-game',
      game_status: 'GET /api/game-status/:gameId',
      make_choice: 'POST /api/make-choice'
    }
  });
});

// 5. Barcha endpoint'larni ko'rsatish
app.get('/api/endpoints', (req, res) => {
  res.json({
    endpoints: [
      { method: 'GET', path: '/', description: 'Bosh sahifa' },
      { method: 'GET', path: '/admin', description: 'Admin panel sahifasi' },
      { method: 'GET', path: '/health', description: 'Server holati' },
      { method: 'GET', path: '/api/users', description: 'Foydalanuvchilar ro\'yxati' },
      { method: 'GET', path: '/api/stats', description: 'Statistika' },
      { method: 'GET', path: '/api/games', description: 'O\'yinlar ro\'yxati' },
      { method: 'GET', path: '/api/debug', description: 'Debug ma\'lumotlari' },
      { method: 'GET', path: '/api/endpoints', description: 'Barcha endpoint\'lar' },
      { method: 'GET', path: '/api/leaderboard', description: 'Reyting jadvali' },
      { method: 'POST', path: '/api/create-game', description: 'Yangi o\'yin yaratish' },
      { method: 'GET', path: '/api/game-status/:gameId', description: 'O\'yin holati' },
      { method: 'POST', path: '/api/make-choice', description: 'Tanlov qilish' }
    ],
    description: 'Telegram Bot Game API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 6. Server holati
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: botPollingActive,
    database: mongoose.connection.readyState === 1,
    active_games: activeGames.size,
    waiting_players: waitingPlayers.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});
// ==================== KOIN & SOVG'A TIZIMI ====================

// Koin schemasi
const coinSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  balance: { type: Number, default: 100 }, // Boshlang'ich koin
  earned: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastDaily: Date,
  achievements: [{
    type: String,
    date: Date
  }],
  transactions: [{
    type: String, // win, daily, bonus, purchase, gift
    amount: Number,
    description: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Coin = mongoose.model('Coin', coinSchema);

// Sovg'a (item) schemasi
const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['avatar', 'frame', 'effect', 'title'], required: true },
  price: { type: Number, required: true },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  icon: String,
  available: { type: Boolean, default: true }
}, { timestamps: true });

const Item = mongoose.model('Item', itemSchema);

// Foydalanuvchi sovg'alari
const userItemSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  itemId: { type: String, required: true },
  purchasedAt: { type: Date, default: Date.now },
  equipped: { type: Boolean, default: false },
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const UserItem = mongoose.model('UserItem', userItemSchema);

// Leaderboard schemasi
const leaderboardSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  username: String,
  firstName: String,
  totalCoins: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  rank: Number,
  weeklyWins: { type: Number, default: 0 }
}, { timestamps: true });

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

// O'yin natijasida koin berish
async function awardCoinsForGame(userId, gameResult, isWinner, winStreak = 0) {
  try {
    let userCoins = await Coin.findOne({ userId });
    
    if (!userCoins) {
      userCoins = new Coin({ 
        userId, 
        balance: 100,
        earned: 0 
      });
    }
    
    let coinsEarned = 0;
    const baseWinReward = 50;
    const baseLoseReward = 10;
    const drawReward = 20;
    
    if (isWinner) {
      coinsEarned = baseWinReward + (winStreak * 10); // Har bir ketma-ket g'alaba uchun +10
      
      // Bonus: 5+ ketma-ket g'alaba uchun bonus
      if (winStreak >= 5) coinsEarned += 50;
      if (winStreak >= 10) coinsEarned += 100;
      
      // Random bonus (1/10 ehtimol)
      if (Math.random() < 0.1) {
        const bonus = Math.floor(Math.random() * 50) + 10;
        coinsEarned += bonus;
      }
    } else if (gameResult === 'draw') {
      coinsEarned = drawReward;
    } else {
      coinsEarned = baseLoseReward;
      
      // Mag'lubiyat bonus (tasalli)
      if (Math.random() < 0.3) {
        coinsEarned += Math.floor(Math.random() * 20);
      }
    }
    
    // Koinlarni yangilash
    userCoins.balance += coinsEarned;
    userCoins.earned += coinsEarned;
    
    // Transaksiya qo'shish
    userCoins.transactions.push({
      type: isWinner ? 'win' : (gameResult === 'draw' ? 'draw' : 'lose'),
      amount: coinsEarned,
      description: `O'yin natijasi: ${gameResult}`,
      timestamp: new Date()
    });
    
    await userCoins.save();
    
    // Leaderboard yangilash
    await updateLeaderboard(userId, coinsEarned, isWinner);
    
    return coinsEarned;
  } catch (error) {
    console.error('❌ Koin berish xatosi:', error);
    return 0;
  }
}

// Daily bonus
async function getDailyBonus(userId) {
  try {
    const userCoins = await Coin.findOne({ userId });
    const now = new Date();
    
    if (!userCoins) {
      const newUserCoins = new Coin({ 
        userId, 
        balance: 150, // Daily bonus bilan boshlash
        earned: 150 
      });
      newUserCoins.dailyStreak = 1;
      newUserCoins.lastDaily = now;
      newUserCoins.transactions.push({
        type: 'daily',
        amount: 150,
        description: 'Birinchi kunlik bonus',
        timestamp: now
      });
      await newUserCoins.save();
      return { success: true, amount: 150, streak: 1, isFirst: true };
    }
    
    // Oxirgi daily bonus vaqtini tekshirish
    if (userCoins.lastDaily) {
      const lastDate = new Date(userCoins.lastDaily);
      const diffHours = (now - lastDate) / (1000 * 60 * 60);
      
      if (diffHours < 20) {
        const nextIn = Math.ceil(20 - diffHours);
        return { 
          success: false, 
          message: `Kutish kerak: ${nextIn} soat`,
          nextIn: nextIn 
        };
      }
      
      // Streak davom ettirish yoki qayta boshlash
      if (diffHours < 48) {
        userCoins.dailyStreak += 1;
      } else {
        userCoins.dailyStreak = 1;
      }
    } else {
      userCoins.dailyStreak = 1;
    }
    
    // Bonus miqdorini hisoblash
    let bonusAmount = 50; // Asosiy bonus
    bonusAmount += userCoins.dailyStreak * 10; // Streak bonus
    
    // Max 200 gacha
    if (bonusAmount > 200) bonusAmount = 200;
    
    // Random extra bonus
    if (Math.random() < 0.2) {
      bonusAmount += Math.floor(Math.random() * 50);
    }
    
    // Koinlarni yangilash
    userCoins.balance += bonusAmount;
    userCoins.earned += bonusAmount;
    userCoins.lastDaily = now;
    
    userCoins.transactions.push({
      type: 'daily',
      amount: bonusAmount,
      description: `Kunlik bonus (${userCoins.dailyStreak} kun)`,
      timestamp: now
    });
    
    // Achievement
    if (userCoins.dailyStreak >= 7) {
      userCoins.achievements.push('7_kun_streak');
    }
    if (userCoins.dailyStreak >= 30) {
      userCoins.achievements.push('30_kun_streak');
    }
    
    await userCoins.save();
    
    return { 
      success: true, 
      amount: bonusAmount, 
      streak: userCoins.dailyStreak,
      message: `+${bonusAmount} koin (${userCoins.dailyStreak} kun)` 
    };
  } catch (error) {
    console.error('❌ Daily bonus xatosi:', error);
    return { success: false, message: 'Xato yuz berdi' };
  }
}

// Leaderboard yangilash
async function updateLeaderboard(userId, coinsEarned, isWinner) {
  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    
    let leaderboard = await Leaderboard.findOne({ userId });
    
    if (!leaderboard) {
      leaderboard = new Leaderboard({
        userId,
        username: user.username,
        firstName: user.firstName,
        totalCoins: coinsEarned,
        winStreak: isWinner ? 1 : 0,
        weeklyWins: isWinner ? 1 : 0
      });
    } else {
      leaderboard.totalCoins += coinsEarned;
      
      if (isWinner) {
        leaderboard.winStreak += 1;
        leaderboard.weeklyWins += 1;
      } else {
        leaderboard.winStreak = 0;
      }
    }
    
    await leaderboard.save();
    
    // Leaderboard ranking
    await calculateLeaderboardRanks();
    
  } catch (error) {
    console.error('❌ Leaderboard yangilash xatosi:', error);
  }
}

// Leaderboard ranking hisoblash
async function calculateLeaderboardRanks() {
  try {
    const leaders = await Leaderboard.find()
      .sort({ totalCoins: -1, weeklyWins: -1 })
      .limit(100);
    
    for (let i = 0; i < leaders.length; i++) {
      leaders[i].rank = i + 1;
      await leaders[i].save();
    }
  } catch (error) {
    console.error('❌ Rank hisoblash xatosi:', error);
  }
}

// O'yin natijasida statistika yangilash (updateGameStats funksiyasini yangilash)
async function updateGameStats(player1Id, player2Id, result) {
  try {
    const updatePromises = [];
    
    // Koinlarni taqsimlash
    let player1Coins = 0, player2Coins = 0;
    
    if (result === 'player1_win') {
      // Player 1 statistika
      updatePromises.push(
        User.updateOne(
          { telegramId: player1Id },
          { 
            $inc: { 
              'gameStats.wins': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        )
      );
      
      // Player 2 statistika
      updatePromises.push(
        User.updateOne(
          { telegramId: player2Id },
          { 
            $inc: { 
              'gameStats.losses': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        )
      );
      
      // Koinlarni hisoblash
      const player1Streak = await getWinStreak(player1Id);
      const player2Streak = await getWinStreak(player2Id);
      
      player1Coins = await awardCoinsForGame(player1Id, 'win', true, player1Streak);
      player2Coins = await awardCoinsForGame(player2Id, 'lose', false, 0);
      
    } else if (result === 'player2_win') {
      // Player 2 statistika
      updatePromises.push(
        User.updateOne(
          { telegramId: player2Id },
          { 
            $inc: { 
              'gameStats.wins': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        )
      );
      
      // Player 1 statistika
      updatePromises.push(
        User.updateOne(
          { telegramId: player1Id },
          { 
            $inc: { 
              'gameStats.losses': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        )
      );
      
      // Koinlarni hisoblash
      const player2Streak = await getWinStreak(player2Id);
      const player1Streak = await getWinStreak(player1Id);
      
      player2Coins = await awardCoinsForGame(player2Id, 'win', true, player2Streak);
      player1Coins = await awardCoinsForGame(player1Id, 'lose', false, 0);
      
    } else { // draw
      updatePromises.push(
        User.updateOne(
          { telegramId: player1Id },
          { 
            $inc: { 
              'gameStats.draws': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        ),
        User.updateOne(
          { telegramId: player2Id },
          { 
            $inc: { 
              'gameStats.draws': 1, 
              'gameStats.totalGames': 1 
            } 
          }
        )
      );
      
      // Durrang uchun koinlar
      player1Coins = await awardCoinsForGame(player1Id, 'draw', false, 0);
      player2Coins = await awardCoinsForGame(player2Id, 'draw', false, 0);
    }
    
    await Promise.all(updatePromises);
    
    // Win rate'ni yangilash
    await updateWinRate(player1Id);
    await updateWinRate(player2Id);
    
    return { player1Coins, player2Coins };
    
  } catch (error) {
    console.error('❌ Statistika yangilash xatosi:', error);
    return { player1Coins: 0, player2Coins: 0 };
  }
}

// Ketma-ket g'alabalar soni
async function getWinStreak(userId) {
  try {
    const recentGames = await Game.find({
      $or: [
        { 'player1.id': userId },
        { 'player2.id': userId }
      ],
      status: 'finished'
    })
    .sort({ finishedAt: -1 })
    .limit(10);
    
    let streak = 0;
    
    for (const game of recentGames) {
      const isPlayer1 = game.player1.id === userId;
      const isWinner = (isPlayer1 && game.result === 'player1_win') || 
                      (!isPlayer1 && game.result === 'player2_win');
      
      if (isWinner) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  } catch (error) {
    console.error('❌ Win streak xatosi:', error);
    return 0;
  }
}
// ==================== YANGI API ENDPOINT'LAR ====================

// 1. Foydalanuvchi koinlari
app.get('/api/coins/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    let userCoins = await Coin.findOne({ userId });
    if (!userCoins) {
      userCoins = new Coin({ userId, balance: 100 });
      await userCoins.save();
    }
    
    // Daily bonus holati
    let dailyStatus = { available: false };
    if (userCoins.lastDaily) {
      const now = new Date();
      const lastDate = new Date(userCoins.lastDaily);
      const diffHours = (now - lastDate) / (1000 * 60 * 60);
      dailyStatus = {
        available: diffHours >= 20,
        nextIn: diffHours < 20 ? Math.ceil(20 - diffHours) : 0,
        streak: userCoins.dailyStreak
      };
    } else {
      dailyStatus = { available: true, streak: 0 };
    }
    
    // Achievements
    const achievements = [];
    if (userCoins.achievements.includes('7_kun_streak')) {
      achievements.push({ id: '7_streak', name: '7 kun ketma-ket', icon: '🔥' });
    }
    if (userCoins.achievements.includes('30_kun_streak')) {
      achievements.push({ id: '30_streak', name: '30 kun ketma-ket', icon: '👑' });
    }
    
    res.json({
      success: true,
      balance: userCoins.balance,
      earned: userCoins.earned,
      spent: userCoins.spent,
      dailyStreak: userCoins.dailyStreak,
      lastDaily: userCoins.lastDaily,
      dailyBonus: dailyStatus,
      achievements,
      recentTransactions: userCoins.transactions.slice(-5).reverse()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Daily bonus olish
app.post('/api/daily-bonus', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId talab qilinadi' });
    }
    
    const result = await getDailyBonus(userId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Leaderboard
app.get('/api/leaderboard/top', async (req, res) => {
  try {
    const topPlayers = await Leaderboard.find()
      .sort({ rank: 1 })
      .limit(50);
    
    // Foydalanuvchilar uchun buyumlarni olish
    const enrichedPlayers = await Promise.all(
      topPlayers.map(async (player) => {
        const equippedItems = await UserItem.find({ 
          userId: player.userId, 
          equipped: true 
        });
        
        return {
          rank: player.rank,
          userId: player.userId,
          name: player.firstName,
          username: player.username,
          totalCoins: player.totalCoins,
          winStreak: player.winStreak,
          weeklyWins: player.weeklyWins,
          equippedItems: equippedItems.map(item => item.itemId),
          updatedAt: player.updatedAt
        };
      })
    );
    
    // Haftalik reset (yakshanba)
    const now = new Date();
    const isSunday = now.getDay() === 0;
    const nextReset = new Date(now);
    nextReset.setDate(now.getDate() + (7 - now.getDay()));
    nextReset.setHours(0, 0, 0, 0);
    
    res.json({
      success: true,
      leaderboard: enrichedPlayers,
      resetInfo: {
        weeklyReset: isSunday,
        nextReset: nextReset,
        timeToReset: nextReset - now
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Sovg'alar do'koni
app.get('/api/shop/items', async (req, res) => {
  try {
    const items = await Item.find({ available: true });
    
    res.json({
      success: true,
      items: items.map(item => ({
        id: item.itemId,
        name: item.name,
        description: item.description,
        type: item.type,
        price: item.price,
        rarity: item.rarity,
        icon: item.icon
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Sovg'a sotib olish
app.post('/api/shop/purchase', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    
    if (!userId || !itemId) {
      return res.status(400).json({ success: false, error: 'userId va itemId talab qilinadi' });
    }
    
    // Sovg'ani tekshirish
    const item = await Item.findOne({ itemId, available: true });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Sovg\'a topilmadi' });
    }
    
    // Koinlarni tekshirish
    const userCoins = await Coin.findOne({ userId });
    if (!userCoins || userCoins.balance < item.price) {
      return res.status(400).json({ success: false, error: 'Koinlar yetarli emas' });
    }
    
    // Sovg'ani allaqachon sotib olganligini tekshirish
    const alreadyOwned = await UserItem.findOne({ userId, itemId });
    if (alreadyOwned) {
      return res.status(400).json({ success: false, error: 'Sizda bu sovg\'a bor' });
    }
    
    // Tranzaksiya
    userCoins.balance -= item.price;
    userCoins.spent += item.price;
    
    userCoins.transactions.push({
      type: 'purchase',
      amount: -item.price,
      description: `Sovg'a: ${item.name}`,
      timestamp: new Date()
    });
    
    await userCoins.save();
    
    // Sovg'ani foydalanuvchiga qo'shish
    const userItem = new UserItem({
      userId,
      itemId
    });
    
    await userItem.save();
    
    res.json({
      success: true,
      message: `"${item.name}" sovg'asi sotib olindi`,
      newBalance: userCoins.balance,
      item: {
        id: item.itemId,
        name: item.name,
        type: item.type
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Sovg'alarni kiyish
app.post('/api/items/equip', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    
    if (!userId || !itemId) {
      return res.status(400).json({ success: false, error: 'userId va itemId talab qilinadi' });
    }
    
    // Sovg'a mavjudligini tekshirish
    const userItem = await UserItem.findOne({ userId, itemId });
    if (!userItem) {
      return res.status(404).json({ success: false, error: 'Sovg\'a topilmadi' });
    }
    
    // Barcha shu turdagi sovg'alarni kiyilmagan qilish
    const itemType = (await Item.findOne({ itemId }))?.type;
    if (itemType) {
      await UserItem.updateMany(
        { 
          userId, 
          itemId: { $in: await Item.find({ type: itemType }).distinct('itemId') }
        },
        { $set: { equipped: false } }
      );
    }
    
    // Yangi sovg'ani kiyish
    userItem.equipped = true;
    await userItem.save();
    
    res.json({
      success: true,
      message: 'Sovg\'a kiyildi',
      item: {
        id: itemId,
        equipped: true
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Foydalanuvchi sovg'alari
app.get('/api/items/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const userItems = await UserItem.find({ userId });
    
    // Sovg'a ma'lumotlarini to'ldirish
    const enrichedItems = await Promise.all(
      userItems.map(async (userItem) => {
        const item = await Item.findOne({ itemId: userItem.itemId });
        return {
          itemId: userItem.itemId,
          name: item?.name || 'Noma\'lum',
          type: item?.type || 'unknown',
          rarity: item?.rarity || 'common',
          icon: item?.icon,
          purchasedAt: userItem.purchasedAt,
          equipped: userItem.equipped,
          price: item?.price || 0
        };
      })
    );
    
    // Kiyilgan sovg'alar
    const equippedItems = enrichedItems.filter(item => item.equipped);
    
    res.json({
      success: true,
      items: enrichedItems,
      equipped: equippedItems.reduce((acc, item) => {
        acc[item.type] = item;
        return acc;
      }, {})
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Bonus vazifalar
app.get('/api/quests/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Hozirgi haftaning boshlanishi
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Haftalik statistikalar
    const weeklyGames = await Game.countDocuments({
      $or: [
        { 'player1.id': userId },
        { 'player2.id': userId }
      ],
      status: 'finished',
      finishedAt: { $gte: weekStart }
    });
    
    const weeklyWins = await Game.countDocuments({
      $or: [
        { 'player1.id': userId, result: 'player1_win' },
        { 'player2.id': userId, result: 'player2_win' }
      ],
      finishedAt: { $gte: weekStart }
    });
    
    const winStreak = await getWinStreak(userId);
    
    // Vazifalar
    const quests = [
      {
        id: 'first_game',
        title: 'Birinchi o\'yin',
        description: 'Birinchi o\'yinni o\'tkaz',
        reward: 50,
        progress: Math.min(weeklyGames, 1),
        target: 1,
        completed: weeklyGames >= 1
      },
      {
        id: 'weekly_5_games',
        title: 'Haftalik o\'yinchi',
        description: 'Haftada 5 ta o\'yin o\'tkaz',
        reward: 100,
        progress: Math.min(weeklyGames, 5),
        target: 5,
        completed: weeklyGames >= 5
      },
      {
        id: 'weekly_3_wins',
        title: 'Haftalik g\'olib',
        description: 'Haftada 3 ta g\'alaba qozon',
        reward: 150,
        progress: Math.min(weeklyWins, 3),
        target: 3,
        completed: weeklyWins >= 3
      },
      {
        id: 'win_streak_3',
        title: 'Ketma-ket g\'olib',
        description: '3 ketma-ket g\'alaba qozon',
        reward: 200,
        progress: Math.min(winStreak, 3),
        target: 3,
        completed: winStreak >= 3
      },
      {
        id: 'daily_login_3',
        title: 'Sodiq o\'yinchi',
        description: '3 kun ketma-ket tizimga kir',
        reward: 300,
        progress: 0, // Bu ma'lumotni Coin modelidan olish kerak
        target: 3,
        completed: false
      }
    ];
    
    res.json({
      success: true,
      quests,
      weeklyStats: {
        games: weeklyGames,
        wins: weeklyWins,
        winStreak
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Vazifa mukofotini olish
app.post('/api/quests/claim', async (req, res) => {
  try {
    const { userId, questId } = req.body;
    
    if (!userId || !questId) {
      return res.status(400).json({ success: false, error: 'userId va questId talab qilinadi' });
    }
    
    // Vazifani tekshirish (bu oddiy misol, aslida baza bilan ishlash kerak)
    const userCoins = await Coin.findOne({ userId });
    if (!userCoins) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }
    
    // Mukofot miqdori (vazifaga qarab)
    const rewards = {
      'first_game': 50,
      'weekly_5_games': 100,
      'weekly_3_wins': 150,
      'win_streak_3': 200,
      'daily_login_3': 300
    };
    
    const rewardAmount = rewards[questId] || 0;
    if (rewardAmount === 0) {
      return res.status(400).json({ success: false, error: 'Noto\'g\'ri vazifa' });
    }
    
    // Koinlarni qo'shish
    userCoins.balance += rewardAmount;
    userCoins.earned += rewardAmount;
    
    userCoins.transactions.push({
      type: 'quest',
      amount: rewardAmount,
      description: `Vazifa mukofoti: ${questId}`,
      timestamp: new Date()
    });
    
    await userCoins.save();
    
    res.json({
      success: true,
      message: `+${rewardAmount} koin mukofoti olindi`,
      reward: rewardAmount,
      newBalance: userCoins.balance
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==================== SERVER ISHGA TUSHIRISH ====================
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`🔗 Bosh sahifa: http://localhost:${PORT}`);
  console.log(`👑 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🤖 Bot polling: ${botPollingActive ? 'ishlaydi' : 'kutilmoqda'}`);
  console.log('==========================================');
});

// Server to'xtash signallari
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM: Server to\'xtatilmoqda...');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT: Server to\'xtatilmoqda...');
  shutdown();
});

async function shutdown() {
  bot.stopPolling();
  wss.close();
  
  for (const socket of playerSockets.values()) {
    socket.close();
  }
  
  await mongoose.connection.close();
  
  console.log('✅ Server to\'xtatildi');
  process.exit(0);
}