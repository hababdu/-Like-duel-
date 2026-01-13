// server.js - Telegram Bot Backend
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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_users?retryWrites=true&w=majority';

console.log('📡 MongoDB URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));

// User Schema (TIMESERIES EMAS!)
const userSchema = new mongoose.Schema({
  telegramId: { 
    type: Number, 
    required: true, 
    unique: true,
    index: true 
  },
  firstName: {
    type: String,
    required: true,
    default: 'User'
  },
  lastName: String,
  username: String,
  languageCode: {
    type: String,
    default: 'en'
  },
  isBot: {
    type: Boolean,
    default: false
  },
  joinDate: { 
    type: Date, 
    default: Date.now 
  },
  lastActivity: { 
    type: Date, 
    default: Date.now 
  },
  visitCount: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: false // BU MUHIM! Timeseries xatosini oldini olish
});

const User = mongoose.model('User', userSchema);

// MongoDB ulanish
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB ga ulandi');
  console.log('📊 Connection state:', mongoose.connection.readyState);
})
.catch((err) => {
  console.error('❌ MongoDB ulanish xatosi:', err.message);
  console.log('📊 Ma\'lumotlar bazasi: Ulanmagan');
});

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID';

console.log('🤖 Bot token:', BOT_TOKEN ? 'Mavjud' : 'Yo\'q');
console.log('👑 Admin ID:', ADMIN_ID);

// Bot yaratish (polling paramlari bilan)
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    timeout: 10,
    autoStart: false
  },
  request: {
    timeout: 30000
  },
  onlyFirstMatch: true,
  filepath: false
});

// Botni ishga tushirish funksiyasi
let botPollingActive = false;

const startBotPolling = () => {
  if (botPollingActive) {
    console.log('⚠️  Bot allaqachon ishlayapti');
    return;
  }
  
  bot.startPolling().then(() => {
    botPollingActive = true;
    console.log('✅ Bot polling ishga tushdi');
  }).catch(err => {
    console.error('❌ Bot polling xatosi:', err.message);
    
    // 409 xatosi bo'lsa, 10 soniya kutish
    if (err.message.includes('409 Conflict')) {
      console.log('🔄 10 soniya kutib qayta urinilmoqda...');
      botPollingActive = false;
      setTimeout(startBotPolling, 10000);
    }
  });
};

// Dastur ishga tushganda botni yoqish
setTimeout(() => {
  console.log('🚀 Bot ishga tushirilmoqda...');
  startBotPolling();
}, 2000);

// ==================== FOYDALANUVCHI FUNKSIYALARI ====================

// Foydalanuvchini saqlash/yangilash
async function saveOrUpdateUser(telegramUser) {
  try {
    console.log(`👤 Foydalanuvchi saqlanmoqda: ${telegramUser.id} - ${telegramUser.first_name}`);
    
    // MongoDB holatini tekshirish
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB ulanmagan, saqlash bekor');
      return null;
    }
    
    const userData = {
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name || 'User',
      lastName: telegramUser.last_name || '',
      username: telegramUser.username || '',
      languageCode: telegramUser.language_code || 'en',
      isBot: telegramUser.is_bot || false,
      lastActivity: new Date()
    };
    
    // Find and update - timeseries EMAS!
    const existingUser = await User.findOne({ telegramId: telegramUser.id });
    
    if (existingUser) {
      // Mavjud foydalanuvchini yangilash
      existingUser.visitCount += 1;
      existingUser.lastActivity = new Date();
      if (userData.firstName) existingUser.firstName = userData.firstName;
      if (userData.username) existingUser.username = userData.username;
      
      await existingUser.save();
      console.log(`✅ Foydalanuvchi yangilandi: ${telegramUser.id}, kirishlar: ${existingUser.visitCount}`);
      return existingUser;
    } else {
      // Yangi foydalanuvchi yaratish
      const newUser = new User({
        ...userData,
        joinDate: new Date(),
        visitCount: 1
      });
      
      await newUser.save();
      console.log(`✅ Yangi foydalanuvchi saqlandi: ${telegramUser.id}`);
      return newUser;
    }
  } catch (error) {
    console.error('❌ Saqlash xatosi:', error.message);
    
    // Agar "timeseries" xatosi bo'lsa, collection'ni o'chirib yangilash
    if (error.message.includes('timeseries')) {
      console.log('⚠️  Timeseries xatosi, collection yangilanadi...');
      try {
        await mongoose.connection.db.dropCollection('users');
        console.log('✅ Collection o\'chirildi, yangilanadi...');
      } catch (dropErr) {
        console.log('ℹ️  Collection o\'chirishda xato:', dropErr.message);
      }
    }
    
    return null;
  }
}

