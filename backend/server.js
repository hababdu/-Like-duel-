// server.js - To'liq Telegram Mini App Backend
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

// Express app yaratish
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== MONGODB ULANISHI ====================
// MongoDB Atlas uchun connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_users?retryWrites=true&w=majority&authSource=admin';

// MongoDB Schema va Model
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  languageCode: String,
  isBot: Boolean,
  joinDate: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 0 },
  lastCommand: String,
  isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// MongoDB ga ulanish
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB ga ulandi');
}).catch((err) => {
  console.error('❌ MongoDB ulanish xatosi:', err.message);
  console.log('📊 Ma\'lumotlar bazasiga ulanmasdan ishlayapti...');
});

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || '1234567890:ABCdefGHIJklmnoPQRstuVWXyzAbcDefGHi';
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 123456789;

const bot = new TelegramBot(BOT_TOKEN, { 
  polling: true,
  filepath: false
});

console.log('🤖 Bot ishga tushdi...');

// ==================== FOYDALANUVCHINI SAQLASH FUNKSIYASI ====================
async function saveOrUpdateUser(telegramUser, command = '/start') {
  try {
    if (!mongoose.connection.readyState) {
      console.log('⚠️  MongoDB ulanmagan, foydalanuvchi saqlanmaydi');
      return null;
    }

    const userData = {
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name || '',
      username: telegramUser.username || '',
      languageCode: telegramUser.language_code || 'en',
      isBot: telegramUser.is_bot || false,
      lastActivity: new Date(),
      lastCommand: command,
      // Agar foydalanuvchi admin bo'lsa
      isAdmin: telegramUser.id === ADMIN_ID
    };

    // MongoDB'da yangilash yoki yangi yaratish
    const result = await User.findOneAndUpdate(
      { telegramId: telegramUser.id },
      { 
        $set: userData,
        $inc: { visitCount: 1 },
        $setOnInsert: { joinDate: new Date() }
      },
      { upsert: true, new: true }
    );

    console.log(`👤 Foydalanuvchi saqlandi: ${telegramUser.id} - ${telegramUser.first_name}`);
    return result;
  } catch (error) {
    console.error('❌ Foydalanuvchini saqlashda xato:', error.message);
    return null;
  }
}

// ==================== BOT COMMAND HANDLERS ====================

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  // Foydalanuvchini saqlash
  await saveOrUpdateUser(user, '/start');
  
  // Inline keyboard yaratish
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 App'ni ochish",
        web_app: { 
          url: process.env.APP_URL || "https://your-frontend.onrender.com" 
        }
      }
    ]]
  };
  
  const welcomeMessage = user.first_name ? 
    `Salom ${user.first_name}! 👋\n` +
    `Mini App'ni ochish uchun tugmani bosing:` :
    `Salom! Mini App'ni ochish uchun tugmani bosing:`;
  
  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: 'HTML'
  });
});

// /admin komandasi (faqat admin uchun)
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (user.id === ADMIN_ID) {
    const adminUrl = process.env.APP_URL ? 
      `${process.env.APP_URL.replace('https://', 'https://')}/admin` :
      `https://your-backend.onrender.com/admin`;
    
    bot.sendMessage(chatId, 
      `👑 Admin panel:\n` +
      `🔗 ${adminUrl}\n\n` +
      `Foydalanuvchilar: /users\n` +
      `Statistika: /stats`,
      { parse_mode: 'HTML' }
    );
  } else {
    bot.sendMessage(chatId, '❌ Siz admin emassiz!');
  }
});

// /stats komandasi
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    if (!mongoose.connection.readyState) {
      bot.sendMessage(chatId, '📊 Statistika: Ma\'lumotlar bazasi ulanmagan');
      return;
    }
    
    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({ joinDate: { $gte: today } });
    const activeToday = await User.countDocuments({ 
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });
    
    const statsMessage = 
      `📊 Bot Statistika:\n\n` +
      `👥 Jami foydalanuvchilar: ${totalUsers}\n` +
      `🆕 Bugun qo'shilgan: ${newToday}\n` +
      `🔵 Faol (24 soat): ${activeToday}\n` +
      `⏰ Vaqt: ${new Date().toLocaleTimeString()}`;
    
    bot.sendMessage(chatId, statsMessage, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Statistika olishda xato');
  }
});

