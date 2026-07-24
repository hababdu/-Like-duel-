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
// CORS SOZLAMALARI
// ======================

// 1. CORS middleware - BARCHA SOROVLARDAN OLDIN
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Ruxsat etilgan origin'lar
  const allowedOrigins = [
    'https://telegram-mini-app-gsny.onrender.com',
    'https://like-admin-m9j1n851q-habibulloabdumutallibovs-projects.vercel.app',
    'https://like-admin-*.vercel.app',
    'https://like-admin.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://telegram-bot-server-2-matj.onrender.com'
  ];

  let isAllowed = false;
  
  if (NODE_ENV === 'development') {
    isAllowed = true;
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin) {
    isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-admin-key, X-Requested-With, x-telegram-init-data, Origin, X-Forwarded-For');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    console.log('🔄 Preflight request:', req.path, 'Origin:', origin);
    return res.sendStatus(200);
  }

  console.log('📨 Request:', req.method, req.path, 'Origin:', origin, 'Allowed:', isAllowed);
  next();
});

// 2. cors package bilan sozlash
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://telegram-mini-app-gsny.onrender.com',
      'https://like-admin-m9j1n851q-habibulloabdumutallibovs-projects.vercel.app',
      'https://like-admin-*.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    ];

    if (!origin) return callback(null, true);
    
    if (NODE_ENV === 'development') {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-admin-key', 'X-Requested-With', 'x-telegram-init-data'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));

// ======================
// MIDDLEWARE
// ======================
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
// SOCKET.IO SOZLAMALARI
// ======================
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "Accept", 
      "x-admin-key", 
      "X-Requested-With", 
      "x-telegram-init-data"
    ]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

// ======================
// GLOBAL STATE
// ======================
let searchQueue = [];
let activeRooms = {};
let onlineUsers = new Map();

// ======================
// MONGODB ULAGI
// ======================
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    console.log('💾 MongoDB muvaffaqiyatli ulandi.');
  } catch (err) {
    console.error('🔴 MongoDB xatolik:', err.message);
    setTimeout(connectDB, 5000);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.log('🟡 MongoDB uzildi. Qayta ulanish...');
  setTimeout(connectDB, 5000);
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
// HELPER FUNCTIONS
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

// ======================
// START ROOM TIMER
// ======================
function startRoomTimer(roomId) {
  let timeLeft = 30;
  const room = activeRooms[roomId];
  if (!room) {
    console.error('❌ Room not found for timer:', roomId);
    return;
  }

  console.log('⏰ Starting timer for room:', roomId);

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  room.timerInterval = setInterval(() => {
    timeLeft--;
    console.log(`⏱️ Timer: ${roomId} - ${timeLeft}s`);
    
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      console.log('⏰ Timer expired for room:', roomId);
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      
      if (Object.keys(room.choices).length < 2) {
        evaluateRound(roomId);
      }
    }
  }, 1000);
}

// ======================
// EVALUATE ROUND
// ======================
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) {
    console.log('❌ Room not found for evaluation:', roomId);
    return;
  }

  console.log('📊 Evaluating round:', roomId);

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
      user1.coins = Math.max(0, user1.coins + coinChange1);
      user1.rating = Math.max(0, user1.rating + xpChange1);
      user1.totalGames = (user1.totalGames || 0) + 1;
      user1.lastGameAt = new Date();
      if (result1 === 'win') user1.wins = (user1.wins || 0) + 1;
      else if (result1 === 'lose') user1.losses = (user1.losses || 0) + 1;
      else user1.draws = (user1.draws || 0) + 1;
      await user1.save();
      console.log('✅ User1 updated:', user1.tgId, 'Coins:', user1.coins);
    }

    if (user2) {
      user2.coins = Math.max(0, user2.coins + coinChange2);
      user2.rating = Math.max(0, user2.rating + xpChange2);
      user2.totalGames = (user2.totalGames || 0) + 1;
      user2.lastGameAt = new Date();
      if (result2 === 'win') user2.wins = (user2.wins || 0) + 1;
      else if (result2 === 'lose') user2.losses = (user2.losses || 0) + 1;
      else user2.draws = (user2.draws || 0) + 1;
      await user2.save();
      console.log('✅ User2 updated:', user2.tgId, 'Coins:', user2.coins);
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

    console.log('✅ Round results sent');

  } catch (err) {
    console.error("❌ Balans yangilashda xatolik:", err);
  }

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }
  delete activeRooms[roomId];
  console.log('🗑️ Room deleted:', roomId);
}

