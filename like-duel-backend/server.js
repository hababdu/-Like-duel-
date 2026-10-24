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
//  8. YANGI: Duel endi bitta raund bilan tugamaydi - o'yinchilar "Chiqish"
//     tugmasini bosmaguncha (yoki ulanish uzilmaguncha) raundlar avtomatik
//     davom etadi. Har bir yangi raund uchun stavka qaytadan "ushlab olinadi".
//  9. YANGI: Chat endi butun duel (barcha raundlar) davomida ishlaydi, chunki
//     xona endi har bir raunddan keyin o'chirilmaydi.
// ============================================================
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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
  ALLOWED_ORIGIN = '',
  JWT_SECRET = '',              // Ilova (Google/Apple) kirishi uchun sessiya tokeni imzosi
  GOOGLE_CLIENT_IDS = '',       // Google OAuth client ID'lar (vergul bilan): web client ID majburiy
  APPLE_CLIENT_ID = '',         // Apple: iOS bundle ID (uz.likeduel.app)
  CLICK_SERVICE_ID = '',        // Click Shop API
  CLICK_MERCHANT_ID = '',
  CLICK_SECRET_KEY = '',
  CLICK_RETURN_URL = ''         // To'lovdan keyin qaytish manzili (ixtiyoriy)
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
  startupErrors.push('TELEGRAM_BOT_TOKEN o\'rnatilmagan. Telegram auth ishlamaydi.');
}
if (!ADMIN_TOKEN) {
  startupErrors.push('ADMIN_TOKEN o\'rnatilmagan. Xavfsizlik uchun bu MAJBURIY (default qiymat endi yo\'q).');
}
if (!JWT_SECRET) {
  // Server yiqilmasin (Telegram o'yini ishlayversin); ilova orqali kirish 503 qaytaradi
  console.warn('⚠️ JWT_SECRET o\'rnatilmagan: Google/Apple orqali kirish o\'chiq.');
}
if (!GOOGLE_CLIENT_IDS) console.warn('⚠️ GOOGLE_CLIENT_IDS o\'rnatilmagan: Google kirish ishlamaydi.');
if (IS_PRODUCTION && !ALLOWED_ORIGIN) {
  startupErrors.push('Production rejimida ALLOWED_ORIGIN majburiy (CORS uchun aniq domenlar kerak).');
}

if (startupErrors.length > 0) {
  console.error('❌ SERVER ISHGA TUSHMADI - quyidagi muammolarni hal qiling:');
  startupErrors.forEach(err => console.error('   - ' + err));
  process.exit(1);
}

// ======================
// CORS
// ======================
function normalizeOrigin(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();
}

const allowedOriginsList = ALLOWED_ORIGIN
  ? ALLOWED_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'].map(normalizeOrigin);

// Capacitor (Android/iOS) ilovasining ichki originlari - doim ruxsat etiladi.
// Xavfsizlik originga emas, token/imzoga tayanadi.
['https://localhost', 'http://localhost', 'http://localhost:38123', 'capacitor://localhost', 'ionic://localhost']
  .forEach((o) => { if (!allowedOriginsList.includes(o)) allowedOriginsList.push(o); });

console.log('🔧 Ruxsat etilgan originlar:', allowedOriginsList);

const corsOptions = {
  origin: (requestOrigin, callback) => {
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

app.set('trust proxy', 1); // Render/Proxy orqasida haqiqiy IP olish uchun
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// SOCKET.IO
// ======================
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Har bir socket ulanishi Telegram initData imzosi bilan tasdiqlanadi.
// tgId endi mijozdan emas, SERVER tasdiqlagan ma'lumotdan olinadi.
io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  const verified = verifyTelegramInitData(auth.initData) || verifyAppToken(auth.token);
  if (!verified?.id) return next(new Error('unauthorized'));
  socket.data.tgId = String(verified.id);
  next();
});

// ======================
// MONGODB CONNECTION
// ======================
mongoose.connect(process.env.MONGODB_URI, {
  family: 4,
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err.message));



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

  // Bot o'yini (server hisoblaydi)
  botStreak: { type: Number, default: 0 },
  botDay: { type: String, default: '' },
  botEarned: { type: Number, default: 0 },

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
// IDENTITY SCHEMA (Google/Apple akkauntlari -> User.tgId ("app_..." ko'rinishida))
// ======================
const IdentitySchema = new mongoose.Schema({
  provider: { type: String, enum: ['google', 'apple'], required: true },
  subject: { type: String, required: true },   // provayderdagi doimiy foydalanuvchi ID (sub)
  email: { type: String, default: '' },
  tgId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});
IdentitySchema.index({ provider: 1, subject: 1 }, { unique: true });
const Identity = mongoose.model('Identity', IdentitySchema);

// ======================
// ORDER SCHEMA (Click orqali tanga sotib olish buyurtmalari)
// ======================
const OrderSchema = new mongoose.Schema({
  tgId: { type: String, required: true, index: true },
  packageId: { type: String, required: true },
  coins: { type: Number, required: true },
  amount: { type: Number, required: true },    // so'mda
  status: { type: String, enum: ['created', 'prepared', 'paid', 'cancelled'], default: 'created' },
  clickTransId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null }
});
const Order = mongoose.model('Order', OrderSchema);

