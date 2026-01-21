/**
 * Tosh-Qaychi-Qog'oz Multiplayer Server - To'liq Versiya
 * Telegram Mini App + WebSocket + MongoDB
 * 
 * @version 2.0.0
 * @date 2026-01
 * @features: ELO Rating, Multi-round, Invitations, Full Chat, Tournaments, Admin Dashboard
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== KONFIGURATSIYA ====================
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL ;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || Habibullox ;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Timeout konfiguratsiyalari
const RECONNECT_TIMEOUT = 5000;
const HEARTBEAT_INTERVAL = 30000;
const MAX_QUEUE_TIME = 300000;
const CLEANUP_INTERVAL = 60000;
const GAME_TIMEOUT = 60000;
const INVITATION_TIMEOUT = 120000;

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ==================== DATABASE ====================
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 100,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ==================== SCHEMA & MODELLAR ====================
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  firstName: String,
  username: String,
  languageCode: { type: String, default: 'uz' },
  isPremium: { type: Boolean, default: false },
  gameStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    elo: { type: Number, default: 1000 },
    streak: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    favoriteMove: { type: String, default: 'rock' },
    totalTimePlayed: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    lastPlayed: Date
  },
  preferences: {
    language: { type: String, default: 'uz' },
    theme: { type: String, default: 'light' },
    soundEnabled: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true },
    vibration: { type: Boolean, default: true }
  },
  friends: [{ 
    userId: Number,
    addedAt: { type: Date, default: Date.now },
    nickname: String 
  }],
  blockedUsers: [Number],
  achievements: [{
    id: String,
    unlockedAt: { type: Date, default: Date.now },
    progress: Number
  }],
  inventory: {
    coins: { type: Number, default: 1000 },
    gems: { type: Number, default: 10 },
    themes: [{ type: String, default: ['default'] }],
    avatars: [{ type: String, default: ['default'] }],
    powerups: {
      doublePoints: { type: Number, default: 0 },
      extraTime: { type: Number, default: 0 },
      revealOpponent: { type: Number, default: 0 }
    }
  },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  status: { type: String, default: 'online' }, // online, away, busy
  currentGameId: String,
  deviceInfo: mongoose.Schema.Types.Mixed,
  joinedAt: { type: Date, default: Date.now },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: Number,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual maydonlar
userSchema.virtual('displayName').get(function() {
  return this.firstName || this.username || `User_${this.telegramId}`;
});

userSchema.virtual('rank').get(function() {
  const elo = this.gameStats.elo;
  if (elo >= 2000) return 'Grandmaster';
  if (elo >= 1800) return 'Master';
  if (elo >= 1600) return 'Diamond';
  if (elo >= 1400) return 'Platinum';
  if (elo >= 1200) return 'Gold';
  if (elo >= 1000) return 'Silver';
  return 'Bronze';
});

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, index: true },
  player1: { 
    id: Number, 
    username: String, 
    firstName: String, 
    choice: String,
    elo: Number,
    score: { type: Number, default: 0 },
    hasLeft: { type: Boolean, default: false }
  },
  player2: { 
    id: Number, 
    username: String, 
    firstName: String, 
    choice: String,
    elo: Number,
    score: { type: Number, default: 0 },
    hasLeft: { type: Boolean, default: false }
  },
  status: { 
    type: String, 
    enum: ['waiting', 'playing', 'finished', 'abandoned', 'timeout'],
    default: 'waiting'
  },
  mode: { 
    type: String, 
    enum: ['casual', 'ranked', 'tournament', 'friendly'],
    default: 'casual'
  },
  result: { 
    type: String, 
    enum: ['draw', 'player1_win', 'player2_win', 'timeout', 'abandoned']
  },
  winnerId: Number,
  rounds: { type: Number, default: 3 },
  currentRound: { type: Number, default: 1 },
  roundResults: [{
    round: Number,
    player1Choice: String,
    player2Choice: String,
    result: String,
    timestamp: { type: Date, default: Date.now }
  }],
  eloChanges: {
    player1: { type: Number, default: 0 },
    player2: { type: Number, default: 0 }
  },
  tournamentId: String,
  duration: Number, // ms
  chatRoomId: String,
  settings: {
    allowSpectators: { type: Boolean, default: false },
    maxSpectators: { type: Number, default: 5 },
    isPrivate: { type: Boolean, default: false },
    password: String
  }
}, { 
  timestamps: true,
  indexes: [
    { 'player1.id': 1, 'player2.id': 1 },
    { status: 1 },
    { createdAt: -1 }
  ]
});

const tournamentSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  creatorId: { type: Number, required: true },
  maxPlayers: { type: Number, default: 16 },
  currentPlayers: { type: Number, default: 0 },
  players: [{
    userId: Number,
    username: String,
    firstName: String,
    elo: Number,
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'registered' } // registered, active, eliminated, winner
  }],
  status: { 
    type: String, 
    enum: ['open', 'full', 'in_progress', 'finished', 'cancelled'],
    default: 'open'
  },
  bracket: mongoose.Schema.Types.Mixed,
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, default: 4 },
  prizePool: { type: Number, default: 0 },
  entryFee: { type: Number, default: 0 },
  prizes: [{
    position: Number,
    prize: Number,
    prizeType: { type: String, default: 'coins' } // coins, gems, special
  }],
  settings: {
    gameMode: { type: String, default: 'ranked' },
    roundsPerMatch: { type: Number, default: 3 },
    timeLimit: { type: Number, default: 60 }, // seconds
    allowSpectators: { type: Boolean, default: true }
  },
  startedAt: Date,
  finishedAt: Date,
  winnerId: Number,
  winners: [{
    position: Number,
    userId: Number,
    prize: Number
  }]
}, { 
  timestamps: true,
  indexes: [
    { status: 1 },
    { 'players.userId': 1 },
    { createdAt: -1 }
  ]
});

const chatRoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['private', 'group', 'game', 'tournament', 'global'],
    default: 'private'
  },
  participants: [{
    userId: Number,
    username: String,
    firstName: String,
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, default: 'member' }, // member, admin, owner
    lastRead: { type: Date, default: Date.now }
  }],
  name: String,
  description: String,
  avatar: String,
  lastMessage: {
    senderId: Number,
    text: String,
    timestamp: Date
  },
  messageCount: { type: Number, default: 0 },
  settings: {
    isPublic: { type: Boolean, default: false },
    maxMembers: { type: Number, default: 100 },
    allowInvites: { type: Boolean, default: true },
    slowMode: { type: Number, default: 0 } // seconds between messages
  },
  createdBy: Number,
  gameId: String,
  tournamentId: String
}, { 
  timestamps: true,
  indexes: [
    { 'participants.userId': 1 },
    { type: 1 },
    { updatedAt: -1 }
  ]
});

const messageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  roomId: { type: String, required: true, index: true },
  senderId: { type: Number, required: true },
  senderName: String,
  type: { 
    type: String, 
    enum: ['text', 'image', 'sticker', 'system', 'game_invite', 'tournament_invite'],
    default: 'text'
  },
  content: mongoose.Schema.Types.Mixed,
  text: String,
  mediaUrl: String,
  metadata: mongoose.Schema.Types.Mixed,
  readBy: [{
    userId: Number,
    readAt: { type: Date, default: Date.now }
  }],
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  reactions: [{
    userId: Number,
    emoji: String,
    reactedAt: { type: Date, default: Date.now }
  }],
  replyTo: String
}, { 
  timestamps: true,
  indexes: [
    { roomId: 1, createdAt: -1 },
    { senderId: 1, createdAt: -1 }
  ]
});

const achievementSchema = new mongoose.Schema({
  achievementId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  category: { 
    type: String, 
    enum: ['games', 'wins', 'streak', 'social', 'collection', 'special'],
    default: 'games'
  },
  icon: String,
  points: { type: Number, default: 10 },
  rarity: { 
    type: String, 
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  condition: {
    type: String,
    required: true, // e.g., "wins >= 10", "elo >= 1500"
    default: "true"
  },
  rewards: {
    coins: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    theme: String,
    avatar: String
  },
  isSecret: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  notificationId: { type: String, required: true, unique: true },
  userId: { type: Number, required: true, index: true },
  type: {
    type: String,
    enum: ['game_invite', 'tournament_invite', 'friend_request', 'game_result', 
           'achievement', 'system', 'chat_message', 'tournament_start'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  actionUrl: String,
  expiresAt: Date
}, { 
  timestamps: true,
  indexes: [
    { userId: 1, read: 1, createdAt: -1 }
  ]
});

// Modellar
const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);
const Tournament = mongoose.model('Tournament', tournamentSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const Message = mongoose.model('Message', messageSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ==================== IN-MEMORY STATE ====================
const playerSessions = new Map(); // userId → session object
const matchmakingQueue = new Map(); // userId → queue entry
const activeGames = new Map(); // gameId → game object
const pendingInvitations = new Map(); // invitationId → invitation
const chatRooms = new Map(); // roomId → chat room object
const activeTournaments = new Map(); // tournamentId → tournament object
const systemLogs = [];
const rateLimit = new Map(); // ip → { count, resetTime }
const gameSpectators = new Map(); // gameId → [userId]
const tournamentSpectators = new Map(); // tournamentId → [userId]

// ==================== TELEGRAM BOT ====================
let bot;
if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const { id, first_name, username, language_code } = msg.from;
    
    try {
      await User.findOneAndUpdate(
        { telegramId: id },
        { 
          telegramId: id, 
          firstName: first_name, 
          username: username,
          languageCode: language_code || 'uz',
          lastSeen: new Date(),
          isOnline: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      const welcomeText = {
        uz: `Assalomu alaykum, ${first_name}! 👋\nTosh-Qaychi-Qog'oz o'yiniga xush kelibsiz!`,
        ru: `Привет, ${first_name}! 👋\nДобро пожаловать в игру Камень-Ножницы-Бумага!`,
        en: `Hello, ${first_name}! 👋\nWelcome to Rock-Paper-Scissors game!`
      };
      
      const text = welcomeText[language_code] || welcomeText.uz;
      
      bot.sendMessage(msg.chat.id, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 O'ynash", web_app: { url: WEB_APP_URL } }],
            [{ text: "📊 Statistika", callback_data: "stats" }],
            [{ text: "🏆 Turnirlar", callback_data: "tournaments" }],
            [{ text: "👥 Do'stlar", callback_data: "friends" }]
          ]
        },
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Bot start error:', error);
    }
  });

  bot.onText(/\/stats/, async (msg) => {
    const userId = msg.from.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (user) {
      const stats = user.gameStats;
      const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : 0;
      
      const statsText = {
        uz: `📊 Sizning statistikaniz:\n\n` +
            `🎮 O'yinlar: ${stats.totalGames}\n` +
            `✅ G'alabalar: ${stats.wins}\n` +
            `❌ Mag'lubiyatlar: ${stats.losses}\n` +
            `🤝 Duranglar: ${stats.draws}\n` +
            `📈 G'alaba foizi: ${winRate}%\n` +
            `⭐ ELO reyting: ${stats.elo}\n` +
            `🔥 Seriya: ${stats.streak}\n` +
            `👑 Daraja: ${user.rank}`,
        ru: `📊 Ваша статистика:\n\n` +
            `🎮 Игры: ${stats.totalGames}\n` +
            `✅ Победы: ${stats.wins}\n` +
            `❌ Поражения: ${stats.losses}\n` +
            `🤝 Ничьи: ${stats.draws}\n` +
            `📈 Процент побед: ${winRate}%\n` +
            `⭐ Рейтинг ELO: ${stats.elo}\n` +
            `🔥 Серия: ${stats.streak}\n` +
            `👑 Ранг: ${user.rank}`,
        en: `📊 Your statistics:\n\n` +
            `🎮 Games: ${stats.totalGames}\n` +
            `✅ Wins: ${stats.wins}\n` +
            `❌ Losses: ${stats.losses}\n` +
            `🤝 Draws: ${stats.draws}\n` +
            `📈 Win rate: ${winRate}%\n` +
            `⭐ ELO rating: ${stats.elo}\n` +
            `🔥 Streak: ${stats.streak}\n` +
            `👑 Rank: ${user.rank}`
      };
      
      const text = statsText[user.preferences?.language] || statsText.uz;
      bot.sendMessage(msg.chat.id, text);
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    
    switch (callbackQuery.data) {
      case 'stats':
        // Stats already handled above
        break;
      case 'tournaments':
        const activeTournaments = await Tournament.find({ 
          status: { $in: ['open', 'in_progress'] }
        }).limit(5);
        
        if (activeTournaments.length > 0) {
          let tournamentsText = '🏆 Faol turnirlar:\n\n';
          activeTournaments.forEach((tournament, index) => {
            tournamentsText += `${index + 1}. ${tournament.name}\n`;
            tournamentsText += `   👥 ${tournament.currentPlayers}/${tournament.maxPlayers}\n`;
            tournamentsText += `   🏅 Pul fondi: ${tournament.prizePool} coins\n\n`;
          });
          
          bot.sendMessage(msg.chat.id, tournamentsText);
        } else {
          bot.sendMessage(msg.chat.id, 'Hozircha faol turnirlar yo\'q. Birozdan keyin tekshiring.');
        }
        break;
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
  });

  console.log('✅ Telegram bot started');
} else {
  console.log('⚠️ Telegram bot token not provided, bot disabled');
}

// ==================== UTILITY FUNCTIONS ====================
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeSend(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Send error:', err.message);
      return false;
    }
  }
  return false;
}

function getPlayerSocket(userId) {
  const session = playerSessions.get(userId);
  return session?.ws;
}

function getPlayerSession(userId) {
  return playerSessions.get(userId);
}

function updatePlayerSession(userId, updates) {
  const session = playerSessions.get(userId);
  if (session) {
    Object.assign(session, updates);
    playerSessions.set(userId, session);
    return true;
  }
  return false;
}

function logSystemEvent(type, message, data = {}) {
  const logEntry = {
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
    pid: process.pid
  };
  
  systemLogs.push(logEntry);
  
  if (systemLogs.length > 1000) {
    systemLogs.shift();
  }
  
  const colors = {
    error: '\x1b[31m',
    warning: '\x1b[33m',
    info: '\x1b[36m',
    success: '\x1b[32m',
    security: '\x1b[35m'
  };
  
  console.log(`${colors[type] || ''}[${type.toUpperCase()}] ${message}\x1b[0m`);
  
  if (type === 'error' || type === 'security') {
    // Monitoring service'ga yuborish
  }
}

function checkRateLimit(ip, limit = 100, windowMs = 60000) {
  const now = Date.now();
  const userLimit = rateLimit.get(ip) || { count: 0, resetTime: now + windowMs };
  
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + windowMs;
  }
  
  userLimit.count++;
  rateLimit.set(ip, userLimit);
  
  if (userLimit.count > limit) {
    logSystemEvent('security', `Rate limit exceeded for IP: ${ip}`);
  }
  
  return userLimit.count <= limit;
}

function calculateELO(playerAELO, playerBELO, result) {
  const K = 32;
  
  const expectedA = 1 / (1 + Math.pow(10, (playerBELO - playerAELO) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (playerAELO - playerBELO) / 400));
  
  let scoreA, scoreB;
  
  switch (result) {
    case 'player1_win':
      scoreA = 1; scoreB = 0; break;
    case 'player2_win':
      scoreA = 0; scoreB = 1; break;
    default:
      scoreA = 0.5; scoreB = 0.5;
  }
  
  const newELOA = Math.round(playerAELO + K * (scoreA - expectedA));
  const newELOB = Math.round(playerBELO + K * (scoreB - expectedB));
  
  return {
    playerA: Math.max(100, newELOA),
    playerB: Math.max(100, newELOB),
    changeA: newELOA - playerAELO,
    changeB: newELOB - playerBELO
  };
}

function validateChoice(choice) {
  const validChoices = ['rock', 'paper', 'scissors'];
  return validChoices.includes(choice);
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

async function createNotification(userId, type, title, message, data = {}) {
  try {
    const notification = new Notification({
      notificationId: generateId('notif_'),
      userId,
      type,
      title,
      message,
      data,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 kun
    });
    
    await notification.save();
    
    // Real-time notification
    const session = getPlayerSession(userId);
    if (session?.ws) {
      safeSend(session.ws, {
        type: 'notification',
        notification: {
          id: notification.notificationId,
          type,
          title,
          message,
          data,
          createdAt: notification.createdAt
        }
      });
    }
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
}

// ==================== WEBSOCKET SERVER ====================
wss.on('connection', (ws, req) => {
  console.log('[WS] New connection established');
  
  const session = {
    ws,
    userId: null,
    authenticated: false,
    lastHeartbeat: Date.now(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    deviceInfo: null,
    gameId: null,
    status: 'connecting'
  };
  
  // Heartbeat
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);
  
  ws.on('pong', () => {
    if (session.userId) {
      const playerSession = playerSessions.get(session.userId);
      if (playerSession) {
        playerSession.lastHeartbeat = Date.now();
      }
    }
    session.lastHeartbeat = Date.now();
  });
  
  ws.on('message', async (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      await handleMessage(ws, data, session);
    } catch (err) {
      console.error('[WS] Message parse error:', err.message);
      safeSend(ws, { type: 'error', message: 'Invalid message format' });
    }
  });
  
  ws.on('close', (code, reason) => {
    clearInterval(heartbeatInterval);
    handleDisconnect(session);
  });
  
  ws.on('error', (error) => {
    console.error('[WS] Connection error:', error.message);
    handleDisconnect(session);
  });
});

async function handleDisconnect(session) {
  if (session.userId) {
    logSystemEvent('info', `User disconnected: ${session.userId}`);
    
    const playerSession = playerSessions.get(session.userId);
    if (playerSession) {
      playerSession.status = 'offline';
      playerSession.lastSeen = Date.now();
      
      // Database'da offline qilish
      try {
        await User.updateOne(
          { telegramId: session.userId },
          { 
            isOnline: false,
            lastSeen: new Date(),
            status: 'offline'
          }
        );
      } catch (error) {
        console.error('Update user online status error:', error);
      }
      
      // Navbatdan chiqarish
      if (matchmakingQueue.has(session.userId)) {
        matchmakingQueue.delete(session.userId);
        logSystemEvent('info', `Removed ${session.userId} from queue (disconnected)`);
      }
      
      // O'yinni qayta ishlash
      if (playerSession.gameId) {
        await handlePlayerDisconnectFromGame(session.userId, playerSession.gameId);
      }
    }
    
    playerSessions.delete(session.userId);
  }
}

async function handlePlayerDisconnectFromGame(userId, gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.status !== 'playing') return;
  
  // Qaysi o'yinchi ekanligini aniqlash
  const isPlayer1 = game.player1.id === userId;
  const isPlayer2 = game.player2?.id === userId;
  
  if (!isPlayer1 && !isPlayer2) return;
  
  // O'yinchi o'yinni tark etgan deb belgilash
  if (isPlayer1) {
    game.player1.hasLeft = true;
  } else {
    game.player2.hasLeft = true;
  }
  
  const opponentId = isPlayer1 ? game.player2?.id : game.player1.id;
  const opponentSession = getPlayerSession(opponentId);
  
  if (opponentSession) {
    // Raqibga xabar
    safeSend(opponentSession.ws, {
      type: 'opponent_disconnected',
      gameId,
      message: 'Raqib uzildi. 30 soniya ichida qaytmasa, siz g‘alaba qozonasiz.',
      timeout: 30
    });
    
    // 30 soniya kutish
    setTimeout(async () => {
      const currentGame = activeGames.get(gameId);
      if (currentGame && currentGame.status === 'playing') {
        const stillDisconnected = isPlayer1 ? 
          currentGame.player1.hasLeft : currentGame.player2.hasLeft;
        
        if (stillDisconnected) {
          const winnerId = opponentId;
          await forceEndGame(gameId, winnerId, 'abandoned');
        }
      }
    }, 30000);
  } else {
    // Agar raqib ham uzilgan bo'lsa
    await forceEndGame(gameId, null, 'abandoned');
  }
}

// ==================== MESSAGE HANDLER ====================
async function handleMessage(ws, data, session) {
  // Rate limiting
  if (!checkRateLimit(session.ip)) {
    safeSend(ws, {
      type: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Juda ko‘p so‘rov. Iltimos, biroz kuting.'
    });
    return;
  }
  
  try {
    switch (data.type) {
      case 'authenticate':
        await handleAuthentication(ws, data, session);
        break;
        
      case 'join_queue':
        await handleJoinQueue(ws, data, session);
        break;
        
      case 'leave_queue':
        await handleLeaveQueue(ws, data, session);
        break;
        
      case 'make_choice':
        await handleMakeChoice(ws, data, session);
        break;
        
      case 'chat_message':
        await handleChatMessage(ws, data, session);
        break;
        
      case 'invite_player':
        await handleInvitePlayer(ws, data, session);
        break;
        
      case 'respond_invitation':
        await handleRespondInvitation(ws, data, session);
        break;
        
      case 'request_rematch':
        await handleRequestRematch(ws, data, session);
        break;
        
      case 'create_tournament':
        await handleCreateTournament(ws, data, session);
        break;
        
      case 'join_tournament':
        await handleJoinTournament(ws, data, session);
        break;
        
      case 'friend_request':
        await handleFriendRequest(ws, data, session);
        break;
        
      case 'update_status':
        await handleUpdateStatus(ws, data, session);
        break;
        
      case 'heartbeat':
        session.lastHeartbeat = Date.now();
        safeSend(ws, { type: 'heartbeat', timestamp: Date.now() });
        break;
        
      case 'get_profile':
        await handleGetProfile(ws, data, session);
        break;
        
      case 'spectate_game':
        await handleSpectateGame(ws, data, session);
        break;
        
      default:
        safeSend(ws, { 
          type: 'error', 
          message: 'Noma\'lum xabar turi',
          receivedType: data.type 
        });
    }
  } catch (error) {
    console.error('Message handler error:', error);
    safeSend(ws, { 
      type: 'error', 
      message: 'Server xatosi', 
      error: error.message 
    });
  }
}

async function handleAuthentication(ws, data, session) {
  const { initData, deviceInfo } = data;
  
  if (!initData) {
    safeSend(ws, { 
      type: 'error', 
      code: 'AUTH_REQUIRED',
      message: 'Autentifikatsiya talab qilinadi' 
    });
    return;
  }
  
  try {
    // Telegram Mini App initData'ni tekshirish
    const urlParams = new URLSearchParams(initData);
    const authDate = parseInt(urlParams.get('auth_date'));
    
    // Auth date tekshirish (24 soat)
    if (Date.now() / 1000 - authDate > 86400) {
      safeSend(ws, { 
        type: 'error', 
        code: 'SESSION_EXPIRED',
        message: 'Session muddati o\'tgan. Qayta kiring.' 
      });
      ws.close(4001, 'Session expired');
      return;
    }
    
    // User ma'lumotlarini olish
    const userParam = urlParams.get('user');
    if (!userParam) {
      safeSend(ws, { 
        type: 'error', 
        code: 'INVALID_USER_DATA',
        message: 'Foydalanuvchi ma\'lumotlari topilmadi' 
      });
      return;
    }
    
    const userData = JSON.parse(decodeURIComponent(userParam));
    const userId = userData.id;
    
    if (!userId) {
      safeSend(ws, { 
        type: 'error', 
        code: 'INVALID_USER_ID',
        message: 'Foydalanuvchi ID si topilmadi' 
      });
      return;
    }
    
    // Database'dan foydalanuvchini topish yoki yaratish
    let user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      // Yangi foydalanuvchi yaratish
      user = new User({
        telegramId: userId,
        firstName: userData.first_name,
        username: userData.username,
        languageCode: userData.language_code || 'uz',
        referralCode: generateReferralCode()
      });
      await user.save();
      
      logSystemEvent('info', `New user created: ${userId} (${userData.first_name})`);
    } else {
      // Mavjud foydalanuvchini yangilash
      user.lastSeen = new Date();
      user.isOnline = true;
      user.status = 'online';
      await user.save();
    }
    
    // Session yaratish
    session.userId = userId;
    session.authenticated = true;
    session.status = 'online';
    session.deviceInfo = deviceInfo;
    session.user = {
      id: userId,
      firstName: user.firstName,
      username: user.username,
      elo: user.gameStats.elo,
      rank: user.rank
    };
    
    playerSessions.set(userId, session);
    
    // Oldingi session bor bo'lsa, uni yopish
    const oldSession = getPlayerSession(userId);
    if (oldSession && oldSession.ws !== ws) {
      safeSend(oldSession.ws, {
        type: 'session_replaced',
        message: 'Siz boshqa qurilmadan kirdingiz'
      });
      oldSession.ws.close(4002, 'New session');
    }
    
    // Foydalanuvchiga javob
    safeSend(ws, {
      type: 'authenticated',
      user: {
        id: user.telegramId,
        firstName: user.firstName,
        username: user.username,
        stats: user.gameStats,
        preferences: user.preferences,
        inventory: user.inventory,
        rank: user.rank,
        level: user.level,
        xp: user.xp
      },
      serverTime: Date.now(),
      sessionId: generateId('sess_')
    });
    
    logSystemEvent('info', `User authenticated: ${userId} (${user.firstName})`);
    
    // Readylikni tekshirish (o'yin o'rtasida uzilgan bo'lsa)
    if (user.currentGameId) {
      const game = activeGames.get(user.currentGameId);
      if (game && game.status === 'playing') {
        safeSend(ws, {
          type: 'reconnect_to_game',
          gameId: user.currentGameId,
          gameState: game
        });
      }
    }
    
    // O'qilmagan notification'larni yuborish
    const unreadNotifications = await Notification.find({
      userId,
      read: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).limit(10);
    
    if (unreadNotifications.length > 0) {
      safeSend(ws, {
        type: 'pending_notifications',
        notifications: unreadNotifications
      });
    }
    
  } catch (error) {
    console.error('Authentication error:', error);
    safeSend(ws, { 
      type: 'error', 
      code: 'AUTH_FAILED',
      message: 'Autentifikatsiya muvaffaqiyatsiz' 
    });
  }
}

async function handleJoinQueue(ws, data, session) {
  if (!session.authenticated) {
    safeSend(ws, { 
      type: 'error', 
      code: 'UNAUTHENTICATED',
      message: 'Avval autentifikatsiya qiling' 
    });
    return;
  }
  
  const { mode = 'casual', gameType = 'single' } = data;
  const userId = session.userId;
  
  // Navbatda borligini tekshirish
  if (matchmakingQueue.has(userId)) {
    safeSend(ws, { 
      type: 'error', 
      code: 'ALREADY_IN_QUEUE',
      message: 'Siz allaqachon navbatdasiz' 
    });
    return;
  }
  
  // Faol o'yinda borligini tekshirish
  if (session.gameId) {
    const game = activeGames.get(session.gameId);
    if (game && game.status === 'playing') {
      safeSend(ws, { 
        type: 'error', 
        code: 'ALREADY_IN_GAME',
        message: 'Siz allaqachon oyindasiz' 
      });
      return;
    }
  }
  
  const user = await User.findOne({ telegramId: userId });
  if (!user) {
    safeSend(ws, { 
      type: 'error', 
      code: 'USER_NOT_FOUND',
      message: 'Foydalanuvchi topilmadi' 
    });
    return;
  }
  
  // Navbatga qo'shish
  const queueEntry = {
    userId,
    joinedAt: Date.now(),
    elo: user.gameStats.elo,
    mode,
    gameType,
    searchRadius: 200,
    session
  };
  
  matchmakingQueue.set(userId, queueEntry);
  
  // Session yangilash
  updatePlayerSession(userId, { 
    status: 'queued',
    queueMode: mode 
  });
  
  // Javob yuborish
  safeSend(ws, {
    type: 'joined_queue',
    mode,
    position: matchmakingQueue.size,
    estimatedWait: Math.max(30, matchmakingQueue.size * 10),
    timestamp: Date.now()
  });
  
  logSystemEvent('info', `User joined queue: ${userId} (${mode} mode)`);
  
  // Matchmaking boshlash
  attemptMatchmaking();
}

async function handleLeaveQueue(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const userId = session.userId;
  
  if (matchmakingQueue.has(userId)) {
    matchmakingQueue.delete(userId);
    
    safeSend(ws, {
      type: 'left_queue',
      timestamp: Date.now()
    });
    
    updatePlayerSession(userId, { 
      status: 'online',
      queueMode: null 
    });
    
    logSystemEvent('info', `User left queue: ${userId}`);
  }
}

async function handleMakeChoice(ws, data, session) {
  if (!session.authenticated) {
    safeSend(ws, { 
      type: 'error', 
      code: 'UNAUTHENTICATED',
      message: 'Avval autentifikatsiya qiling' 
    });
    return;
  }
  
  const { gameId, choice, round = 1 } = data;
  const userId = session.userId;
  
  if (!gameId || !choice) {
    safeSend(ws, { 
      type: 'error', 
      code: 'INVALID_DATA',
      message: 'GameId va Choice talab qilinadi' 
    });
    return;
  }
  
  if (!validateChoice(choice)) {
    safeSend(ws, { 
      type: 'error', 
      code: 'INVALID_CHOICE',
      message: 'Noto\'g\'ri tanlov. Rock, Paper yoki Scissors tanlang.' 
    });
    return;
  }
  
  const game = activeGames.get(gameId);
  if (!game) {
    safeSend(ws, { 
      type: 'error', 
      code: 'GAME_NOT_FOUND',
      message: 'O\'yin topilmadi' 
    });
    return;
  }
  
  // O'yinchi tekshirish
  const isPlayer1 = game.player1.id === userId;
  const isPlayer2 = game.player2?.id === userId;
  
  if (!isPlayer1 && !isPlayer2) {
    safeSend(ws, { 
      type: 'error', 
      code: 'NOT_IN_GAME',
      message: 'Siz bu o\'yinda emassiz' 
    });
    return;
  }
  
  // Tanlovni saqlash
  if (isPlayer1) {
    game.player1.choice = choice;
  } else {
    game.player2.choice = choice;
  }
  
  // Raund natijasini saqlash
  if (!game.roundResults) {
    game.roundResults = [];
  }
  
  // Ikkala o'yinchi ham tanlagan bo'lsa
  if (game.player1.choice && game.player2?.choice) {
    const roundResult = determineRoundResult(game.player1.choice, game.player2.choice);
    
    game.roundResults.push({
      round: game.currentRound,
      player1Choice: game.player1.choice,
      player2Choice: game.player2.choice,
      result: roundResult,
      timestamp: new Date()
    });
    
    // Hisobni yangilash
    if (roundResult === 'player1_win') {
      game.player1.score++;
    } else if (roundResult === 'player2_win') {
      game.player2.score++;
    }
    
    // Raqibga xabar
    const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
    const opponentSession = getPlayerSession(opponentId);
    
    if (opponentSession) {
      safeSend(opponentSession.ws, {
        type: 'round_result',
        gameId,
        round: game.currentRound,
        result: roundResult,
        choices: {
          player1: game.player1.choice,
          player2: game.player2.choice
        },
        scores: {
          player1: game.player1.score,
          player2: game.player2.score
        }
      });
    }
    
    // O'yinchilarga xabar
    safeSend(ws, {
      type: 'round_result',
      gameId,
      round: game.currentRound,
      result: roundResult,
      choices: {
        player1: game.player1.choice,
        player2: game.player2.choice
      },
      scores: {
        player1: game.player1.score,
        player2: game.player2.score
      }
    });
    
    // Tanlovlarni tozalash keyingi raund uchun
    game.player1.choice = null;
    game.player2.choice = null;
    game.currentRound++;
    
    // O'yin tugashini tekshirish
    if (game.currentRound > game.rounds) {
      await finalizeGame(gameId);
    } else {
      // Keyingi raund boshlanishi
      setTimeout(() => {
        const currentGame = activeGames.get(gameId);
        if (currentGame && currentGame.status === 'playing') {
          sendToPlayers(gameId, {
            type: 'next_round',
            gameId,
            round: currentGame.currentRound,
            scores: {
              player1: currentGame.player1.score,
              player2: currentGame.player2.score
            }
          });
        }
      }, 2000);
    }
  } else {
    // Faqat bitta tanlov bo'lsa
    safeSend(ws, {
      type: 'choice_accepted',
      gameId,
      choice,
      waitingForOpponent: true
    });
    
    // Raqibga xabar
    const opponentId = isPlayer1 ? game.player2.id : game.player1.id;
    const opponentSession = getPlayerSession(opponentId);
    
    if (opponentSession) {
      safeSend(opponentSession.ws, {
        type: 'opponent_choice_made',
        gameId
      });
    }
  }
  
  activeGames.set(gameId, game);
}

async function handleChatMessage(ws, data, session) {
  if (!session.authenticated) {
    safeSend(ws, { 
      type: 'error', 
      code: 'UNAUTHENTICATED',
      message: 'Avval autentifikatsiya qiling' 
    });
    return;
  }
  
  const { roomId, text, type = 'text' } = data;
  const userId = session.userId;
  
  if (!roomId || !text || text.trim() === '') {
    safeSend(ws, { 
      type: 'error', 
      code: 'INVALID_MESSAGE',
      message: 'Xabar matni bo\'sh bo\'lmasligi kerak' 
    });
    return;
  }
  
  // Xabar uzunligini cheklash
  const messageText = text.trim().slice(0, 2000);
  
  try {
    let room = chatRooms.get(roomId);
    
    // Agar room topilmasa, database'dan qidirish
    if (!room) {
      const dbRoom = await ChatRoom.findOne({ roomId });
      if (dbRoom) {
        room = dbRoom.toObject();
        chatRooms.set(roomId, room);
      }
    }
    
    if (!room) {
      safeSend(ws, { 
        type: 'error', 
        code: 'ROOM_NOT_FOUND',
        message: 'Chat topilmadi' 
      });
      return;
    }
    
    // Ishtirokchi ekanligini tekshirish
    const participant = room.participants.find(p => p.userId === userId);
    if (!participant) {
      safeSend(ws, { 
        type: 'error', 
        code: 'NOT_PARTICIPANT',
        message: 'Siz bu chat\'da emassiz' 
      });
      return;
    }
    
    // Slow mode tekshirish
    if (room.settings?.slowMode > 0) {
      const lastMessage = await Message.findOne({
        roomId,
        senderId: userId
      }).sort({ createdAt: -1 });
      
      if (lastMessage) {
        const timeDiff = Date.now() - lastMessage.createdAt.getTime();
        if (timeDiff < room.settings.slowMode * 1000) {
          const waitTime = Math.ceil((room.settings.slowMode * 1000 - timeDiff) / 1000);
          safeSend(ws, { 
            type: 'error', 
            code: 'SLOW_MODE',
            message: `Iltimos, ${waitTime} soniya kuting`,
            waitTime
          });
          return;
        }
      }
    }
    
    // Message yaratish
    const messageId = generateId('msg_');
    const message = {
      messageId,
      roomId,
      senderId: userId,
      senderName: session.user?.firstName || `User_${userId}`,
      type,
      text: messageText,
      content: { text: messageText },
      readBy: [{ userId, readAt: new Date() }],
      reactions: [],
      createdAt: new Date()
    };
    
    // Database'ga saqlash
    const messageDoc = new Message(message);
    await messageDoc.save();
    
    // Room'ni yangilash
    room.lastMessage = {
      senderId: userId,
      text: messageText,
      timestamp: new Date()
    };
    room.messageCount = (room.messageCount || 0) + 1;
    room.updatedAt = new Date();
    
    // In-memory yangilash
    chatRooms.set(roomId, room);
    
    // Database'dagi room'ni yangilash
    await ChatRoom.updateOne(
      { roomId },
      {
        lastMessage: room.lastMessage,
        messageCount: room.messageCount,
        updatedAt: new Date()
      }
    );
    
    // Xabarni barcha ishtirokchilarga yuborish
    const messagePayload = {
      type: 'chat_message',
      roomId,
      message: {
        ...message,
        id: messageId,
        createdAt: message.createdAt.toISOString()
      }
    };
    
    for (const participant of room.participants) {
      if (participant.userId !== userId) {
        const participantSession = getPlayerSession(participant.userId);
        if (participantSession) {
          // Read by ni yangilash
          messageDoc.readBy.push({ userId: participant.userId, readAt: new Date() });
          
          // Xabarni yuborish
          safeSend(participantSession.ws, messagePayload);
          
          // Notification yaratish
          if (participantSession.status === 'offline' || 
              (participantSession.status === 'online' && !participantSession.gameId)) {
            await createNotification(
              participant.userId,
              'chat_message',
              `Yangi xabar: ${session.user?.firstName}`,
              messageText,
              { roomId, senderId: userId }
            );
          }
        }
      }
    }
    
    // O'ziga xabar yuborish (confirmation)
    safeSend(ws, {
      type: 'message_sent',
      messageId,
      roomId,
      timestamp: Date.now()
    });
    
    // Read by ni saqlash
    await messageDoc.save();
    
  } catch (error) {
    console.error('Chat message error:', error);
    safeSend(ws, { 
      type: 'error', 
      code: 'CHAT_ERROR',
      message: 'Xabar yuborishda xatolik' 
    });
  }
}

async function handleInvitePlayer(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { inviteeId, gameMode = 'casual', rounds = 3 } = data;
  const inviterId = session.userId;
  
  if (inviterId === inviteeId) {
    safeSend(ws, { 
      type: 'error', 
      code: 'SELF_INVITE',
      message: 'O\'zingizni taklif qilolmaysiz' 
    });
    return;
  }
  
  // Invitee online ekanligini tekshirish
  const inviteeSession = getPlayerSession(inviteeId);
  if (!inviteeSession) {
    safeSend(ws, { 
      type: 'error', 
      code: 'USER_OFFLINE',
      message: 'Foydalanuvchi hozir offline' 
    });
    return;
  }
  
  // Invitee allaqachon o'yinda ekanligini tekshirish
  if (inviteeSession.gameId) {
    safeSend(ws, { 
      type: 'error', 
      code: 'USER_IN_GAME',
      message: 'Foydalanuvchi hozir o\'yinda' 
    });
    return;
  }
  
  // Taklif yaratish
  const invitationId = generateId('inv_');
  const invitation = {
    invitationId,
    inviterId,
    inviteeId,
    gameMode,
    rounds,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITATION_TIMEOUT
  };
  
  pendingInvitations.set(invitationId, invitation);
  
  // Invitee'ga xabar yuborish
  safeSend(inviteeSession.ws, {
    type: 'game_invitation',
    invitationId,
    inviter: {
      id: inviterId,
      firstName: session.user?.firstName,
      username: session.user?.username,
      elo: session.user?.elo
    },
    gameMode,
    rounds,
    expiresIn: 120
  });
  
  // Inviter'ga xabar yuborish
  safeSend(ws, {
    type: 'invitation_sent',
    invitationId,
    invitee: {
      id: inviteeId,
      firstName: inviteeSession.user?.firstName,
      username: inviteeSession.user?.username
    }
  });
  
  // Notification yaratish
  await createNotification(
    inviteeId,
    'game_invite',
    `O'yin taklifi: ${session.user?.firstName}`,
    `${session.user?.firstName} sizni o'yinga taklif qildi`,
    { invitationId, inviterId, gameMode }
  );
  
  // Taklifning muddati o'tishi
  setTimeout(() => {
    const currentInvitation = pendingInvitations.get(invitationId);
    if (currentInvitation && currentInvitation.status === 'pending') {
      currentInvitation.status = 'expired';
      pendingInvitations.delete(invitationId);
      
      // Taklifchiga xabar
      const inviterWs = getPlayerSocket(inviterId);
      if (inviterWs) {
        safeSend(inviterWs, {
          type: 'invitation_expired',
          invitationId
        });
      }
    }
  }, INVITATION_TIMEOUT);
  
  logSystemEvent('info', `Game invitation created: ${inviterId} → ${inviteeId}`);
}

async function handleRespondInvitation(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { invitationId, response } = data; // accept or reject
  const userId = session.userId;
  
  const invitation = pendingInvitations.get(invitationId);
  if (!invitation) {
    safeSend(ws, { 
      type: 'error', 
      code: 'INVITATION_NOT_FOUND',
      message: 'Taklif topilmadi' 
    });
    return;
  }
  
  if (invitation.inviteeId !== userId) {
    safeSend(ws, { 
      type: 'error', 
      code: 'NOT_INVITED',
      message: 'Bu taklif sizga emas' 
    });
    return;
  }
  
  if (invitation.status !== 'pending') {
    safeSend(ws, { 
      type: 'error', 
      code: 'INVITATION_EXPIRED',
      message: 'Taklif allaqachon amalga oshirilgan' 
    });
    return;
  }
  
  if (Date.now() > invitation.expiresAt) {
    invitation.status = 'expired';
    pendingInvitations.delete(invitationId);
    safeSend(ws, { 
      type: 'error', 
      code: 'INVITATION_EXPIRED',
      message: 'Taklif muddati o\'tgan' 
    });
    return;
  }
  
  if (response === 'accept') {
    // Taklifchi online ekanligini tekshirish
    const inviterSession = getPlayerSession(invitation.inviterId);
    if (!inviterSession) {
      safeSend(ws, { 
        type: 'error', 
        code: 'INVITER_OFFLINE',
        message: 'Taklifchi hozir offline' 
      });
      return;
    }
    
    // O'yin yaratish
    const gameId = generateId('game_');
    const game = {
      gameId,
      player1: {
        id: invitation.inviterId,
        username: inviterSession.user?.username,
        firstName: inviterSession.user?.firstName,
        elo: inviterSession.user?.elo || 1000,
        choice: null,
        score: 0,
        hasLeft: false
      },
      player2: {
        id: userId,
        username: session.user?.username,
        firstName: session.user?.firstName,
        elo: session.user?.elo || 1000,
        choice: null,
        score: 0,
        hasLeft: false
      },
      status: 'playing',
      mode: invitation.gameMode,
      rounds: invitation.rounds || 3,
      currentRound: 1,
      roundResults: [],
      createdAt: new Date(),
      settings: {
        isPrivate: true,
        allowSpectators: false
      }
    };
    
    activeGames.set(gameId, game);
    
    // O'yinchilarni yangilash
    updatePlayerSession(invitation.inviterId, { 
      status: 'in_game',
      gameId 
    });
    
    updatePlayerSession(userId, { 
      status: 'in_game',
      gameId 
    });
    
    // Database'dagi userlarni yangilash
    await User.updateMany(
      { telegramId: { $in: [invitation.inviterId, userId] } },
      { 
        currentGameId: gameId,
        status: 'in_game',
        lastSeen: new Date()
      }
    );
    
    // Taklifchiga xabar
    safeSend(inviterSession.ws, {
      type: 'invitation_accepted',
      invitationId,
      gameId,
      opponent: {
        id: userId,
        firstName: session.user?.firstName,
        username: session.user?.username,
        elo: session.user?.elo
      },
      gameMode: invitation.gameMode,
      rounds: invitation.rounds
    });
    
    // Taklif qabul qiluvchiga xabar
    safeSend(ws, {
      type: 'game_started',
      gameId,
      opponent: {
        id: invitation.inviterId,
        firstName: inviterSession.user?.firstName,
        username: inviterSession.user?.username,
        elo: inviterSession.user?.elo
      },
      gameMode: invitation.gameMode,
      rounds: invitation.rounds
    });
    
    invitation.status = 'accepted';
    
    // Taymer
    setGameTimeout(gameId);
    
    logSystemEvent('info', `Game started via invitation: ${gameId}`);
    
  } else if (response === 'reject') {
    invitation.status = 'rejected';
    
    // Taklifchiga xabar
    const inviterWs = getPlayerSocket(invitation.inviterId);
    if (inviterWs) {
      safeSend(inviterWs, {
        type: 'invitation_rejected',
        invitationId,
        by: userId
      });
    }
    
    safeSend(ws, { type: 'invitation_rejected', invitationId });
  }
  
  pendingInvitations.delete(invitationId);
}

async function handleRequestRematch(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { gameId } = data;
  const userId = session.userId;
  
  const game = activeGames.get(gameId);
  if (!game || game.status !== 'finished') {
    safeSend(ws, { 
      type: 'error', 
      code: 'GAME_NOT_FOUND',
      message: 'O\'yin topilmadi' 
    });
    return;
  }
  
  // Faqat o'yinchilar rematch so'rashi mumkin
  if (game.player1.id !== userId && game.player2?.id !== userId) {
    safeSend(ws, { 
      type: 'error', 
      code: 'NOT_IN_GAME',
      message: 'Siz bu o\'yinda emassiz' 
    });
    return;
  }
  
  const opponentId = game.player1.id === userId ? game.player2?.id : game.player1.id;
  const opponentSession = getPlayerSession(opponentId);
  
  if (!opponentSession) {
    safeSend(ws, { 
      type: 'error', 
      code: 'OPPONENT_OFFLINE',
      message: 'Raqib hozir offline' 
    });
    return;
  }
  
  // Raqibga so'rov yuborish
  safeSend(opponentSession.ws, {
    type: 'rematch_requested',
    gameId,
    from: userId,
    fromName: session.user?.firstName,
    gameMode: game.mode,
    rounds: game.rounds
  });
  
  safeSend(ws, { 
    type: 'rematch_request_sent',
    gameId 
  });
  
  logSystemEvent('info', `Rematch requested: ${userId} → ${opponentId}`);
}

async function handleCreateTournament(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { 
    name, 
    maxPlayers = 16, 
    entryFee = 0, 
    prizePool = 0,
    settings = {}
  } = data;
  
  const creatorId = session.userId;
  
  if (!name) {
    safeSend(ws, { 
      type: 'error', 
      code: 'MISSING_NAME',
      message: 'Turnir nomi talab qilinadi' 
    });
    return;
  }
  
  try {
    const tournamentId = generateId('tour_');
    
    const tournament = {
      tournamentId,
      name,
      description: data.description || '',
      creatorId,
      maxPlayers,
      currentPlayers: 1,
      players: [{
        userId: creatorId,
        username: session.user?.username,
        firstName: session.user?.firstName,
        elo: session.user?.elo || 1000,
        joinedAt: new Date(),
        status: 'registered'
      }],
      status: 'open',
      prizePool,
      entryFee,
      prizes: data.prizes || [],
      settings: {
        gameMode: settings.gameMode || 'ranked',
        roundsPerMatch: settings.roundsPerMatch || 3,
        timeLimit: settings.timeLimit || 60,
        allowSpectators: settings.allowSpectators !== false,
        ...settings
      },
      bracket: null,
      currentRound: 0,
      totalRounds: Math.ceil(Math.log2(maxPlayers))
    };
    
    // Database'ga saqlash
    const tournamentDoc = new Tournament(tournament);
    await tournamentDoc.save();
    
    // In-memory saqlash
    activeTournaments.set(tournamentId, tournament);
    
    // Javob yuborish
    safeSend(ws, {
      type: 'tournament_created',
      tournamentId,
      tournament
    });
    
    logSystemEvent('info', `Tournament created: ${tournamentId} by ${creatorId}`);
    
    // Global notification
    await createNotification(
      null, // null = global notification
      'tournament_invite',
      `Yangi turnir: ${name}`,
      `${session.user?.firstName} yangi turnir yaratdi. Qatnashing!`,
      { tournamentId, creatorId }
    );
    
  } catch (error) {
    console.error('Create tournament error:', error);
    safeSend(ws, { 
      type: 'error', 
      code: 'TOURNAMENT_CREATION_FAILED',
      message: 'Turnir yaratishda xatolik' 
    });
  }
}

async function handleJoinTournament(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { tournamentId } = data;
  const userId = session.userId;
  
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) {
    safeSend(ws, { 
      type: 'error', 
      code: 'TOURNAMENT_NOT_FOUND',
      message: 'Turnir topilmadi' 
    });
    return;
  }
  
  if (tournament.status !== 'open') {
    safeSend(ws, { 
      type: 'error', 
      code: 'TOURNAMENT_CLOSED',
      message: 'Turnir yopilgan yoki boshlangan' 
    });
    return;
  }
  
  if (tournament.currentPlayers >= tournament.maxPlayers) {
    safeSend(ws, { 
      type: 'error', 
      code: 'TOURNAMENT_FULL',
      message: 'Turnir to\'lgan' 
    });
    return;
  }
  
  // Allaqachon qatnashganligini tekshirish
  const alreadyJoined = tournament.players.some(p => p.userId === userId);
  if (alreadyJoined) {
    safeSend(ws, { 
      type: 'error', 
      code: 'ALREADY_JOINED',
      message: 'Siz allaqachon turnirdasiz' 
    });
    return;
  }
  
  // Entry fee tekshirish
  const user = await User.findOne({ telegramId: userId });
  if (tournament.entryFee > 0 && user.inventory.coins < tournament.entryFee) {
    safeSend(ws, { 
      type: 'error', 
      code: 'INSUFFICIENT_COINS',
      message: `Turnirga qatnashish uchun ${tournament.entryFee} coin kerak` 
    });
    return;
  }
  
  // Entry fee to'lash
  if (tournament.entryFee > 0) {
    user.inventory.coins -= tournament.entryFee;
    tournament.prizePool += tournament.entryFee;
    await user.save();
  }
  
  // Turnirga qo'shish
  tournament.players.push({
    userId,
    username: session.user?.username,
    firstName: session.user?.firstName,
    elo: session.user?.elo || 1000,
    joinedAt: new Date(),
    status: 'registered'
  });
  
  tournament.currentPlayers++;
  
  // Agar turnir to'lsa, statusni o'zgartirish
  if (tournament.currentPlayers >= tournament.maxPlayers) {
    tournament.status = 'full';
    // Turnirni boshlashni rejalashtirish
    scheduleTournamentStart(tournamentId);
  }
  
  // Database'da yangilash
  await Tournament.updateOne(
    { tournamentId },
    {
      players: tournament.players,
      currentPlayers: tournament.currentPlayers,
      status: tournament.status,
      prizePool: tournament.prizePool
    }
  );
  
  // Javob yuborish
  safeSend(ws, {
    type: 'tournament_joined',
    tournamentId,
    position: tournament.currentPlayers,
    startTime: tournament.startedAt || Date.now() + 300000 // 5 daqiqa
  });
  
  logSystemEvent('info', `User joined tournament: ${userId} -> ${tournamentId}`);
  
  // Turnir egalariga xabar
  for (const player of tournament.players) {
    if (player.userId !== userId) {
      await createNotification(
        player.userId,
        'tournament_invite',
        `Yangi ishtirokchi: ${tournament.name}`,
        `${session.user?.firstName} turnirga qo'shildi.`,
        { tournamentId, newPlayerId: userId }
      );
    }
  }
}

async function handleFriendRequest(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { targetId, action } = data; // add, remove, accept, reject
  const userId = session.userId;
  
  if (userId === targetId) {
    safeSend(ws, { 
      type: 'error', 
      code: 'SELF_FRIEND',
      message: 'O\'zingizni do\'st qilib qo\'sha olmaysiz' 
    });
    return;
  }
  
  try {
    const user = await User.findOne({ telegramId: userId });
    const targetUser = await User.findOne({ telegramId: targetId });
    
    if (!targetUser) {
      safeSend(ws, { 
        type: 'error', 
        code: 'USER_NOT_FOUND',
        message: 'Foydalanuvchi topilmadi' 
      });
      return;
    }
    
    switch (action) {
      case 'add':
        // Allaqachon do'st ekanligini tekshirish
        const alreadyFriend = user.friends.some(f => f.userId === targetId);
        if (alreadyFriend) {
          safeSend(ws, { 
            type: 'error', 
            code: 'ALREADY_FRIENDS',
            message: 'Bu foydalanuvchi allaqachon dostingiz' 
          });
          return;
        }
        
        // Bloklanganligini tekshirish
        if (user.blockedUsers.includes(targetId) || targetUser.blockedUsers.includes(userId)) {
          safeSend(ws, { 
            type: 'error', 
            code: 'BLOCKED',
            message: 'Bu foydalanuvchi sizni bloklagan yoki siz bloklagansiz' 
          });
          return;
        }
        
        // Do'stlik so'rovini yuborish
        await createNotification(
          targetId,
          'friend_request',
          `Do'stlik so'rovi: ${user.firstName}`,
          `${user.firstName} sizni do'st qilishni xohlaydi`,
          { from: userId, action: 'friend_request' }
        );
        
        safeSend(ws, { 
          type: 'friend_request_sent',
          to: targetId 
        });
        
        logSystemEvent('info', `Friend request sent: ${userId} -> ${targetId}`);
        break;
        
      case 'accept':
        // Do'stlik so'rovini qabul qilish
        const friendRequest = await Notification.findOne({
          userId,
          type: 'friend_request',
          'data.from': targetId,
          read: false
        }).sort({ createdAt: -1 });
        
        if (!friendRequest) {
          safeSend(ws, { 
            type: 'error', 
            code: 'NO_FRIEND_REQUEST',
            message: 'Dostlik sorovi topilmadi' 
          });
          return;
        }
        
        // Do'st qo'shish
        user.friends.push({
          userId: targetId,
          nickname: targetUser.firstName,
          addedAt: new Date()
        });
        
        targetUser.friends.push({
          userId: userId,
          nickname: user.firstName,
          addedAt: new Date()
        });
        
        await user.save();
        await targetUser.save();
        
        // Notification'ni o'qilgan qilish
        friendRequest.read = true;
        await friendRequest.save();
        
        // Javob yuborish
        safeSend(ws, {
          type: 'friend_added',
          friend: {
            id: targetId,
            firstName: targetUser.firstName,
            username: targetUser.username,
            isOnline: getPlayerSession(targetId) !== null
          }
        });
        
        // Boshqa foydalanuvchiga xabar
        const targetSession = getPlayerSession(targetId);
        if (targetSession) {
          safeSend(targetSession.ws, {
            type: 'friend_request_accepted',
            by: userId,
            byName: user.firstName
          });
        }
        
        logSystemEvent('info', `Friend request accepted: ${userId} <- ${targetId}`);
        break;
        
      case 'remove':
        // Do'stlikdan olib tashlash
        user.friends = user.friends.filter(f => f.userId !== targetId);
        targetUser.friends = targetUser.friends.filter(f => f.userId !== userId);
        
        await user.save();
        await targetUser.save();
        
        safeSend(ws, { 
          type: 'friend_removed',
          userId: targetId 
        });
        
        logSystemEvent('info', `Friend removed: ${userId} - ${targetId}`);
        break;
        
      case 'block':
        // Bloklash
        if (!user.blockedUsers.includes(targetId)) {
          user.blockedUsers.push(targetId);
          user.friends = user.friends.filter(f => f.userId !== targetId);
          await user.save();
        }
        
        safeSend(ws, { 
          type: 'user_blocked',
          userId: targetId 
        });
        
        logSystemEvent('info', `User blocked: ${userId} -> ${targetId}`);
        break;
        
      case 'unblock':
        // Blokdan olib tashlash
        user.blockedUsers = user.blockedUsers.filter(id => id !== targetId);
        await user.save();
        
        safeSend(ws, { 
          type: 'user_unblocked',
          userId: targetId 
        });
        
        logSystemEvent('info', `User unblocked: ${userId} -> ${targetId}`);
        break;
    }
    
  } catch (error) {
    console.error('Friend request error:', error);
    safeSend(ws, { 
      type: 'error', 
      code: 'FRIEND_REQUEST_FAILED',
      message: 'Dostlik sorovida xatolik' 
    });
  }
}

async function handleUpdateStatus(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { status, customStatus } = data;
  const userId = session.userId;
  
  if (status && ['online', 'away', 'busy', 'invisible'].includes(status)) {
    updatePlayerSession(userId, { status });
    
    // Database'da yangilash
    await User.updateOne(
      { telegramId: userId },
      { status }
    );
    
    // Do'stlarga xabar (agar invisible bo'lmasa)
    if (status !== 'invisible') {
      const user = await User.findOne({ telegramId: userId });
      if (user) {
        for (const friend of user.friends) {
          const friendSession = getPlayerSession(friend.userId);
          if (friendSession) {
            safeSend(friendSession.ws, {
              type: 'friend_status_changed',
              friendId: userId,
              status,
              customStatus
            });
          }
        }
      }
    }
    
    safeSend(ws, {
      type: 'status_updated',
      status,
      customStatus,
      timestamp: Date.now()
    });
  }
}

async function handleGetProfile(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { userId: targetId } = data;
  const viewerId = session.userId;
  
  const profileId = targetId || viewerId;
  
  try {
    const user = await User.findOne({ telegramId: profileId })
      .select('-__v -blockedUsers -referralCode')
      .lean();
    
    if (!user) {
      safeSend(ws, { 
        type: 'error', 
        code: 'USER_NOT_FOUND',
        message: 'Foydalanuvchi topilmadi' 
      });
      return;
    }
    
    // Oxirgi 10 ta o'yin
    const recentGames = await Game.find({
      $or: [
        { 'player1.id': profileId },
        { 'player2.id': profileId }
      ],
      status: 'finished'
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
    
    // Achivement'lar
    const achievements = await Achievement.find({
      achievementId: { $in: user.achievements?.map(a => a.id) || [] }
    }).lean();
    
    // Do'stlar ro'yxati (faqat online do'stlar)
    const onlineFriends = [];
    for (const friend of user.friends || []) {
      const friendSession = getPlayerSession(friend.userId);
      if (friendSession) {
        onlineFriends.push({
          id: friend.userId,
          firstName: friend.nickname || friendSession.user?.firstName,
          username: friendSession.user?.username,
          status: friendSession.status,
          isOnline: true
        });
      }
    }
    
    // Bloklanganligini tekshirish
    const viewer = await User.findOne({ telegramId: viewerId });
    const isBlocked = viewer?.blockedUsers?.includes(profileId) || 
                     user.blockedUsers?.includes(viewerId);
    
    // Do'st ekanligini tekshirish
    const isFriend = viewer?.friends?.some(f => f.userId === profileId) || false;
    
    const profile = {
      id: user.telegramId,
      firstName: user.firstName,
      username: user.username,
      isPremium: user.isPremium,
      stats: user.gameStats,
      rank: user.rank,
      level: user.level,
      xp: user.xp,
      preferences: user.preferences,
      inventory: user.inventory,
      achievements: achievements.map(ach => ({
        id: ach.achievementId,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        rarity: ach.rarity,
        unlockedAt: user.achievements?.find(a => a.id === ach.achievementId)?.unlockedAt
      })),
      recentGames,
      onlineFriends,
      isOnline: getPlayerSession(profileId) !== null,
      status: getPlayerSession(profileId)?.status || 'offline',
      isFriend,
      isBlocked,
      canSendFriendRequest: !isFriend && !isBlocked && profileId !== viewerId,
      joinedAt: user.joinedAt
    };
    
    safeSend(ws, {
      type: 'profile_data',
      profile,
      isOwnProfile: profileId === viewerId
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    safeSend(ws, { 
      type: 'error', 
      code: 'PROFILE_FETCH_FAILED',
      message: 'Profil ma\'lumotlarini olishda xatolik' 
    });
  }
}

async function handleSpectateGame(ws, data, session) {
  if (!session.authenticated) {
    return;
  }
  
  const { gameId, action } = data; // join or leave
  const userId = session.userId;
  
  const game = activeGames.get(gameId);
  if (!game) {
    safeSend(ws, { 
      type: 'error', 
      code: 'GAME_NOT_FOUND',
      message: 'O\'yin topilmadi' 
    });
    return;
  }
  
  if (!game.settings.allowSpectators) {
    safeSend(ws, { 
      type: 'error', 
      code: 'SPECTATING_NOT_ALLOWED',
      message: 'Bu o\'yinni kuzatish mumkin emas' 
    });
    return;
  }
  
  if (action === 'join') {
    // O'yinchi ekanligini tekshirish
    if (game.player1.id === userId || game.player2?.id === userId) {
      safeSend(ws, { 
        type: 'error', 
        code: 'CANNOT_SPECTATE_OWN_GAME',
        message: 'O\'z o\'yiningizni kuzata olmaysiz' 
      });
      return;
    }
    
    // Spectator limitini tekshirish
    const spectators = gameSpectators.get(gameId) || [];
    if (spectators.length >= (game.settings.maxSpectators || 5)) {
      safeSend(ws, { 
        type: 'error', 
        code: 'SPECTATOR_LIMIT_REACHED',
        message: 'Kuzatuvchilar soni chegaraga yetgan' 
      });
      return;
    }
    
    // Spectator qo'shish
    if (!spectators.includes(userId)) {
      spectators.push(userId);
      gameSpectators.set(gameId, spectators);
    }
    
    // O'yin holatini yuborish
    safeSend(ws, {
      type: 'spectating_started',
      gameId,
      gameState: {
        player1: {
          id: game.player1.id,
          firstName: game.player1.firstName,
          score: game.player1.score
        },
        player2: {
          id: game.player2?.id,
          firstName: game.player2?.firstName,
          score: game.player2?.score
        },
        currentRound: game.currentRound,
        roundResults: game.roundResults,
        mode: game.mode,
        rounds: game.rounds
      }
    });
    
    // O'yinchilarga xabar (agar ruxsat berilgan bo'lsa)
    if (game.settings.notifySpectators) {
      const player1Ws = getPlayerSocket(game.player1.id);
      const player2Ws = getPlayerSocket(game.player2?.id);
      
      const spectatorName = session.user?.firstName || `User_${userId}`;
      
      if (player1Ws) {
        safeSend(player1Ws, {
          type: 'spectator_joined',
          gameId,
          spectatorId: userId,
          spectatorName,
          totalSpectators: spectators.length
        });
      }
      
      if (player2Ws) {
        safeSend(player2Ws, {
          type: 'spectator_joined',
          gameId,
          spectatorId: userId,
          spectatorName,
          totalSpectators: spectators.length
        });
      }
    }
    
    logSystemEvent('info', `User started spectating: ${userId} -> ${gameId}`);
    
  } else if (action === 'leave') {
    // Spectator chiqarish
    const spectators = gameSpectators.get(gameId) || [];
    const index = spectators.indexOf(userId);
    if (index > -1) {
      spectators.splice(index, 1);
      gameSpectators.set(gameId, spectators);
    }
    
    safeSend(ws, {
      type: 'spectating_ended',
      gameId
    });
    
    logSystemEvent('info', `User stopped spectating: ${userId} -> ${gameId}`);
  }
}

// ==================== GAME FUNCTIONS ====================
function attemptMatchmaking() {
  if (matchmakingQueue.size < 2) return;
  
  const queueArray = Array.from(matchmakingQueue.entries());
  
  // Mode bo'yicha guruhlash
  const casualQueue = queueArray.filter(([_, entry]) => entry.mode === 'casual');
  const rankedQueue = queueArray.filter(([_, entry]) => entry.mode === 'ranked');
  
  // Casual matchmaking (tezkor)
  if (casualQueue.length >= 2) {
    createMatchFromQueue(casualQueue.slice(0, 2));
    return;
  }
  
  // Ranked matchmaking (ELO asosida)
  if (rankedQueue.length >= 2) {
    // ELO asosida saralash
    rankedQueue.sort((a, b) => a[1].elo - b[1].elo);
    
    for (let i = 0; i < rankedQueue.length - 1; i++) {
      for (let j = i + 1; j < rankedQueue.length; j++) {
        const playerA = rankedQueue[i];
        const playerB = rankedQueue[j];
        const eloDiff = Math.abs(playerA[1].elo - playerB[1].elo);
        
        // ELO farqi searchRadius ichida bo'lsa
        const maxRadius = Math.max(playerA[1].searchRadius, playerB[1].searchRadius);
        if (eloDiff <= maxRadius) {
          createMatchFromQueue([playerA, playerB]);
          return;
        }
      }
    }
    
    // Agar juft topilmasa, searchRadiusni oshirish
    rankedQueue.forEach(([userId, entry]) => {
      const waitTime = Date.now() - entry.joinedAt;
      if (waitTime > 30000) {
        entry.searchRadius += 50;
        matchmakingQueue.set(userId, entry);
      }
    });
  }
}

function createMatchFromQueue(players) {
  const [playerA, playerB] = players;
  const playerAEntry = playerA[1];
  const playerBEntry = playerB[1];
  
  // Navbatdan olib tashlash
  matchmakingQueue.delete(playerA[0]);
  matchmakingQueue.delete(playerB[0]);
  
  const gameId = generateId('game_');
  
  const game = {
    gameId,
    player1: {
      id: playerA[0],
      username: playerAEntry.session.user?.username,
      firstName: playerAEntry.session.user?.firstName,
      elo: playerAEntry.elo,
      choice: null,
      score: 0,
      hasLeft: false
    },
    player2: {
      id: playerB[0],
      username: playerBEntry.session.user?.username,
      firstName: playerBEntry.session.user?.firstName,
      elo: playerBEntry.elo,
      choice: null,
      score: 0,
      hasLeft: false
    },
    status: 'playing',
    mode: playerAEntry.mode,
    rounds: 3,
    currentRound: 1,
    roundResults: [],
    createdAt: new Date(),
    settings: {
      allowSpectators: true,
      maxSpectators: 10,
      notifySpectators: false
    }
  };
  
  activeGames.set(gameId, game);
  
  // O'yinchilarni yangilash
  updatePlayerSession(playerA[0], { 
    status: 'in_game',
    gameId 
  });
  
  updatePlayerSession(playerB[0], { 
    status: 'in_game',
    gameId 
  });
  
  // Database'dagi userlarni yangilash
  User.updateMany(
    { telegramId: { $in: [playerA[0], playerB[0]] } },
    { 
      currentGameId: gameId,
      status: 'in_game',
      lastSeen: new Date()
    }
  ).catch(err => console.error('Update users error:', err));
  
  // Xabarlar yuborish
  safeSend(playerAEntry.session.ws, {
    type: 'match_found',
    gameId,
    opponent: {
      id: playerB[0],
      firstName: playerBEntry.session.user?.firstName,
      username: playerBEntry.session.user?.username,
      elo: playerBEntry.elo,
      rank: playerBEntry.session.user?.rank
    },
    gameMode: playerAEntry.mode,
    rounds: 3,
    isRanked: playerAEntry.mode === 'ranked'
  });
  
  safeSend(playerBEntry.session.ws, {
    type: 'match_found',
    gameId,
    opponent: {
      id: playerA[0],
      firstName: playerAEntry.session.user?.firstName,
      username: playerAEntry.session.user?.username,
      elo: playerAEntry.elo,
      rank: playerAEntry.session.user?.rank
    },
    gameMode: playerAEntry.mode,
    rounds: 3,
    isRanked: playerBEntry.mode === 'ranked'
  });
  
  // Taymer
  setGameTimeout(gameId);
  
  logSystemEvent('info', `Match created: ${gameId} (${playerA[0]} vs ${playerB[0]})`);
}

async function finalizeGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  // O'yinni tugatish
  game.status = 'finished';
  game.finishedAt = new Date();
  game.duration = game.finishedAt.getTime() - game.createdAt.getTime();
  
  // G'olibni aniqlash
  let result, winnerId;
  
  if (game.player1.score > game.player2.score) {
    result = 'player1_win';
    winnerId = game.player1.id;
  } else if (game.player2.score > game.player1.score) {
    result = 'player2_win';
    winnerId = game.player2.id;
  } else {
    result = 'draw';
    winnerId = null;
  }
  
  game.result = result;
  game.winnerId = winnerId;
  
  // ELO o'zgarishini hisoblash (ranked mode uchun)
  let eloChanges = { player1: 0, player2: 0 };
  if (game.mode === 'ranked') {
    eloChanges = calculateELO(game.player1.elo, game.player2.elo, result);
    game.eloChanges = eloChanges;
  }
  
  // Database'da o'yinni saqlash
  try {
    const gameRecord = new Game(game);
    await gameRecord.save();
    
    // User statistikasini yangilash
    const updates = [
      User.updateOne(
        { telegramId: game.player1.id },
        {
          $inc: {
            'gameStats.totalGames': 1,
            'gameStats.wins': result === 'player1_win' ? 1 : 0,
            'gameStats.losses': result === 'player2_win' ? 1 : 0,
            'gameStats.draws': result === 'draw' ? 1 : 0,
            'gameStats.elo': eloChanges.changeA,
            'gameStats.totalTimePlayed': game.duration,
            'gameStats.streak': result === 'player1_win' ? 1 : result === 'player2_win' ? -1 : 0,
            xp: result === 'player1_win' ? 10 : result === 'player2_win' ? 2 : 5,
            'inventory.coins': result === 'player1_win' ? 50 : result === 'player2_win' ? 10 : 25
          },
          $set: {
            'gameStats.lastPlayed': new Date(),
            currentGameId: null,
            status: 'online'
          },
          $max: {
            'gameStats.maxStreak': result === 'player1_win' ? 
              (await User.findOne({ telegramId: game.player1.id }))?.gameStats?.streak || 0 : 0
          },
          $addToSet: {
            'gameStats.favoriteMove': game.player1.choice
          }
        }
      ),
      User.updateOne(
        { telegramId: game.player2.id },
        {
          $inc: {
            'gameStats.totalGames': 1,
            'gameStats.wins': result === 'player2_win' ? 1 : 0,
            'gameStats.losses': result === 'player1_win' ? 1 : 0,
            'gameStats.draws': result === 'draw' ? 1 : 0,
            'gameStats.elo': eloChanges.changeB,
            'gameStats.totalTimePlayed': game.duration,
            'gameStats.streak': result === 'player2_win' ? 1 : result === 'player1_win' ? -1 : 0,
            xp: result === 'player2_win' ? 10 : result === 'player1_win' ? 2 : 5,
            'inventory.coins': result === 'player2_win' ? 50 : result === 'player1_win' ? 10 : 25
          },
          $set: {
            'gameStats.lastPlayed': new Date(),
            currentGameId: null,
            status: 'online'
          },
          $max: {
            'gameStats.maxStreak': result === 'player2_win' ? 
              (await User.findOne({ telegramId: game.player2.id }))?.gameStats?.streak || 0 : 0
          },
          $addToSet: {
            'gameStats.favoriteMove': game.player2.choice
          }
        }
      )
    ];
    
    await Promise.all(updates);
    
    // Achievement'larni tekshirish
    await checkAchievements(game.player1.id);
    await checkAchievements(game.player2.id);
    
  } catch (error) {
    console.error('Save game error:', error);
  }
  
  // Natijani o'yinchilarga yuborish
  const resultPayload = {
    type: 'game_result',
    gameId,
    result,
    winnerId,
    scores: {
      player1: game.player1.score,
      player2: game.player2.score
    },
    roundResults: game.roundResults,
    eloChanges: game.mode === 'ranked' ? eloChanges : null,
    duration: game.duration,
    isRanked: game.mode === 'ranked',
    rematchAvailable: true
  };
  
  // O'yinchilarga yuborish
  sendToPlayers(gameId, resultPayload);
  
  // Kuzatuvchilarga yuborish
  const spectators = gameSpectators.get(gameId) || [];
  for (const spectatorId of spectators) {
    const spectatorWs = getPlayerSocket(spectatorId);
    if (spectatorWs) {
      safeSend(spectatorWs, resultPayload);
    }
  }
  
  // O'yinchilarni yangilash
  updatePlayerSession(game.player1.id, { 
    status: 'online',
    gameId: null 
  });
  
  if (game.player2.id) {
    updatePlayerSession(game.player2.id, { 
      status: 'online',
      gameId: null 
    });
  }
  
  // O'yinni tozalash
  setTimeout(() => {
    activeGames.delete(gameId);
    gameSpectators.delete(gameId);
  }, 30000); // 30 soniyadan keyin tozalash
  
  logSystemEvent('info', `Game finished: ${gameId} - ${result}`);
}

async function forceEndGame(gameId, winnerId, reason) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  game.status = 'finished';
  game.result = reason;
  game.winnerId = winnerId;
  game.finishedAt = new Date();
  
  // Database'da saqlash
  try {
    const gameRecord = new Game(game);
    await gameRecord.save();
  } catch (error) {
    console.error('Save forced game error:', error);
  }
  
  // O'yinchilarga xabar
  const resultPayload = {
    type: 'game_result',
    gameId,
    result: reason,
    winnerId,
    scores: {
      player1: game.player1.score,
      player2: game.player2.score
    },
    roundResults: game.roundResults,
    isForced: true
  };
  
  sendToPlayers(gameId, resultPayload);
  
  // O'yinchilarni yangilash
  updatePlayerSession(game.player1.id, { 
    status: 'online',
    gameId: null 
  });
  
  if (game.player2.id) {
    updatePlayerSession(game.player2.id, { 
      status: 'online',
      gameId: null 
    });
  }
  
  // Tozalash
  activeGames.delete(gameId);
  gameSpectators.delete(gameId);
}

function setGameTimeout(gameId) {
  setTimeout(async () => {
    const game = activeGames.get(gameId);
    if (game && game.status === 'playing') {
      await forceEndGame(gameId, null, 'timeout');
    }
  }, GAME_TIMEOUT);
}

function sendToPlayers(gameId, payload) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  const player1Ws = getPlayerSocket(game.player1.id);
  const player2Ws = getPlayerSocket(game.player2?.id);
  
  if (player1Ws) safeSend(player1Ws, payload);
  if (player2Ws) safeSend(player2Ws, payload);
}

// ==================== TOURNAMENT FUNCTIONS ====================
function scheduleTournamentStart(tournamentId) {
  setTimeout(async () => {
    const tournament = activeTournaments.get(tournamentId);
    if (!tournament || tournament.status !== 'full') return;
    
    tournament.status = 'in_progress';
    tournament.startedAt = new Date();
    tournament.currentRound = 1;
    
    // Bracket yaratish
    tournament.bracket = createTournamentBracket(tournament.players);
    
    // Database'da yangilash
    await Tournament.updateOne(
      { tournamentId },
      {
        status: 'in_progress',
        startedAt: tournament.startedAt,
        currentRound: 1,
        bracket: tournament.bracket
      }
    );
    
    // Ishtirokchilarga xabar
    for (const player of tournament.players) {
      const session = getPlayerSession(player.userId);
      if (session) {
        safeSend(session.ws, {
          type: 'tournament_started',
          tournamentId,
          bracket: tournament.bracket,
          currentRound: 1,
          opponent: getFirstRoundOpponent(tournament.bracket, player.userId)
        });
      }
      
      await createNotification(
        player.userId,
        'tournament_start',
        `Turnir boshladi: ${tournament.name}`,
        'Birinchi raund boshlanmoqda. Omad!',
        { tournamentId, round: 1 }
      );
    }
    
    // Birinchi raund o'yinlarini boshlash
    startTournamentRound(tournamentId, 1);
    
  }, 300000); // 5 daqiqa kutish
}

function createTournamentBracket(players) {
  const bracket = {
    rounds: [],
    matches: []
  };
  
  // Random tartibda saralash
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  
  // Birinchi raund uchun juftliklar
  const matches = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    if (i + 1 < shuffledPlayers.length) {
      matches.push({
        matchId: generateId('match_'),
        player1: shuffledPlayers[i],
        player2: shuffledPlayers[i + 1],
        winner: null,
        status: 'pending',
        round: 1
      });
    } else {
      // Agar toq son bo'lsa, bir o'yinchi bemalol keyingi raundga
      matches.push({
        matchId: generateId('match_'),
        player1: shuffledPlayers[i],
        player2: null,
        winner: shuffledPlayers[i],
        status: 'bye',
        round: 1
      });
    }
  }
  
  bracket.matches = matches;
  bracket.rounds.push({
    round: 1,
    matches: matches.map(m => m.matchId)
  });
  
  return bracket;
}

function getFirstRoundOpponent(bracket, playerId) {
  for (const match of bracket.matches) {
    if (match.player1?.userId === playerId) {
      return match.player2;
    }
    if (match.player2?.userId === playerId) {
      return match.player1;
    }
  }
  return null;
}

function startTournamentRound(tournamentId, round) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;
  
  const roundMatches = tournament.bracket.matches.filter(m => m.round === round && m.status === 'pending');
  
  for (const match of roundMatches) {
    if (match.player1 && match.player2) {
      // O'yin yaratish
      const gameId = generateId('tour_game_');
      const game = {
        gameId,
        player1: {
          id: match.player1.userId,
          username: match.player1.username,
          firstName: match.player1.firstName,
          elo: match.player1.elo,
          choice: null,
          score: 0,
          hasLeft: false
        },
        player2: {
          id: match.player2.userId,
          username: match.player2.username,
          firstName: match.player2.firstName,
          elo: match.player2.elo,
          choice: null,
          score: 0,
          hasLeft: false
        },
        status: 'playing',
        mode: tournament.settings.gameMode,
        rounds: tournament.settings.roundsPerMatch,
        currentRound: 1,
        roundResults: [],
        tournamentId,
        createdAt: new Date(),
        settings: {
          allowSpectators: tournament.settings.allowSpectators,
          maxSpectators: 20
        }
      };
      
      activeGames.set(gameId, game);
      match.gameId = gameId;
      match.status = 'in_progress';
      
      // O'yinchilarni yangilash
      updatePlayerSession(match.player1.userId, { 
        status: 'in_game',
        gameId,
        tournamentId 
      });
      
      updatePlayerSession(match.player2.userId, { 
        status: 'in_game',
        gameId,
        tournamentId 
      });
      
      // O'yinchilarga xabar
      const player1Ws = getPlayerSocket(match.player1.userId);
      const player2Ws = getPlayerSocket(match.player2.userId);
      
      if (player1Ws) {
        safeSend(player1Ws, {
          type: 'tournament_match_started',
          tournamentId,
          gameId,
          opponent: match.player2,
          round,
          settings: tournament.settings
        });
      }
      
      if (player2Ws) {
        safeSend(player2Ws, {
          type: 'tournament_match_started',
          tournamentId,
          gameId,
          opponent: match.player1,
          round,
          settings: tournament.settings
        });
      }
      
      // Taymer
      setTournamentGameTimeout(gameId, tournamentId, match.matchId);
    }
  }
}

function setTournamentGameTimeout(gameId, tournamentId, matchId) {
  setTimeout(async () => {
    const game = activeGames.get(gameId);
    if (game && game.status === 'playing') {
      // Timeout bo'lsa, baland balli g'olib
      let winnerId = null;
      if (game.player1.score > game.player2.score) {
        winnerId = game.player1.id;
      } else if (game.player2.score > game.player1.score) {
        winnerId = game.player2.id;
      }
      
      await handleTournamentMatchResult(tournamentId, matchId, winnerId, 'timeout');
    }
  }, (game?.rounds || 3) * GAME_TIMEOUT + 30000); // Har bir raund uchun + 30 soniya
}

async function handleTournamentMatchResult(tournamentId, matchId, winnerId, resultType) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;
  
  const match = tournament.bracket.matches.find(m => m.matchId === matchId);
  if (!match) return;
  
  match.winner = winnerId ? 
    (match.player1.userId === winnerId ? match.player1 : match.player2) : null;
  match.status = 'finished';
  match.resultType = resultType;
  match.finishedAt = new Date();
  
  // Keyingi raundga o'tkazish
  if (match.winner) {
    advanceToNextRound(tournament, match);
  }
  
  // Database'da yangilash
  await Tournament.updateOne(
    { tournamentId },
    {
      bracket: tournament.bracket,
      $set: { [`bracket.matches.$[elem].winner`]: match.winner, 
              [`bracket.matches.$[elem].status`]: 'finished' }
    },
    {
      arrayFilters: [{ 'elem.matchId': matchId }]
    }
  );
  
  // Turnir tugashini tekshirish
  checkTournamentCompletion(tournamentId);
}

function advanceToNextRound(tournament, match) {
  const nextRound = match.round + 1;
  const nextRoundMatches = tournament.bracket.matches.filter(m => m.round === nextRound);
  
  // Bo'sh joy topish
  for (const nextMatch of nextRoundMatches) {
    if (!nextMatch.player1) {
      nextMatch.player1 = match.winner;
      break;
    } else if (!nextMatch.player2) {
      nextMatch.player2 = match.winner;
      nextMatch.status = 'pending';
      break;
    }
  }
  
  // Agar yangi raund uchun matchlar bo'lmasa, yaratish
  if (nextRoundMatches.length === 0 && tournament.bracket.matches.filter(m => m.round === match.round && m.status === 'finished').length >= 2) {
    // Yarim final, final, etc.
    const winners = tournament.bracket.matches
      .filter(m => m.round === match.round && m.winner)
      .map(m => m.winner);
    
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        tournament.bracket.matches.push({
          matchId: generateId('match_'),
          player1: winners[i],
          player2: winners[i + 1],
          winner: null,
          status: 'pending',
          round: nextRound
        });
      }
    }
    
    tournament.bracket.rounds.push({
      round: nextRound,
      matches: tournament.bracket.matches.filter(m => m.round === nextRound).map(m => m.matchId)
    });
  }
  
  // Keyingi raundni boshlash
  if (tournament.currentRound < nextRound) {
    tournament.currentRound = nextRound;
    startTournamentRound(tournament.tournamentId, nextRound);
  }
}

async function checkTournamentCompletion(tournamentId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;
  
  // Barcha matchlar tugaganligini tekshirish
  const allMatchesFinished = tournament.bracket.matches.every(m => 
    m.status === 'finished' || m.status === 'bye'
  );
  
  if (allMatchesFinished) {
    tournament.status = 'finished';
    tournament.finishedAt = new Date();
    
    // G'olibni aniqlash
    const finalMatch = tournament.bracket.matches
      .filter(m => m.round === tournament.currentRound)
      .find(m => m.winner);
    
    if (finalMatch?.winner) {
      tournament.winnerId = finalMatch.winner.userId;
      tournament.winners = calculateTournamentPrizes(tournament);
      
      // Sovrinlarni tarqatish
      await distributeTournamentPrizes(tournament);
    }
    
    // Database'da yangilash
    await Tournament.updateOne(
      { tournamentId },
      {
        status: 'finished',
        finishedAt: tournament.finishedAt,
        winnerId: tournament.winnerId,
        winners: tournament.winners
      }
    );
    
    // Natijalarni e'lon qilish
    announceTournamentResults(tournament);
    
    // Tozalash
    setTimeout(() => {
      activeTournaments.delete(tournamentId);
      tournamentSpectators.delete(tournamentId);
    }, 3600000); // 1 soatdan keyin tozalash
  }
}

function calculateTournamentPrizes(tournament) {
  const winners = [];
  
  // Final match'idan boshlab
  const finalMatch = tournament.bracket.matches
    .filter(m => m.round === tournament.currentRound)
    .find(m => m.winner);
  
  if (finalMatch?.winner) {
    // 1-o'rin
    winners.push({
      position: 1,
      userId: finalMatch.winner.userId,
      prize: tournament.prizePool * 0.5 // 50%
    });
    
    // 2-o'rin (finalda yutqazgan)
    const runnerUp = finalMatch.player1.userId === finalMatch.winner.userId ? 
      finalMatch.player2 : finalMatch.player1;
    
    if (runnerUp) {
      winners.push({
        position: 2,
        userId: runnerUp.userId,
        prize: tournament.prizePool * 0.3 // 30%
      });
    }
    
    // Yarim finalchilar (3-4 o'rinlar)
    const semiFinalMatches = tournament.bracket.matches.filter(m => m.round === tournament.currentRound - 1);
    for (const match of semiFinalMatches) {
      if (match.winner && match.winner.userId !== finalMatch.winner.userId && 
          (!runnerUp || match.winner.userId !== runnerUp.userId)) {
        winners.push({
          position: 3,
          userId: match.winner.userId,
          prize: tournament.prizePool * 0.1 // 10%
        });
      }
    }
  }
  
  return winners;
}

async function distributeTournamentPrizes(tournament) {
  for (const winner of tournament.winners) {
    await User.updateOne(
      { telegramId: winner.userId },
      {
        $inc: {
          'inventory.coins': winner.prize,
          xp: winner.position === 1 ? 500 : winner.position === 2 ? 300 : 100
        }
      }
    );
    
    // Notification yaratish
    await createNotification(
      winner.userId,
      'achievement',
      `Turnirda g'alaba: ${tournament.name}`,
      `Siz ${tournament.name} turnirida ${winner.position}-o'rinni egallab, ${winner.prize} coin yutdingiz!`,
      { tournamentId: tournament.tournamentId, position: winner.position, prize: winner.prize }
    );
  }
}

function announceTournamentResults(tournament) {
  // Barcha ishtirokchilarga xabar
  for (const player of tournament.players) {
    const session = getPlayerSession(player.userId);
    if (session) {
      const playerResult = tournament.winners.find(w => w.userId === player.userId);
      
      safeSend(session.ws, {
        type: 'tournament_finished',
        tournamentId: tournament.tournamentId,
        winnerId: tournament.winnerId,
        winners: tournament.winners,
        playerResult,
        tournamentName: tournament.name
      });
    }
  }
}

// ==================== ACHIEVEMENT FUNCTIONS ====================
async function checkAchievements(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return;
  
  const achievements = await Achievement.find({});
  
  for (const achievement of achievements) {
    // Allaqachon olganligini tekshirish
    const alreadyUnlocked = user.achievements?.some(a => a.id === achievement.achievementId);
    if (alreadyUnlocked) continue;
    
    // Shartni tekshirish
    const conditionMet = evaluateAchievementCondition(achievement.condition, user);
    if (conditionMet) {
      // Achievement berish
      user.achievements.push({
        id: achievement.achievementId,
        unlockedAt: new Date(),
        progress: 100
      });
      
      // Sovrinlarni berish
      if (achievement.rewards.coins) {
        user.inventory.coins += achievement.rewards.coins;
      }
      if (achievement.rewards.gems) {
        user.inventory.gems += achievement.rewards.gems;
      }
      if (achievement.rewards.theme) {
        user.inventory.themes.push(achievement.rewards.theme);
      }
      if (achievement.rewards.avatar) {
        user.inventory.avatars.push(achievement.rewards.avatar);
      }
      
      await user.save();
      
      // Notification yaratish
      await createNotification(
        userId,
        'achievement',
        `Yangi achievement: ${achievement.name}`,
        achievement.description,
        { 
          achievementId: achievement.achievementId,
          rewards: achievement.rewards,
          rarity: achievement.rarity 
        }
      );
      
      // Real-time xabar
      const session = getPlayerSession(userId);
      if (session) {
        safeSend(session.ws, {
          type: 'achievement_unlocked',
          achievement: {
            id: achievement.achievementId,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            rarity: achievement.rarity,
            rewards: achievement.rewards
          }
        });
      }
      
      logSystemEvent('info', `Achievement unlocked: ${userId} - ${achievement.achievementId}`);
    }
  }
}

function evaluateAchievementCondition(condition, user) {
  try {
    // Oddiy shartlarni tekshirish
    const stats = user.gameStats;
    
    // Misol: "wins >= 10"
    if (condition.includes('wins')) {
      const matches = condition.match(/wins\s*>=\s*(\d+)/);
      if (matches) {
        return stats.wins >= parseInt(matches[1]);
      }
    }
    
    // Misol: "elo >= 1500"
    if (condition.includes('elo')) {
      const matches = condition.match(/elo\s*>=\s*(\d+)/);
      if (matches) {
        return stats.elo >= parseInt(matches[1]);
      }
    }
    
    // Misol: "totalGames >= 100"
    if (condition.includes('totalGames')) {
      const matches = condition.match(/totalGames\s*>=\s*(\d+)/);
      if (matches) {
        return stats.totalGames >= parseInt(matches[1]);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Evaluate achievement condition error:', error);
    return false;
  }
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==================== CLEANUP FUNCTIONS ====================
setInterval(() => {
  const now = Date.now();
  
  // Eski takliflarni tozalash
  for (const [id, invitation] of pendingInvitations.entries()) {
    if (now > invitation.expiresAt) {
      pendingInvitations.delete(id);
    }
  }
  
  // Uzoq vaqt inactive bo'lgan sessionlarni tozalash
  for (const [userId, session] of playerSessions.entries()) {
    if (now - session.lastHeartbeat > 180000) { // 3 daqiqa
      playerSessions.delete(userId);
      logSystemEvent('info', `Cleaned inactive session: ${userId}`);
    }
  }
  
  // Rate limit tozalash
  for (const [ip, limit] of rateLimit.entries()) {
    if (now > limit.resetTime) {
      rateLimit.delete(ip);
    }
  }
  
  // Eski system loglarni tozalash
  while (systemLogs.length > 1000) {
    systemLogs.shift();
  }
  
  // Database'dagi online statusni yangilash
  const onlineUserIds = Array.from(playerSessions.keys());
  User.updateMany(
    { telegramId: { $nin: onlineUserIds } },
    { isOnline: false }
  ).catch(err => console.error('Cleanup update error:', err));
  
}, CLEANUP_INTERVAL);

// ==================== API ROUTES ====================
// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      pid: process.pid
    },
    connections: {
      activeGames: activeGames.size,
      queuedPlayers: matchmakingQueue.size,
      connectedPlayers: playerSessions.size,
      pendingInvitations: pendingInvitations.size,
      activeTournaments: activeTournaments.size
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host
    }
  });
});

// Statistikalar
app.get('/api/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalGames,
      activeUsers,
      newToday,
      totalTournaments
    ] = await Promise.all([
      User.countDocuments(),
      Game.countDocuments(),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      Tournament.countDocuments()
    ]);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        newToday,
        totalGames,
        totalTournaments,
        onlineNow: playerSessions.size,
        inQueue: matchmakingQueue.size,
        activeGames: activeGames.size,
        activeTournaments: activeTournaments.size,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { type = 'elo', limit = 100, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sortCriteria = {};
    switch (type) {
      case 'elo':
        sortCriteria = { 'gameStats.elo': -1 };
        break;
      case 'wins':
        sortCriteria = { 'gameStats.wins': -1 };
        break;
      case 'streak':
        sortCriteria = { 'gameStats.streak': -1 };
        break;
      case 'level':
        sortCriteria = { level: -1 };
        break;
      default:
        sortCriteria = { 'gameStats.elo': -1 };
    }
    
    const topPlayers = await User.find()
      .sort(sortCriteria)
      .skip(skip)
      .limit(parseInt(limit))
      .select('telegramId firstName username gameStats level xp')
      .lean();
    
    const total = await User.countDocuments();
    
    res.json({
      success: true,
      leaderboard: topPlayers.map((user, index) => ({
        rank: skip + index + 1,
        id: user.telegramId,
        name: user.firstName,
        username: user.username,
        stats: user.gameStats,
        level: user.level,
        xp: user.xp,
        isOnline: getPlayerSession(user.telegramId) !== null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      type
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// O'yinlar tarixi
app.get('/api/games', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = { status: 'finished' };
    if (userId) {
      query.$or = [
        { 'player1.id': parseInt(userId) },
        { 'player2.id': parseInt(userId) }
      ];
    }
    
    const games = await Game.find(query)
      .sort({ finishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Game.countDocuments(query);
    
    res.json({
      success: true,
      games,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Turnirlar ro'yxati
app.get('/api/tournaments', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const tournaments = await Tournament.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Tournament.countDocuments(query);
    
    res.json({
      success: true,
      tournaments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Foydalanuvchi profili
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(req.params.id) })
      .select('-__v -blockedUsers')
      .lean();
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }
    
    // Oxirgi o'yinlar
    const recentGames = await Game.find({
      $or: [
        { 'player1.id': user.telegramId },
        { 'player2.id': user.telegramId }
      ],
      status: 'finished'
    })
    .sort({ finishedAt: -1 })
    .limit(5)
    .lean();
    
    // Achievement'lar
    const achievements = await Achievement.find({
      achievementId: { $in: user.achievements?.map(a => a.id) || [] }
    }).lean();
    
    res.json({
      success: true,
      user: {
        ...user,
        recentGames,
        achievements: achievements.map(ach => ({
          ...ach,
          unlockedAt: user.achievements?.find(a => a.id === ach.achievementId)?.unlockedAt
        })),
        isOnline: getPlayerSession(user.telegramId) !== null,
        rank: user.rank
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Admin panel static fayllar
app.use('/admin/panel', express.static('admin-panel'));

// Admin login (simple version)
app.post('/admin/login', (req, res) => {
  const { token } = req.body;
  if (token === ADMIN_TOKEN) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Admin panel uchun bosh sahifa
// ==================== ADMIN PANEL ====================

// Admin panel login sahifasi
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
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>🎮 Game Server Admin Login</h2>
        <input type="password" id="token" placeholder="Enter Admin Token" autocomplete="off">
        <button onclick="login()">Login to Admin Panel</button>
        <div id="error"></div>
        
        <div class="info">
          <strong>Server Info:</strong><br>
          • Port: ${PORT}<br>
          • WebSocket: ws://${req.hostname}<br>
          • Health: <a href="/health" target="_blank">/health</a>
        </div>
      </div>
      
      <script>
        async function login() {
          const token = document.getElementById('token').value.trim();
          const errorDiv = document.getElementById('error');
          
          if (!token) {
            errorDiv.textContent = 'Please enter admin token';
            return;
          }
          
          errorDiv.textContent = 'Checking...';
          errorDiv.style.color = 'blue';
          
          try {
            // Admin tokenini tekshirish (faqat frontend)
            const correctToken = '${ADMIN_TOKEN}' || 'admin-secret-key';
            
            if (token === correctToken) {
              localStorage.setItem('adminToken', token);
              window.location.href = '/admin/dashboard';
            } else {
              errorDiv.textContent = 'Invalid admin token';
              errorDiv.style.color = 'red';
            }
          } catch (error) {
            errorDiv.textContent = 'Login error: ' + error.message;
            errorDiv.style.color = 'red';
          }
        }
        
        document.getElementById('token').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') login();
        });
        
        // Token localStorage'da saqlangan bo'lsa
        const savedToken = localStorage.getItem('adminToken');
        if (savedToken) {
          document.getElementById('token').value = savedToken;
        }
      </script>
    </body>
    </html>
  `);
});

// Admin dashboard sahifasi (panel o'rniga)
app.get('/admin/dashboard', (req, res) => {
  // Token tekshirish
  const token = req.query.token || req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).send(`
      <html>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h2>Unauthorized</h2>
        <p>Invalid or missing admin token</p>
        <a href="/admin">Back to Login</a>
      </body>
      </html>
    `);
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Game Server Admin Dashboard</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --primary: #2c3e50;
          --secondary: #3498db;
          --danger: #e74c3c;
          --warning: #f39c12;
          --success: #2ecc71;
          --light: #ecf0f1;
          --dark: #2c3e50;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          background: white;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }

        .header h1 {
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .server-info {
          display: flex;
          gap: 20px;
          color: var(--dark);
          align-items: center;
          flex-wrap: wrap;
        }

        .server-info .status {
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
          background: var(--success);
          color: white;
        }

        .dashboard {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .card {
          background: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .card h3 {
          color: var(--primary);
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .stat-item {
          text-align: center;
          padding: 15px;
          border-radius: 8px;
          background: var(--light);
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: var(--primary);
          margin: 10px 0;
        }

        .stat-label {
          font-size: 12px;
          color: #7f8c8d;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .online { color: var(--success); }
        .queue { color: var(--warning); }
        .games { color: var(--secondary); }
        .tournaments { color: var(--danger); }

        .table-container {
          background: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        th {
          background: var(--primary);
          color: white;
          position: sticky;
          top: 0;
        }

        tr:hover {
          background: #f5f5f5;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .badge.online { background: var(--success); color: white; }
        .badge.offline { background: #95a5a6; color: white; }
        .badge.queued { background: var(--warning); color: white; }
        .badge.ingame { background: var(--secondary); color: white; }

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
          font-weight: bold;
          transition: all 0.3s;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .btn-primary { background: var(--secondary); color: white; }
        .btn-success { background: var(--success); color: white; }
        .btn-warning { background: var(--warning); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-dark { background: var(--primary); color: white; }

        .refresh-btn {
          background: var(--primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: var(--dark);
        }

        .error {
          color: var(--danger);
          padding: 10px;
          background: #ffebee;
          border-radius: 5px;
          margin: 10px 0;
        }

        .success {
          color: var(--success);
          padding: 10px;
          background: #e8f5e9;
          border-radius: 5px;
          margin: 10px 0;
        }

        @media (max-width: 768px) {
          .dashboard {
            grid-template-columns: 1fr;
          }
          
          .stat-grid {
            grid-template-columns: 1fr;
          }
          
          .header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }
          
          .server-info {
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .controls {
            justify-content: center;
          }
        }

        .logout-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
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
            Tosh-Qaychi-Qog'oz Admin Dashboard
          </h1>
          <div class="server-info">
            <div class="status" id="serverStatus">Checking...</div>
            <div id="serverTime">--:--:--</div>
            <button class="refresh-btn" onclick="loadAllData()">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>

        <!-- Dashboard Stats -->
        <div class="dashboard">
          <div class="card">
            <h3><i class="fas fa-users"></i> Players</h3>
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-value online" id="onlinePlayers">0</div>
                <div class="stat-label">Online Now</div>
              </div>
              <div class="stat-item">
                <div class="stat-value queue" id="queuedPlayers">0</div>
                <div class="stat-label">In Queue</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3><i class="fas fa-trophy"></i> Games</h3>
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-value games" id="activeGames">0</div>
                <div class="stat-label">Active Games</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" id="totalGames">0</div>
                <div class="stat-label">Total Games</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3><i class="fas fa-chess"></i> System</h3>
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-value" id="memoryUsage">0%</div>
                <div class="stat-label">Memory</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" id="uptime">0s</div>
                <div class="stat-label">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Online Players Table -->
        <div class="table-container">
          <h3><i class="fas fa-user-clock"></i> Online Players</h3>
          <div id="playersLoading" class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading players...
          </div>
          <table id="playersTable" style="display: none;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Game</th>
                <th>IP Address</th>
                <th>Connected</th>
              </tr>
            </thead>
            <tbody id="playersBody">
              <!-- Players will be loaded here -->
            </tbody>
          </table>
        </div>

        <!-- Active Games Table -->
        <div class="table-container">
          <h3><i class="fas fa-play-circle"></i> Active Games</h3>
          <div id="gamesLoading" class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading games...
          </div>
          <table id="gamesTable" style="display: none;">
            <thead>
              <tr>
                <th>Game ID</th>
                <th>Player 1</th>
                <th>Player 2</th>
                <th>Mode</th>
                <th>Round</th>
                <th>Score</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody id="gamesBody">
              <!-- Games will be loaded here -->
            </tbody>
          </table>
        </div>

        <!-- Controls -->
        <div class="card">
          <h3><i class="fas fa-cogs"></i> Server Controls</h3>
          <div class="controls">
            <button class="btn-primary" onclick="showModal('broadcastModal')">
              <i class="fas fa-bullhorn"></i> Broadcast
            </button>
            <button class="btn-warning" onclick="showModal('logsModal')">
              <i class="fas fa-clipboard-list"></i> View Logs
            </button>
            <button class="btn-dark" onclick="window.open('/health', '_blank')">
              <i class="fas fa-heartbeat"></i> Health Check
            </button>
          </div>
        </div>
      </div>

      <!-- Broadcast Modal -->
      <div id="broadcastModal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
          <h3><i class="fas fa-bullhorn"></i> Send Broadcast Message</h3>
          <div style="margin-bottom: 15px;">
            <label>Message Type:</label>
            <select id="broadcastType" style="width: 100%; padding: 8px; margin-top: 5px;">
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="alert">Alert</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label>Message:</label>
            <textarea id="broadcastMessage" placeholder="Enter your message here..." style="width: 100%; padding: 8px; margin-top: 5px; min-height: 100px;"></textarea>
          </div>
          <div id="broadcastResult"></div>
          <div class="controls">
            <button class="btn-success" onclick="sendBroadcast()">Send</button>
            <button class="btn-danger" onclick="hideModal('broadcastModal')">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Logs Modal -->
      <div id="logsModal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
          <h3><i class="fas fa-clipboard-list"></i> Server Logs</h3>
          <div class="controls" style="margin-bottom: 20px;">
            <select id="logTypeFilter" style="padding: 8px;" onchange="loadLogs()">
              <option value="">All Types</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
            <select id="logLimit" style="padding: 8px;" onchange="loadLogs()">
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
            </select>
            <button class="refresh-btn" onclick="loadLogs()">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
          <div id="logsLoading" class="loading">
            <i class="fas fa-spinner fa-spin"></i> Loading logs...
          </div>
          <div id="logsContainer" style="display: none;">
            <!-- Logs will be loaded here -->
          </div>
          <div class="controls" style="margin-top: 20px;">
            <button class="btn-danger" onclick="hideModal('logsModal')">Close</button>
          </div>
        </div>
      </div>

      <!-- Logout Button -->
      <button class="logout-btn btn-danger" onclick="logout()">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>

      <script>
        const SERVER_URL = window.location.origin;
        const ADMIN_TOKEN = '${ADMIN_TOKEN}';
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
          loadAllData();
          setInterval(loadStats, 5000);
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
              document.getElementById('onlinePlayers').textContent = 
                data.stats.onlineNow || 0;
              document.getElementById('queuedPlayers').textContent = 
                data.stats.inQueue || 0;
              document.getElementById('activeGames').textContent = 
                data.stats.activeGames || 0;
              document.getElementById('totalGames').textContent = 
                data.stats.totalGames || 0;
              
              document.getElementById('serverStatus').textContent = 
                data.stats.databaseStatus === 'connected' ? '✅ Online' : '❌ Offline';
              document.getElementById('serverStatus').className = 
                data.stats.databaseStatus === 'connected' ? 'status' : 'status offline';
            }
          } catch (error) {
            console.error('Error loading stats:', error);
          }
        }

        async function loadPlayers() {
          try {
            const response = await fetch(SERVER_URL + '/admin/api/sessions', {
              headers: { 'x-admin-token': ADMIN_TOKEN }
            });
            const data = await response.json();
            
            const loading = document.getElementById('playersLoading');
            const table = document.getElementById('playersTable');
            const body = document.getElementById('playersBody');
            
            if (data.success) {
              loading.style.display = 'none';
              table.style.display = 'table';
              body.innerHTML = '';
              
              if (data.sessions.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align: center;">No players online</td></tr>';
                return;
              }
              
              data.sessions.forEach(player => {
                const connectedTime = Math.floor((Date.now() - (player.connectedAt || Date.now())) / 1000);
                const connectedStr = formatTime(connectedTime);
                
                const row = \`
                  <tr>
                    <td>\${player.userId}</td>
                    <td><strong>\${player.firstName || 'Unknown'}</strong><br>
                        <small>@\${player.username || 'no-username'}</small>
                    </td>
                    <td><span class="badge \${player.status || 'offline'}">\${player.status || 'offline'}</span></td>
                    <td>\${player.gameId ? '🎮 ' + player.gameId.substring(0, 8) + '...' : 'None'}</td>
                    <td><small>\${player.ip || 'Unknown'}</small></td>
                    <td>\${connectedStr}</td>
                  </tr>
                \`;
                body.innerHTML += row;
              });
            }
          } catch (error) {
            console.error('Error loading players:', error);
          }
        }

        async function loadGames() {
          try {
            const response = await fetch(SERVER_URL + '/admin/api/games', {
              headers: { 'x-admin-token': ADMIN_TOKEN }
            });
            const data = await response.json();
            
            const loading = document.getElementById('gamesLoading');
            const table = document.getElementById('gamesTable');
            const body = document.getElementById('gamesBody');
            
            if (data.success) {
              loading.style.display = 'none';
              table.style.display = 'table';
              body.innerHTML = '';
              
              if (!data.games || data.games.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align: center;">No active games</td></tr>';
                return;
              }
              
              data.games.forEach(game => {
                const startedTime = Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000);
                const startedStr = formatTime(startedTime);
                
                const row = \`
                  <tr>
                    <td><small>\${game.gameId?.substring(0, 12) || 'N/A'}...</small></td>
                    <td><strong>\${game.player1?.firstName || 'Player1'}</strong><br>
                        <small>ELO: \${game.player1?.elo || 1000}</small>
                    </td>
                    <td>\${game.player2?.firstName ? \`<strong>\${game.player2.firstName}</strong><br><small>ELO: \${game.player2.elo || 1000}</small>\` : 'Waiting...'}</td>
                    <td><span class="badge \${game.mode === 'ranked' ? 'ingame' : 'queued'}">\${game.mode || 'casual'}</span></td>
                    <td>\${game.currentRound || 1}/\${game.rounds || 3}</td>
                    <td><strong>\${game.scores?.player1 || 0}</strong> - <strong>\${game.scores?.player2 || 0}</strong></td>
                    <td>\${startedStr}</td>
                  </tr>
                \`;
                body.innerHTML += row;
              });
            }
          } catch (error) {
            console.error('Error loading games:', error);
          }
        }

        async function loadLogs() {
          const typeFilter = document.getElementById('logTypeFilter').value;
          const limit = document.getElementById('logLimit').value;
          
          try {
            const url = \`\${SERVER_URL}/admin/api/logs?limit=\${limit}\${typeFilter ? \`&type=\${typeFilter}\` : ''}\`;
            const response = await fetch(url, {
              headers: { 'x-admin-token': ADMIN_TOKEN }
            });
            const data = await response.json();
            
            const loading = document.getElementById('logsLoading');
            const container = document.getElementById('logsContainer');
            
            if (data.success) {
              loading.style.display = 'none';
              container.style.display = 'block';
              container.innerHTML = '';
              
              if (!data.logs || data.logs.length === 0) {
                container.innerHTML = '<div class="error">No logs found</div>';
                return;
              }
              
              data.logs.forEach(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                const logClass = \`log-entry log-\${log.type}\`;
                
                const logHtml = \`
                  <div class="\${logClass}" style="padding: 10px; border-left: 4px solid; margin-bottom: 10px; background: #f5f5f5;">
                    <div style="font-size: 12px; color: #666;">[\${time}] \${log.type?.toUpperCase() || 'INFO'}</div>
                    <div style="margin: 5px 0; font-weight: bold;">\${log.message || 'No message'}</div>
                    \${log.data ? \`<div style="font-size: 12px; color: #666; white-space: pre-wrap;">\${JSON.stringify(log.data, null, 2)}</div>\` : ''}
                  </div>
                \`;
                container.innerHTML += logHtml;
              });
            }
          } catch (error) {
            console.error('Error loading logs:', error);
          }
        }

        async function sendBroadcast() {
          const type = document.getElementById('broadcastType').value;
          const message = document.getElementById('broadcastMessage').value.trim();
          const resultDiv = document.getElementById('broadcastResult');
          
          if (!message) {
            resultDiv.innerHTML = '<div class="error">Please enter a message</div>';
            return;
          }
          
          try {
            const response = await fetch(SERVER_URL + '/admin/api/broadcast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-token': ADMIN_TOKEN
              },
              body: JSON.stringify({ 
                message, 
                type,
                target: 'all'
              })
            });
            
            const data = await response.json();
            
            if (data.success) {
              resultDiv.innerHTML = \`
                <div class="success">
                  ✅ Message sent to \${data.sentTo || 0} players
                </div>
              \`;
              
              setTimeout(() => {
                resultDiv.innerHTML = '';
                hideModal('broadcastModal');
              }, 3000);
            } else {
              resultDiv.innerHTML = \`<div class="error">\${data.error}</div>\`;
            }
          } catch (error) {
            console.error('Error sending broadcast:', error);
            resultDiv.innerHTML = '<div class="error">Failed to send broadcast</div>';
          }
        }

        function formatTime(seconds) {
          if (seconds < 60) return \`\${seconds}s ago\`;
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (minutes < 60) return \`\${minutes}m \${secs}s ago\`;
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return \`\${hours}h \${mins}m ago\`;
        }

        function showModal(modalId) {
          document.getElementById(modalId).style.display = 'flex';
          if (modalId === 'logsModal') {
            loadLogs();
          }
        }

        function hideModal(modalId) {
          document.getElementById(modalId).style.display = 'none';
        }

        function logout() {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin';
        }
      </script>
    </body>
    </html>
  `);
});
// Admin API (faqat admin uchun)
app.use('/admin/api/*', (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ success: false, error: 'Admin huquqlari talab qilinadi' });
  }
  next();
});

app.get('/admin/api/logs', (req, res) => {
  const { type, limit = 100 } = req.query;
  let logs = [...systemLogs];
  
  if (type) {
    logs = logs.filter(log => log.type === type);
  }
  
  logs = logs.slice(-parseInt(limit)).reverse();
  
  res.json({ success: true, logs });
});

app.get('/admin/api/sessions', (req, res) => {
  const sessions = Array.from(playerSessions.values()).map(s => ({
    userId: s.userId,
    firstName: s.user?.firstName,
    username: s.user?.username,
    status: s.status,
    gameId: s.gameId,
    tournamentId: s.tournamentId,
    lastHeartbeat: s.lastHeartbeat,
    ip: s.ip,
    device: s.deviceInfo,
    connectedFor: Date.now() - s.connectedAt
  }));
  
  res.json({ success: true, sessions });
});

app.get('/admin/api/games', (req, res) => {
  const games = Array.from(activeGames.values()).map(game => ({
    gameId: game.gameId,
    player1: game.player1,
    player2: game.player2,
    status: game.status,
    mode: game.mode,
    currentRound: game.currentRound,
    scores: {
      player1: game.player1.score,
      player2: game.player2.score
    },
    roundResults: game.roundResults,
    createdAt: game.createdAt,
    spectators: gameSpectators.get(game.gameId)?.length || 0
  }));
  
  res.json({ success: true, games });
});

app.post('/admin/api/broadcast', async (req, res) => {
  try {
    const { message, type = 'info', target = 'all' } = req.body;
    
    let sentTo = 0;
    
    if (target === 'all') {
      // Barcha online foydalanuvchilarga
      Array.from(playerSessions.values()).forEach(session => {
        if (safeSend(session.ws, {
          type: 'admin_broadcast',
          message,
          broadcastType: type,
          timestamp: Date.now()
        })) {
          sentTo++;
        }
      });
    } else if (target === 'in_game') {
      // Faqat o'yindagilarga
      Array.from(playerSessions.values()).forEach(session => {
        if (session.gameId && safeSend(session.ws, {
          type: 'admin_broadcast',
          message,
          broadcastType: type,
          timestamp: Date.now()
        })) {
          sentTo++;
        }
      });
    }
    
    res.json({
      success: true,
      sentTo,
      message: 'Xabar yuborildi'
    });
    
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Server monitoring
app.get('/admin/api/system', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2);
  
  res.json({
    success: true,
    system: {
      uptime: process.uptime(),
      memory: {
        used: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        percent: `${memoryPercent}%`
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      connections: wss.clients.size
    }
  });
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Server xatosi', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// ==================== SERVER START ====================
server.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │ 🎮 Tosh-Qaychi-Qog'oz Multiplayer Server v2.0.0            │
  │                                                             │
  │ 📊 Port:        ${PORT.toString().padEnd(39)}│
  │ 🔌 WebSocket:   ws://localhost:${PORT}                     │
  │ 📈 Health:      http://localhost:${PORT}/health            │
  │ 📊 Stats API:   http://localhost:${PORT}/api/stats         │
  │ 🕒 Started:     ${new Date().toLocaleString()}             │
  └─────────────────────────────────────────────────────────────┘
  
  📊 System Info:
  • Memory:       ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
  • Node.js:      ${process.version}
  • Environment:  ${process.env.NODE_ENV || 'development'}
  • PID:          ${process.pid}
  • Database:     ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}
  • Bot:          ${bot ? '✅ Running' : '❌ Disabled'}
  `);
  
  // Muntazam monitoring
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2);
    
    console.log(`
  ┌───────────────────────────────────────────────────┐
  │ Real-time Statistics ${new Date().toLocaleTimeString()} │
  ├───────────────────────────────────────────────────┤
  │ 👤 Online Players: ${Array.from(playerSessions.values())
      .filter(s => s.status === 'online').length.toString().padEnd(25)}│
  │ 🎮 Active Games:   ${activeGames.size.toString().padEnd(25)}│
  │ ⏳ In Queue:       ${matchmakingQueue.size.toString().padEnd(25)}│
  │ 🏆 Tournaments:    ${activeTournaments.size.toString().padEnd(25)}│
  │ 💬 Chat Rooms:     ${chatRooms.size.toString().padEnd(25)}│
  │ 📨 Invitations:    ${pendingInvitations.size.toString().padEnd(25)}│
  │ 💾 Memory:         ${memoryPercent}%${' '.repeat(21)}│
  └───────────────────────────────────────────────────┘
    `);
  }, 60000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Barcha o'yinchilarga xabar
  Array.from(playerSessions.values()).forEach(session => {
    safeSend(session.ws, {
      type: 'server_shutdown',
      message: 'Server yangilanmoqda. Iltimos, 5 daqiqadan keyin qayta ulaning.',
      reconnectIn: 300,
      timestamp: Date.now()
    });
  });
  
  // 5 soniya kutish
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Connectionlarni yopish
  wss.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    // Database connection'ni yopish
    await mongoose.connection.close(false);
    console.log('✅ Database connection closed');
    
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logSystemEvent('error', 'Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logSystemEvent('error', 'Unhandled Rejection', { 
    reason: reason?.message || reason 
  });
});

// ==================== INITIALIZE ====================
// Boshlang'ich achievement'larni yaratish
async function initializeAchievements() {
  const achievements = [
    {
      achievementId: 'first_win',
      name: 'Birinchi Gʻalaba',
      description: 'Birinchi o‘yinda gʻalaba qozoning',
      category: 'wins',
      icon: '🏆',
      points: 10,
      rarity: 'common',
      condition: 'wins >= 1',
      rewards: { coins: 100 }
    },
    {
      achievementId: 'win_streak_5',
      name: '5 Gʻalaba Ketma-ket',
      description: '5 marta ketma-ket gʻalaba qozoning',
      category: 'streak',
      icon: '🔥',
      points: 50,
      rarity: 'rare',
      condition: 'streak >= 5',
      rewards: { coins: 500, gems: 5 }
    },
    {
      achievementId: 'elo_1500',
      name: 'Master',
      description: '1500 ELO reytingga erishing',
      category: 'games',
      icon: '👑',
      points: 100,
      rarity: 'epic',
      condition: 'elo >= 1500',
      rewards: { coins: 1000, gems: 10, theme: 'gold' }
    },
    {
      achievementId: 'play_100_games',
      name: 'Tajribali Oʻyinchi',
      description: '100 ta o‘yin o‘ynang',
      category: 'games',
      icon: '🎮',
      points: 75,
      rarity: 'rare',
      condition: 'totalGames >= 100',
      rewards: { coins: 750 }
    },
    {
      achievementId: 'perfect_win',
      name: 'Mukammal Gʻalaba',
      description: '3:0 hisobida gʻalaba qozoning',
      category: 'wins',
      icon: '⭐',
      points: 25,
      rarity: 'common',
      condition: 'true', // Bu logic o'yinda tekshiriladi
      rewards: { coins: 250 }
    }
  ];
  
  for (const achievement of achievements) {
    await Achievement.findOneAndUpdate(
      { achievementId: achievement.achievementId },
      achievement,
      { upsert: true, new: true }
    );
  }
  
  console.log('✅ Achievements initialized');
}

// Server ishga tushganda
setTimeout(async () => {
  await initializeAchievements();
  console.log('🚀 Server fully initialized and ready');
}, 2000);