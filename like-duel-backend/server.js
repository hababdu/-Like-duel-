import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 💾 MONGODB ULANISHI
// ==========================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/like-duel')
  .then(() => console.log('💾 MongoDB muvaffaqiyatli ulandi.'))
  .catch(err => console.error('🔴 MongoDB xatolik:', err));

// ==========================================
// 📝 FOYDALANUVCHI MODELI (SCHEMA)
// ==========================================
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: "O'yinchi" },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100 }, // Yangi kirganda 100 tanga
  rating: { type: Number, default: 100 },
  refParent: { type: String, default: null },
  isRefRewarded: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ==========================================
// 🛰️ USER API (O'YINCHILAR UCHUN)
// ==========================================

// O'yinchi avtorizatsiyasi (Kirganda 100 tanga beriladi, referal bo'lsa qo'shimcha bonus)
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
        coins: 100, // Standart bonus
        rating: 100,
        refParent: refParent || null
      });

      // Referal tizimi
      if (refParent && refParent !== tgId) {
        const parentUser = await User.findOne({ tgId: refParent });
        if (parentUser) {
          parentUser.coins += 100; // Taklif qilganga 100 tanga
          await parentUser.save();
          user.coins += 100;       // Kelganga ham qo'shimcha 100 tanga
          user.isRefRewarded = true;
        }
      }
      await user.save();
    } else {
      // Mavjud o'yinchi ma'lumotlarini yangilash (Tangalar va XP ga tegmagan holda)
      let updateFields = {};
      if (username !== undefined) updateFields.username = username;
      if (firstName !== undefined) updateFields.firstName = firstName;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;

      user = await User.findOneAndUpdate({ tgId }, { $set: updateFields }, { new: true });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server avtorizatsiya xatosi" });
  }
});

// 🔓 Shaxsiy chat havolasini ochish (10 tanga yechiladi)
app.post('/api/user/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user || user.coins < 10) {
      return res.status(400).json({ success: false, message: "Mablag' yetarli emas (Kamida 10 tanga kerak)!" });
    }
    user.coins -= 10;
    await user.save();
    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Tranzaksiya xatosi" });
  }
});


// ==========================================
// 👑 ADMIN PANEL API (CRUD & STATS)
// ==========================================

// 1. Umumiy statistika (O'yinchilar soni va muomaladagi barcha tangalar summasi)
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    
    // Barcha o'yinchilar tangalarini yig'ish ($sum)
    const coinResult = await User.aggregate([
      { $group: { _id: null, totalCoins: { $sum: "$coins" } } }
    ]);
    
    const totalCoins = coinResult.length > 0 ? coinResult[0].totalCoins : 0;
    res.status(200).json({ success: true, totalUsers, totalCoins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Statistika yuklanmadi" });
  }
});

// 2. Hamma o'yinchilar ro'yxati (Reyting bo'yicha saralangan)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ rating: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Ro'yxat yuklanmadi" });
  }
});

// 3. Yangi o'yinchi qo'shish
app.post('/api/admin/users', async (req, res) => {
  const { tgId, firstName, username, coins, rating } = req.body;
  try {
    const existing = await User.findOne({ tgId });
    if (existing) return res.status(400).json({ success: false, message: "Bu Telegram ID allaqachon ro'yxatda bor!" });

    const newUser = new User({ tgId, firstName, username, coins: Number(coins), rating: Number(rating) });
    await newUser.save();
    res.status(200).json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Qo'shishda xatolik" });
  }
});

// 4. O'yinchini tahrirlash (Update)
app.put('/api/admin/users/:id', async (req, res) => {
  const { firstName, username, coins, rating } = req.body;
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { firstName, username, coins: Number(coins), rating: Number(rating) } },
      { new: true }
    );
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Tahrirlashda xatolik" });
  }
});

// 5. O'yinchini o'chirish (Delete)
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "O'yinchi o'chirildi" });
  } catch (error) {
    res.status(500).json({ success: false, message: "O'chirishda xatolik" });
  }
});


// ==========================================
// 🎮 REAL-TIME DUEL MATCHMAKING & SOCKET.IO
// ==========================================
let searchQueue = []; // O'yin qidirayotganlar ro'yxati
let activeRooms = {}; // Faol o'yin xonalari

// Tosh-qaychi-qog'oz g'olibini aniqlash funksiyasi
function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) {
    return 'player1';
  }
  return 'player2';
}

