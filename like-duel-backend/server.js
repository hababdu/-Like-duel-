// ============================================================
// SERVER.JS - TO'LIQ BACKEND
// ============================================================
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ======================
// ENVIRONMENT VARIABLES
// ======================
const {
  PORT = 10000,
  MONGODB_URI,
  ADMIN_TOKEN = 'admin-secret-key'
} = process.env;

// ======================
// CORS
// ======================
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// SOCKET.IO
// ======================
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  },
  transports: ['websocket', 'polling']
});

// ======================
// MONGODB CONNECTION
// ======================
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ======================
// USER SCHEMA
// ======================
const UserSchema = new mongoose.Schema({
  // Telegram ma'lumotlari
  tgId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  languageCode: { type: String, default: 'uz' },
  isPremium: { type: Boolean, default: false },
  
  // O'yin ma'lumotlari
  coins: { type: Number, default: 100 },
  rating: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },
  
  // Statistika
  totalGames: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },
  
  // Referal
  refParent: { type: String, default: null },
  refCount: { type: Number, default: 0 },
  refBonus: { type: Number, default: 0 },
  isRefRewarded: { type: Boolean, default: false },
  
  // Holat
  isOnline: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ======================
// GAME STATE
// ======================
let searchQueue = [];
let activeRooms = {};
let onlineUsers = new Map();

// ======================
// API ROUTES
// ======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ============================================================
// 1. USER AUTH - TELEGRAM MA'LUMOTLARINI SAQLASH
// ============================================================
app.post('/api/user/auth', async (req, res) => {
  try {
    const { 
      tgId, 
      username, 
      firstName, 
      lastName, 
      photoUrl, 
      languageCode,
      isPremium,
      refParent 
    } = req.body;

    console.log('📥 Auth request:', { tgId, username, firstName });

    // tgId tekshirish
    if (!tgId) {
      return res.status(400).json({ 
        success: false, 
        message: 'tgId talab qilinadi' 
      });
    }

    // User ni topish yoki yaratish
    let user = await User.findOne({ tgId });

    if (!user) {
      // Yangi user yaratish
      user = new User({
        tgId,
        username: username || '',
        firstName: firstName || "O'yinchi",
        lastName: lastName || '',
        photoUrl: photoUrl || '',
        languageCode: languageCode || 'uz',
        isPremium: isPremium || false,
        coins: 100,
        rating: 100,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        refParent: refParent && refParent !== tgId ? refParent : null
      });

      // Referal bonusi
      if (refParent && refParent !== tgId) {
        const parent = await User.findOne({ tgId: refParent });
        if (parent) {
          parent.coins += 100;
          parent.refCount += 1;
          parent.refBonus += 100;
          await parent.save();
          
          user.coins += 100;
          user.isRefRewarded = true;
          
          // Socket orqali parent ga xabar
          io.emit(`update_${refParent}`, {
            type: 'REF_BONUS',
            coins: parent.coins,
            refCount: parent.refCount
          });
        }
      }

      await user.save();
      console.log('✅ New user created:', user.tgId);
    } else {
      // Mavjud user yangilash
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.photoUrl = photoUrl || user.photoUrl;
      user.languageCode = languageCode || user.languageCode;
      user.isPremium = isPremium || user.isPremium;
      user.lastLogin = new Date();
      user.isOnline = true;
      await user.save();
      console.log('✅ User updated:', user.tgId);
    }

    // Javob
    res.json({
      success: true,
      user: {
        tgId: user.tgId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
        coins: user.coins,
        rating: user.rating,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        totalGames: user.totalGames,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        winStreak: user.winStreak,
        maxWinStreak: user.maxWinStreak,
        refCount: user.refCount,
        refBonus: user.refBonus,
        isRefRewarded: user.isRefRewarded
      }
    });

  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xatoligi: ' + error.message
    });
  }
});

// ============================================================
// 2. GET USER PROFILE
// ============================================================
app.get('/api/user/:tgId', async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    res.json({
      success: true,
      user: {
        tgId: user.tgId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        isPremium: user.isPremium,
        coins: user.coins,
        rating: user.rating,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel,
        totalGames: user.totalGames,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        winStreak: user.winStreak,
        maxWinStreak: user.maxWinStreak,
        refCount: user.refCount,
        refBonus: user.refBonus,
        isOnline: user.isOnline
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server xatoligi'
    });
  }
});

