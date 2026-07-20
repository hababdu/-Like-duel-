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
// MIDDLEWARE
// ======================
app.use(cors({
  origin: process.env.CLIENT_URL || "*", 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-admin-key"]
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 100, // har IP uchun 100 ta so'rov
  message: { success: false, message: "Juda ko'p so'rov yubordingiz. Biroz kutib turing." }
});
app.use('/api/', limiter);

// ======================
// MONGODB
// ======================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/like-duel')
  .then(() => console.log('💾 MongoDB muvaffaqiyatli ulandi.'))
  .catch(err => console.error('🔴 MongoDB xatolik:', err));

// ======================
// USER SCHEMA
// ======================
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: "O'yinchi" },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100 },
  rating: { type: Number, default: 100 },
  refParent: { type: String, default: null },
  isRefRewarded: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ======================
// ADMIN AUTH MIDDLEWARE
// ======================
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: "Admin ruxsati yo'q" });
  }
  next();
};

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
// API ROUTES
// ======================

// 1. AUTH + REFERRAL
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

      // Referral mukofoti
      if (refParent && refParent !== tgId) {
        const parent = await User.findOne({ tgId: refParent });
        if (parent) {
          parent.coins += 100;
          await parent.save();

          user.coins += 100;
          user.isRefRewarded = true;

          // Online bo'lsa bildirish
          io.emit(`update_${refParent}`, { type: 'REF_BONUS', coins: parent.coins });
        }
      }
      await user.save();
    } else {
      // Mavjud foydalanuvchini yangilash
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.photoUrl = photoUrl || user.photoUrl;
      user.lastLogin = new Date();
      await user.save();
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Avtorizatsiya xatoligi" });
  }
});

// 2. LEADERBOARD
app.get('/api/user/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('tgId firstName username coins rating photoUrl');

    res.status(200).json({ success: true, leaders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Leaderboard xatoligi" });
  }
});

// 3. CHAT LINK SOTIB OLISH
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
    res.status(500).json({ success: false, message: "Xarid amalga oshmadi" });
  }
});

// ======================
// ADMIN ROUTES
// ======================
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const coinResult = await User.aggregate([{ $group: { _id: null, totalCoins: { $sum: "$coins" } } }]);
    const totalCoins = coinResult[0]?.totalCoins || 0;

    res.status(200).json({ success: true, totalUsers, totalCoins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Statistika xatoligi" });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await User.find().sort({ rating: -1 });
  res.status(200).json({ success: true, users });
});
 // ======================
// ADMIN ROUTES (To'liq ishlaydigan)
// ======================

// Statistikalar
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCoins = await User.aggregate([{ $group: { _id: null, total: { $sum: "$coins" } } }]);
    const totalRating = await User.aggregate([{ $group: { _id: null, total: { $sum: "$rating" } } }]);
    
    const top10 = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(10)
      .select('firstName username coins rating');

    res.json({
      success: true,
      data: {
        totalUsers,
        totalCoins: totalCoins[0]?.total || 0,
        totalRating: totalRating[0]?.total || 0,
        top10
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Statistika xatoligi" });
  }
});

// Barcha foydalanuvchilar (qidiruv bilan)
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
    res.status(500).json({ success: false, message: "Foydalanuvchilarni yuklashda xatolik" });
  }
});

// Bitta foydalanuvchini olish
app.get('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Xatolik" });
  }
});

// Foydalanuvchini tahrirlash
app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const { coins, rating, firstName, username, photoUrl } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { coins, rating, firstName, username, photoUrl },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });

    res.json({ success: true, user, message: "Muvaffaqiyatli yangilandi" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Tahrirlashda xatolik" });
  }
});

// Foydalanuvchini o‘chirish
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Foydalanuvchi o‘chirildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: "O‘chirishda xatolik" });
  }
});

// Coin qo‘shish / ayirish (tez operatsiya)
app.post('/api/admin/users/:id/coins', adminAuth, async (req, res) => {
  const { amount } = req.body; // musbat yoki manfiy
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { coins: amount } },
      { new: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Coin o‘zgartirishda xatolik" });
  }
});
// Boshqa admin CRUD'larni ham shu tarzda qoldirdim (kerak bo'lsa qo'shishingiz mumkin)

// ======================
// SOCKET.IO
// ======================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let searchQueue = [];
let activeRooms = {};

function startRoomTimer(roomId) {
  let timeLeft = 30;
  const room = activeRooms[roomId];
  if (!room) return;

  room.timerInterval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
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

  // DB da xavfsiz yangilash
  try {
    await User.findOneAndUpdate({ tgId: p1.tgId }, {
      $inc: { coins: coinChange1, rating: xpChange1 },
      $max: { coins: 0, rating: 0 }
    });

    await User.findOneAndUpdate({ tgId: p2.tgId }, {
      $inc: { coins: coinChange2, rating: xpChange2 },
      $max: { coins: 0, rating: 0 }
    });
  } catch (err) {
    console.error("Balans yangilashda xatolik:", err);
  }

  io.to(p1.socketId).emit('round_result', {
    myChoice: c1, opponentChoice: c2, result: result1,
    rewardCoins: coinChange1, rewardXP: xpChange1
  });

  io.to(p2.socketId).emit('round_result', {
    myChoice: c2, opponentChoice: c1, result: result2,
    rewardCoins: coinChange2, rewardXP: xpChange2
  });

  delete activeRooms[roomId];
}

// Socket Logic
io.on('connection', (socket) => {

  socket.on('find_match', ({ player, stake = 10 }) => {
    // Eski qidiruvlarni tozalash
    searchQueue = searchQueue.filter(p => io.sockets.sockets.has(p.socketId));

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.firstName || player.name,
      username: player.username || '',
      rating: player.rating || 100,
      stake: Number(stake)
    };

    const opponentIndex = searchQueue.findIndex(p => 
      p.stake === newPlayer.stake && p.tgId !== newPlayer.tgId
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
        timerInterval: null
      };

      const matchDataForP1 = { roomId, opponent: { tgId: opponent.tgId, name: opponent.name, rating: opponent.rating }, stake: newPlayer.stake };
      const matchDataForP2 = { roomId, opponent: { tgId: newPlayer.tgId, name: newPlayer.name, rating: newPlayer.rating }, stake: newPlayer.stake };

      socket.emit('match_found', matchDataForP1);
      io.to(opponent.socketId).emit('match_found', matchDataForP2);

      startRoomTimer(roomId);
    } else {
      searchQueue.push(newPlayer);
      socket.emit('searching', { stake: newPlayer.stake });
    }
  });

  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;

    if (Object.keys(room.choices).length === 2) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  socket.on('cancel_search', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
  });

  socket.on('disconnect', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players.some(p => p.socketId === socket.id)) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        socket.to(roomId).emit('opponent_left');
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi`);
  console.log(`🌐 Admin panel: /api/admin/* (x-admin-key kerak)`);
});