// Raund natijasini hisoblash va ma'lumotlar bazasiga yozish
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const p1 = room.players[0];
  const p2 = room.players[1];

  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  let res1 = 'draw', res2 = 'draw';
  let coinChanges = { p1: 0, p2: 0 };
  let xpChanges = { p1: 0, p2: 0 };

  if (c1 === 'timeout' && c2 === 'timeout') {
    // Ikkala o'yinchi ham ulgurmadi
  } else if (c1 === 'timeout') {
    res1 = 'lose'; res2 = 'win';
    coinChanges.p1 = -room.stake; coinChanges.p2 = room.stake;
    xpChanges.p1 = -10; xpChanges.p2 = 15;
  } else if (c2 === 'timeout') {
    res1 = 'win'; res2 = 'lose';
    coinChanges.p1 = room.stake; coinChanges.p2 = -room.stake;
    xpChanges.p1 = 15; xpChanges.p2 = -10;
  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      res1 = 'win'; res2 = 'lose';
      coinChanges.p1 = room.stake; coinChanges.p2 = -room.stake;
      xpChanges.p1 = 15; xpChanges.p2 = -10;
    } else if (winner === 'player2') {
      res1 = 'lose'; res2 = 'win';
      coinChanges.p1 = -room.stake; coinChanges.p2 = room.stake;
      xpChanges.p1 = -10; xpChanges.p2 = 15;
    }
  }

  // Baza (MongoDB) dagi ma'lumotlarni yangilash
  try {
    const dbUser1 = await User.findOne({ tgId: p1.tgId });
    const dbUser2 = await User.findOne({ tgId: p2.tgId });

    if (dbUser1) {
      dbUser1.coins = Math.max(0, dbUser1.coins + coinChanges.p1);
      dbUser1.rating = Math.max(0, dbUser1.rating + xpChanges.p1);
      await dbUser1.save();
    }

    if (dbUser2) {
      dbUser2.coins = Math.max(0, dbUser2.coins + coinChanges.p2);
      dbUser2.rating = Math.max(0, dbUser2.rating + xpChanges.p2);
      await dbUser2.save();
    }
  } catch (err) {
    console.error("O'yin natijasini bazaga yozishda xatolik:", err);
  }

  // Har bir o'yinchiga faqat o'ziga tegishli natijani yuborish
  io.to(p1.socketId).emit('round_result', {
    myChoice: c1,
    opponentChoice: c2,
    result: res1,
    rewardCoins: coinChanges.p1,
    rewardXP: xpChanges.p1
  });

  io.to(p2.socketId).emit('round_result', {
    myChoice: c2,
    opponentChoice: c1,
    result: res2,
    rewardCoins: coinChanges.p2,
    rewardXP: xpChanges.p2
  });

  // Xonani tozalash yoki keyingi raundga tayyorlash
  delete activeRooms[roomId];
}

// Socket ulanish jarayoni
io.on('connection', (socket) => {
  
  // 🔍 O'yinchi raqib qidirganda
  socket.on('find_match', ({ player, stake }) => {
    // Eski so'rovlarni tozalash
    searchQueue = searchQueue.filter(p => p.tgId !== player.tgId);

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.name,
      username: player.username || '',
      rating: player.rating || 100,
      coins: player.coins || 100,
      stake: Number(stake) || 10
    };

    // Mos keluvchi raqibni qidirish (stavkasi teng bo'lgan)
    const opponentIndex = searchQueue.findIndex(p => p.stake === newPlayer.stake && p.tgId !== newPlayer.tgId);

    if (opponentIndex !== -1) {
      const opponent = searchQueue.splice(opponentIndex, 1)[0];
      const roomId = `room_${opponent.tgId}_${newPlayer.tgId}`;

      socket.join(roomId);
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.join(roomId);

      // Faol xona yaratish
      activeRooms[roomId] = {
        roomId,
        players: [newPlayer, opponent],
        choices: {},
        stake: newPlayer.stake,
        timerLeft: 30,
        timerInterval: null
      };

      // Har ikki tomonga raqib ma'lumotlarini uzatish
      io.to(opponent.socketId).emit('match_found', {
        roomId,
        opponent: { tgId: newPlayer.tgId, name: newPlayer.name, username: newPlayer.username, rating: newPlayer.rating }
      });

      io.to(socket.id).emit('match_found', {
        roomId,
        opponent: { tgId: opponent.tgId, name: opponent.name, username: opponent.username, rating: opponent.rating }
      });

      // 30 soniyalik taymerni boshlash
      let timeLeft = 30;
      activeRooms[roomId].timerInterval = setInterval(() => {
        timeLeft--;
        io.to(roomId).emit('timer_tick', timeLeft);
        if (timeLeft <= 0) {
          clearInterval(activeRooms[roomId].timerInterval);
          evaluateRound(roomId);
        }
      }, 1000);

    } else {
      searchQueue.push(newPlayer);
    }
  });

  // ❌ Qidiruvni bekor qilish
  socket.on('cancel_search', ({ tgId }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== tgId);
  });
  
  // 🖐️ O'yinchi yurish (tosh, qaychi, qog'oz) qilganda
  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;
    const p1 = room.players[0];
    const p2 = room.players[1];

    // Har ikkala o'yinchi ham tanlab bo'lgan bo'lsa
    if (room.choices[p1.socketId] && room.choices[p2.socketId]) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  // 💬 Real-time chat xabarlarini uzatish
  socket.on('send_chat_message', ({ roomId, senderId, text }) => {
    socket.to(roomId).emit('chat_message', { senderId, text });
  });

  // 🔌 Ulanish uzilganda (Disconnect)
  socket.on('disconnect', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players.some(p => p.socketId === socket.id)) {
        clearInterval(room.timerInterval);
        socket.to(roomId).emit('opponent_left');
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

// ==========================================
// 🚀 SERVERNI ISHGA TUSHIRISH
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server muvaffaqiyatli ishlamoqda, Port: ${PORT}`);
});