// ============================================================
// 3. UPDATE USER COINS
// ============================================================
app.post('/api/user/update-coins', async (req, res) => {
  try {
    const { tgId, amount } = req.body;
    
    const user = await User.findOne({ tgId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    user.coins = Math.max(0, user.coins + amount);
    await user.save();

    res.json({
      success: true,
      coins: user.coins
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server xatoligi'
    });
  }
});

// ============================================================
// 4. LEADERBOARD
// ============================================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('tgId firstName username photoUrl coins rating level totalGames wins');

    res.json({
      success: true,
      leaders
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server xatoligi'
    });
  }
});

// ============================================================
// 5. REFERRALS
// ============================================================
app.get('/api/user/:tgId/referrals', async (req, res) => {
  try {
    const referrals = await User.find({ refParent: req.params.tgId })
      .select('firstName username coins rating createdAt');

    res.json({
      success: true,
      referrals,
      count: referrals.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server xatoligi'
    });
  }
});

// ============================================================
// 6. GAME STATS
// ============================================================
app.get('/api/user/:tgId/stats', async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }

    const winRate = user.totalGames > 0 
      ? Math.round((user.wins / user.totalGames) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalGames: user.totalGames,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        winRate: winRate,
        winStreak: user.winStreak,
        maxWinStreak: user.maxWinStreak,
        rating: user.rating,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server xatoligi'
    });
  }
});

// ============================================================
// SOCKET.IO - GAME EVENTS
// ============================================================

