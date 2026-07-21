import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ======================
// ENVIRONMENT VARIABLES
// ======================
const {
  PORT = 10000,
  NODE_ENV = 'production',
  MONGODB_URI,
  ADMIN_TOKEN = 'admin-secret-key',
  WEB_APP_URL = 'https://telegram-mini-app-gsny.onrender.com'
} = process.env;

// ======================
// MIDDLEWARE
// ======================
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? [WEB_APP_URL, 'https://telegram-mini-app-gsny.onrender.com', 'https://telegram-bot-server-2-matj.onrender.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-admin-key", "x-telegram-init-data"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Juda ko'p so'rov yubordingiz. Biroz kutib turing." }
});
app.use('/api/', limiter);

// ======================
// SOCKET.IO - OLDINDAN E'LON QILISH (MUHIM!)
// ======================
const io = new Server(server, {
  cors: { 
    origin: NODE_ENV === 'production' 
      ? [WEB_APP_URL, 'https://telegram-mini-app-gsny.onrender.com']
      : '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket holatlari - io e'lon qilingandan KEYIN
let searchQueue = [];
let activeRooms = {};
let onlineUsers = new Map();

// ======================
// SOCKET HELPER FUNCTIONS - io dan KEYIN
// ======================
function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) return 'player1';
  return 'player2';
}

async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) {
    console.log(`⚠️ Room ${roomId} topilmadi`);
    return;
  }

  const [p1, p2] = room.players;
  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  let result1 = 'draw', result2 = 'draw';
  let coinChange1 = 0, coinChange2 = 0;
  let xpChange1 = 0, xpChange2 = 0;

  if (c1 === 'timeout' && c2 === 'timeout') {
    // Hech narsa o'zgarmaydi
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
    }
  }

  try {
    const [user1, user2] = await Promise.all([
      User.findOne({ tgId: p1.tgId }),
      User.findOne({ tgId: p2.tgId })
    ]);

    if (user1) {
      const newCoins = Math.max(0, user1.coins + coinChange1);
      const newRating = Math.max(0, user1.rating + xpChange1);
      user1.coins = newCoins;
      user1.rating = newRating;
      user1.totalGames = (user1.totalGames || 0) + 1;
      user1.lastGameAt = new Date();
      
      if (result1 === 'win') user1.wins = (user1.wins || 0) + 1;
      else if (result1 === 'lose') user1.losses = (user1.losses || 0) + 1;
      else user1.draws = (user1.draws || 0) + 1;
      
      await user1.save();
    }

    if (user2) {
      const newCoins = Math.max(0, user2.coins + coinChange2);
      const newRating = Math.max(0, user2.rating + xpChange2);
      user2.coins = newCoins;
      user2.rating = newRating;
      user2.totalGames = (user2.totalGames || 0) + 1;
      user2.lastGameAt = new Date();
      
      if (result2 === 'win') user2.wins = (user2.wins || 0) + 1;
      else if (result2 === 'lose') user2.losses = (user2.losses || 0) + 1;
      else user2.draws = (user2.draws || 0) + 1;
      
      await user2.save();
    }

    io.to(p1.socketId).emit('round_result', {
      myChoice: c1, 
      opponentChoice: c2, 
      result: result1,
      rewardCoins: coinChange1, 
      rewardXP: xpChange1
    });

    io.to(p2.socketId).emit('round_result', {
      myChoice: c2, 
      opponentChoice: c1, 
      result: result2,
      rewardCoins: coinChange2, 
      rewardXP: xpChange2
    });

  } catch (err) {
    console.error("Balans yangilashda xatolik:", err);
    io.to(roomId).emit('error', { 
      message: 'Server xatoligi yuz berdi', 
      code: 'DB_ERROR' 
    });
  }

  delete activeRooms[roomId];
  console.log(`🧹 Room ${roomId} tozalandi`);
}