// ======================
// ADMIN AUTH
// ======================
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
  if (!adminKey || adminKey !== ADMIN_TOKEN) {
    return res.status(403).json({ 
      success: false, 
      message: "Admin ruxsati yo'q"
    });
  }
  next();
};

// ======================
// API ROUTES
// ======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime(),
    cors: 'enabled',
    activeRooms: Object.keys(activeRooms).length,
    queueLength: searchQueue.length,
    onlineUsers: onlineUsers.size
  });
});

// AUTH
// Server.js dagi auth endpoint
app.post('/api/user/auth', async (req, res) => {
  console.log('📥 ===== AUTH REQUEST =====');
  console.log('📊 Body:', req.body);
  
  const { tgId, username, firstName, lastName, photoUrl, refParent } = req.body;

  try {
    // tgId ni tekshirish
    if (!tgId) {
      console.error('❌ No tgId provided');
      return res.status(400).json({ 
        success: false, 
        message: "tgId talab qilinadi" 
      });
    }

    console.log('🔍 Looking for user:', tgId);
    let user = await User.findOne({ tgId });

    if (!user) {
      console.log('🆕 Creating new user:', tgId);
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
        }
      }
      await user.save();
      console.log('✅ New user created:', user.tgId);
    } else {
      console.log('🔄 Updating existing user:', tgId);
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.photoUrl = photoUrl || user.photoUrl;
      user.lastLogin = new Date();
      user.isOnline = true;
      await user.save();
      console.log('✅ User updated:', user.tgId);
    }

    console.log('📤 Sending response:', { success: true, user: user.tgId });
    res.status(200).json({ success: true, user });

  } catch (error) {
    console.error('❌ Auth xatoligi:', error);
    res.status(500).json({ 
      success: false, 
      message: "Avtorizatsiya xatoligi: " + error.message 
    });
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

// USER REFERRALS
app.get('/api/user/:tgId/referrals', async (req, res) => {
  try {
    const referrals = await User.find({ refParent: req.params.tgId })
      .select('firstName username coins rating createdAt');
    
    const count = referrals.length;
    const totalBonus = count * 100;

    res.status(200).json({ 
      success: true, 
      data: { 
        referrals, 
        count, 
        totalBonus 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Referal xatoligi" });
  }
});

// ======================
// ADMIN ROUTES
// ======================

// Stats
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

// Users list
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20, sortBy = 'rating' } = req.query;
    
    const query = search ? {
      $or: [
        { tgId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const sortOptions = {
      rating: { rating: -1, coins: -1 },
      coins: { coins: -1, rating: -1 },
      games: { totalGames: -1, rating: -1 },
      newest: { createdAt: -1 }
    };

    const users = await User.find(query)
      .sort(sortOptions[sortBy] || sortOptions.rating)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-__v');

    const total = await User.countDocuments(query);

    res.json({ 
      success: true, 
      users, 
      total, 
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Admin users xatoligi:', err);
    res.status(500).json({ success: false, message: "Foydalanuvchilarni yuklashda xatolik" });
  }
});

// Get single user
app.get('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Xatolik" });
  }
});

// Update user
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

// Delete user
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Foydalanuvchi o'chirildi" });
  } catch (err) {
    console.error('Delete xatoligi:', err);
    res.status(500).json({ success: false, message: "O'chirishda xatolik" });
  }
});

// Update coins
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
// SOCKET.IO EVENTS - TUZATILGAN
// ======================