// ==================== BOT COMMAND HANDLERS ====================

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  console.log(`📨 /start from: ${user.id} - ${user.first_name}`);
  
  // Foydalanuvchini saqlash
  const savedUser = await saveOrUpdateUser(user);
  
  // Inline keyboard
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
  
  const visits = savedUser ? savedUser.visitCount : 1;
  
  bot.sendMessage(chatId, 
    `Salom ${user.first_name}! 👋\n` +
    `Sizning ma'lumotlaringiz saqlandi.\n` +
    `Kirishlar soni: ${visits}\n\n` +
    `Mini App'ni ochish uchun tugmani bosing:`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    }
  );
});

// /test komandasi (debug uchun)
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  const savedUser = await saveOrUpdateUser(user);
  
  if (savedUser) {
    bot.sendMessage(chatId,
      `✅ Test muvaffaqiyatli!\n` +
      `ID: ${savedUser.telegramId}\n` +
      `Ism: ${savedUser.firstName}\n` +
      `Kirishlar: ${savedUser.visitCount}\n` +
      `Admin panel: /admin`,
      { parse_mode: 'HTML' }
    );
  } else {
    bot.sendMessage(chatId, '❌ Test muvaffaqiyatsiz. Database ulanmagan.');
  }
});

// /admin komandasi
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  const backendUrl = process.env.RENDER_EXTERNAL_URL || `https://telegram-bot-server-2-matj.onrender.com`;
  const adminUrl = `${backendUrl}/admin`;
  
  // Admin tekshirish
  if (user.id.toString() === ADMIN_ID.toString()) {
    bot.sendMessage(chatId,
      `👑 Admin Panel\n\n` +
      `🔗 ${adminUrl}\n\n` +
      `Foydalanuvchilar: /users\n` +
      `Statistika: /stats\n` +
      `Database holati: /dbstatus`,
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
    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const newToday = await User.countDocuments({ joinDate: { $gte: today } });
    const activeToday = await User.countDocuments({ 
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });
    
    bot.sendMessage(chatId,
      `📊 Bot Statistika\n\n` +
      `👥 Jami foydalanuvchilar: ${totalUsers}\n` +
      `🆕 Bugun qo'shilgan: ${newToday}\n` +
      `🔵 Faol (24 soat): ${activeToday}\n` +
      `🕐 Vaqt: ${new Date().toLocaleTimeString()}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    bot.sendMessage(chatId, '❌ Statistika olishda xato');
  }
});

// /users komandasi
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  // Admin tekshirish
  if (user.id.toString() !== ADMIN_ID.toString()) {
    bot.sendMessage(chatId, '❌ Siz admin emassiz!');
    return;
  }
  
  try {
    const users = await User.find().sort({ lastActivity: -1 }).limit(5);
    
    let message = `👥 So'nggi 5 foydalanuvchi:\n\n`;
    
    users.forEach((u, index) => {
      message += `${index + 1}. ${u.firstName || 'Noma\'lum'} (ID: ${u.telegramId})\n`;
      message += `   👤 @${u.username || 'yo\'q'} | Kirish: ${u.visitCount}\n`;
      message += `   🕐 ${u.lastActivity.toLocaleDateString()}\n\n`;
    });
    
    const totalUsers = await User.countDocuments();
    message += `\n📊 Jami: ${totalUsers} ta foydalanuvchi`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Foydalanuvchilarni olishda xato');
  }
});