// ======================
// TRANSACTION SCHEMA (HAMYON TARIXI / LEDGER)
// ======================
const TransactionSchema = new mongoose.Schema({
  tgId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'signup_bonus',
      'referral_bonus',
      'game_stake_hold',
      'game_stake_refund',
      'game_win',
      'game_lose',
      'game_draw_refund',
      'purchase',
      'bot_game',
      'admin_adjust'
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
// ROOM SCHEMA
// ======================
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
// activeRooms[roomId] = {
//   roomId, players: [p1, p2], choices, stake,
//   timer, timeLeft, chat, roundNumber, sessionEnded
// }
let activeRooms = {};
let onlineUsers = new Map();

const VALID_CHOICES = ['rock', 'paper', 'scissors'];
const ROUND_SECONDS = 30;
const REFERRAL_BONUS = 50;
const SIGNUP_BONUS = 100;
const MIN_STAKE = 1;
const MAX_STAKE = 100000;
const ABSENT_STATES = ['timeout', 'disconnected', 'left'];

// Narxlar so'mda (UZS). Xohlagancha o'zgartiring.
const COIN_PACKAGES = [
  { id: 'pack_100', coins: 100, price: 10000, title: '100 🪙 Tanga' },
  { id: 'pack_500', coins: 500, price: 40000, title: '500 🪙 Tanga' },
  { id: 'pack_1200', coins: 1200, price: 80000, title: '1200 🪙 Tanga (+200 bonus)' },
  { id: 'pack_3000', coins: 3000, price: 180000, title: '3000 🪙 Tanga (+600 bonus)' }
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
// STAVKANI IKKALA O'YINCHIDAN USHLAB OLISH (ESCROW)
// Bitta raund uchun ham, davom etayotgan duel'dagi keyingi
// raundlar uchun ham shu funksiya qayta ishlatiladi.
// ============================================================
async function holdStakeForBothPlayers(p1, p2, stake, roomId) {
  let holdUser1;
  try {
    holdUser1 = await applyCoinTransaction(
      p1.tgId, -stake, 'game_stake_hold',
      `Duel stavkasi ushlab turildi (${roomId})`, { roomId },
      { requireSufficient: true }
    );
  } catch {
    return { success: false, failedTgId: p1.tgId };
  }

  let holdUser2;
  try {
    holdUser2 = await applyCoinTransaction(
      p2.tgId, -stake, 'game_stake_hold',
      `Duel stavkasi ushlab turildi (${roomId})`, { roomId },
      { requireSufficient: true }
    );
  } catch {
    // p1'ning ushlab turilgan tangasini darhol qaytaramiz
    await applyCoinTransaction(
      p1.tgId, stake, 'game_stake_refund',
      'Raqibda mablag\' yetarli emas, stavka qaytarildi', { roomId }
    );
    return { success: false, failedTgId: p2.tgId };
  }

  return { success: true, holdUser1, holdUser2 };
}

// ============================================================
// SERVER TIKLANGANDA - "OSILIB QOLGAN" XONALARNI QAYTARISH
// ============================================================
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

// ============================================================
// ILOVA TOKENI (email/parol bilan kirgan foydalanuvchilar uchun JWT)
// ============================================================
function verifyAppToken(token) {
  if (!JWT_SECRET || !token) return null;
  try {
    const payload = jwt.verify(String(token), JWT_SECRET, { algorithms: ['HS256'] });
    return payload?.sub ? { id: String(payload.sub) } : null;
  } catch {
    return null;
  }
}

function signAppToken(tgId) {
  return jwt.sign({ sub: String(tgId) }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

function bearerToken(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// Telegram initData YOKI ilova tokeni - ikkalasi ham req.telegramUser.id ni beradi
function requireTelegramAuth(req, res, next) {
  const initData = req.body?.initData || req.headers['x-telegram-init-data'];
  const verifiedUser = verifyTelegramInitData(initData) || verifyAppToken(bearerToken(req));

  if (!verifiedUser) {
    return res.status(401).json({
      success: false,
      message: 'Autentifikatsiya muvaffaqiyatsiz'
    });
  }

  req.telegramUser = verifiedUser;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
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
// TEZLIK CHEKLOVI (tashqi paketsiz, xotirada)
// ======================
function makeLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset <= now) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    return e.count <= max;
  };
}
const httpLimit = makeLimiter({ windowMs: 60_000, max: 120 });
const authLimit = makeLimiter({ windowMs: 60_000, max: 20 });

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/click/')) return next(); // Click serveri cheklanmaydi
  const isAuthPath = req.path === '/user/auth' || req.path === '/auth/google' || req.path === '/auth/apple';
  const allowed = (isAuthPath ? authLimit : httpLimit)(req.ip);
  if (!allowed) return res.status(429).json({ success: false, message: 'Juda ko\'p so\'rov. Biroz kuting.' });
  next();
});

// Socket hodisalari uchun cheklov: bitta ulanish, bitta hodisa turi
function socketAllow(socket, event, max, windowMs) {
  const rl = (socket.data.rl ||= {});
  const now = Date.now();
  let e = rl[event];
  if (!e || e.reset <= now) e = rl[event] = { count: 0, reset: now + windowMs };
  e.count++;
  return e.count <= max;
}

// Faqat o'z ma'lumotini ko'ra oladi (initData dagi id == URL dagi tgId)
function requireSelf(req, res, next) {
  if (String(req.telegramUser?.id) !== String(req.params.tgId)) {
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
// ADMIN PANEL - TO'LIQ NAZORAT
// ======================
// BOT BILAN O'YIN (mukofot va natija FAQAT serverda hisoblanadi)
// ======================
const BOT_REWARDS = { easy: 40, medium: 70, hard: 110 };
const BOT_DRAW = 10;
const BOT_LOSE = -20;
const BOT_TIMEOUT = -10;
const BOT_MIN_COINS = 10;
const BOT_DAILY_CAP = Number(process.env.BOT_DAILY_COIN_CAP) || 300; // kuniga ko'pi bilan shuncha tanga YUTILADI
const BOT_COOLDOWN_MS = 700;
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
const botHistory = new Map(); // tgId -> oxirgi tanlovlar
const botLast = new Map();    // tgId -> oxirgi so'rov vaqti

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, t] of botLast) if (t < cutoff) { botLast.delete(id); botHistory.delete(id); }
}, 10 * 60 * 1000).unref();

