import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 🌐 Barcha domenlardan (jumladan, alohida React admin panelingizdan) keladigan so'rovlarga ruxsat berish
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));
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
  coins: { type: Number, default: 100 }, // Yangi kirganda 100 tanga bonus
  rating: { type: Number, default: 100 }, // Reyting ochkosi (XP)
  refParent: { type: String, default: null }, // Uni taklif qilgan odamning tgId si
  isRefRewarded: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ==========================================
// 🛰️ SERVER TOMONDAGI MANTIQIY API-LAR
// ==========================================

/**
 * 1. AVTORIZATSIYA VA REFERAL TIZIMI (Xavfsiz Server mantiqi)
 * Yangi o'yinchi kirganda unga 100 tanga beriladi.
 * Agar kimdir taklif qilgan bo'lsa, taklif qilganga ham 100 tanga serverda avtomatik qo'shiladi.
 */
app.post('/api/user/auth', async (req, res) => {
  const { tgId, username, firstName, lastName, photoUrl, refParent } = req.body;
  
  try {
    let user = await User.findOne({ tgId });
    
    if (!user) {
      // 🆕 Yangi o'yinchi yaratish
      user = new User({
        tgId,
        username: username || '',
        firstName: firstName || "O'yinchi",
        lastName: lastName || '',
        photoUrl: photoUrl || '',
        coins: 100, // Yangi o'yinchiga standart bonus
        rating: 100,
        refParent: refParent && refParent !== tgId ? refParent : null
      });

      // 🎁 Do'stini taklif qilganni mukofotlash (Server nazorati)
      if (refParent && refParent !== tgId) {
        const parentUser = await User.findOne({ tgId: refParent });
        if (parentUser) {
          parentUser.coins += 100; // Taklif qilgan do'stiga 100 tanga bonus
          await parentUser.save();
          
          user.coins += 100; // Taklif orqali kelgan yangi o'yinchiga yana +100 tanga
          user.isRefRewarded = true;
          
          // Agar taklif qilgan odam o'yinda onlayn bo'lsa, unga real-vaqtda xabar berish
          io.emit(`update_${refParent}`, { type: 'REF_BONUS', coins: parentUser.coins });
        }
      }
      await user.save();
    } else {
      // Oldin kirgan o'yinchi bo'lsa, faqat ism/rasmini yangilaymiz (Tangalarga tegilmaydi!)
      let updateFields = {};
      if (username !== undefined) updateFields.username = username;
      if (firstName !== undefined) updateFields.firstName = firstName;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;

      user = await User.findOneAndUpdate({ tgId }, { $set: updateFields }, { new: true });
    }
    
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Serverda avtorizatsiya xatoligi" });
  }
});

/**
 * 2. REYTING TIZIMI (Serverda tangalari va ochkolariga qarab saralash)
 * Kimda qancha tanga borligi va reytingi yuqoriligiga qarab TOP o'yinchilarni aniqlaydi.
 */
app.get('/api/user/leaderboard', async (req, res) => {
  try {
    // Ham reyting (XP), ham tangalari ko'pligi bo'yicha TOP 50 talikni chiqaradi
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('firstName username coins rating photoUrl tgId');
      
    res.status(200).json({ success: true, leaders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Reyting tizimida xatolik" });
  }
});

/**
 * 3. SHAXSIY CHAT LINKINI SOTIB OLISH (Xavfsiz Tranzaksiya)
 */
app.post('/api/user/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user || user.coins < 10) {
      return res.status(400).json({ success: false, message: "Tangalaringiz yetarli emas (kamida 10 tanga kerak)!" });
    }
    
    user.coins -= 10; // Serverda yechib olish
    await user.save();
    
    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Tranzaksiyani bajarib bo'lmadi" });
  }
});

// ==========================================
// 👑 ADMIN PANEL API (Barcha ma'lumotlarni nazorat qilish)
// ==========================================

// Jami o'yinchilar soni va muomaladagi barcha tangalar summasi
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const coinResult = await User.aggregate([
      { $group: { _id: null, totalCoins: { $sum: "$coins" } } }
    ]);
    const totalCoins = coinResult.length > 0 ? coinResult[0].totalCoins : 0;
    res.status(200).json({ success: true, totalUsers, totalCoins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Statistika xatosi" });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ rating: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Ro'yxat xatosi" });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(200).json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Qo'shish xatosi" });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Tahrirlash xatosi" });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "O'yinchi o'chirildi" });
  } catch (error) {
    res.status(500).json({ success: false, message: "O'chirish xatosi" });
  }
});


// ==========================================
// 🎮 DUEL GAME REAL-TIME MANTIQI (SOCKET.IO)
// ==========================================
let searchQueue = []; 
let activeRooms = {}; 

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

// O'yin natijasini va balansni faqat server hisoblaydi
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
    // Har ikkisi uxlab qoldi
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

  // 🔒 DB darajasida xavfsiz hisoblash (Frontend buni o'zgartira olmaydi)
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
    console.error("Balansni yangilashda xatolik:", err);
  }

  io.to(p1.socketId).emit('round_result', { myChoice: c1, opponentChoice: c2, result: res1, rewardCoins: coinChanges.p1, rewardXP: xpChanges.p1 });
  io.to(p2.socketId).emit('round_result', { myChoice: c2, opponentChoice: c1, result: res2, rewardCoins: coinChanges.p2, rewardXP: xpChanges.p2 });

  delete activeRooms[roomId];
}

io.on('connection', (socket) => {
  
  socket.on('find_match', ({ player, stake }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== player.tgId);

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.name,
      username: player.username || '',
      rating: player.rating || 100,
      stake: Number(stake) || 10
    };

    const opponentIndex = searchQueue.findIndex(p => p.stake === newPlayer.stake && p.tgId !== newPlayer.tgId);

    if (opponentIndex !== -1) {
      const opponent = searchQueue.splice(opponentIndex, 1)[0];
      const roomId = `room_${opponent.tgId}_${newPlayer.tgId}`;

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

      io.to(opponent.socketId).emit('match_found', { roomId, opponent: { tgId: newPlayer.tgId, name: newPlayer.name, rating: newPlayer.rating } });
      io.to(socket.id).emit('match_found', { roomId, opponent: { tgId: opponent.tgId, name: opponent.name, rating: opponent.rating } });

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

  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;
    if (room.choices[room.players[0].socketId] && room.choices[room.players[1].socketId]) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  socket.on('cancel_search', ({ tgId }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== tgId);
  });

  socket.on('disconnect', () => {
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
    for (const roomId in activeRooms) {
      if (activeRooms[roomId].players.some(p => p.socketId === socket.id)) {
        clearInterval(activeRooms[roomId].timerInterval);
        socket.to(roomId).emit('opponent_left');
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Xavfsiz server Port: ${PORT} da yondi.`));