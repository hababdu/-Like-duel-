require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose'); // MongoDB uchun
// YOKI PostgreSQL uchun:
// const { Pool } = require('pg');

const app = express();
app.use(express.json());

// MongoDB ulanishi
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram_users', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User modeli
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  languageCode: String,
  isBot: Boolean,
  joinDate: { type: Date, default: Date.now },
  lastActivity: Date,
  visitCount: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// YOKI PostgreSQL uchun:
/*
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createUsersTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      username VARCHAR(100),
      language_code VARCHAR(10),
      is_bot BOOLEAN DEFAULT FALSE,
      join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP,
      visit_count INTEGER DEFAULT 0
    )
  `;
  await pool.query(query);
}
createUsersTable();
*/

// Botni yaratish
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('🤖 Bot ishga tushdi...');

// ========== HAR BIR FOYDALANUVCHINI SAQLASH ==========

// /start komandasi - foydalanuvchini saqlash
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  console.log('Yangi foydalanuvchi:', user);
  
  try {
    // Foydalanuvchini ma'lumotlar bazasiga saqlash yoki yangilash
    await saveOrUpdateUser(user);
    
    // Mini App havolasi
    const keyboard = {
      inline_keyboard: [[
        {
          text: "📱 App'ni ochish",
          web_app: { url: process.env.APP_URL }
        }
      ]]
    };
    
    await bot.sendMessage(chatId, 
      `Salom ${user.first_name}! 👋\n` +
      `Sizning ma'lumotlaringiz saqlandi.\n` +
      `App'ni ochish uchun tugmani bosing:`,
      { reply_markup: keyboard }
    );
    
  } catch (error) {
    console.error('Foydalanuvchini saqlashda xato:', error);
    bot.sendMessage(chatId, 'Xatolik yuz berdi, iltimos qayta urinib ko\'ring.');
  }
});

// Mini App'dan kirgan foydalanuvchilarni saqlash
bot.on('web_app_data', async (msg) => {
  const user = msg.from;
  const data = JSON.parse(msg.web_app_data?.data || '{}');
  
  console.log('Web App foydalanuvchisi:', user);
  console.log('App dan ma\'lumot:', data);
  
  try {
    // Foydalanuvchini saqlash
    await saveOrUpdateUser(user);
    
    // Agar app dan qo'shimcha ma'lumot kelsa
    if (data.userAction) {
      await saveUserAction(user.id, data.userAction);
    }
    
  } catch (error) {
    console.error('Web App foydalanuvchisini saqlashda xato:', error);
  }
});

// Har qanday xabarda foydalanuvchi faolligini yangilash
bot.on('message', async (msg) => {
  if (msg.from) {
    try {
      await updateUserActivity(msg.from.id);
    } catch (error) {
      console.error('Faollikni yangilashda xato:', error);
    }
  }
});

// ========== MA'LUMOTLAR BAZASI FUNKSIYALARI ==========

// Foydalanuvchini saqlash/yangilash funksiyasi
async function saveOrUpdateUser(telegramUser) {
  const userData = {
    telegramId: telegramUser.id,
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name,
    username: telegramUser.username,
    languageCode: telegramUser.language_code,
    isBot: telegramUser.is_bot || false,
    lastActivity: new Date()
  };
  
  // MongoDB
  const result = await User.findOneAndUpdate(
    { telegramId: telegramUser.id },
    { 
      $set: userData,
      $inc: { visitCount: 1 },
      $setOnInsert: { joinDate: new Date() }
    },
    { upsert: true, new: true }
  );
  
  console.log(`Foydalanuvchi saqlandi: ${telegramUser.id} - ${telegramUser.first_name}`);
  return result;
  
  // YOKI PostgreSQL
  /*
  const query = `
    INSERT INTO users (telegram_id, first_name, last_name, username, language_code, is_bot, last_activity, visit_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
    ON CONFLICT (telegram_id) 
    DO UPDATE SET 
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      username = EXCLUDED.username,
      last_activity = EXCLUDED.last_activity,
      visit_count = users.visit_count + 1
    RETURNING *
  `;
  
  const values = [
    userData.telegramId,
    userData.firstName,
    userData.lastName,
    userData.username,
    userData.languageCode,
    userData.isBot,
    userData.lastActivity
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
  */
}

// Foydalanuvchi faolligini yangilash
async function updateUserActivity(telegramId) {
  // MongoDB
  await User.updateOne(
    { telegramId },
    { $set: { lastActivity: new Date() } }
  );
  
  // PostgreSQL
  // await pool.query('UPDATE users SET last_activity = $1 WHERE telegram_id = $2', [new Date(), telegramId]);
}

// Qo'shimcha harakatlarni saqlash
async function saveUserAction(telegramId, action) {
  // Actions collection/table yaratishingiz mumkin
  console.log(`Foydalanuvchi harakati: ${telegramId} - ${action}`);
}

// ========== ADMIN API ENDPOINTLARI ==========

// Barcha foydalanuvchilarni olish
app.get('/api/users', async (req, res) => {
  try {
    // MongoDB
    const users = await User.find().sort({ joinDate: -1 }).limit(100);
    
    // PostgreSQL
    // const result = await pool.query('SELECT * FROM users ORDER BY join_date DESC LIMIT 100');
    // const users = result.rows;
    
    res.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Faol foydalanuvchilar
app.get('/api/users/active', async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // MongoDB
    const activeUsers = await User.find({
      lastActivity: { $gte: oneDayAgo }
    }).sort({ lastActivity: -1 });
    
    res.json({
      success: true,
      count: activeUsers.length,
      users: activeUsers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Statistikalar
app.get('/api/stats', async (req, res) => {
  try {
    // MongoDB
    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({ joinDate: { $gte: today } });
    
    // PostgreSQL
    /*
    const totalResult = await pool.query('SELECT COUNT(*) FROM users');
    const todayResult = await pool.query('SELECT COUNT(*) FROM users WHERE join_date >= CURRENT_DATE');
    const totalUsers = parseInt(totalResult.rows[0].count);
    const newToday = parseInt(todayResult.rows[0].count);
    */
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== FRONTEND (MINI APP) UCHUN API ==========

// Frontend'dan kelgan foydalanuvchi ma'lumotlarini saqlash
app.post('/api/save-user', async (req, res) => {
  try {
    const userData = req.body;
    
    // Telegram WebApp'dan kelgan ma'lumotlarni tekshirish
    if (!userData.id) {
      return res.status(400).json({ success: false, error: 'Telegram ID kerak' });
    }
    
    const savedUser = await saveOrUpdateUser(userData);
    
    res.json({
      success: true,
      message: 'Foydalanuvchi ma\'lumotlari saqlandi',
      user: savedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SERVER ISHGA TUSHIRISH ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`📊 Ma'lumotlar bazasi: ${mongoose.connection.readyState === 1 ? 'Ulangan' : 'Ulanmagan'}`);
});

// MongoDB ulanish xatolari
mongoose.connection.on('error', err => {
  console.error('MongoDB ulanish xatosi:', err);
});

mongoose.connection.once('open', () => {
  console.log('✅ MongoDB ga ulandi');
});