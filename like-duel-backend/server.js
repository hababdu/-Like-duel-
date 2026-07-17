import express from 'express';
import http from 'http'; // Socket.io uchun kerak
import { Server } from 'socket.io'; // Socket.io serveri
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// HTTP server yaratamiz (Express va Socket.io bitta portda ishlashi uchun)
const server = http.createServer(app);

// Socket.io sozlamalari
const io = new Server(server, {
  cors: {
    origin: "*", // Barcha domenlardan ulanishga ruxsat (ishlab chiqish jarayoni uchun)
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// --- MONGOOSE MA'LUMOTLAR BAZASI ULANISHI ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🟢 MongoDB-ga muvaffaqiyatli ulandi!'))
  .catch((err) => console.error('🔴 MongoDB ulanishida xatolik:', err));

// --- FOYDALANUVCHI SCHEMASI ---
const userSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true },
  username: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String },
  photoUrl: { type: String, default: '' },
  coins: { type: Number, default: 100 },       // Boshlang'ich tanga
  rating: { type: Number, default: 100 },      // Boshlang'ich reyting (XP)
  referredBy: { type: String, default: null }, // Taklif qilgan do'st IDsi
  referralsCount: { type: Number, default: 0 } 
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- TELEGRAM BOT SOZLAMALARI (TELEGRAF) ---
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
  try {
    const tgId = ctx.from.id.toString();
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || '';
    
    const startPayload = ctx.payload; 
    let referredBy = null;

    if (startPayload && startPayload.startsWith('ref_')) {
      referredBy = startPayload.replace('ref_', '');
    }

    let user = await User.findOne({ tgId });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      let startCoins = 100;

      if (referredBy && referredBy !== tgId) {
        const referrer = await User.findOne({ tgId: referredBy });
        if (referrer) {
          startCoins = 200; 
          
          referrer.coins += 100;
          referrer.referralsCount += 1;
          await referrer.save();

          try {
            await ctx.telegram.sendMessage(
              referredBy, 
              `🔥 Do'stingiz ${firstName} sizning taklifingiz bilan o'yinga qo'shildi! Sizga +100 🪙 bonus berildi!`
            );
          } catch (err) {
            console.log("Referrerga xabar yuborib bo'lmadi:", err.message);
          }
        }
      }

      user = new User({
        tgId,
        username,
        firstName,
        lastName,
        coins: startCoins,
        referredBy: referredBy && referredBy !== tgId ? referredBy : null
      });

      await user.save();
    }

    const webAppUrl = process.env.WEB_APP_URL;

    await ctx.reply(
      `Sizni Like Duel o'yinida ko'rib turganimizdan xursandmiz! ⚡\n\n` +
      `Sizning balansingiz: ${user.coins} 🪙\n` +
      `Reytingingiz: ${user.rating} XP\n\n` +
      (isNewUser 
        ? `🎁 Yangi o'yinchi bonusi hisobingizga o'tkazildi!` 
        : `Qani, duellarda g'olib bo'ling va o'z kuchingizni ko'rsating!`),
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 O\'yinni boshlash', webAppUrl)]
      ])
    );

  } catch (error) {
    console.error("Bot start xatoligi:", error);
    await ctx.reply("Tizimda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
  }
});

// --- EXPRESS API (FRONTEND REAKT UCHUN) ---
app.post('/api/user/auth', async (req, res) => {
  try {
    const { tgId, username, firstName, lastName, photoUrl } = req.body;

    if (!tgId) {
      return res.status(400).json({ error: "Telegram ID talab qilinadi" });
    }

    let user = await User.findOne({ tgId: tgId.toString() });

    if (!user) {
      user = new User({
        tgId: tgId.toString(),
        username,
        firstName,
        lastName,
        photoUrl
      });
      await user.save();
    } else {
      user.photoUrl = photoUrl || user.photoUrl;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.username = username || user.username;
      await user.save();
    }

    res.status(200).json({
      coins: user.coins,
      rating: user.rating,
      user
    });

  } catch (error) {
    console.error("Auth API xatosi:", error);
    res.status(500).json({ error: "Server xatoligi" });
  }
});