// /dbstatus komandasi
bot.onText(/\/dbstatus/, async (msg) => {
  const chatId = msg.chat.id;
  
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  
  bot.sendMessage(chatId,
    `📊 Database Holati\n\n` +
    `🔌 Status: ${state} (${mongoose.connection.readyState})\n` +
    `🕐 Vaqt: ${new Date().toLocaleTimeString()}`,
    { parse_mode: 'HTML' }
  );
});

// Web App ma'lumotlari
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  console.log(`📱 Web App data from: ${user.id}`);
  
  await saveOrUpdateUser(user);
  
  try {
    if (msg.web_app_data?.data) {
      const data = JSON.parse(msg.web_app_data.data);
      console.log('Web App ma\'lumoti:', data);
      
      bot.sendMessage(chatId, '✅ Ma\'lumotlar qabul qilindi!');
    }
  } catch (error) {
    console.error('Web App xatosi:', error);
  }
});

// Har qanday xabar
bot.on('message', async (msg) => {
  if (msg.from && !msg.text?.startsWith('/')) {
    await saveOrUpdateUser(msg.from);
  }
});

// ==================== EXPRESS SERVER & API ====================

// Statik fayllar
app.use(express.static(__dirname));

// Bosh sahifa
app.get('/', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  
  res.json({
    status: 'online',
    service: 'Telegram Bot Backend',
    bot: botPollingActive ? 'running' : 'stopped',
    database: dbState,
    endpoints: {
      home: '/',
      admin: '/admin',
      api_users: '/api/users',
      api_stats: '/api/stats',
      api_debug: '/api/debug',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Admin panel sahifasi - BU YERDA QO'SHILDI!
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1,
    bot: botPollingActive,
    timestamp: new Date().toISOString()
  });
});

// ==================== API ENDPOINTS ====================

// API: Foydalanuvchilar
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    let users = [];
    let totalUsers = 0;
    
    if (mongoose.connection.readyState === 1) {
      users = await User.find()
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit);
      
      totalUsers = await User.countDocuments();
    }
    
    res.json({
      success: true,
      page,
      limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      databaseConnected: mongoose.connection.readyState === 1,
      users: users.map(user => ({
        id: user.telegramId,
        name: `${user.firstName} ${user.lastName || ''}`.trim() || 'Noma\'lum',
        username: user.username,
        joinDate: user.joinDate,
        lastActivity: user.lastActivity,
        visits: user.visitCount,
        isBot: user.isBot
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: mongoose.connection.readyState === 1
    });
  }
});

// API: Statistika (MAJHURIY: stats obyekti bo'lishi kerak)
app.get('/api/stats', async (req, res) => {
  try {
    let totalUsers = 0;
    let newToday = 0;
    let activeToday = 0;
    
    if (mongoose.connection.readyState === 1) {
      totalUsers = await User.countDocuments();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      newToday = await User.countDocuments({ joinDate: { $gte: today } });
      activeToday = await User.countDocuments({ 
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
      });
    }
    
    // MAJHURIY: stats obyektini qaytarish
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
      error: error.message,
      stats: { // Xato bo'lsa ham stats obyekti bo'lsin
        totalUsers: 0,
        newToday: 0,
        activeToday: 0,
        databaseStatus: 'error'
      }
    });
  }
});

// API: Debug
app.get('/api/debug', async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  res.json({
    mongodb: {
      state: mongoose.connection.readyState,
      status: states[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host || 'N/A'
    },
    bot: {
      polling: botPollingActive,
      token: BOT_TOKEN ? 'set' : 'not set'
    },
    environment: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: ['/', '/admin', '/api/users', '/api/stats', '/health', '/api/debug']
  });
});

// ==================== SERVER ISHGA TUSHIRISH ====================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`🔗 Bosh sahifa: http://localhost:${PORT}`);
  console.log(`👑 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`📊 API: http://localhost:${PORT}/api/users`);
  console.log('==========================================');
});

// Server to'xtash signallari
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM: Server to\'xtatilmoqda...');
  bot.stopPolling();
  mongoose.connection.close();
  console.log('✅ Server to\'xtatildi');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT: Server to\'xtatilmoqda...');
  bot.stopPolling();
  mongoose.connection.close();
  console.log('✅ Server to\'xtatildi');
  process.exit(0);
});