function pickBotChoice(difficulty, history) {
  const random = VALID_CHOICES[Math.floor(Math.random() * VALID_CHOICES.length)];
  if (difficulty === 'easy' || history.length < 3) return random;
  // o'yinchining eng ko'p tanlagan shaklini topib, unga qarshisini tanlaydi
  const counts = history.reduce((a, c) => { a[c] = (a[c] || 0) + 1; return a; }, {});
  const favorite = Object.keys(counts).reduce((a, b) => (counts[a] >= counts[b] ? a : b));
  const chance = difficulty === 'hard' ? 0.55 : 0.35;
  return Math.random() < chance ? COUNTER[favorite] : random;
}

function judgeBot(player, bot) {
  if (player === bot) return 'draw';
  return COUNTER[bot] === player ? 'win' : 'lose'; // COUNTER[bot] - botni yutadigan shakl
}

async function applyBotDelta(user, delta, newStreak, type, description, metadata) {
  const day = new Date().toISOString().slice(0, 10);
  let earned = user.botDay === day ? (user.botEarned || 0) : 0;
  let capReached = false;
  if (delta > 0) {
    const room = Math.max(0, BOT_DAILY_CAP - earned);
    if (delta > room) { delta = room; capReached = true; }
    earned += delta;
  }
  const after = await User.findOneAndUpdate(
    { tgId: user.tgId },
    [{ $set: { coins: { $max: [0, { $add: ['$coins', delta] }] }, botStreak: newStreak, botDay: day, botEarned: earned } }],
    { new: true }
  );
  const change = after.coins - user.coins;
  if (change !== 0) {
    await Transaction.create({ tgId: user.tgId, type, amount: change, balanceAfter: after.coins, description, metadata });
  }
  return { after, change, capReached };
}

function botCooldown(tgId) {
  const now = Date.now();
  if (now - (botLast.get(tgId) || 0) < BOT_COOLDOWN_MS) return false;
  botLast.set(tgId, now);
  return true;
}

