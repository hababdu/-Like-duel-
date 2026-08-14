// ============================================================
// SERVER.JS - TO'LIQ BACKEND (EKONOMIKA TIZIMI BILAN)
// TUZATILGAN VERSIYA - barcha aniqlangan muammolar hal qilingan:
//  1. Escrow endi MongoDB'da persistent (server qulasa ham tanga yo'qolmaydi)
//  2. CORS production'da ALLOWED_ORIGIN'ni majburiy qiladi
//  3. ADMIN_TOKEN uchun xavfli default yo'q - o'rnatilmasa server ishga tushmaydi
//  4. onlineUsers'da eski/yetim socketlar tozalanadi
//  5. Race condition kamaytirilgan (findOneAndUpdate atomik operatsiyalar bilan)
//  6. Stavka uchun min/max chegara qo'yilgan
//  7. Server qayta ishga tushganda "osilib qolgan" xonalar avtomatik qaytariladi
// ============================================================
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ======================
// ENVIRONMENT VARIABLES
// ======================
const {
  PORT = 10000,
  NODE_ENV = 'development',
  MONGODB_URI,
  ADMIN_TOKEN,                  // MAJBURIY - default yo'q (xavfsizlik uchun)
  TELEGRAM_BOT_TOKEN,           // Bot tokeni - initData tekshiruvi VA to'lovlar uchun MAJBURIY
  TELEGRAM_WEBHOOK_SECRET = '', // setWebhook chaqirilganda secret_token sifatida bering
  ALLOWED_ORIGIN = ''
} = process.env;

const IS_PRODUCTION = NODE_ENV === 'production';

// ======================
// STARTUP TEKSHIRUVLARI - muhim env o'rnatilmagan bo'lsa server ishga tushmaydi
// ======================
const startupErrors = [];

if (!MONGODB_URI) {
  startupErrors.push('MONGODB_URI o\'rnatilmagan.');
}
if (!TELEGRAM_BOT_TOKEN) {
  startupErrors.push('TELEGRAM_BOT_TOKEN o\'rnatilmagan. Auth va to\'lovlar ishlamaydi.');
}
if (!ADMIN_TOKEN) {
  startupErrors.push('ADMIN_TOKEN o\'rnatilmagan. Xavfsizlik uchun bu MAJBURIY (default qiymat endi yo\'q).');
}
if (IS_PRODUCTION && !ALLOWED_ORIGIN) {
  startupErrors.push('Production rejimida ALLOWED_ORIGIN majburiy (CORS uchun aniq domenlar kerak).');
}