function startRoomTimer(roomId) {
  let timeLeft = 30;
  const room = activeRooms[roomId];
  if (!room) return;

  room.timerInterval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 5 && timeLeft > 0) {
      io.to(roomId).emit('timer_warning', { timeLeft });
    }

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      io.to(roomId).emit('timeout', { message: 'Vaqt tugadi!' });
      evaluateRound(roomId);
    }
  }, 1000);
}

// ======================
// MONGODB ULAGI
// ======================
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('💾 MongoDB muvaffaqiyatli ulandi.');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error('🔴 MongoDB xatolik:', err);
    process.exit(1);
  });

mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB ulandi');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 MongoDB xatolik:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 MongoDB uzildi');
});

// ======================
// USER SCHEMA
// ======================
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: "O'yinchi" },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100, min: 0 },
  rating: { type: Number, default: 100, min: 0 },
  refParent: { type: String, default: null },
  isRefRewarded: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  totalGames: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  lastGameAt: { type: Date },
  isOnline: { type: Boolean, default: false },
  deviceInfo: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ======================
// ADMIN AUTH
// ======================
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
  if (!adminKey || adminKey !== ADMIN_TOKEN) {
    return res.status(403).json({ 
      success: false, 
      message: "Admin ruxsati yo'q",
      error: 'FORBIDDEN'
    });
  }
  next();
};

// ======================
// API ROUTES
// ======================

// AUTH
app.post('/api/user/auth', async (req, res) => {
  const { tgId, username, firstName, lastName, photoUrl, refParent } = req.body;

  try {
    let user = await User.findOne({ tgId });

    if (!user) {
      user = new User({
        tgId,
        username: username || '',
        firstName: firstName || "O'yinchi",
        lastName: lastName || '',
        photoUrl: photoUrl || '',
        coins: 100,
        rating: 100,
        refParent: refParent && refParent !== tgId ? refParent : null,
      });

      if (refParent && refParent !== tgId) {
        const parent = await User.findOne({ tgId: refParent });
        if (parent) {
          parent.coins += 100;
          await parent.save();
          user.coins += 100;
          user.isRefRewarded = true;
          io.emit(`update_${refParent}`, { 
            type: 'REF_BONUS', 
            coins: parent.coins,
            message: `👤 ${user.firstName} sizning taklifingiz orqali ro'yxatdan o'tdi! +100 🪙`
          });
        }
      }
      await user.save();
    } else {
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.photoUrl = photoUrl || user.photoUrl;
      user.lastLogin = new Date();
      user.isOnline = true;
      await user.save();
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Auth xatoligi:', error);
    res.status(500).json({ success: false, message: "Avtorizatsiya xatoligi" });
  }
});

// LEADERBOARD
app.get('/api/user/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('tgId firstName username coins rating photoUrl totalGames wins');

    res.status(200).json({ success: true, leaders });
  } catch (error) {
    console.error('Leaderboard xatoligi:', error);
    res.status(500).json({ success: false, message: "Leaderboard xatoligi" });
  }
});

// BUY CHAT LINK
app.post('/api/user/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    if (user.coins < 10) return res.status(400).json({ success: false, message: "Yetarli tanga yo'q (10 ta kerak)" });

    user.coins -= 10;
    await user.save();

    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    console.error('Xarid xatoligi:', error);
    res.status(500).json({ success: false, message: "Xarid amalga oshmadi" });
  }
});

