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
  
  ws.on('close', () => {
    console.log('❌ WebSocket uzildi');
    // O'yinchini waiting ro'yxatidan o'chirish
    for (const [userId, player] of waitingPlayers.entries()) {
      if (player.socket === ws) {
        waitingPlayers.delete(userId);
        break;
      }
    }
    
    // Socket'larni tozalash
    for (const [userId, socket] of playerSockets.entries()) {
      if (socket === ws) {
        playerSockets.delete(userId);
        break;
      }
    }
  });
});

async function handleWebSocketMessage(ws, data) {
  switch (data.type) {
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: ['/', '/admin', '/api/stats', '/api/games', '/api/leaderboard', '/health']
  });
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