// --- SOCKET.IO MULTIPLAYER & MATCHMAKING MANTIQI ---

const matchmakingQueue = []; // Raqib qidirayotgan o'yinchilar ro'yxati
const activeRooms = {};       // Faol o'yin xonalari

io.on('connection', (socket) => {
  console.log(`🔌 Foydalanuvchi ulandi (Socket): ${socket.id}`);

  // 1. MATCHMAKING: Raqib qidirish navbatiga qo'shilish
  socket.on('find_match', async ({ player, stake }) => {
    // Agar foydalanuvchida tgId yo'q bo'lsa, xatolik
    if (!player || !player.tgId) return;

    // Navbatda ushbu socket bor-yo'qligini tekshirish
    const exists = matchmakingQueue.find(p => p.socketId === socket.id);
    if (exists) return;

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId.toString(),
      name: player.name,
      avatar: player.avatar,
      rating: player.rating,
      coins: player.coins,
      stake
    };

    // Navbatdan o'zidan boshqa va stavkasi bir xil bo'lgan raqibni qidirish
    const opponent = matchmakingQueue.find(p => p.stake === stake && p.socketId !== socket.id);

    if (opponent) {
      // Raqib topildi! Uni navbatdan olib tashlaymiz
      const oppIndex = matchmakingQueue.indexOf(opponent);
      if (oppIndex > -1) matchmakingQueue.splice(oppIndex, 1);

      // Noyob xonalar (Room ID) yaratamiz
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      const currentSocket = socket;

      if (opponentSocket && currentSocket) {
        opponentSocket.join(roomId);
        currentSocket.join(roomId);

        // Xona obyektini shakllantirish
        activeRooms[roomId] = {
          players: [
            { socketId: currentSocket.id, ...player, tgId: player.tgId.toString() },
            { socketId: opponentSocket.id, ...opponent, tgId: opponent.tgId.toString() }
          ],
          choices: {},
          timer: 30,
          timerInterval: null
        };

        // Ikkala o'yinchiga ham raqib topilgani haqida xabar berish
        opponentSocket.emit('match_found', { 
          roomId, 
          opponent: { name: player.name, avatar: player.avatar, rating: player.rating, coins: player.coins } 
        });

        currentSocket.emit('match_found', { 
          roomId, 
          opponent: { name: opponent.name, avatar: opponent.avatar, rating: opponent.rating, coins: opponent.coins } 
        });

        // 3 soniyalik tayyorgarlikdan so'ng birinchi raundni boshlaymiz
        setTimeout(() => {
          startRound(roomId);
        }, 3000);
      }
    } else {
      // Navbatga qo'shish
      matchmakingQueue.push(newPlayer);
    }
  });

  // 2. O'YINCHI HARAKAT QILGANDA (Tosh, Qog'oz yoki Qaychi)
  socket.on('player_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) return;

    room.choices[socket.id] = choice;

    const playerIds = room.players.map(p => p.socketId);
    // Agar har ikkala o'yinchi ham tanlov qilib bo'lgan bo'lsa
    if (room.choices[playerIds[0]] && room.choices[playerIds[1]]) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  });

  // 3. CHAT XABARI KELGANDA
  socket.on('send_message', ({ roomId, sender, text }) => {
    socket.to(roomId).emit('receive_message', { sender, text, isMe: false });
  });

  // 4. XONADAN CHIQISH (Bekor qilish yoki o'yindan chiqish)
  socket.on('leave_room', ({ roomId }) => {
    handleDisconnect(socket, roomId);
  });

  // 5. KUTILMAGANDA ALOQA UZILGANDA
  socket.on('disconnect', () => {
    const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (index > -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`❌ Navbatdan o'chirildi: ${socket.id}`);
    }

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      const isInRoom = room.players.some(p => p.socketId === socket.id);
      if (isInRoom) {
        handleDisconnect(socket, roomId);
        break;
      }
    }
  });
});

// --- O'YINNING YORDAMCHI FUNKSIYALARI ---

function startRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  room.choices = {};
  room.timer = 30;

  io.to(roomId).emit('start_round');

  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(roomId).emit('timer_tick', room.timer);

    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId); // Vaqt tugasa ham avtomatik hisoblash
    }
  }, 1000);
}

// Raund g'olibini aniqlash va Ma'lumotlar bazasiga (MongoDB) saqlash
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const p1 = room.players[0];
  const p2 = room.players[1];

  const c1 = room.choices[p1.socketId] || null;
  const c2 = room.choices[p2.socketId] || null;

  let result1 = 'draw';
  let result2 = 'draw';

  if (c1 === c2) {
    result1 = 'draw';
    result2 = 'draw';
  } else if (
    (c1 === 'rock' && c2 === 'scissors') ||
    (c1 === 'paper' && c2 === 'rock') ||
    (c1 === 'scissors' && c2 === 'paper') ||
    (c1 !== null && c2 === null)
  ) {
    result1 = 'win';
    result2 = 'lose';
  } else {
    result1 = 'lose';
    result2 = 'win';
  }

  const STAKE = 100;
  const rewardP1 = result1 === 'win' ? STAKE : (result1 === 'lose' ? -STAKE : 0);
  const rewardXP1 = result1 === 'win' ? 15 : (result1 === 'lose' ? -10 : 0);

  const rewardP2 = result2 === 'win' ? STAKE : (result2 === 'lose' ? -STAKE : 0);
  const rewardXP2 = result2 === 'win' ? 15 : (result2 === 'lose' ? -10 : 0);

  // MongoDB-da o'yinchilarning yangi balanslarini yangilash (Asinxron)
  try {
    await User.findOneAndUpdate(
      { tgId: p1.tgId },
      { $inc: { coins: rewardP1, rating: rewardXP1 } }
    );
    await User.findOneAndUpdate(
      { tgId: p2.tgId },
      { $inc: { coins: rewardP2, rating: rewardXP2 } }
    );
  } catch (dbErr) {
    console.error("O'yin natijalarini bazaga saqlashda xatolik:", dbErr);
  }

  // Frontend-ga natijalarni uzatish
  io.to(p1.socketId).emit('round_result', {
    myChoice: c1,
    opponentChoice: c2,
    result: result1,
    rewardCoins: rewardP1,
    rewardXP: rewardXP1
  });

  io.to(p2.socketId).emit('round_result', {
    myChoice: c2,
    opponentChoice: c1,
    result: result2,
    rewardCoins: rewardP2,
    rewardXP: rewardXP2
  });

  // 5 soniyadan so'ng keyingi raundni avtomatik boshlash
  setTimeout(() => {
    if (activeRooms[roomId]) {
      startRound(roomId);
    }
  }, 5000);
}

// Aloqa uzilganda raqibga texnik g'alaba yozish
async function handleDisconnect(socket, roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  clearInterval(room.timerInterval);
  
  const winner = room.players.find(p => p.socketId !== socket.id);
  if (winner) {
    // Chiqib ketmagan o'yinchiga g'alaba mukofotini bazada qo'shib qo'yamiz
    try {
      await User.findOneAndUpdate(
        { tgId: winner.tgId },
        { $inc: { coins: 100, rating: 15 } }
      );
    } catch (err) {
      console.error("Texnik g'alabani saqlashda xatolik:", err);
    }
    io.to(winner.socketId).emit('opponent_left');
  }

  delete activeRooms[roomId];
}

// --- RENDER VA WEBHOOK / POLLING SOZLAMASI ---
if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/bot${process.env.BOT_TOKEN}`;
  app.use(bot.webhookCallback(webhookPath));
  bot.telegram.setWebhook(`${process.env.APP_URL}${webhookPath}`);
  console.log('🔮 Bot Webhook rejimida ishga tushdi!');
} else {
  bot.launch();
  console.log('🤖 Bot Polling (mahalliy) rejimida ishga tushdi!');
}

// MUHIM O'ZGARISH: server.listen Express emas, balki HTTP serverni eshitadi (Socket ishlaydi)
server.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} portida ishlamoqda!`);
});

// Kutilmagan to'xtashlarni boshqarish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));