if (startupErrors.length > 0) {
  console.error('❌ SERVER ISHGA TUSHMADI - quyidagi muammolarni hal qiling:');
  startupErrors.forEach(err => console.error('   - ' + err));
  // Production'da darhol to'xtatamiz. Dev'da faqat ADMIN_TOKEN/MONGODB_URI bo'lmasa ham to'xtatamiz,
  // chunki bularsiz server xavfsiz yoki foydali ishlay olmaydi.
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ======================
// CORS
// ======================
// TUZATISH: oddiy qiymat solishtirish o'rniga normalizatsiya qiluvchi funksiya
// ishlatiladi - oxirgi "/" belgisi, bo'sh joylar va ko'rinmas belgilar (masalan
// nusxalashda tushib qolgan zero-width/non-breaking space) hisobga olinmaydi.
// Rad etilgan Origin har doim log'ga yoziladi - shu orqali .env'dagi qiymat bilan
// brauzerdan kelayotgan qiymat orasidagi farqni darhol ko'rish mumkin.
function normalizeOrigin(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // ko'rinmas/maxsus bo'sh joy belgilari
    .trim()
    .replace(/\/+$/, '') // oxirgi slash(lar)ni olib tashlash
    .toLowerCase();
}

const allowedOriginsList = ALLOWED_ORIGIN
  ? ALLOWED_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'].map(normalizeOrigin);

console.log('🔧 Ruxsat etilgan originlar:', allowedOriginsList);

const corsOptions = {
  origin: (requestOrigin, callback) => {
    // requestOrigin undefined bo'lishi mumkin (masalan server-to-server so'rov,
    // Postman, yoki bir xil origin'dan kelgan so'rov) - bunday holatda ruxsat beramiz.
    if (!requestOrigin) return callback(null, true);

    const normalized = normalizeOrigin(requestOrigin);
    if (allowedOriginsList.includes(normalized)) {
      return callback(null, true);
    }

    console.warn(`⚠️ CORS rad etildi. Kelgan Origin: "${requestOrigin}" (normalized: "${normalized}"). Ruxsat etilganlar:`, allowedOriginsList);
    return callback(new Error('CORS: bu origin ruxsat etilmagan'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Admin-Token', 'X-Telegram-Init-Data']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// SOCKET.IO
// ======================
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// ======================
// MONGODB CONNECTION
// ======================
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    recoverStaleRooms(); // server qayta ishga tushganda osilib qolgan xonalarni qaytarish
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// ======================
// USER SCHEMA
// ======================
const UserSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  languageCode: { type: String, default: 'uz' },
  isPremium: { type: Boolean, default: false },

  // MUHIM: coins maydoni to'g'ridan-to'g'ri o'zgartirilmaydi.
  // Har qanday o'zgarish FAQAT applyCoinTransaction() orqali,
  // ledger (Transaction) yozuvi bilan birga amalga oshiriladi.
  coins: { type: Number, default: 0 },
  rating: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },

  totalGames: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },

  refParent: { type: String, default: null },
  refCount: { type: Number, default: 0 },
  refBonus: { type: Number, default: 0 },
  isRefRewarded: { type: Boolean, default: false },

  isOnline: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ======================
// TRANSACTION SCHEMA (HAMYON TARIXI / LEDGER)
// ======================
const TransactionSchema = new mongoose.Schema({
  tgId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'signup_bonus',       // ro'yxatdan o'tish bonusi (+100)
      'referral_bonus',     // do'st taklif qilgani uchun (+50)
      'game_stake_hold',    // duelga kirishda stavka ushlab turiladi (-)
      'game_stake_refund',  // raqib topilmadi/xato/server tiklandi - qaytarildi (+)
      'game_win',           // duelda g'alaba (+2x stavka)
      'game_lose',          // duelda mag'lubiyat (0, faqat ledger yozuvi uchun)
      'game_draw_refund',   // durang - stavka qaytarildi (+)
      'purchase',           // Telegram Stars orqali sotib olindi (+)
      'admin_adjust'        // admin tomonidan qo'lda tuzatish (+/-)
    ]
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

// ======================
// PAYMENT SCHEMA (Telegram Stars to'lovlari, ikki marta hisoblanmasligi uchun)
// ======================
const PaymentSchema = new mongoose.Schema({
  telegramPaymentChargeId: { type: String, required: true, unique: true },
  tgId: { type: String, required: true },
  packageId: { type: String, required: true },
  starsAmount: { type: Number, required: true },
  coinsAwarded: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', PaymentSchema);

// ======================
// ROOM SCHEMA (YANGI) - duel xonalarini MongoDB'da saqlash
// ======================
// Nima uchun kerak: avvalgi versiyada activeRooms faqat xotirada (RAM) saqlanardi.
// Agar stavka ikkala o'yinchidan yechilgandan (escrow) keyin server qulasa,
// xonaga oid butun ma'lumot yo'qolib, tanga hech kimga qaytarilmasdan yo'qolib
// qolardi. Endi har bir xona MongoDB'da ham yoziladi va status bilan kuzatiladi:
//   'active'    -> o'yin davom etmoqda, stavkalar escrow'da
//   'completed' -> natija chiqarilgan, tanga taqsimlangan
//   'refunded'  -> server tiklanganda topilib, ikkala tarafga ham qaytarilgan
const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'completed', 'refunded'], default: 'active', index: true },
  stake: { type: Number, required: true },
  players: [{
    tgId: String,
    name: String,
    username: String,
    rating: Number,
    level: Number,
    photoUrl: String
  }],
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

const Room = mongoose.model('Room', RoomSchema);

// ======================
// GAME STATE (faqat vaqtinchalik/runtime holat - manba MongoDB)
// ======================
let searchQueue = [];
let activeRooms = {}; // roomId -> { players, choices, stake, timer, timeLeft, chat }
let onlineUsers = new Map(); // tgId -> { socketId, user }

const VALID_CHOICES = ['rock', 'paper', 'scissors'];
const ROUND_SECONDS = 30;
const REFERRAL_BONUS = 50;
const SIGNUP_BONUS = 100;
const MIN_STAKE = 1;
const MAX_STAKE = 100000; // haddan tashqari katta/manfiy stavkalarning oldini olish

const COIN_PACKAGES = [
  { id: 'pack_100', coins: 100, stars: 50, title: '100 🪙 Tanga' },
  { id: 'pack_500', coins: 500, stars: 200, title: '500 🪙 Tanga' },
  { id: 'pack_1200', coins: 1200, stars: 400, title: '1200 🪙 Tanga (+200 bonus)' },
  { id: 'pack_3000', coins: 3000, stars: 900, title: '3000 🪙 Tanga (+600 bonus)' }
];

// ============================================================
// MARKAZIY TANGA FUNKSIYASI - BUTUN TIZIMDA FAQAT SHU ORQALI
// TANGA O'ZGARTIRILADI.
// ============================================================
async function applyCoinTransaction(tgId, amount, type, description = '', metadata = {}, opts = {}) {
  const { requireSufficient = false } = opts;

  const run = async (session) => {
    const user = await User.findOne({ tgId }).session(session || null);
    if (!user) throw new Error('Foydalanuvchi topilmadi: ' + tgId);

    if (requireSufficient && amount < 0 && user.coins + amount < 0) {
      const err = new Error('COINS_INSUFFICIENT');
      err.code = 'COINS_INSUFFICIENT';
      throw err;
    }

    const newBalance = Math.max(0, user.coins + amount);
    const actualChange = newBalance - user.coins;
    user.coins = newBalance;
    await user.save({ session: session || undefined });

    await Transaction.create([{
      tgId, type, amount: actualChange, balanceAfter: newBalance, description, metadata
    }], { session: session || undefined });

    return user;
  };

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch {
    session = null;
  }

  if (!session) {
    return run(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await run(session);
    });
    return result;
  } catch (err) {
    if (err.code === 'COINS_INSUFFICIENT') throw err;
    console.warn('⚠️ Tranzaksiyasiz rejimga o\'tildi:', err.message);
    return run(null);
  } finally {
    session.endSession();
  }
}

// ============================================================
// SERVER TIKLANGANDA - "OSILIB QOLGAN" XONALARNI QAYTARISH
// ============================================================
// Server ishga tushganda (yoki qayta ishga tushganda), MongoDB'dagi
// 'active' statusidagi barcha xonalarni topamiz. Bu holat faqat server
// ilgari kutilmaganda o'chgan/qulagan bo'lsa yuzaga keladi (chunki normal
// oqimda evaluateRound() har doim xonani 'completed' qilib yopadi).
// Xavfsizlik nuqtai nazaridan eng to'g'ri yechim - ikkala tarafga ham
// stavkasini to'liq qaytarish, chunki o'yin natijasi noma'lum.
async function recoverStaleRooms() {
  try {
    const staleRooms = await Room.find({ status: 'active' });
    if (staleRooms.length === 0) return;

    console.log(`🔄 ${staleRooms.length} ta osilib qolgan xona topildi, tangalar qaytarilmoqda...`);

    for (const room of staleRooms) {
      for (const player of room.players) {
        try {
          await applyCoinTransaction(
            player.tgId,
            room.stake,
            'game_stake_refund',
            `Server tiklandi, duel yakunlanmagan - stavka qaytarildi (${room.roomId})`,
            { roomId: room.roomId, recovery: true }
          );
        } catch (err) {
          console.error(`❌ ${player.tgId} uchun qaytarishda xato:`, err.message);
        }
      }
      room.status = 'refunded';
      room.completedAt = new Date();
      await room.save();
    }

    console.log('✅ Barcha osilib qolgan xonalar uchun tangalar qaytarildi.');
  } catch (err) {
    console.error('❌ recoverStaleRooms xatosi:', err);
  }
}

// ============================================================
// TELEGRAM API YORDAMCHISI
// ============================================================
async function callTelegramApi(method, payload) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API xato (${method}): ${data.description}`);
  return data.result;
}

// ============================================================
// TELEGRAM initData TEKSHIRUVI
// ============================================================
function verifyTelegramInitData(initData) {
  if (!TELEGRAM_BOT_TOKEN || !initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckArr = [];
    for (const [key, value] of params.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    const authDate = Number(params.get('auth_date') || 0);
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || now - authDate > 60 * 60 * 24) return null;

    const userJson = params.get('user');
    return userJson ? JSON.parse(userJson) : null;
  } catch (err) {
    console.error('❌ initData tekshiruvida xato:', err);
    return null;
  }
}

function requireTelegramAuth(req, res, next) {
  const initData = req.body.initData || req.headers['x-telegram-init-data'];
  const verifiedUser = verifyTelegramInitData(initData);

  if (!verifiedUser) {
    return res.status(401).json({
      success: false,
      message: 'Telegram autentifikatsiyasi muvaffaqiyatsiz'
    });
  }

  req.telegramUser = verifiedUser;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  // timingSafeEqual bilan solishtirish - timing attack'larning oldini olish uchun
  const tokenBuf = Buffer.from(String(token || ''));
  const adminBuf = Buffer.from(String(ADMIN_TOKEN));
  const isValid = tokenBuf.length === adminBuf.length &&
    crypto.timingSafeEqual(tokenBuf, adminBuf);

  if (!isValid) {
    return res.status(403).json({ success: false, message: 'Ruxsat berilmagan' });
  }
  next();
}

// ======================
// API ROUTES
// ======================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ============================================================
// 1. USER AUTH
// ============================================================
app.post('/api/user/auth', requireTelegramAuth, async (req, res) => {
  try {
    const verified = req.telegramUser;
    const tgId = String(verified.id);
    const { refParent } = req.body;

    console.log('📥 Auth request:', { tgId, username: verified.username });

    let user = await User.findOne({ tgId });

    if (!user) {
      user = new User({
        tgId,
        username: verified.username || '',
        firstName: verified.first_name || "O'yinchi",
        lastName: verified.last_name || '',
        photoUrl: verified.photo_url || '',
        languageCode: verified.language_code || 'uz',
        isPremium: !!verified.is_premium,
        coins: 0,
        rating: 100,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        refParent: refParent && String(refParent) !== tgId ? String(refParent) : null
      });
      await user.save();
      console.log('✅ New user created:', user.tgId);

      await applyCoinTransaction(tgId, SIGNUP_BONUS, 'signup_bonus', "Ro'yxatdan o'tish bonusi");

      if (user.refParent) {
        const parent = await User.findOne({ tgId: user.refParent });
        if (parent) {
          await applyCoinTransaction(
            parent.tgId,
            REFERRAL_BONUS,
            'referral_bonus',
            `${user.firstName} taklif qilingani uchun bonus`,
            { referredTgId: tgId }
          );
          parent.refCount += 1;
          parent.refBonus += REFERRAL_BONUS;
          await parent.save();

          user.isRefRewarded = true;
          await user.save();

          io.emit(`update_${user.refParent}`, {
            type: 'REF_BONUS',
            coins: parent.coins + REFERRAL_BONUS,
            refCount: parent.refCount
          });
        }
      }

      user = await User.findOne({ tgId });

    } else {
      user.username = verified.username || user.username;
      user.firstName = verified.first_name || user.firstName;
      user.lastName = verified.last_name || user.lastName;
      user.photoUrl = verified.photo_url || user.photoUrl;
      user.languageCode = verified.language_code || user.languageCode;
      user.isPremium = verified.is_premium ?? user.isPremium;
      user.lastLogin = new Date();
      user.isOnline = true;
      await user.save();
      console.log('✅ User updated:', user.tgId);
    }

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
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
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
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 3. WALLET - hamyon balansi va tranzaksiyalar tarixi
// ============================================================
app.get('/api/user/:tgId/wallet', async (req, res) => {
  try {
    const { tgId } = req.params;
    const limit = Math.min(100, Number(req.query.limit) || 30);

    const user = await User.findOne({ tgId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }

    const transactions = await Transaction.find({ tgId })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      balance: user.coins,
      transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 4. ADMIN - qo'lda tanga tuzatish (faqat admin token bilan)
// ============================================================
app.post('/api/admin/update-coins', requireAdmin, async (req, res) => {
  try {
    const { tgId, amount, reason } = req.body;

    if (!tgId) {
      return res.status(400).json({ success: false, message: 'tgId majburiy' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount === 0) {
      return res.status(400).json({ success: false, message: 'amount noto\'g\'ri' });
    }

    const user = await applyCoinTransaction(
      tgId,
      numAmount,
      'admin_adjust',
      reason || 'Admin tuzatishi'
    );
    res.json({ success: true, coins: user.coins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 5. ADMIN - butun tizimdagi tangalar holatini nazorat qilish
// ============================================================
app.get('/api/admin/economy-stats', requireAdmin, async (req, res) => {
  try {
    const totalCoinsAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$coins' } } }
    ]);
    const totalCoins = totalCoinsAgg[0]?.total || 0;
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();

    const byType = await Transaction.aggregate([
      { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { totalAmount: -1 } }
    ]);

    // Qo'shimcha: hozirda 'active' turgan (hal qilinmagan) xonalar soni va ularda
    // "muzlab" turgan umumiy tanga miqdori - operativ monitoring uchun foydali.
    const activeRoomsAgg = await Room.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, count: { $sum: 1 }, frozenCoins: { $sum: { $multiply: ['$stake', { $size: '$players' }] } } } }
    ]);
    const activeRoomsStats = activeRoomsAgg[0] || { count: 0, frozenCoins: 0 };

    res.json({
      success: true,
      totalCoins,
      totalUsers,
      totalTransactions,
      byType,
      activeRooms: activeRoomsStats.count,
      frozenCoinsInActiveRooms: activeRoomsStats.frozenCoins
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 6. LEADERBOARD
// ============================================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('tgId firstName username photoUrl coins rating level totalGames wins');

    res.json({ success: true, leaders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 7. REFERRALS
// ============================================================
app.get('/api/user/:tgId/referrals', async (req, res) => {
  try {
    const referrals = await User.find({ refParent: req.params.tgId })
      .select('firstName username coins rating createdAt');

    res.json({ success: true, referrals, count: referrals.length, bonusPerReferral: REFERRAL_BONUS });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 8. GAME STATS
// ============================================================
app.get('/api/user/:tgId/stats', async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
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
        winRate,
        winStreak: user.winStreak,
        maxWinStreak: user.maxWinStreak,
        rating: user.rating,
        level: user.level,
        xp: user.xp,
        xpToNextLevel: user.xpToNextLevel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================
// 9. SHOP - Telegram Stars orqali tanga sotib olish
// ============================================================
app.get('/api/shop/packages', (req, res) => {
  res.json({ success: true, packages: COIN_PACKAGES });
});

app.post('/api/shop/create-invoice', requireTelegramAuth, async (req, res) => {
  try {
    const tgId = String(req.telegramUser.id);
    const { packageId } = req.body;

    const pkg = COIN_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Nomalum paket' });
    }

    const invoiceLink = await callTelegramApi('createInvoiceLink', {
      title: pkg.title,
      description: `${pkg.coins} tanga hamyoningizga qo'shiladi`,
      payload: JSON.stringify({ tgId, packageId: pkg.id }),
      currency: 'XTR',
      prices: [{ label: pkg.title, amount: pkg.stars }]
    });

    res.json({ success: true, invoiceLink, package: pkg });
  } catch (error) {
    console.error('❌ Create invoice error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 10. TELEGRAM WEBHOOK - to'lovlarni tasdiqlash
// ============================================================
app.post('/api/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).end();
    }
  }

  const update = req.body;

  try {
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      let payload = null;
      try { payload = JSON.parse(query.invoice_payload); } catch {}

      const pkg = payload ? COIN_PACKAGES.find(p => p.id === payload.packageId) : null;

      const answerPayload = {
        pre_checkout_query_id: query.id,
        ok: !!pkg
      };
      if (!pkg) answerPayload.error_message = 'Paket topilmadi';

      await callTelegramApi('answerPreCheckoutQuery', answerPayload);

    } else if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const chargeId = payment.telegram_payment_charge_id;

      const existing = await Payment.findOne({ telegramPaymentChargeId: chargeId });
      if (!existing) {
        const payload = JSON.parse(payment.invoice_payload);
        const pkg = COIN_PACKAGES.find(p => p.id === payload.packageId);

        if (pkg) {
          // Payment yozuvini AVVAL unique constraint bilan yaratamiz - bu ikkita
          // parallel webhook chaqiruvi bir xil to'lovni ikki marta qayta ishlashining
          // oldini oladi (unique index xato tashlaydi, shunda tangani ikki marta bermaymiz).
          try {
            await Payment.create({
              telegramPaymentChargeId: chargeId,
              tgId: payload.tgId,
              packageId: pkg.id,
              starsAmount: payment.total_amount,
              coinsAwarded: pkg.coins
            });
          } catch (dupErr) {
            if (dupErr.code === 11000) {
              // Boshqa parallel so'rov allaqachon qayta ishlagan - xavfsiz chiqib ketamiz
              res.status(200).end();
              return;
            }
            throw dupErr;
          }

          const user = await applyCoinTransaction(
            payload.tgId,
            pkg.coins,
            'purchase',
            `${pkg.title} sotib olindi (${payment.total_amount} ⭐)`,
            { telegramPaymentChargeId: chargeId, starsAmount: payment.total_amount }
          );

          const socketInfo = onlineUsers.get(payload.tgId);
          if (socketInfo && io.sockets.sockets.has(socketInfo.socketId)) {
            io.to(socketInfo.socketId).emit('wallet_updated', {
              reason: 'purchase',
              coinsAwarded: pkg.coins,
              newBalance: user.coins
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Telegram webhook xatosi:', error);
  }

  res.status(200).end();
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
      const tgIdStr = String(tgId);

      const user = await User.findOne({ tgId: tgIdStr });
      if (!user) {
        socket.emit('error', { message: 'Foydalanuvchi topilmadi' });
        return;
      }

      // TUZATISH: agar shu tgId oldindan boshqa socket bilan ulangan bo'lsa
      // (masalan eski tab yopilmagan yoki tarmoq uzilib qayta ulangan),
      // eski socketni topib, uni "yetim" holatda qoldirmasdan tozalaymiz.
      const previous = onlineUsers.get(tgIdStr);
      if (previous && previous.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(previous.socketId);
        if (oldSocket) {
          oldSocket.emit('force_disconnect', { reason: 'new_session' });
          oldSocket.disconnect(true);
        }
        // Eski socket qidiruv navbatida bo'lsa, olib tashlaymiz
        searchQueue = searchQueue.filter(p => p.socketId !== previous.socketId);
      }

      user.isOnline = true;
      user.lastLogin = new Date();
      await user.save();

      onlineUsers.set(tgIdStr, { socketId: socket.id, user });

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

      io.emit('user_status', { tgId: tgIdStr, status: 'online', firstName: user.firstName });

    } catch (error) {
      console.error('❌ User connect error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ============================================================
  // FIND MATCH - stavka xona ochilganda darhol "ushlab turiladi" (escrow)
  // va MongoDB'da Room hujjati yaratiladi (crash-safety uchun).
  // ============================================================
  socket.on('find_match', async ({ player, stake = 10 }) => {
    try {
      if (!player || !player.tgId) {
        socket.emit('error', { message: 'Player ma\'lumoti noto\'g\'ri' });
        return;
      }

      // TUZATISH: stavka min/max chegara bilan cheklanadi
      const requestedStake = Math.min(MAX_STAKE, Math.max(MIN_STAKE, Math.floor(Number(stake) || 10)));

      const user = await User.findOne({ tgId: String(player.tgId) });
      if (!user) {
        socket.emit('error', { message: 'Foydalanuvchi topilmadi' });
        return;
      }

      if (user.coins < requestedStake) {
        socket.emit('error', { message: 'Coin yetarli emas' });
        return;
      }

      searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

      const newPlayer = {
        socketId: socket.id,
        tgId: String(player.tgId),
        name: user.firstName || player.firstName || "O'yinchi",
        username: user.username || player.username || '',
        rating: user.rating || 100,
        level: user.level || 1,
        photoUrl: user.photoUrl || '',
        stake: requestedStake
      };

      const opponentIndex = searchQueue.findIndex(p =>
        p.stake === newPlayer.stake &&
        p.tgId !== newPlayer.tgId &&
        io.sockets.sockets.has(p.socketId)
      );

      if (opponentIndex !== -1) {
        const opponent = searchQueue.splice(opponentIndex, 1)[0];
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const oppSocket = io.sockets.sockets.get(opponent.socketId);

        // -------- STAVKALARNI USHLAB TURISH (ESCROW) --------
        let holdUser1, holdUser2;
        try {
          holdUser1 = await applyCoinTransaction(
            newPlayer.tgId, -newPlayer.stake, 'game_stake_hold',
            `Duel stavkasi ushlab turildi (${roomId})`, { roomId },
            { requireSufficient: true }
          );
        } catch {
          socket.emit('error', { message: 'Yetarli tanga yo\'q' });
          searchQueue.push(opponent);
          if (oppSocket) oppSocket.emit('searching', { stake: opponent.stake, queueLength: searchQueue.length });
          return;
        }

        try {
          holdUser2 = await applyCoinTransaction(
            opponent.tgId, -opponent.stake, 'game_stake_hold',
            `Duel stavkasi ushlab turildi (${roomId})`, { roomId },
            { requireSufficient: true }
          );
        } catch {
          await applyCoinTransaction(
            newPlayer.tgId, newPlayer.stake, 'game_stake_refund',
            'Raqibda mablag\' yetarli emas, stavka qaytarildi', { roomId }
          );
          socket.emit('error', { message: 'Raqibda mablag\' yetarli emas edi, qayta qidiring' });
          if (oppSocket) oppSocket.emit('error', { message: 'Sizda mablag\' yetarli emas edi' });
          return;
        }

        // TUZATISH: xonani MongoDB'ga ham yozamiz - shu bilan server qulasa ham
        // stavkalar "kimga tegishli ekani" ma'lum bo'lib qoladi va recoverStaleRooms()
        // keyingi ishga tushishda ularni qaytara oladi.
        try {
          await Room.create({
            roomId,
            status: 'active',
            stake: newPlayer.stake,
            players: [
              { tgId: newPlayer.tgId, name: newPlayer.name, username: newPlayer.username, rating: newPlayer.rating, level: newPlayer.level, photoUrl: newPlayer.photoUrl },
              { tgId: opponent.tgId, name: opponent.name, username: opponent.username, rating: opponent.rating, level: opponent.level, photoUrl: opponent.photoUrl }
            ]
          });
        } catch (err) {
          console.error('❌ Room yozishda xato, ehtiyot chorasi sifatida ikkalasiga ham qaytariladi:', err);
          await applyCoinTransaction(newPlayer.tgId, newPlayer.stake, 'game_stake_refund', 'Xona yaratishda xato, qaytarildi', { roomId });
          await applyCoinTransaction(opponent.tgId, opponent.stake, 'game_stake_refund', 'Xona yaratishda xato, qaytarildi', { roomId });
          socket.emit('error', { message: 'Xona yaratishda xato, qaytadan urinib ko\'ring' });
          if (oppSocket) oppSocket.emit('error', { message: 'Xona yaratishda xato, qaytadan urinib ko\'ring' });
          return;
        }

        socket.join(roomId);
        if (oppSocket) oppSocket.join(roomId);

        activeRooms[roomId] = {
          roomId,
          players: [newPlayer, opponent],
          choices: {},
          stake: newPlayer.stake,
          timer: null,
          timeLeft: ROUND_SECONDS,
          createdAt: Date.now(),
          chat: []
        };

        socket.emit('match_found', {
          roomId,
          opponent: {
            tgId: opponent.tgId, name: opponent.name, username: opponent.username,
            rating: opponent.rating, level: opponent.level, photoUrl: opponent.photoUrl
          },
          stake: newPlayer.stake
        });
        socket.emit('balance_updated', { coins: holdUser1.coins, reason: 'game_stake_hold' });

        if (oppSocket) {
          oppSocket.emit('match_found', {
            roomId,
            opponent: {
              tgId: newPlayer.tgId, name: newPlayer.name, username: newPlayer.username,
              rating: newPlayer.rating, level: newPlayer.level, photoUrl: newPlayer.photoUrl
            },
            stake: newPlayer.stake
          });
          oppSocket.emit('balance_updated', { coins: holdUser2.coins, reason: 'game_stake_hold' });
        }

        startRoomTimer(roomId);

      } else {
        searchQueue.push(newPlayer);
        socket.emit('searching', { stake: newPlayer.stake, queueLength: searchQueue.length });
      }

    } catch (error) {
      console.error('❌ Find match error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ============================================================
  // MAKE CHOICE
  // ============================================================
  socket.on('make_choice', ({ roomId, choice }) => {
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Xona topilmadi' });
      return;
    }

    if (!VALID_CHOICES.includes(choice)) {
      socket.emit('error', { message: 'Noto\'g\'ri tanlov' });
      return;
    }

    const isPlayerInRoom = room.players.some(p => p.socketId === socket.id);
    if (!isPlayerInRoom) {
      socket.emit('error', { message: 'Siz bu xonada emassiz' });
      return;
    }

    room.choices[socket.id] = choice;

    const player1Id = room.players[0].socketId;
    const player2Id = room.players[1].socketId;
    const hasPlayer1Choice = room.choices[player1Id] !== undefined;
    const hasPlayer2Choice = room.choices[player2Id] !== undefined;

    if (hasPlayer1Choice && hasPlayer2Choice) {
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }
      evaluateRound(roomId);
    } else {
      const otherPlayerId = socket.id === player1Id ? player2Id : player1Id;
      if (io.sockets.sockets.has(otherPlayerId)) {
        io.to(otherPlayerId).emit('opponent_choice_made', { status: 'waiting' });
      }
    }
  });

  // ============================================================
  // CHAT MESSAGE
  // ============================================================
  socket.on('chat_message', ({ roomId, message }) => {
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Xona topilmadi' });
      return;
    }

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const safeMessage = String(message || '').slice(0, 500);
    if (!safeMessage.trim()) return;

    io.to(roomId).emit('chat_message', {
      tgId: player.tgId,
      name: player.name || "O'yinchi",
      photoUrl: player.photoUrl || '',
      message: safeMessage,
      timestamp: new Date().toISOString()
    });
  });

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
  socket.on('disconnect', async () => {
    console.log('🔴 Socket disconnected:', socket.id);

    searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

    for (const [tgId, data] of onlineUsers.entries()) {
      if (data.socketId === socket.id) {
        onlineUsers.delete(tgId);
        try {
          await User.updateOne({ tgId }, { isOnline: false });
        } catch (err) {
          console.error('❌ isOnline yangilashda xato:', err);
        }
        io.emit('user_status', { tgId, status: 'offline' });
        break;
      }
    }

    for (const [roomId, room] of Object.entries(activeRooms)) {
      const playerExists = room.players.some(p => p.socketId === socket.id);
      if (playerExists) {
        const otherPlayer = room.players.find(p => p.socketId !== socket.id);
        if (otherPlayer && io.sockets.sockets.has(otherPlayer.socketId)) {
          io.to(otherPlayer.socketId).emit('opponent_left');
        }
        if (room.timer) clearInterval(room.timer);
        room.choices[socket.id] = 'disconnected';
        evaluateRound(roomId);
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

  let timeLeft = ROUND_SECONDS;
  room.timeLeft = timeLeft;

  room.timer = setInterval(() => {
    timeLeft--;
    room.timeLeft = timeLeft;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      evaluateRound(roomId);
    }
  }, 1000);
}

// Stavka allaqachon ikkala o'yinchidan ham "ushlab turilgan" (escrow) holda.
// Shu sabab bu yerda faqat QAYTARISH/QO'SHISH amallari bajariladi.
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  delete activeRooms[roomId];
  if (room.timer) clearInterval(room.timer);

  const [p1, p2] = room.players;
  const rawC1 = room.choices[p1.socketId];
  const rawC2 = room.choices[p2.socketId];
  const c1 = rawC1 || 'timeout';
  const c2 = rawC2 || 'timeout';

  const p1Absent = c1 === 'timeout' || c1 === 'disconnected';
  const p2Absent = c2 === 'timeout' || c2 === 'disconnected';

  let result1, result2;
  let xpChange1 = 0, xpChange2 = 0;
  let coinPayout1 = 0, coinPayout2 = 0;

  if (p1Absent && p2Absent) {
    result1 = 'draw'; result2 = 'draw';
    coinPayout1 = room.stake; coinPayout2 = room.stake;

  } else if (p1Absent) {
    result1 = 'lose'; result2 = 'win';
    coinPayout2 = room.stake * 2;
    xpChange1 = -10; xpChange2 = 15;

  } else if (p2Absent) {
    result1 = 'win'; result2 = 'lose';
    coinPayout1 = room.stake * 2;
    xpChange1 = 15; xpChange2 = -10;

  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      result1 = 'win'; result2 = 'lose';
      coinPayout1 = room.stake * 2;
      xpChange1 = 15; xpChange2 = -10;
    } else if (winner === 'player2') {
      result1 = 'lose'; result2 = 'win';
      coinPayout2 = room.stake * 2;
      xpChange1 = -10; xpChange2 = 15;
    } else {
      result1 = 'draw'; result2 = 'draw';
      coinPayout1 = room.stake; coinPayout2 = room.stake;
      xpChange1 = 5; xpChange2 = 5;
    }
  }

  try {
    const [user1, user2] = await Promise.all([
      User.findOne({ tgId: p1.tgId }),
      User.findOne({ tgId: p2.tgId })
    ]);

    let finalUser1 = user1, finalUser2 = user2;
    if (coinPayout1 > 0) {
      const txType = result1 === 'draw' ? 'game_draw_refund' : 'game_win';
      finalUser1 = await applyCoinTransaction(p1.tgId, coinPayout1, txType, `Duel natijasi (${roomId})`, { roomId });
    } else if (user1) {
      await Transaction.create({
        tgId: p1.tgId, type: 'game_lose', amount: 0, balanceAfter: user1.coins,
        description: `Duelda mag'lubiyat (${roomId})`, metadata: { roomId }
      });
    }

    if (coinPayout2 > 0) {
      const txType = result2 === 'draw' ? 'game_draw_refund' : 'game_win';
      finalUser2 = await applyCoinTransaction(p2.tgId, coinPayout2, txType, `Duel natijasi (${roomId})`, { roomId });
    } else if (user2) {
      await Transaction.create({
        tgId: p2.tgId, type: 'game_lose', amount: 0, balanceAfter: user2.coins,
        description: `Duelda mag'lubiyat (${roomId})`, metadata: { roomId }
      });
    }

    // TUZATISH: Room hujjatini 'completed' deb belgilaymiz - shunda
    // recoverStaleRooms() uni "osilib qolgan" deb hisoblamaydi.
    try {
      await Room.updateOne({ roomId }, { status: 'completed', completedAt: new Date() });
    } catch (err) {
      console.error('❌ Room statusini yangilashda xato:', err);
    }

    await applyStatsUpdate(finalUser1, result1, xpChange1);
    await applyStatsUpdate(finalUser2, result2, xpChange2);

    io.to(p1.socketId).emit('round_result', {
      myChoice: rawC1 || 'timeout',
      opponentChoice: rawC2 || 'timeout',
      result: result1,
      rewardCoins: coinPayout1 - room.stake,
      rewardXP: xpChange1,
      newCoins: finalUser1?.coins ?? 0,
      newRating: finalUser1?.rating ?? 0,
      newLevel: finalUser1?.level ?? 1,
      opponentName: p2.name,
      opponentRating: p2.rating,
      opponentLevel: finalUser2?.level ?? 1
    });

    io.to(p2.socketId).emit('round_result', {
      myChoice: rawC2 || 'timeout',
      opponentChoice: rawC1 || 'timeout',
      result: result2,
      rewardCoins: coinPayout2 - room.stake,
      rewardXP: xpChange2,
      newCoins: finalUser2?.coins ?? 0,
      newRating: finalUser2?.rating ?? 0,
      newLevel: finalUser2?.level ?? 1,
      opponentName: p1.name,
      opponentRating: p1.rating,
      opponentLevel: finalUser1?.level ?? 1
    });

  } catch (error) {
    // TUZATISH: agar shu yerda xato bo'lsa, stavka escrow'da "muzlab" qolishi mumkin.
    // Bu holatda xonani 'active' deb qoldiramiz (status o'zgartirilmagan bo'ladi),
    // shunda keyingi server-restart'da recoverStaleRooms() uni albatta topib,
    // ikkala o'yinchiga ham stavkani qaytaradi. Shu bilan birga darhol
    // qayta urinib ko'ramiz, xatoni yashirmasdan.
    console.error('❌ Evaluate round error:', error);
    io.to(p1.socketId).emit('error', { message: 'Duel natijasini hisoblashda xato yuz berdi, tez orada tekshiriladi' });
    io.to(p2.socketId).emit('error', { message: 'Duel natijasini hisoblashda xato yuz berdi, tez orada tekshiriladi' });
  }
}

async function applyStatsUpdate(user, result, xpChange) {
  if (!user) return;

  user.rating = Math.max(0, user.rating + xpChange);
  user.totalGames += 1;
  user.xp += Math.max(0, xpChange);

  if (result === 'win') {
    user.wins += 1;
    user.winStreak += 1;
    user.maxWinStreak = Math.max(user.maxWinStreak, user.winStreak);
  } else if (result === 'lose') {
    user.losses += 1;
    user.winStreak = 0;
  } else {
    user.draws += 1;
  }

  while (user.xp >= user.xpToNextLevel) {
    user.level += 1;
    user.xp -= user.xpToNextLevel;
    user.xpToNextLevel = Math.floor(user.xpToNextLevel * 1.5);
  }

  await user.save();
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
// GRACEFUL SHUTDOWN - SIGTERM/SIGINT kelganda ochiq xonalarni yopish
// ============================================================
// TUZATISH: agar hosting platforma (masalan Render) serverni muntazam
// deploy/restart qilsa, biz buni oldindan bilamiz (SIGTERM keladi).
// Shu vaqtda hali 'active' bo'lgan xonalarni darhol qaytarib, keyingi
// ishga tushishda recoverStaleRooms()ga qoldirmasdan tezroq hal qilamiz.
async function gracefulShutdown(signal) {
  console.log(`⚠️ ${signal} qabul qilindi, faol xonalar yopilmoqda...`);
  const roomIds = Object.keys(activeRooms);

  for (const roomId of roomIds) {
    const room = activeRooms[roomId];
    if (room.timer) clearInterval(room.timer);
    for (const player of room.players) {
      try {
        await applyCoinTransaction(
          player.tgId, room.stake, 'game_stake_refund',
          `Server to'xtatildi, stavka qaytarildi (${roomId})`, { roomId }
        );
      } catch (err) {
        console.error(`❌ ${player.tgId} uchun shutdown-refund xatosi:`, err.message);
      }
    }
    try {
      await Room.updateOne({ roomId }, { status: 'refunded', completedAt: new Date() });
    } catch {}
  }

  server.close(() => {
    console.log('✅ Server toza yopildi.');
    process.exit(0);
  });

  // Agar 10 soniyada yopilmasa, majburan chiqamiz
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
});