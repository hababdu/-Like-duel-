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
    origin: "*", // Mini App uchun xavfsiz ulanish
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
  coins: { type: Number, default: 100 }, // Default 100 tanga, lekin bazada bo'lsa yangilanadi
  rating: { type: Number, default: 100 },
  refParent: { type: String, default: null }
});

const User = mongoose.model('User', userSchema);

// 🛰️ API Yo'lagi: Autentifikatsiya va Balansni Yangilash (Upsert)
app.post('/api/user/auth', async (req, res) => {
  const { tgId, username, firstName, lastName, photoUrl, coins, rating, refParent } = req.body;

  try {
    // Agar so'rovda faqat tgId kelib, coins/rating kelmasa (ya'ni birinchi kirish bo'lsa)
    // bazadagi mavjud qiymatlarni o'zgartirmaslik kerak.
    let updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
    if (refParent !== undefined) updateFields.refParent = refParent;
    
    // 🪙 Eng muhimi: Agar o'yin tugab, yangi tanga/reyting kelsa, bazani yangilaymiz
    if (coins !== undefined) updateFields.coins = coins;
    if (rating !== undefined) updateFields.rating = rating;

    let user = await User.findOneAndUpdate(
      { tgId: tgId },
      { $set: updateFields },
      { new: true, upsert: true } // Yo'q bo'lsa yangi ochadi, bor bo'lsa yangilaydi
    );

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Foydalanuvchini saqlashda xatolik:", error);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

// 🎮 O'yin Xonalari va Navbat Statelari
let searchQueue = []; // Qidirayotgan o'yinchilar
let activeRooms = {}; // Faol o'yin xonalari

// 🔄 Tosh-Qog'oz-Qaychi Mantiqi (Natijani aniqlash)
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

// ⏳ Raund Yakunini Baholash va Natijalarni Tarqatish
function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const p1 = room.players[0];
  const p2 = room.players[1];

  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  let res1 = 'draw';
  let res2 = 'draw';
  let reward1 = 0;
  let reward2 = 0;
  let xp1 = 0;
  let xp2 = 0;

  if (c1 === 'timeout' && c2 === 'timeout') {
    // Ikkala o'yinchi ham ulgurmadi
    res1 = 'draw'; res2 = 'draw';
  } else if (c1 === 'timeout') {
    res1 = 'lose'; res2 = 'win';
    reward1 = -1; reward2 = 1;
    xp1 = -10; xp2 = 15;
  } else if (c2 === 'timeout') {
    res1 = 'win'; res2 = 'lose';
    reward1 = 1; reward2 = -1;
    xp1 = 15; xp2 = -10;
  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      res1 = 'win'; res2 = 'lose';
      reward1 = 1; reward2 = -1;
      xp1 = 15; xp2 = -10;
    } else if (winner === 'player2') {
      res1 = 'lose'; res2 = 'win';
      reward1 = -1; reward2 = 1;
      xp1 = -10; xp2 = 15;
    }
  }

  // 1-o'yinchiga natijani yuborish
  io.to(p1.socketId).emit('round_result', {
    myChoice: c1,
    opponentChoice: c2,
    result: res1,
    rewardCoins: reward1,
    rewardXP: xp1
  });

  // 2-o'yinchiga natijani yuborish
  io.to(p2.socketId).emit('round_result', {
    myChoice: c2,
    opponentChoice: c1,
    result: res2,
    rewardCoins: reward2,
    rewardXP: xp2
  });

  // Xonadagi tanlovlarni tozalash (keyingi raund uchun)
  room.choices = {};
}

// 🔌 Socket.io Tarmoq Hodisalari
io.on('connection', (socket) => {
  console.log(`🔌 Yangi ulanish: ${socket.id}`);

  // 1. 🔍 RAQIB QIDIRISH
  socket.on('find_match', ({ player, stake }) => {
    // Avval eski navbatda turgan bo'lsa o'chiramiz (dublekat bo'lmasligi uchun)
    searchQueue = searchQueue.filter(p => p.tgId !== player.tgId);

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.name,
      rating: player.rating,
      coins: player.coins,
      stake: stake
    };

    if (searchQueue.length > 0) {
      // Navbatda odam bor — Matchmaking (Ulanish)
      const opponent = searchQueue.shift();
      const roomId = `room_${opponent.tgId}_${newPlayer.tgId}`;

      socket.join(roomId);
      io.sockets.sockets.get(opponent.socketId)?.join(roomId);

      activeRooms[roomId] = {
        roomId: roomId,
        players: [newPlayer, opponent],
        choices: {},
        timer: 30,
        timerInterval: null
      };

      // Har ikkala o'yinchiga raqib topilganini e'lon qilish
      io.to(opponent.socketId).emit('match_found', { roomId, opponent: { name: newPlayer.name, rating: newPlayer.rating } });
      io.to(socket.id).emit('match_found', { roomId, opponent: { name: opponent.name, rating: opponent.rating } });

      // O'yin taymerini ishga tushirish (30 soniya)
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
      // Navbatda hech kim yo'q, kutish ro'yxatiga qo'shamiz
      searchQueue.push(newPlayer);
    }
  });

  // 2. ❌ QIDIRISHNI BEKOR QILISH
  socket.on('cancel_search', ({ tgId }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== tgId);
  });

  // 3. 🪨 TAQDIRIY TANLOV (Tosh, Qog'oz, Qaychi)
  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;

    const playerIds = room.players.map(p => p.socketId);
    // Agar har ikkala o'yinchi ham tanlab bo'lgan bo'lsa
    if (room.choices[playerIds[0]] && room.choices[playerIds[1]]) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  // 4. 💬 JONLI DUEL CHATI HODISASI
  socket.on('send_chat_message', ({ roomId, senderId, text }) => {
    // Xabarni xonadagi o'zimizdan boshqa raqibga yuborish
    socket.to(roomId).emit('chat_message', { senderId, text });
  });

  // 5. 🔄 RE-MATCH (QAYTA O'YNASH SO'ROVI)
  socket.on('request_rematch', ({ roomId }) => {
    const room = activeRooms[roomId];
    if (!room) return;
    
    // Har ikkala o'yinchiga yangi raund boshlanayotganini bildirish
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

  // 6. 🔌 ULANISH UZILGANDA (Disconnect)
  socket.on('disconnect', () => {
    console.log(`🔌 Ulanish uzildi: ${socket.id}`);
    
    // Navbatdan o'chirish
    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    // Agar faol o'yinda bo'lsa, raqibga texnik g'alaba berish
    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        clearInterval(room.timerInterval);
        socket.to(roomId).emit('opponent_left');
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

// 🚀 Serverni ishga tushirish
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda muvaffaqiyatli ishga tushdi.`);
});