// USER STATS
app.get('/api/user/:tgId/stats', async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    
    res.status(200).json({ 
      success: true, 
      stats: {
        coins: user.coins,
        rating: user.rating,
        totalGames: user.totalGames,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        winRate: user.totalGames > 0 ? Math.round((user.wins / user.totalGames) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Statistika xatoligi" });
  }
});

// ======================
// ADMIN ROUTES
// ======================

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      onlineUsersCount,
      totalCoins,
      totalRating,
      totalGames,
      top10
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnline: true }),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$coins" } } }]),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$rating" } } }]),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$totalGames" } } }]),
      User.find().sort({ rating: -1, coins: -1 }).limit(10).select('firstName username coins rating totalGames wins')
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        onlineUsers: onlineUsersCount,
        totalCoins: totalCoins[0]?.total || 0,
        totalRating: totalRating[0]?.total || 0,
        totalGames: totalGames[0]?.total || 0,
        top10,
        activeRooms: Object.keys(activeRooms).length,
        searchQueue: searchQueue.length,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error('Admin stats xatoligi:', err);
    res.status(500).json({ success: false, message: "Statistika xatoligi" });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = search ? {
      $or: [
        { tgId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await User.find(query)
      .sort({ rating: -1, coins: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-__v');

    const total = await User.countDocuments(query);

    res.json({ success: true, users, total, page: Number(page) });
  } catch (err) {
    console.error('Admin users xatoligi:', err);
    res.status(500).json({ success: false, message: "Foydalanuvchilarni yuklashda xatolik" });
  }
});

app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const { coins, rating, firstName, username, photoUrl } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        coins: Math.max(0, coins || 0), 
        rating: Math.max(0, rating || 0),
        firstName, 
        username, 
        photoUrl 
      },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });

    res.json({ success: true, user, message: "Muvaffaqiyatli yangilandi" });
  } catch (err) {
    console.error('Update xatoligi:', err);
    res.status(500).json({ success: false, message: "Tahrirlashda xatolik" });
  }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Foydalanuvchi o'chirildi" });
  } catch (err) {
    console.error('Delete xatoligi:', err);
    res.status(500).json({ success: false, message: "O'chirishda xatolik" });
  }
});

app.post('/api/admin/users/:id/coins', adminAuth, async (req, res) => {
  const { amount } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    
    const newCoins = Math.max(0, user.coins + (amount || 0));
    user.coins = newCoins;
    await user.save();
    
    res.json({ success: true, user });
  } catch (err) {
    console.error('Coin update xatoligi:', err);
    res.status(500).json({ success: false, message: "Coin o'zgartirishda xatolik" });
  }
});

// ======================
// SOCKET.IO EVENTS - io dan KEYIN
// ======================