io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  // ============================================================
  // USER CONNECT
  // ============================================================
  socket.on('user_connect', async (data) => {
    try {
      const { tgId } = data;
      
      if (!tgId) {
        socket.emit('error', { message: 'tgId kerak' });
        return;
      }

      const user = await User.findOne({ tgId: String(tgId) });
      
      if (!user) {
        socket.emit('error', { message: 'Foydalanuvchi topilmadi' });
        return;
      }

      user.isOnline = true;
      user.lastLogin = new Date();
      await user.save();

      onlineUsers.set(String(tgId), {
        socketId: socket.id,
        user: user
      });

      socket.emit('user_connected', {
        success: true,
        user: {
          tgId: user.tgId,
          firstName: user.firstName,
          username: user.username,
          photoUrl: user.photoUrl,
          coins: user.coins,
          rating: user.rating,
          level: user.level
        }
      });

      // Barchaga online status
      io.emit('user_status', {
        tgId: String(tgId),
        status: 'online',
        firstName: user.firstName
      });

    } catch (error) {
      console.error('❌ User connect error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ============================================================
  // FIND MATCH
  // ============================================================
  socket.on('find_match', async ({ player, stake = 10 }) => {
    try {
      console.log('🔍 Find match:', player.tgId);

      // Queue dan o'chirish
      searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

      const newPlayer = {
        socketId: socket.id,
        tgId: String(player.tgId),
        name: player.firstName || "O'yinchi",
        username: player.username || '',
        rating: player.rating || 100,
        stake: Math.max(1, Number(stake) || 10)
      };

      // Raqib qidirish
      const opponentIndex = searchQueue.findIndex(p => 
        p.stake === newPlayer.stake && 
        p.tgId !== newPlayer.tgId &&
        io.sockets.sockets.has(p.socketId)
      );

      if (opponentIndex !== -1) {
        // Raqib topildi
        const opponent = searchQueue.splice(opponentIndex, 1)[0];
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        socket.join(roomId);
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (oppSocket) {
          oppSocket.join(roomId);
        }

        // Xona yaratish
        activeRooms[roomId] = {
          roomId,
          players: [newPlayer, opponent],
          choices: {},
          stake: newPlayer.stake,
          timer: null,
          timeLeft: 30,
          createdAt: Date.now()
        };

        // Match found
        const opponentData = {
          tgId: opponent.tgId,
          name: opponent.name,
          username: opponent.username,
          rating: opponent.rating
        };

        const playerData = {
          tgId: newPlayer.tgId,
          name: newPlayer.name,
          username: newPlayer.username,
          rating: newPlayer.rating
        };

        socket.emit('match_found', {
          roomId,
          opponent: opponentData,
          stake: newPlayer.stake
        });

        oppSocket.emit('match_found', {
          roomId,
          opponent: playerData,
          stake: newPlayer.stake
        });

        // Timer boshlash
        startRoomTimer(roomId);

      } else {
        // Queue ga qo'shish
        searchQueue.push(newPlayer);
        socket.emit('searching', {
          stake: newPlayer.stake,
          queueLength: searchQueue.length
        });
      }

    } catch (error) {
      console.error('❌ Find match error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ============================================================
  // MAKE CHOICE
  // ============================================================
// ============================================================
// SERVER.JS - SOCKET EVENTS TUZATILGAN
// ============================================================

// ============================================================
// MAKE CHOICE - TUZATILGAN
// ============================================================
socket.on('make_choice', ({ roomId, choice }) => {
  console.log('✋ Make choice:', { roomId, choice, socketId: socket.id });
  
  const room = activeRooms[roomId];
  if (!room) {
    console.error('❌ Room not found:', roomId);
    socket.emit('error', { message: 'Xona topilmadi' });
    return;
  }

  // O'yinchi tanlovini saqlash
  room.choices[socket.id] = choice;
  console.log('📊 Choices:', room.choices);
  console.log('📊 Total choices:', Object.keys(room.choices).length);
  
  // Ikkala o'yinchi ham tanlov qilganini tekshirish
  const player1Id = room.players[0].socketId;
  const player2Id = room.players[1].socketId;
  const hasPlayer1Choice = room.choices[player1Id] !== undefined;
  const hasPlayer2Choice = room.choices[player2Id] !== undefined;
  
  console.log('📊 Player1 choice:', hasPlayer1Choice ? room.choices[player1Id] : '❌');
  console.log('📊 Player2 choice:', hasPlayer2Choice ? room.choices[player2Id] : '❌');

  // Ikkala o'yinchi ham tanlov qildi
  if (hasPlayer1Choice && hasPlayer2Choice) {
    console.log('✅ Both players made choice!');
    
    // Timer ni to'xtatish
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
    
    // Natijani hisoblash
    evaluateRound(roomId);
  } else {
    console.log('⏳ Waiting for other player...');
    // Boshqa o'yinchiga xabar yuborish
    const otherPlayerId = socket.id === player1Id ? player2Id : player1Id;
    if (io.sockets.sockets.has(otherPlayerId)) {
      io.to(otherPlayerId).emit('opponent_choice_made', {
        status: 'waiting'
      });
    }
  }
});

// ============================================================
// SERVER.JS - CHAT UCHUN QO'SHIMCHA
// ============================================================

// ============================================================
// CHAT MESSAGE
// ============================================================
socket.on('chat_message', ({ roomId, message }) => {
  console.log('💬 Chat message:', { roomId, message, socketId: socket.id });
  
  const room = activeRooms[roomId];
  if (!room) {
    socket.emit('error', { message: 'Xona topilmadi' });
    return;
  }

  // Xabarni yuborgan o'yinchini topish
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  const chatData = {
    tgId: player.tgId,
    name: player.name || "O'yinchi",
    photoUrl: player.photoUrl || '',
    message: message,
    timestamp: new Date().toISOString()
  };

  // Xonadagi barchaga yuborish
  io.to(roomId).emit('chat_message', chatData);
});

// ============================================================
// FIND MATCH - PLAYERGA PHOTO URL QO'SHISH
// ============================================================
socket.on('find_match', async ({ player, stake = 10 }) => {
  console.log('🔍 Find match:', player.tgId);

  try {
    // User ma'lumotlarini bazadan olish
    const user = await User.findOne({ tgId: String(player.tgId) });
    
    if (!user) {
      socket.emit('error', { message: 'Foydalanuvchi topilmadi' });
      return;
    }

    // Queue dan o'chirish
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    const newPlayer = {
      socketId: socket.id,
      tgId: String(player.tgId),
      name: player.firstName || "O'yinchi",
      username: player.username || '',
      rating: player.rating || 100,
      stake: Math.max(1, Number(stake) || 10),
      photoUrl: user.photoUrl || '', // PHOTO URL QO'SHILDI
      level: user.level || 1
    };

    // Raqib qidirish
    const opponentIndex = searchQueue.findIndex(p => 
      p.stake === newPlayer.stake && 
      p.tgId !== newPlayer.tgId &&
      io.sockets.sockets.has(p.socketId)
    );

    if (opponentIndex !== -1) {
      const opponent = searchQueue.splice(opponentIndex, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      socket.join(roomId);
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) {
        oppSocket.join(roomId);
      }

      // Xona yaratish
      activeRooms[roomId] = {
        roomId,
        players: [newPlayer, opponent],
        choices: {},
        stake: newPlayer.stake,
        timer: null,
        timeLeft: 30,
        createdAt: Date.now(),
        chat: [] // CHAT UCHUN
      };

      // Match found
      const opponentData = {
        tgId: opponent.tgId,
        name: opponent.name,
        username: opponent.username,
        rating: opponent.rating,
        photoUrl: opponent.photoUrl || '', // PHOTO URL QO'SHILDI
        level: opponent.level || 1
      };

      const playerData = {
        tgId: newPlayer.tgId,
        name: newPlayer.name,
        username: newPlayer.username,
        rating: newPlayer.rating,
        photoUrl: newPlayer.photoUrl || '', // PHOTO URL QO'SHILDI
        level: newPlayer.level || 1
      };

      socket.emit('match_found', {
        roomId,
        opponent: opponentData,
        stake: newPlayer.stake
      });

      oppSocket.emit('match_found', {
        roomId,
        opponent: playerData,
        stake: newPlayer.stake
      });

      startRoomTimer(roomId);

    } else {
      searchQueue.push(newPlayer);
      socket.emit('searching', {
        stake: newPlayer.stake,
        queueLength: searchQueue.length
      });
    }

  } catch (error) {
    console.error('❌ Find match error:', error);
    socket.emit('error', { message: error.message });
  }
});

// ============================================================
// EVALUATE ROUND - TUZATILGAN
// ============================================================
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) {
    console.error('❌ Room not found for evaluation:', roomId);
    return;
  }

  console.log('📊 ===== EVALUATING ROUND =====');
  console.log('📊 Room ID:', roomId);
  console.log('📊 Choices:', room.choices);

  const [p1, p2] = room.players;
  
  // Tanlovlarni olish (agar bo'lmasa 'timeout')
  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';
  
  console.log('📊 Player1 choice:', c1);
  console.log('📊 Player2 choice:', c2);

  let result1, result2;
  let coinChange1 = 0, coinChange2 = 0;
  let xpChange1 = 0, xpChange2 = 0;

  // Natijalarni hisoblash
  if (c1 === 'timeout' && c2 === 'timeout') {
    // Ikkalasi ham tanlov qilmagan
    result1 = 'draw'; 
    result2 = 'draw';
    coinChange1 = 0; 
    coinChange2 = 0;
    xpChange1 = 0; 
    xpChange2 = 0;
    
  } else if (c1 === 'timeout') {
    // Faqat 1-o'yinchi tanlov qilmagan
    result1 = 'lose'; 
    result2 = 'win';
    coinChange1 = -room.stake; 
    coinChange2 = room.stake;
    xpChange1 = -10; 
    xpChange2 = 15;
    
  } else if (c2 === 'timeout') {
    // Faqat 2-o'yinchi tanlov qilmagan
    result1 = 'win'; 
    result2 = 'lose';
    coinChange1 = room.stake; 
    coinChange2 = -room.stake;
    xpChange1 = 15; 
    xpChange2 = -10;
    
  } else {
    // Ikkalasi ham tanlov qilgan
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      result1 = 'win'; 
      result2 = 'lose';
      coinChange1 = room.stake; 
      coinChange2 = -room.stake;
      xpChange1 = 15; 
      xpChange2 = -10;
    } else if (winner === 'player2') {
      result1 = 'lose'; 
      result2 = 'win';
      coinChange1 = -room.stake; 
      coinChange2 = room.stake;
      xpChange1 = -10; 
      xpChange2 = 15;
    } else {
      result1 = 'draw'; 
      result2 = 'draw';
      coinChange1 = 0; 
      coinChange2 = 0;
      xpChange1 = 5; 
      xpChange2 = 5;
    }
  }

  console.log('📊 Results:', { result1, result2, coinChange1, coinChange2 });

  try {
    // Userlarni yangilash
    const [user1, user2] = await Promise.all([
      User.findOne({ tgId: p1.tgId }),
      User.findOne({ tgId: p2.tgId })
    ]);

    if (user1) {
      user1.coins = Math.max(0, user1.coins + coinChange1);
      user1.rating = Math.max(0, user1.rating + xpChange1);
      user1.totalGames += 1;
      user1.xp += Math.max(0, xpChange1);
      
      if (result1 === 'win') {
        user1.wins += 1;
        user1.winStreak += 1;
        user1.maxWinStreak = Math.max(user1.maxWinStreak, user1.winStreak);
      } else if (result1 === 'lose') {
        user1.losses += 1;
        user1.winStreak = 0;
      } else {
        user1.draws += 1;
      }
      
      // Level tekshirish
      while (user1.xp >= user1.xpToNextLevel) {
        user1.level += 1;
        user1.xp -= user1.xpToNextLevel;
        user1.xpToNextLevel = Math.floor(user1.xpToNextLevel * 1.5);
      }
      
      await user1.save();
      console.log('✅ User1 updated:', user1.tgId, 'Coins:', user1.coins);
    }

    if (user2) {
      user2.coins = Math.max(0, user2.coins + coinChange2);
      user2.rating = Math.max(0, user2.rating + xpChange2);
      user2.totalGames += 1;
      user2.xp += Math.max(0, xpChange2);
      
      if (result2 === 'win') {
        user2.wins += 1;
        user2.winStreak += 1;
        user2.maxWinStreak = Math.max(user2.maxWinStreak, user2.winStreak);
      } else if (result2 === 'lose') {
        user2.losses += 1;
        user2.winStreak = 0;
      } else {
        user2.draws += 1;
      }
      
      while (user2.xp >= user2.xpToNextLevel) {
        user2.level += 1;
        user2.xp -= user2.xpToNextLevel;
        user2.xpToNextLevel = Math.floor(user2.xpToNextLevel * 1.5);
      }
      
      await user2.save();
      console.log('✅ User2 updated:', user2.tgId, 'Coins:', user2.coins);
    }

    // Natijalarni yuborish
    const resultData1 = {
      myChoice: c1,
      opponentChoice: c2,
      result: result1,
      rewardCoins: coinChange1,
      rewardXP: xpChange1,
      newCoins: user1?.coins || 0,
      newRating: user1?.rating || 0,
      newLevel: user1?.level || 1,
      opponentName: p2.name,
      opponentRating: p2.rating,
      opponentLevel: user2?.level || 1
    };

    const resultData2 = {
      myChoice: c2,
      opponentChoice: c1,
      result: result2,
      rewardCoins: coinChange2,
      rewardXP: xpChange2,
      newCoins: user2?.coins || 0,
      newRating: user2?.rating || 0,
      newLevel: user2?.level || 1,
      opponentName: p1.name,
      opponentRating: p1.rating,
      opponentLevel: user1?.level || 1
    };

    console.log('📤 Sending result to player1:', resultData1);
    console.log('📤 Sending result to player2:', resultData2);

    io.to(p1.socketId).emit('round_result', resultData1);
    io.to(p2.socketId).emit('round_result', resultData2);

  } catch (error) {
    console.error('❌ Evaluate round error:', error);
  }

  // Xonani o'chirish
  if (room.timer) {
    clearInterval(room.timer);
  }
  delete activeRooms[roomId];
  console.log('🗑️ Room deleted:', roomId);
}

// ============================================================
// DETERMINE WINNER
// ============================================================
function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) return 'player1';
  return 'player2';
}

  // ============================================================
  // CANCEL SEARCH
  // ============================================================
  socket.on('cancel_search', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
    socket.emit('search_cancelled');
  });

  // ============================================================
  // DISCONNECT
  // ============================================================
  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
    
    // Queue dan o'chirish
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
    
    // Online users dan o'chirish
    for (const [tgId, data] of onlineUsers.entries()) {
      if (data.socketId === socket.id) {
        onlineUsers.delete(tgId);
        break;
      }
    }
    
    // Active room dan o'chirish
    for (const [roomId, room] of Object.entries(activeRooms)) {
      const playerExists = room.players.some(p => p.socketId === socket.id);
      if (playerExists) {
        const otherPlayer = room.players.find(p => p.socketId !== socket.id);
        if (otherPlayer && io.sockets.sockets.has(otherPlayer.socketId)) {
          io.to(otherPlayer.socketId).emit('opponent_left');
        }
        clearInterval(room.timer);
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

// ============================================================
// GAME FUNCTIONS
// ============================================================

function startRoomTimer(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  let timeLeft = 30;
  room.timeLeft = timeLeft;

  room.timer = setInterval(() => {
    timeLeft--;
    room.timeLeft = timeLeft;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(room.timer);
      evaluateRound(roomId);
    }
  }, 1000);
}

async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const [p1, p2] = room.players;
  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  // Natijalarni hisoblash
  let result1, result2;
  let coinChange1 = 0, coinChange2 = 0;
  let xpChange1 = 0, xpChange2 = 0;

  if (c1 === 'timeout' && c2 === 'timeout') {
    result1 = 'draw'; result2 = 'draw';
  } else if (c1 === 'timeout') {
    result1 = 'lose'; result2 = 'win';
    coinChange1 = -room.stake; coinChange2 = room.stake;
    xpChange1 = -10; xpChange2 = 15;
  } else if (c2 === 'timeout') {
    result1 = 'win'; result2 = 'lose';
    coinChange1 = room.stake; coinChange2 = -room.stake;
    xpChange1 = 15; xpChange2 = -10;
  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      result1 = 'win'; result2 = 'lose';
      coinChange1 = room.stake; coinChange2 = -room.stake;
      xpChange1 = 15; xpChange2 = -10;
    } else if (winner === 'player2') {
      result1 = 'lose'; result2 = 'win';
      coinChange1 = -room.stake; coinChange2 = room.stake;
      xpChange1 = -10; xpChange2 = 15;
    } else {
      result1 = 'draw'; result2 = 'draw';
    }
  }

  try {
    // Userlarni yangilash
    const [user1, user2] = await Promise.all([
      User.findOne({ tgId: p1.tgId }),
      User.findOne({ tgId: p2.tgId })
    ]);

    if (user1) {
      user1.coins = Math.max(0, user1.coins + coinChange1);
      user1.rating = Math.max(0, user1.rating + xpChange1);
      user1.totalGames += 1;
      user1.xp += Math.max(0, xpChange1);
      
      if (result1 === 'win') {
        user1.wins += 1;
        user1.winStreak += 1;
        user1.maxWinStreak = Math.max(user1.maxWinStreak, user1.winStreak);
      } else if (result1 === 'lose') {
        user1.losses += 1;
        user1.winStreak = 0;
      } else {
        user1.draws += 1;
      }
      
      // Level tekshirish
      while (user1.xp >= user1.xpToNextLevel) {
        user1.level += 1;
        user1.xp -= user1.xpToNextLevel;
        user1.xpToNextLevel = Math.floor(user1.xpToNextLevel * 1.5);
      }
      
      await user1.save();
    }

    if (user2) {
      user2.coins = Math.max(0, user2.coins + coinChange2);
      user2.rating = Math.max(0, user2.rating + xpChange2);
      user2.totalGames += 1;
      user2.xp += Math.max(0, xpChange2);
      
      if (result2 === 'win') {
        user2.wins += 1;
        user2.winStreak += 1;
        user2.maxWinStreak = Math.max(user2.maxWinStreak, user2.winStreak);
      } else if (result2 === 'lose') {
        user2.losses += 1;
        user2.winStreak = 0;
      } else {
        user2.draws += 1;
      }
      
      while (user2.xp >= user2.xpToNextLevel) {
        user2.level += 1;
        user2.xp -= user2.xpToNextLevel;
        user2.xpToNextLevel = Math.floor(user2.xpToNextLevel * 1.5);
      }
      
      await user2.save();
    }

    // Natijalarni yuborish
    io.to(p1.socketId).emit('round_result', {
      myChoice: c1,
      opponentChoice: c2,
      result: result1,
      rewardCoins: coinChange1,
      rewardXP: xpChange1,
      newCoins: user1?.coins || 0,
      newRating: user1?.rating || 0,
      newLevel: user1?.level || 1
    });

    io.to(p2.socketId).emit('round_result', {
      myChoice: c2,
      opponentChoice: c1,
      result: result2,
      rewardCoins: coinChange2,
      rewardXP: xpChange2,
      newCoins: user2?.coins || 0,
      newRating: user2?.rating || 0,
      newLevel: user2?.level || 1
    });

  } catch (error) {
    console.error('❌ Evaluate round error:', error);
  }

  // Xonani o'chirish
  clearInterval(room.timer);
  delete activeRooms[roomId];
}

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) return 'player1';
  return 'player2';
}

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});