io.on('connection', (socket) => {
  console.log('🟢 New connection:', socket.id);

  // BARCHA EVENTLARNI LOG QILISH
  socket.onAny((event, ...args) => {
    console.log(`📨 Event: ${event}`, JSON.stringify(args, null, 2));
  });

  // USER CONNECT
  socket.on('user_connect', async (data) => {
    console.log('👤 User connect:', data);
    
    try {
      const { tgId, firstName } = data;
      
      if (!tgId) {
        console.error('❌ No tgId provided');
        socket.emit('error', { message: 'Foydalanuvchi ID si kerak' });
        return;
      }

      let user = await User.findOne({ tgId: String(tgId) });
      
      if (!user) {
        user = new User({
          tgId: String(tgId),
          firstName: firstName || "O'yinchi",
          coins: 100,
          rating: 100
        });
        await user.save();
        console.log('✅ New user created:', user.tgId);
      } else {
        user.isOnline = true;
        user.lastLogin = new Date();
        await user.save();
        console.log('✅ User updated:', user.tgId);
      }

      onlineUsers.set(String(tgId), {
        socketId: socket.id,
        firstName: user.firstName,
        username: user.username,
        rating: user.rating,
        coins: user.coins
      });

      socket.emit('user_connected', {
        success: true,
        user: {
          tgId: user.tgId,
          firstName: user.firstName,
          username: user.username,
          coins: user.coins,
          rating: user.rating,
          totalGames: user.totalGames || 0,
          wins: user.wins || 0,
          losses: user.losses || 0
        }
      });

      io.emit('user_status', {
        tgId: String(tgId),
        status: 'online',
        firstName: user.firstName
      });

    } catch (error) {
      console.error('❌ User connect error:', error);
      socket.emit('error', { 
        message: 'Foydalanuvchi ulanishida xatolik: ' + error.message 
      });
    }
  });

  // FIND MATCH - TUZATILGAN
// ============================================================
// SERVER.JS - USER ID NI TEKSHIRISH
// ============================================================

socket.on('find_match', ({ player, stake = 10 }) => {
  console.log('🔍 ===== FIND MATCH START =====');
  console.log('📊 Player data:', player);
  console.log('📊 Player tgId:', player?.tgId);
  console.log('📊 Player tgId type:', typeof player?.tgId);
  
  // tgId ni tekshirish
  if (!player || !player.tgId || player.tgId === 'undefined' || player.tgId === 'null') {
    console.error('❌ Invalid tgId:', player?.tgId);
    socket.emit('error', { message: 'Noto\'g\'ri foydalanuvchi ID si' });
    return;
  }

  // tgId ni string ga o'tkazish
  const tgId = String(player.tgId);
  console.log('✅ Valid tgId:', tgId);
  
  // ... qolgan kod
});

  // CANCEL SEARCH
  socket.on('cancel_search', () => {
    console.log('❌ Cancel search:', socket.id);
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
    socket.emit('search_cancelled');
  });

  // MAKE CHOICE
  socket.on('make_choice', ({ roomId, choice }) => {
    console.log('✋ Make choice:', { roomId, choice, socketId: socket.id });
    
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Xona topilmadi' });
      return;
    }

    room.choices[socket.id] = choice;
    console.log('📊 Choices:', room.choices);
    
    // Ikkala o'yinchi ham tanlov qildi
    if (Object.keys(room.choices).length === 2) {
      console.log('✅ Both players made choice');
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
      }
      evaluateRound(roomId);
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log('🔴 Disconnect:', socket.id);
    
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
        console.log('🚪 Player left room:', roomId);
        const otherPlayer = room.players.find(p => p.socketId !== socket.id);
        if (otherPlayer && io.sockets.sockets.has(otherPlayer.socketId)) {
          io.to(otherPlayer.socketId).emit('opponent_left');
        }
        if (room.timerInterval) {
          clearInterval(room.timerInterval);
        }
        delete activeRooms[roomId];
        break;
      }
    }
  });

  // ERROR HANDLER
  socket.on('error', (error) => {
    console.error('❌ Socket error event:', error);
  });
});

// ======================
// GLOBAL ERROR HANDLERS
// ======================
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ======================
// START SERVER
// ======================
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📊 Web App URL: ${WEB_APP_URL}`);
  console.log(`✅ CORS sozlamalari faol`);
  console.log(`🔍 Health check: /api/health`);
});