io.on('connection', (socket) => {
  console.log(`🔌 Yangi ulanish: ${socket.id}`);
  console.log(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);

  socket.on('user_connect', async (data) => {
    const { tgId, firstName } = data;
    try {
      await User.findOneAndUpdate(
        { tgId },
        { isOnline: true, lastLogin: new Date() }
      );
      
      onlineUsers.set(tgId, {
        socketId: socket.id,
        firstName,
        connectedAt: new Date()
      });

      io.emit('user_status', {
        tgId,
        status: 'online',
        firstName
      });

      console.log(`👤 ${firstName} (${tgId}) online bo'ldi`);
    } catch (error) {
      console.error('User connect error:', error);
    }
  });

  socket.on('find_match', ({ player, stake = 10 }) => {
    console.log(`🔍 ${player.firstName} raqib qidirmoqda...`);

    searchQueue = searchQueue.filter(p => io.sockets.sockets.has(p.socketId));

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.firstName || player.name || "O'yinchi",
      username: player.username || '',
      rating: player.rating || 100,
      stake: Number(stake),
      joinedAt: new Date()
    };

    const opponentIndex = searchQueue.findIndex(p => 
      p.stake === newPlayer.stake && 
      p.tgId !== newPlayer.tgId &&
      p.socketId !== socket.id
    );

    if (opponentIndex !== -1) {
      const opponent = searchQueue.splice(opponentIndex, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      socket.join(roomId);
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.join(roomId);

      activeRooms[roomId] = {
        roomId,
        players: [newPlayer, opponent],
        choices: {},
        stake: newPlayer.stake,
        timerInterval: null,
        createdAt: new Date()
      };

      const matchDataForP1 = { 
        roomId, 
        opponent: { 
          tgId: opponent.tgId, 
          name: opponent.name, 
          rating: opponent.rating,
          username: opponent.username 
        }, 
        stake: newPlayer.stake 
      };
      const matchDataForP2 = { 
        roomId, 
        opponent: { 
          tgId: newPlayer.tgId, 
          name: newPlayer.name, 
          rating: newPlayer.rating,
          username: newPlayer.username 
        }, 
        stake: newPlayer.stake 
      };

      socket.emit('match_found', matchDataForP1);
      io.to(opponent.socketId).emit('match_found', matchDataForP2);

      io.emit('match_started', {
        roomId,
        players: [newPlayer.name, opponent.name],
        stake: newPlayer.stake
      });

      console.log(`⚔️ Match topildi: ${newPlayer.name} vs ${opponent.name}`);
      startRoomTimer(roomId);
    } else {
      searchQueue.push(newPlayer);
      socket.emit('searching', { stake: newPlayer.stake });
      console.log(`⏳ ${newPlayer.name} navbatga qo'shildi. Navbatda: ${searchQueue.length} o'yinchi`);
    }
  });

  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Xona topilmadi', code: 'ROOM_NOT_FOUND' });
      return;
    }

    room.choices[socket.id] = choice;
    console.log(`🎯 ${socket.id} tanladi: ${choice}`);

    if (Object.keys(room.choices).length === 2) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      io.to(roomId).emit('both_ready', { message: 'Ikkala o\'yinchi ham tayyor!' });
      evaluateRound(roomId);
    }
  });

  socket.on('cancel_search', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
    console.log(`❌ ${socket.id} qidiruvni bekor qildi`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Uzilish: ${socket.id}`);
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    let disconnectedUser = null;
    for (const [tgId, data] of onlineUsers.entries()) {
      if (data.socketId === socket.id) {
        disconnectedUser = { tgId, ...data };
        onlineUsers.delete(tgId);
        break;
      }
    }

    if (disconnectedUser) {
      io.emit('user_status', {
        tgId: disconnectedUser.tgId,
        status: 'offline',
        firstName: disconnectedUser.firstName
      });
    }

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players.some(p => p.socketId === socket.id)) {
        socket.to(roomId).emit('opponent_left', {
          message: 'Raqib o\'yinni tark etdi',
          timestamp: new Date()
        });
        
        if (room.timerInterval) clearInterval(room.timerInterval);
        
        setTimeout(() => {
          delete activeRooms[roomId];
          console.log(`🧹 Room ${roomId} o'chirildi (disconnect)`);
        }, 2000);
        
        break;
      }
    }

    console.log(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('error', (error) => {
    console.error(`Socket error ${socket.id}:`, error);
  });
});

// ======================
// PERIODIC CLEANUP
// ======================
setInterval(async () => {
  try {
    const now = Date.now();
    for (const [roomId, room] of Object.entries(activeRooms)) {
      const roomAge = now - room.createdAt.getTime();
      if (roomAge > 30 * 60 * 1000) {
        delete activeRooms[roomId];
        console.log(`🧹 Eski room tozalandi: ${roomId}`);
      }
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await User.updateMany(
      { 
        lastLogin: { $lt: thirtyMinutesAgo },
        isOnline: true
      },
      { isOnline: false }
    );
  } catch (error) {
    console.error('Cleanup xatoligi:', error);
  }
}, 30 * 60 * 1000);

// ======================
// START SERVER
// ======================
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📊 Web App URL: ${WEB_APP_URL}`);
  console.log(`👥 Online users: ${onlineUsers.size}`);
  console.log(`🎮 Active rooms: ${Object.keys(activeRooms).length}`);
  console.log(`🔍 Search queue: ${searchQueue.length}`);
});

// ======================
// ERROR HANDLING
// ======================
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});