// /users komandasi (admin uchun)
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (user.id !== ADMIN_ID) {
    bot.sendMessage(chatId, '❌ Siz admin emassiz!');
    return;
  }
  
  try {
    const users = await User.find().sort({ lastActivity: -1 }).limit(10);
    
    let message = `👥 So'nggi 10 foydalanuvchi:\n\n`;
    users.forEach((u, index) => {
      message += `${index + 1}. ${u.firstName || 'Noma\'lum'} (ID: ${u.telegramId})\n`;
      message += `   👤 @${u.username || 'yo\'q'} | Kirish: ${u.visitCount}\n`;
      message += `   🕐 ${u.lastActivity.toLocaleDateString()}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Foydalanuvchilarni olishda xato');
  }
});

// Web App ma'lumotlarini qabul qilish
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    // Foydalanuvchini saqlash
    await saveOrUpdateUser(user, 'web_app');
    
    // Web App dan kelgan ma'lumotlarni qayta ishlash
    if (msg.web_app_data) {
      const data = JSON.parse(msg.web_app_data.data);
      console.log('📨 Web App ma\'lumoti:', data);
      
      // Bu yerda data'ni qayta ishlashingiz mumkin
      // Masalan: buyurtma, forma to'ldirish, va h.k.
      
      // Foydalanuvchiga javob
      const response = data.type === 'order' ? 
        `✅ Buyurtma qabul qilindi!\nMahsulot: ${data.productName}\nNarxi: ${data.totalPrice} so'm` :
        `✅ Ma'lumotlar qabul qilindi!`;
      
      bot.sendMessage(chatId, response);
      
      // Admin'ga xabar (agar admin ID sozlangan bo'lsa)
      if (ADMIN_ID && data.type === 'order') {
        bot.sendMessage(ADMIN_ID, 
          `🛒 Yangi buyurtma!\n` +
          `Mijoz: ${user.first_name || 'Noma\'lum'}\n` +
          `Mahsulot: ${data.productName}\n` +
          `Jami: ${data.totalPrice} so'm`,
          { parse_mode: 'HTML' }
        );
      }
    }
  } catch (error) {
    console.error('Web App ma\'lumotlarini qayta ishlash xatosi:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi');
  }
});

// Har qanday xabar uchun
bot.on('message', async (msg) => {
  if (msg.from && !msg.text?.startsWith('/')) {
    await saveOrUpdateUser(msg.from, 'message');
  }
});

// ==================== EXPRESS SERVER & API ====================

// Statik fayllarni berish (admin.html uchun)
app.use(express.static(path.join(__dirname, 'public')));

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Bosh sahifa
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Telegram Mini App Backend',
    bot: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      admin: '/admin',
      api: '/api',
      users: '/api/users',
      stats: '/api/stats'
    },
    timestamp: new Date().toISOString()
  });
});

// API: Barcha foydalanuvchilar
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments();
    
    res.json({
      success: true,
      page,
      limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      users: users.map(user => ({
        id: user.telegramId,
        name: `${user.firstName} ${user.lastName}`.trim(),
        username: user.username,
        joinDate: user.joinDate,
        lastActivity: user.lastActivity,
        visits: user.visitCount,
        isAdmin: user.isAdmin
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API: Statistika
app.get('/api/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newToday = await User.countDocuments({ joinDate: { $gte: today } });
    const activeToday = await User.countDocuments({ 
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        activeToday,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API: Frontend'dan foydalanuvchi ma'lumotlarini saqlash
app.post('/api/save-user', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telegram user data kerak' 
      });
    }
    
    const savedUser = await saveOrUpdateUser(userData, 'api_save');
    
    res.json({
      success: true,
      message: 'Foydalanuvchi ma\'lumotlari saqlandi',
      user: savedUser ? {
        id: savedUser.telegramId,
        name: savedUser.firstName
      } : null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Server porti
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`🔗 Asosiy sahifa: http://localhost:${PORT}`);
  console.log(`👑 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🤖 Bot token: ${BOT_TOKEN ? 'Mavjud' : 'Yo\'q!'}`);
  console.log(`👑 Admin ID: ${ADMIN_ID}`);
});

// Server to'xtash signallari
process.once('SIGINT', () => {
  console.log('🛑 Server to\'xtatilmoqda...');
  bot.stopPolling();
  mongoose.connection.close();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Server to\'xtatilmoqda...');
  bot.stopPolling();
  mongoose.connection.close();
  process.exit(0);
});