app.post('/api/bot/play', requireTelegramAuth, async (req, res) => {
  try {
    const tgId = String(req.telegramUser.id);
    const { choice, difficulty } = req.body || {};
    if (!VALID_CHOICES.includes(choice) || !BOT_REWARDS[difficulty]) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri so\'rov' });
    }
    if (!botCooldown(tgId)) {
      return res.status(429).json({ success: false, message: 'Biroz kuting' });
    }
    const user = await User.findOne({ tgId });
    if (!user) return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    if (user.coins < BOT_MIN_COINS) {
      return res.status(400).json({ success: false, message: `Bot o'ynash uchun ${BOT_MIN_COINS} tanga kerak` });
    }

    const history = botHistory.get(tgId) || [];
    const botChoice = pickBotChoice(difficulty, history);
    history.push(choice);
    if (history.length > 10) history.shift();
    botHistory.set(tgId, history);

    const result = judgeBot(choice, botChoice);
    const prevStreak = user.botStreak || 0;
    let combo = 0, delta;
    if (result === 'win') {
      combo = prevStreak >= 2 ? (prevStreak - 1) * 10 : 0;
      delta = BOT_REWARDS[difficulty] + combo;
    } else {
      delta = result === 'draw' ? BOT_DRAW : BOT_LOSE;
    }
    const newStreak = result === 'win' ? prevStreak + 1 : result === 'lose' ? 0 : prevStreak;

    const { after, change, capReached } = await applyBotDelta(
      user, delta, newStreak, 'bot_game', `Bot (${difficulty}): ${result}`, { difficulty, choice, botChoice, result }
    );
    res.json({ success: true, botChoice, result, change, combo, coins: after.coins, streak: after.botStreak, capReached });
  } catch (error) {
    console.error('❌ Bot play xatosi:', error);
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

app.post('/api/bot/timeout', requireTelegramAuth, async (req, res) => {
  try {
    const tgId = String(req.telegramUser.id);
    if (!botCooldown(tgId)) return res.status(429).json({ success: false, message: 'Biroz kuting' });
    const user = await User.findOne({ tgId });
    if (!user) return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    const { after, change } = await applyBotDelta(user, BOT_TIMEOUT, 0, 'bot_game', 'Bot: vaqt tugadi', { result: 'timeout' });
    res.json({ success: true, change, coins: after.coins, streak: 0 });
  } catch (error) {
    console.error('❌ Bot timeout xatosi:', error);
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// ============================================================

// Barcha foydalanuvchilar (qidiruv + pagination)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const search = (req.query.search || '').trim();
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { tgId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ lastLogin: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bitta foydalanuvchi to'liq ma'lumot
app.get('/api/admin/user/:tgId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    if (!user) return res.status(404).json({ success: false, message: 'Topilmadi' });

    const lastTx = await Transaction.find({ tgId: user.tgId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, user, recentTransactions: lastTx });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Faol xonalar (runtime + MongoDB)
app.get('/api/admin/rooms', requireAdmin, async (req, res) => {
  try {
    const dbRooms = await Room.find({ status: 'active' }).sort({ createdAt: -1 });
    const runtimeRooms = Object.values(activeRooms).map(r => ({
      roomId: r.roomId,
      stake: r.stake,
      roundNumber: r.roundNumber,
      timeLeft: r.timeLeft,
      sessionEnded: r.sessionEnded,
      players: r.players.map(p => ({
        tgId: p.tgId,
        name: p.name,
        socketId: p.socketId,
        isConnected: io.sockets.sockets.has(p.socketId)
      })),
      choices: r.choices
    }));

    res.json({
      success: true,
      dbActiveRooms: dbRooms,
      runtimeRooms,
      searchQueueLength: searchQueue.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Xonani majburiy yopish + stavkalarni qaytarish
app.post('/api/admin/rooms/:roomId/force-close', requireAdmin, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = activeRooms[roomId];

    if (room) {
      if (room.timer) clearInterval(room.timer);

      for (const p of room.players) {
        try {
          await applyCoinTransaction(
            p.tgId,
            room.stake,
            'game_stake_refund',
            `Admin tomonidan majburiy yopildi (${roomId})`,
            { roomId, adminForce: true }
          );
        } catch (e) {
          console.error('Force close refund error:', e.message);
        }
      }
      delete activeRooms[roomId];
    }

    await Room.updateOne(
      { roomId },
      { status: 'refunded', completedAt: new Date() }
    );

    // O'yinchilarga xabar
    if (room) {
      for (const p of room.players) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) {
          s.emit('duel_ended', { reason: 'admin_force_close' });
          s.leave(roomId);
        }
      }
    }

    res.json({ success: true, message: 'Xona yopildi va stavkalar qaytarildi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Qidiruv navbatini tozalash
app.post('/api/admin/clear-queue', requireAdmin, (req, res) => {
  const count = searchQueue.length;
  searchQueue = [];
  res.json({ success: true, cleared: count });
});

// Online foydalanuvchilar
app.get('/api/admin/online', requireAdmin, (req, res) => {
  const list = [];
  for (const [tgId, data] of onlineUsers.entries()) {
    list.push({
      tgId,
      socketId: data.socketId,
      name: data.user?.firstName,
      username: data.user?.username,
      isSocketAlive: io.sockets.sockets.has(data.socketId)
    });
  }
  res.json({ success: true, online: list, count: list.length });
});

// Tranzaksiyalar (so'nggi)
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const type = req.query.type || null;

    const filter = type ? { type } : {};
    const txs = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, transactions: txs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Foydalanuvchini to'liq o'chirish (ixtiyoriy, ehtiyotkorlik bilan)
app.delete('/api/admin/user/:tgId', requireAdmin, async (req, res) => {
  try {
    const { tgId } = req.params;
    await User.deleteOne({ tgId });
    await Identity.deleteMany({ tgId });
    await Transaction.deleteMany({ tgId });
    onlineUsers.delete(tgId);
    res.json({ success: true, message: 'Foydalanuvchi o\'chirildi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 0. ILOVA AUTH (Google / Apple)

function appUserPayload(user) {
  return {
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
  };
}

function requireAppAuthEnabled(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, message: 'Ilova orqali kirish serverda yoqilmagan (JWT_SECRET)' });
  }
  next();
}

const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

async function verifyProviderToken(provider, idToken) {
  if (provider === 'google') {
    const audience = GOOGLE_CLIENT_IDS.split(',').map(x => x.trim()).filter(Boolean);
    if (!audience.length) throw new Error('GOOGLE_CLIENT_IDS sozlanmagan');
    const { payload } = await jwtVerify(idToken, googleJWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience
    });
    return payload;
  }
  if (provider === 'apple') {
    if (!APPLE_CLIENT_ID) throw new Error('APPLE_CLIENT_ID sozlanmagan');
    const { payload } = await jwtVerify(idToken, appleJWKS, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_CLIENT_ID
    });
    return payload;
  }
  throw new Error('Noma\'lum provayder');
}

function socialLoginHandler(provider) {
  return async (req, res) => {
    try {
      const idToken = String(req.body?.idToken || '');
      if (!idToken) return res.status(400).json({ success: false, message: 'idToken kerak' });

      let claims;
      try {
        claims = await verifyProviderToken(provider, idToken);
      } catch (err) {
        console.warn(`⚠️ ${provider} token rad etildi:`, err.message);
        return res.status(401).json({ success: false, message: 'Kirish tasdiqlanmadi' });
      }
      const subject = String(claims.sub || '');
      if (!subject) return res.status(401).json({ success: false, message: 'Kirish tasdiqlanmadi' });

      let identity = await Identity.findOne({ provider, subject });
      let tgId;
      if (identity) {
        tgId = identity.tgId;
        const existing = await User.findOne({ tgId });
        if (!existing) { // akkaunt o'chirilgan - qayta ro'yxatdan o'tkazamiz
          await Identity.deleteOne({ _id: identity._id });
          identity = null;
        }
      }
      if (!identity) {
        const firstName = String(req.body?.firstName || claims.given_name || claims.name || '').trim().slice(0, 32)
          || String(claims.email || '').split('@')[0].slice(0, 32) || 'Player';
        tgId = `app_${crypto.randomBytes(8).toString('hex')}`;
        try {
          await Identity.create({ provider, subject, email: String(claims.email || ''), tgId });
        } catch (e) {
          if (e?.code === 11000) { // parallel so'rov yaratib bo'ldi
            identity = await Identity.findOne({ provider, subject });
            tgId = identity.tgId;
          } else throw e;
        }
        if (!identity) {
          await User.create({
            tgId,
            firstName,
            photoUrl: provider === 'google' ? String(claims.picture || '') : ''
          });
          await applyCoinTransaction(tgId, SIGNUP_BONUS, 'signup_bonus', "Ro'yxatdan o'tish bonusi");
        }
      }

      const user = await User.findOne({ tgId });
      user.lastLogin = new Date();
      await user.save();
      res.json({ success: true, token: signAppToken(tgId), user: appUserPayload(user) });
    } catch (error) {
      console.error(`❌ ${provider} login error:`, error);
      res.status(500).json({ success: false, message: 'Server xatoligi' });
    }
  };
}

app.post('/api/auth/google', requireAppAuthEnabled, socialLoginHandler('google'));
app.post('/api/auth/apple', requireAppAuthEnabled, socialLoginHandler('apple'));

// Akkauntni o'chirish (App Store talabi). Faqat ilova akkauntlari uchun.
app.delete('/api/auth/account', requireAppAuthEnabled, requireTelegramAuth, async (req, res) => {
  try {
    const tgId = String(req.telegramUser.id);
    if (!tgId.startsWith('app_')) {
      return res.status(400).json({ success: false, message: "Telegram akkauntini bu yerdan o'chirib bo'lmaydi" });
    }
    await Identity.deleteMany({ tgId });
    await User.deleteOne({ tgId });
    await Transaction.deleteMany({ tgId });
    onlineUsers.delete(tgId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete account error:', error);
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// 1. USER AUTH
app.post('/api/user/auth', requireTelegramAuth, async (req, res) => {
  try {
    const verified = req.telegramUser;
    const tgId = String(verified.id);
    const { refParent } = req.body;

    console.log('📥 Auth request:', { tgId, username: verified.username });

    let user = await User.findOne({ tgId });

    // Ilova akkaunti o'chirilgan bo'lsa, eski token bilan qayta yaratilmasin
    if (!user && tgId.startsWith('app_')) {
      return res.status(401).json({ success: false, message: 'Akkaunt topilmadi' });
    }

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

// 2. GET USER PROFILE
app.get('/api/user/:tgId', requireTelegramAuth, requireSelf, async (req, res) => {
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

// 3. WALLET
app.get('/api/user/:tgId/wallet', requireTelegramAuth, requireSelf, async (req, res) => {
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

// 4. ADMIN - qo'lda tanga tuzatish
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

// 5. ADMIN - ekonomika statistikasi
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

// 6. LEADERBOARD
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

// 7. REFERRALS
app.get('/api/user/:tgId/referrals', requireTelegramAuth, requireSelf, async (req, res) => {
  try {
    const referrals = await User.find({ refParent: req.params.tgId })
      .select('firstName username coins rating createdAt');

    res.json({ success: true, referrals, count: referrals.length, bonusPerReferral: REFERRAL_BONUS });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// 8. GAME STATS
app.get('/api/user/:tgId/stats', requireTelegramAuth, requireSelf, async (req, res) => {
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

// 9. SHOP (Click orqali karta to'lovi)
const clickEnabled = () => !!(CLICK_SERVICE_ID && CLICK_MERCHANT_ID && CLICK_SECRET_KEY);
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

app.get('/api/shop/packages', (req, res) => {
  res.json({ success: true, packages: COIN_PACKAGES, paymentsEnabled: clickEnabled() });
});

// Buyurtma yaratadi va Click to'lov sahifasi havolasini qaytaradi
app.post('/api/shop/click/create', requireTelegramAuth, async (req, res) => {
  try {
    if (!clickEnabled()) {
      return res.status(503).json({ success: false, message: "To'lov tizimi hozircha yoqilmagan" });
    }
    const tgId = String(req.telegramUser.id);
    const pkg = COIN_PACKAGES.find(p => p.id === req.body?.packageId);
    if (!pkg) return res.status(400).json({ success: false, message: 'Nomalum paket' });

    const order = await Order.create({ tgId, packageId: pkg.id, coins: pkg.coins, amount: pkg.price });
    const params = new URLSearchParams({
      service_id: CLICK_SERVICE_ID,
      merchant_id: CLICK_MERCHANT_ID,
      amount: String(pkg.price),
      transaction_param: String(order._id)
    });
    if (CLICK_RETURN_URL) params.set('return_url', CLICK_RETURN_URL);

    res.json({
      success: true,
      orderId: String(order._id),
      payUrl: `https://my.click.uz/services/pay?${params.toString()}`,
      package: pkg
    });
  } catch (error) {
    console.error('❌ Click create error:', error);
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// Buyurtma holati (mijoz to'lovdan qaytgach tekshiradi)
app.get('/api/shop/order/:id', requireTelegramAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false });
    const order = await Order.findOne({ _id: req.params.id, tgId: String(req.telegramUser.id) });
    if (!order) return res.status(404).json({ success: false });
    res.json({ success: true, status: order.status, coins: order.coins });
  } catch {
    res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
});

// --- Click Shop API (server-to-server): prepare va complete ---
function clickReply(res, body, error, note) {
  res.json({ ...body, error, error_note: note });
}

async function clickHandler(req, res, isComplete) {
  const b = req.body || {};
  const base = {
    click_trans_id: b.click_trans_id,
    merchant_trans_id: b.merchant_trans_id
  };
  try {
    if (!clickEnabled()) return clickReply(res, base, -8, 'Service disabled');

    const signString = isComplete
      ? `${b.click_trans_id}${b.service_id}${CLICK_SECRET_KEY}${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`
      : `${b.click_trans_id}${b.service_id}${CLICK_SECRET_KEY}${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`;
    const given = String(b.sign_string || '');
    const expected = md5(signString);
    const okSign = given.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!okSign || String(b.service_id) !== String(CLICK_SERVICE_ID)) {
      return clickReply(res, base, -1, 'SIGN CHECK FAILED!');
    }
    if (String(b.action) !== (isComplete ? '1' : '0')) {
      return clickReply(res, base, -3, 'Action not found');
    }
    if (!mongoose.isValidObjectId(b.merchant_trans_id)) {
      return clickReply(res, base, -5, 'Order not found');
    }

    const order = await Order.findById(b.merchant_trans_id);
    if (!order) return clickReply(res, base, -5, 'Order not found');
    if (Number(b.amount) !== order.amount) return clickReply(res, base, -2, 'Incorrect parameter amount');
    if (order.status === 'paid') return clickReply(res, base, -4, 'Already paid');
    if (order.status === 'cancelled') return clickReply(res, base, -9, 'Transaction cancelled');

    if (!isComplete) {
      order.status = 'prepared';
      order.clickTransId = String(b.click_trans_id);
      await order.save();
      return clickReply(res, { ...base, merchant_prepare_id: String(order._id) }, 0, 'Success');
    }

    // COMPLETE
    if (order.status !== 'prepared' || String(b.merchant_prepare_id) !== String(order._id)) {
      return clickReply(res, base, -6, 'Transaction not found');
    }
    if (Number(b.error) < 0) {
      await Order.updateOne({ _id: order._id, status: 'prepared' }, { status: 'cancelled' });
      return clickReply(res, { ...base, merchant_confirm_id: String(order._id) }, -9, 'Transaction cancelled');
    }

    // Atomik: faqat bir marta "paid" ga o'tadi (takroriy so'rovda tanga ikki marta berilmaydi)
    const paid = await Order.findOneAndUpdate(
      { _id: order._id, status: 'prepared' },
      { status: 'paid', paidAt: new Date() }
    );
    if (!paid) return clickReply(res, base, -4, 'Already paid');

    let user;
    try {
      user = await applyCoinTransaction(
        order.tgId, order.coins, 'purchase',
        `${order.coins} tanga sotib olindi (${order.amount} so'm)`,
        { orderId: String(order._id), clickTransId: String(b.click_trans_id), amount: order.amount }
      );
    } catch (e) {
      // Tanga berilmadi - buyurtmani qaytaramiz, Click qayta urinadi
      await Order.updateOne({ _id: order._id }, { status: 'prepared', paidAt: null });
      throw e;
    }
    const socketInfo = onlineUsers.get(order.tgId);
    if (socketInfo && io.sockets.sockets.has(socketInfo.socketId)) {
      io.to(socketInfo.socketId).emit('wallet_updated', {
        reason: 'purchase', coinsAwarded: order.coins, newBalance: user.coins
      });
    }
    return clickReply(res, { ...base, merchant_confirm_id: String(order._id) }, 0, 'Success');
  } catch (error) {
    console.error('❌ Click xatosi:', error);
    return clickReply(res, base, -7, 'Failed to update user');
  }
}

app.post('/api/click/prepare', (req, res) => clickHandler(req, res, false));
app.post('/api/click/complete', (req, res) => clickHandler(req, res, true));

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
      if (!socketAllow(socket, 'user_connect', 10, 10_000)) return;
      const tgId = socket.data.tgId; // mijoz yuborgan tgId e'tiborga olinmaydi
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

      const previous = onlineUsers.get(tgIdStr);
      if (previous && previous.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(previous.socketId);
        if (oldSocket) {
          oldSocket.emit('force_disconnect', { reason: 'new_session' });
          oldSocket.disconnect(true);
        }
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
  // va MongoDB'da Room hujjati yaratiladi.
  // ============================================================
  socket.on('find_match', async ({ player = {}, stake = 10 } = {}) => {
    try {
      if (!socketAllow(socket, 'find_match', 6, 10_000)) {
        socket.emit('error', { message: 'Juda tez-tez urinish. Biroz kuting.' });
        return;
      }
      if (!socket.data.tgId) {
        socket.emit('error', { message: 'Player ma\'lumoti noto\'g\'ri' });
        return;
      }

      const requestedStake = Math.min(MAX_STAKE, Math.max(MIN_STAKE, Math.floor(Number(stake) || 10)));

      const user = await User.findOne({ tgId: socket.data.tgId });
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
        tgId: socket.data.tgId,
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
        const hold = await holdStakeForBothPlayers(newPlayer, opponent, newPlayer.stake, roomId);
        if (!hold.success) {
          if (hold.failedTgId === newPlayer.tgId) {
            socket.emit('error', { message: 'Yetarli tanga yo\'q' });
            searchQueue.push(opponent);
            if (oppSocket) oppSocket.emit('searching', { stake: opponent.stake, queueLength: searchQueue.length });
          } else {
            socket.emit('error', { message: 'Raqibda mablag\' yetarli emas edi, qayta qidiring' });
            if (oppSocket) oppSocket.emit('error', { message: 'Sizda mablag\' yetarli emas edi' });
          }
          return;
        }
        const { holdUser1, holdUser2 } = hold;

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
          chat: [],
          roundNumber: 1,
          sessionEnded: false
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
  socket.on('make_choice', ({ roomId, choice } = {}) => {
    if (!socketAllow(socket, 'make_choice', 20, 10_000)) return;
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
  // LEAVE ROOM (YANGI) - o'yinchi "Chiqish" tugmasini bosganda
  // duel butunlay yakunlanadi. Agar joriy raund tugallanmagan bo'lsa,
  // chiqayotgan o'yinchi shu raundni yutqizgan hisoblanadi (vaqt
  // tugagandagi kabi), so'ng sessiya yopiladi va ortiqcha yangi
  // raund boshlanmaydi.
  // ============================================================
  socket.on('leave_room', ({ roomId }) => {
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('room_left', { roomId });
      return;
    }

    const isPlayerInRoom = room.players.some(p => p.socketId === socket.id);
    if (!isPlayerInRoom) return;

    room.sessionEnded = true;
    if (room.choices[socket.id] === undefined) {
      room.choices[socket.id] = 'left';
    }

    const otherPlayer = room.players.find(p => p.socketId !== socket.id);
    if (otherPlayer && io.sockets.sockets.has(otherPlayer.socketId)) {
      io.to(otherPlayer.socketId).emit('opponent_left_room');
    }

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    evaluateRound(roomId);
  });

  // ============================================================
  // CHAT MESSAGE - xona faol bo'lgan butun davr (barcha raundlar)
  // davomida ishlaydi, chunki xona endi raund tugashi bilan
  // o'chirilmaydi.
  // ============================================================
  socket.on('chat_message', ({ roomId, message } = {}) => {
    if (!socketAllow(socket, 'chat_message', 8, 10_000)) return;
    const room = activeRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Xona topilmadi' });
      return;
    }

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const safeMessage = String(message || '').slice(0, 500);
    if (!safeMessage.trim()) return;

    const chatEntry = {
      tgId: player.tgId,
      name: player.name || "O'yinchi",
      photoUrl: player.photoUrl || '',
      message: safeMessage,
      timestamp: new Date().toISOString()
    };

    // So'nggi xabarlarni xotirada saqlaymiz (masalan yangi qo'shilgan
    // klient uchun emas, shunchaki debugging/monitoring uchun foydali)
    room.chat.push(chatEntry);
    if (room.chat.length > 100) room.chat.shift();

    io.to(roomId).emit('chat_message', chatEntry);
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
        room.sessionEnded = true;
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

// ============================================================
// Xonani butunlay yopish - duel sessiyasi tugaganda chaqiriladi
// (chiqish, ulanish uzilishi, yoki keyingi raund uchun mablag'
// yetmasligi sabablari bilan).
// ============================================================
async function closeRoomSession(roomId) {
  const room = activeRooms[roomId];
  delete activeRooms[roomId];
  if (room?.timer) clearInterval(room.timer);

  try {
    await Room.updateOne({ roomId }, { status: 'completed', completedAt: new Date() });
  } catch (err) {
    console.error('❌ Room statusini yangilashda xato:', err);
  }

  if (room) {
    for (const p of room.players) {
      const s = io.sockets.sockets.get(p.socketId);
      if (s) s.leave(roomId);
    }
  }
}

// Har bir raundda stavka ikkala o'yinchidan ham escrow'da bo'ladi.
// Shu sabab bu yerda faqat QAYTARISH/QO'SHISH amallari bajariladi.
// Raund tugagach, agar ikkala o'yinchi ham hali ulangan bo'lsa va
// hech biri "chiqish"ni bosmagan bo'lsa - avtomatik ravishda yangi
// raund uchun stavka qayta ushlab olinadi va o'yin davom etadi.
async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  const [p1, p2] = room.players;
  const rawC1 = room.choices[p1.socketId];
  const rawC2 = room.choices[p2.socketId];
  const c1 = rawC1 || 'timeout';
  const c2 = rawC2 || 'timeout';

  const p1Absent = ABSENT_STATES.includes(c1);
  const p2Absent = ABSENT_STATES.includes(c2);

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
      finalUser1 = await applyCoinTransaction(p1.tgId, coinPayout1, txType, `Duel natijasi (${roomId})`, { roomId, round: room.roundNumber });
    } else if (user1) {
      await Transaction.create({
        tgId: p1.tgId, type: 'game_lose', amount: 0, balanceAfter: user1.coins,
        description: `Duelda mag'lubiyat (${roomId})`, metadata: { roomId, round: room.roundNumber }
      });
    }

    if (coinPayout2 > 0) {
      const txType = result2 === 'draw' ? 'game_draw_refund' : 'game_win';
      finalUser2 = await applyCoinTransaction(p2.tgId, coinPayout2, txType, `Duel natijasi (${roomId})`, { roomId, round: room.roundNumber });
    } else if (user2) {
      await Transaction.create({
        tgId: p2.tgId, type: 'game_lose', amount: 0, balanceAfter: user2.coins,
        description: `Duelda mag'lubiyat (${roomId})`, metadata: { roomId, round: room.roundNumber }
      });
    }

    await applyStatsUpdate(finalUser1, result1, xpChange1);
    await applyStatsUpdate(finalUser2, result2, xpChange2);

    // Sessiya davom etadimi yoki shu yerda yakunlanadimi - hal qilamiz
    const p1SocketAlive = io.sockets.sockets.has(p1.socketId);
    const p2SocketAlive = io.sockets.sockets.has(p2.socketId);
    const wantsToContinue = !room.sessionEnded && p1SocketAlive && p2SocketAlive;

    io.to(p1.socketId).emit('round_result', {
      roundNumber: room.roundNumber,
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
      opponentLevel: finalUser2?.level ?? 1,
      sessionContinues: wantsToContinue
    });

    io.to(p2.socketId).emit('round_result', {
      roundNumber: room.roundNumber,
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
      opponentLevel: finalUser1?.level ?? 1,
      sessionContinues: wantsToContinue
    });

    if (!wantsToContinue) {
      await closeRoomSession(roomId);
      return;
    }

    // -------- KEYINGI RAUND UCHUN TAYYORGARLIK --------
    room.choices = {};
    room.roundNumber += 1;

    const hold = await holdStakeForBothPlayers(p1, p2, room.stake, roomId);
    if (!hold.success) {
      io.to(p1.socketId).emit('duel_ended', { reason: 'insufficient_funds' });
      io.to(p2.socketId).emit('duel_ended', { reason: 'insufficient_funds' });
      await closeRoomSession(roomId);
      return;
    }

    io.to(p1.socketId).emit('balance_updated', { coins: hold.holdUser1.coins, reason: 'game_stake_hold' });
    io.to(p2.socketId).emit('balance_updated', { coins: hold.holdUser2.coins, reason: 'game_stake_hold' });

    io.to(roomId).emit('next_round_started', { roomId, roundNumber: room.roundNumber, stake: room.stake });
    startRoomTimer(roomId);

  } catch (error) {
    // Agar shu yerda xato bo'lsa, stavka escrow'da "muzlab" qolishi mumkin.
    // Xonani 'active' deb qoldiramiz, shunda keyingi server-restart'da
    // recoverStaleRooms() uni albatta topib, ikkala o'yinchiga ham
    // stavkani qaytaradi.
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
// GRACEFUL SHUTDOWN
// ============================================================
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