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
  cors: { origin: "*", methods: ["GET", "POST"] }
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/like-duel')
  .then(() => console.log('💾 MongoDB muvaffaqiyatli ulandi.'))
  .catch(err => console.error('🔴 MongoDB xatolik:', err));

// 📝 Foydalanuvchi Modeli
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: "O'yinchi" },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100 }, // Yangi o'yinchiga default 100 tanga
  rating: { type: Number, default: 100 },
  refParent: { type: String, default: null },
  isRefRewarded: { type: Boolean, default: false } // Referal bonus berilganini tekshirish
});

const User = mongoose.model('User', userSchema);

// 🛰️ API: Autentifikatsiya, Referal va Balans
app.post('/api/user/auth', async (req, res) => {
  const { tgId, username, firstName, lastName, photoUrl, coins, rating, refParent } = req.body;

  try {
    let user = await User.findOne({ tgId });

    if (!user) {
      // 1. Yangi foydalanuvchi yaratish (Boshlang'ich 100 tanga oladi)
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

      // 2. 👥 Referal tizimi mantiqi
      if (refParent && refParent !== tgId) {
        const parentUser = await User.findOne({ tgId: refParent });
        if (parentUser) {
          // Taklif qilgan odamga 100 tanga qo'shish
          parentUser.coins += 100;
          await parentUser.save();
          
          // Yangi kelgan o'yinchiga taklif havolasi orqali kelgani uchun yana +100 tanga bonus (Jami 200)
          user.coins += 100;
          user.isRefRewarded = true;
          console.log(`🎁 Referal bonus berildi! Parent: ${refParent}, Child: ${tgId}`);
        }
      }
      await user.save();
    } else {
      // 3. Mavjud foydalanuvchi ma'lumotlarini yangilash (O'yin tugaganda yoki tanga sotib olganda)
      let updateFields = {};
      if (username !== undefined) updateFields.username = username;
      if (firstName !== undefined) updateFields.firstName = firstName;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
      if (coins !== undefined) updateFields.coins = coins;
      if (rating !== undefined) updateFields.rating = rating;

      user = await User.findOneAndUpdate({ tgId }, { $set: updateFields }, { new: true });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Auth xatolik:", error);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

// 💰 API: 10 Tangaga Raqibning Username profile linkini sotib olish
app.post('/api/user/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user || user.coins < 10) {
      return res.status(400).json({ success: false, message: "Mablag' yetarli emas yoki foydalanuvchi topilmadi!" });
    }
    user.coins -= 10; // 10 tanga yechib olish
    await user.save();
    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    res.status(500).json({ success: false, message: "Xatolik yuz berdi" });
  }
});

// 🎮 Socket Matchmaking va O'yin ichidagi real chat
let searchQueue = [];
let activeRooms = {};

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if ((choice1 === 'rock' && choice2 === 'scissors') || (choice1 === 'paper' && choice2 === 'rock') || (choice1 === 'scissors' && choice2 === 'paper')) return 'player1';
  return 'player2';
}

function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;
  const p1 = room.players[0]; const p2 = room.players[1];
  const c1 = room.choices[p1.socketId] || 'timeout'; const c2 = room.choices[p2.socketId] || 'timeout';

  let res1 = 'draw', res2 = 'draw', reward1 = 0, reward2 = 0, xp1 = 0, xp2 = 0;
  if (c1 === 'timeout' && c2 === 'timeout') {} 
  else if (c1 === 'timeout') { res1 = 'lose'; res2 = 'win'; reward1 = -1; reward2 = 1; xp1 = -10; xp2 = 15; } 
  else if (c2 === 'timeout') { res1 = 'win'; res2 = 'lose'; reward1 = 1; reward2 = -1; xp1 = 15; xp2 = -10; } 
  else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') { res1 = 'win'; res2 = 'lose'; reward1 = 1; reward2 = -1; xp1 = 15; xp2 = -10; } 
    else if (winner === 'player2') { res1 = 'lose'; res2 = 'win'; reward1 = -1; reward2 = 1; xp1 = -10; xp2 = 15; }
  }

  io.to(p1.socketId).emit('round_result', { myChoice: c1, opponentChoice: c2, result: res1, rewardCoins: reward1, rewardXP: xp1 });
  io.to(p2.socketId).emit('round_result', { myChoice: c2, opponentChoice: c1, result: res2, rewardCoins: reward2, rewardXP: xp2 });
  room.choices = {};
}

io.on('connection', (socket) => {
  socket.on('find_match', ({ player, stake }) => {
    searchQueue = searchQueue.filter(p => p.tgId !== player.tgId);
    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.name,
      username: player.username || '', // Username profil havolasi uchun kerak
      rating: player.rating,
      coins: player.coins,
      stake
    };

    if (searchQueue.length > 0) {
      const opponent = searchQueue.shift();
      const roomId = `room_${opponent.tgId}_${newPlayer.tgId}`;
      socket.join(roomId);
      io.sockets.sockets.get(opponent.socketId)?.join(roomId);

      activeRooms[roomId] = { roomId, players: [newPlayer, opponent], choices: {}, timer: 30, timerInterval: null };

      // Raqib ma'lumotlariga username ham qo'shib yuboramiz
      io.to(opponent.socketId).emit('match_found', { roomId, opponent: { tgId: newPlayer.tgId, name: newPlayer.name, username: newPlayer.username, rating: newPlayer.rating } });
      io.to(socket.id).emit('match_found', { roomId, opponent: { tgId: opponent.tgId, name: opponent.name, username: opponent.username, rating: opponent.rating } });

      let timeLeft = 30;
      activeRooms[roomId].timerInterval = setInterval(() => {
        timeLeft--;
        io.to(roomId).emit('timer_tick', timeLeft);
        if (timeLeft <= 0) { clearInterval(activeRooms[roomId].timerInterval); evaluateRound(roomId); }
      }, 1000);
    } else {
      searchQueue.push(newPlayer);
    }
  });

  socket.on('cancel_search', ({ tgId }) => { searchQueue = searchQueue.filter(p => p.tgId !== tgId); });
  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;
    room.choices[socket.id] = choice;
    const playerIds = room.players.map(p => p.socketId);
    if (room.choices[playerIds[0]] && room.choices[playerIds[1]]) { clearInterval(room.timerInterval); evaluateRound(roomId); }
  });

  // 💬 Real-time erkin matnli chat hodisasi
  socket.on('send_chat_message', ({ roomId, senderId, text }) => {
    socket.to(roomId).emit('chat_message', { senderId, text });
  });

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));