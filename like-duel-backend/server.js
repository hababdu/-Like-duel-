const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Telegram Mini App ulanishi uchun xavfsiz ochiq eshik
    methods: ["GET", "POST"]
  }
});

// 🔌 MongoDB Ulanishi
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/like-duel')
  .then(() => console.log('💾 MongoDB muvaffaqiyatli ulandi.'))
  .catch(err => console.error('🔴 MongoDB ulanishida xatolik:', err));

// 📝 Foydalanuvchi Modeli (Schema)
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: "O'yinchi" },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100 }, // Yangi kirgan o'yinchiga avtomatik 100 tanga beriladi
  rating: { type: Number, default: 100 },
  refParent: { type: String, default: null }, // Uni taklif qilgan odamning tgId si
  isRefRewarded: { type: Boolean, default: false } // Referal bonus berilganlik holati
});

const User = mongoose.model('User', userSchema);

// 🛰️ API 1: Autentifikatsiya va Referal Tizimi
app.post('/api/user/auth', async (req, res) => {
  const { tgId, username, firstName, lastName, photoUrl, coins, rating, refParent } = req.body;

  try {
    let user = await User.findOne({ tgId });

    if (!user) {
      // 1. Yangi foydalanuvchi birinchi marta botga kirdi -> Boshlang'ich 100 tanga oladi
      user = new User({
        tgId,
        username: username || '',
        firstName: firstName || "O'yinchi",
        lastName: lastName || '',
        photoUrl: photoUrl || '',
        coins: 100, 
        rating: 100,
        refParent: refParent || null
      });

      // 2. 👥 Referal tizimi mantiqi (Taklif qilgan do'st uchun bonus)
      if (refParent && refParent !== tgId) {
        const parentUser = await User.findOne({ tgId: refParent });
        if (parentUser) {
          // Do'stini taklif qilgan odamga +100 tanga beriladi
          parentUser.coins += 100;
          await parentUser.save();
          
          // Havola orqali yangi kelgan do'stga ham yana +100 tanga bonus beriladi (Boshlang'ich 100 + bonus 100 = jami 200 tanga)
          user.coins += 100;
          user.isRefRewarded = true;
          console.log(`🎁 Referal tizimi ishladi! Taklif qildi: ${refParent}, Ro'yxatdan o'tdi: ${tgId}`);
        }
      }
      await user.save();
    } else {
      // 3. Mavjud foydalanuvchi (O'yin tugab balans yangilanganda)
      let updateFields = {};
      if (username !== undefined) updateFields.username = username;
      if (firstName !== undefined) updateFields.firstName = firstName;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
      
      // Faqat frontenddan real yangi qiymat kelsa bazaga yoziladi (overwrite/update muammosini oldini oladi)
      if (coins !== undefined) updateFields.coins = coins;
      if (rating !== undefined) updateFields.rating = rating;

      user = await User.findOneAndUpdate({ tgId }, { $set: updateFields }, { new: true });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Auth API xatoligi:", error);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

// 💰 API 2: 10 tangaga raqib shaxsiy chatiga o'tish linkini sotib olish
app.post('/api/user/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user || user.coins < 10) {
      return res.status(400).json({ success: false, message: "Mablag' yetarli emas yoki profil topilmadi!" });
    }
    
    // 10 tangani balansdan ayirish
    user.coins -= 10;
    await user.save();
    
    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    console.error("❌ Xarid xatoligi:", error);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

// 🎮 O'yin Xonalari va Navbat Statelari
let searchQueue = []; // Qidiruvdagi o'yinchilar
let activeRooms = {}; // Faol o'yin xonalari

// 🔄 Tosh-Qog'oz-Qaychi Mantiqi (G'olibni aniqlash)
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

// ⏳ Raundni Baholash va Natijalarni Yuborish
function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const p1 = room.players[0];
  const p2 = room.players[1];

  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  let res1 = 'draw', res2 = 'draw', reward1 = 0, reward2 = 0, xp1 = 0, xp2 = 0;

  if (c1 === 'timeout' && c2 === 'timeout') {
    // Ikkala tomon ham uxladi
  } else if (c1 === 'timeout') {
    res1 = 'lose'; res2 = 'win'; reward1 = -1; reward2 = 1; xp1 = -10; xp2 = 15;
  } else if (c2 === 'timeout') {
    res1 = 'win'; res2 = 'lose'; reward1 = 1; reward2 = -1; xp1 = 15; xp2 = -10;
  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      res1 = 'win'; res2 = 'lose'; reward1 = 1; reward2 = -1; xp1 = 15; xp2 = -10;
    } else if (winner === 'player2') {
      res1 = 'lose'; res2 = 'win'; reward1 = -1; reward2 = 1; xp1 = -10; xp2 = 15;
    }
  }

  // O'yinchilarga shaxsiy natijalarini yuborish
  io.to(p1.socketId).emit('round_result', { myChoice: c1, opponentChoice: c2, result: res1, rewardCoins: reward1, rewardXP: xp1 });
  io.to(p2.socketId).emit('round_result', { myChoice: c2, opponentChoice: c1, result: res2, rewardCoins: reward2, rewardXP: xp2 });
  
  room.choices = {};
}

// 🔌 Socket.io Tarmoq Hodisalari (Real-time aloqa)
io.on('connection', (socket) => {
  console.log(`🔌 Yangi o'yinchi ulandi: ${socket.id}`);

  // 1. 🔍 RAQIB QIDIRISH (MATCHMAKING)
  socket.on('find_match', ({ player, stake }) => {
    // Navbatda eski nusxasi bo'lsa tozalaymiz
    searchQueue = searchQueue.filter(p => p.tgId !== player.tgId);

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.name,
      username: player.username || '', // Shaxsiy chat linki ochilishi uchun kerak
      rating: player.rating,
      coins: player.coins,
      stake
    };

    if (searchQueue.length > 0) {
      // Navbatda munosib raqib bor -> O'yin xonasi ochiladi
      const opponent = searchQueue.shift();
      const roomId = `room_${opponent.tgId}_${newPlayer.tgId}`;

      socket.join(roomId);
      io.sockets.sockets.get(opponent.socketId)?.join(roomId);

      activeRooms[roomId] = {
        roomId,
        players: [newPlayer, opponent],
        choices: {},
        timer: 30,
        timerInterval: null
      };

      // Har bir o'yinchiga raqib ma'lumotlarini (shu jumladan telegram username'ini) uzatish
      io.to(opponent.socketId).emit('match_found', { roomId, opponent: { tgId: newPlayer.tgId, name: newPlayer.name, username: newPlayer.username, rating: newPlayer.rating } });
      io.to(socket.id).emit('match_found', { roomId, opponent: { tgId: opponent.tgId, name: opponent.name, username: opponent.username, rating: opponent.rating } });

      // 30 soniyalik o'yin taymerini ishga tushirish
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
      // Navbatda hech kim yo'q -> Kutish ro'yxatiga yoziladi
      searchQueue.push(newPlayer);
    }
  });

  // 2. ❌ QIDIRISHNI BEKOR QILISH
  socket.on('cancel_search', ({ tgId }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== tgId);
  });

  // 3. 🪨 FOYDALANUVCHI HARAKATI (Tosh, Qog'oz, Qaychi)
  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;
    const playerIds = room.players.map(p => p.socketId);

    // Ikkala o'yinchi ham harakat qilib bo'lsa, taymer to'xtatiladi va raund baholanadi
    if (room.choices[playerIds[0]] && room.choices[playerIds[1]]) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  // 4. 💬 REAL-TIME IKKI TARAFLAMA CHAT HODISASI
  socket.on('send_chat_message', ({ roomId, senderId, text }) => {
    // Xabarni o'zimizdan boshqa o'sha xonadagi raqibga to'g'ridan-to'g'ri yetkazadi
    socket.to(roomId).emit('chat_message', { senderId, text });
  });

  // 5. 🔄 RE-MATCH (QAYTA O'YNASH SO'ROVI)
  socket.on('request_rematch', ({ roomId }) => {
    const room = activeRooms[roomId];
    if (!room) return;
    
    io.to(roomId).emit('start_round');

    let timeLeft = 30;
    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timer_tick', timeLeft);
      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        evaluateRound(roomId);
      }
    }, 1000);
  });

  // 6. 🔌 ULANISH UZILGANDA (DISCONNECT)
  socket.on('disconnect', () => {
    console.log(`🔌 Ulanish uzildi: ${socket.id}`);
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      if (room.players.some(p => p.socketId === socket.id)) {
        clearInterval(room.timerInterval);
        // Raqibga o'yin tugaganini va texnik g'alaba berilganini aytish
        socket.to(roomId).emit('opponent_left');
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

// 🚀 Server portini sozlash
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda muvaffaqiyatli ishga tushdi.`);
});