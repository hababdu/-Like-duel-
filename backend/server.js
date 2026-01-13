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
// Foydalanuvchi nomini KICHIK HARFLARDA yozing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/?appName=Cluster0';

console.log('📡 MongoDB URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));

// User Schema (YANGILANGAN)
const userSchema = new mongoose.Schema({
  telegramId: { 
    type: Number, 
    required: true, 
    unique: true,
    index: true 
  },
  firstName: {
    type: String,
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
    default: () => new Date()
  },
  lastActivity: { 
    type: Date, 
    default: () => new Date()
  },
  visitCount: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: false,
  collection: 'users' // Collection nomini aniq belgilash
});

const User = mongoose.model('User', userSchema);

// MongoDB ulanish (YANGILANGAN)
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB ga ulandi');
  console.log('📊 Connection state:', mongoose.connection.readyState);
  console.log('📁 Database:', mongoose.connection.db?.databaseName);
  
  // Collection ni tekshirish
  mongoose.connection.db.listCollections({name: 'users'}).toArray((err, collections) => {
    if (err) {
      console.log('⚠️  Collection tekshirish xatosi:', err.message);
    } else if (collections.length === 0) {
      console.log('ℹ️  "users" collection yaratiladi...');
    } else {
      console.log('✅ "users" collection mavjud');
    }
  });
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

// Bot yaratish (WEBHOOK emas, polling)
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 1000, // 1 soniya
    params: {
      timeout: 10,
      allowed_updates: ["message", "callback_query", "chat_member"]
    },
    autoStart: false
  }
});

// Botni ishga tushirish funksiyasi (YANGILANGAN)
let botPollingActive = false;
let retryCount = 0;
const MAX_RETRIES = 5;

const startBotPolling = async () => {
  if (botPollingActive) {
    console.log('⚠️  Bot allaqachon ishlayapti');
    return;
  }
  
  try {
    // Avval polling to'xtatish
    await bot.stopPolling();
    
    // 2 soniya kutish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`🚀 Bot polling ishga tushirilmoqda... (urush: ${retryCount + 1})`);
    
    // Yangi polling boshlash
    bot.startPolling({
      restart: true
    }).then(() => {
      botPollingActive = true;
      retryCount = 0;
      console.log('✅ Bot polling muvaffaqiyatli ishga tushdi');
      
      // Polling holatini tekshirish
      bot.isPolling().then(isPolling => {
        console.log(`📡 Bot polling holati: ${isPolling ? 'active' : 'inactive'}`);
      });
      
    }).catch(err => {
      console.error('❌ Bot polling xatosi:', err.message);
      
      // 409 xatosi bo'lsa, qayta urinish
      if (err.message.includes('409 Conflict') && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = 5000 * retryCount; // Har bir urinishda ortib boradi
        console.log(`🔄 ${delay/1000} soniya kutib qayta urinilmoqda (${retryCount}/${MAX_RETRIES})...`);
        
        botPollingActive = false;
        setTimeout(startBotPolling, delay);
      } else {
        console.error('❌ Maksimal urinishlar soniga yetildi, bot ishlamayapti');
      }
    });
    
  } catch (error) {
    console.error('❌ Botni ishga tushirishda xato:', error.message);
  }
};

// Dastur ishga tushganda botni yoqish
setTimeout(() => {
  startBotPolling();
}, 3000);

// ==================== FOYDALANUVCHI FUNKSIYALARI ====================

// Foydalanuvchini saqlash/yangilash (YANGILANGAN)
async function saveOrUpdateUser(telegramUser) {
  try {
    console.log(`👤 Foydalanuvchi saqlanmoqda: ${telegramUser.id} - ${telegramUser.first_name}`);
    
    // MongoDB holatini tekshirish
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB ulanmagan, saqlash bekor');
      return null;
    }
    
    const currentDate = new Date();
    
    // Ma'lumotlarni tozalash
    const userData = {
      telegramId: Number(telegramUser.id),
      firstName: String(telegramUser.first_name || 'User'),
      lastName: telegramUser.last_name ? String(telegramUser.last_name) : '',
      username: telegramUser.username ? String(telegramUser.username) : '',
      languageCode: String(telegramUser.language_code || 'en'),
      isBot: Boolean(telegramUser.is_bot || false),
      lastActivity: currentDate
    };
    
    console.log('📝 Saqlanayotgan ma\'lumotlar:', {
      telegramId: userData.telegramId,
      firstName: userData.firstName,
      date: currentDate.toISOString()
    });
    
    // Find and update
    const existingUser = await User.findOne({ telegramId: userData.telegramId });
    
    if (existingUser) {
      // Mavjud foydalanuvchini yangilash
      existingUser.visitCount = Number(existingUser.visitCount || 0) + 1;
      existingUser.lastActivity = currentDate;
      existingUser.firstName = userData.firstName;
      if (userData.username) existingUser.username = userData.username;
      
      await existingUser.save();
      console.log(`✅ Foydalanuvchi yangilandi: ${userData.telegramId}, kirishlar: ${existingUser.visitCount}`);
      return existingUser;
    } else {
      // Yangi foydalanuvchi yaratish
      const newUser = new User({
        ...userData,
        joinDate: currentDate,
        visitCount: 1
      });
      
      await newUser.save();
      console.log(`✅ Yangi foydalanuvchi saqlandi: ${userData.telegramId}`);
      return newUser;
    }
  } catch (error) {
    console.error('❌ Saqlash xatosi:', error.message);
    console.error('❌ Xato tafsilotlari:', error.stack);
    
    // BSON xatosini aniqlash
    if (error.message.includes('BSON') || error.message.includes('datetime') || error.message.includes('habibullox')) {
      console.log('⚠️  Database struktura xatosi, qayta urinib ko\'ramiz...');
      
      // Muammoli ma'lumotlarni o'chirish
      try {
        // Barcha noto'g'ri ma'lumotlarni o'chirish
        const result = await User.deleteMany({
          $or: [
            { joinDate: { $type: 'string' } },
            { lastActivity: { $type: 'string' } },
            { telegramId: { $type: 'string' } }
          ]
        });
        console.log(`🗑️  ${result.deletedCount} ta noto'g'ri ma'lumot o'chirildi`);
      } catch (cleanErr) {
        console.log('⚠️  Tozalashda xato:', cleanErr.message);
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

// /testdb komandasi - Database test (YANGI)
bot.onText(/\/testdb/, async (msg) => {
  const chatId = msg.chat.id;
  
  const dbState = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  let message = `📊 Database Test:\n`;
  message += `🔌 Status: ${states[dbState]} (${dbState})\n`;
  message += `🕐 Vaqt: ${new Date().toISOString()}\n`;
  message += `🤖 Bot polling: ${botPollingActive ? 'active' : 'inactive'}\n`;
  
  // Test saqlash
  try {
    if (dbState === 1) {
      const testId = Date.now(); // Unique ID
      const testUser = new User({
        telegramId: testId,
        firstName: 'Test User',
        joinDate: new Date(),
        lastActivity: new Date(),
        visitCount: 1
      });
      
      await testUser.save();
      message += `✅ Test saqlash muvaffaqiyatli!\n`;
      message += `📝 Test ID: ${testId}\n`;
      
      // Test ma'lumotni tekshirish
      const foundUser = await User.findOne({ telegramId: testId });
      if (foundUser) {
        message += `🔍 Test ma'lumot topildi: ${foundUser.firstName}\n`;
      }
      
      // Test ma'lumotni o'chirish
      await User.deleteOne({ telegramId: testId });
      message += `🗑️ Test ma'lumot o'chirildi\n`;
    } else {
      message += `❌ Database ulanmagan\n`;
    }
  } catch (error) {
    message += `❌ Test saqlash xatosi: ${error.message}\n`;
  }
  
  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
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
      `Database holati: /dbstatus\n` +
      `Database test: /testdb`,
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
      `🕐 Vaqt: ${new Date().toLocaleTimeString()}\n` +
      `📡 Bot holati: ${botPollingActive ? 'ishlayapti' : 'to\'xtagan'}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    bot.sendMessage(chatId, '❌ Statistika olishda xato: ' + error.message);
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
    bot.sendMessage(chatId, '❌ Foydalanuvchilarni olishda xato: ' + error.message);
  }
});

// /dbstatus komandasi
bot.onText(/\/dbstatus/, async (msg) => {
  const chatId = msg.chat.id;
  
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  
  // Foydalanuvchilar soni
  let userCount = 0;
  try {
    userCount = await User.countDocuments();
  } catch (err) {
    userCount = -1;
  }
  
  bot.sendMessage(chatId,
    `📊 Database Holati\n\n` +
    `🔌 Status: ${state} (${mongoose.connection.readyState})\n` +
    `👥 Foydalanuvchilar: ${userCount}\n` +
    `🤖 Bot polling: ${botPollingActive ? 'active' : 'inactive'}\n` +
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

// Admin panel sahifasi
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1,
    bot: botPollingActive,
    mongodbState: mongoose.connection.readyState,
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

// API: Statistika
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
    
    // stats obyektini qaytarish
    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        activeToday,
        databaseStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        botStatus: botPollingActive ? 'running' : 'stopped'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stats: {
        totalUsers: 0,
        newToday: 0,
        activeToday: 0,
        databaseStatus: 'error',
        botStatus: 'unknown'
      }
    });
  }
});

// API: Debug
app.get('/api/debug', async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  // Database ma'lumotlari
  let dbInfo = {};
  if (mongoose.connection.readyState === 1) {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      dbInfo = {
        collections: collections.map(c => c.name),
        usersCount: await User.countDocuments()
      };
    } catch (err) {
      dbInfo = { error: err.message };
    }
  }
  
  res.json({
    mongodb: {
      state: mongoose.connection.readyState,
      status: states[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      database: mongoose.connection.db?.databaseName || 'N/A',
      collections: dbInfo.collections || []
    },
    bot: {
      polling: botPollingActive,
      token: BOT_TOKEN ? 'set' : 'not set',
      adminId: ADMIN_ID || 'not set'
    },
    environment: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    users: {
      count: dbInfo.usersCount || 0
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
  console.log(`🤖 Bot polling: ${botPollingActive ? 'ishlaydi' : 'kutilmoqda'}`);
  console.log('==========================================');
  
  // Server ishga tushganda test qilish
  setTimeout(() => {
    console.log('🔍 Server test rejimi...');
    console.log(`📊 MongoDB holati: ${mongoose.connection.readyState}`);
    console.log(`🤖 Bot polling: ${botPollingActive}`);
  }, 5000);
});

// Server to'xtash signallari
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM: Server to\'xtatilmoqda...');
  bot.stopPolling().then(() => {
    console.log('✅ Bot polling to\'xtatildi');
  }).catch(err => {
    console.log('⚠️  Botni to\'xtatishda xato:', err.message);
  });
  
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB ulanishi yopildi');
  });
  
  setTimeout(() => {
    console.log('✅ Server to\'xtatildi');
    process.exit(0);
  }, 1000);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT: Server to\'xtatilmoqda...');
  bot.stopPolling().then(() => {
    console.log('✅ Bot polling to\'xtatildi');
  }).catch(err => {
    console.log('⚠️  Botni to\'xtatishda xato:', err.message);
  });
  
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB ulanishi yopildi');
  });
  
  setTimeout(() => {
    console.log('✅ Server to\'xtatildi');
    process.exit(0);
  }, 1000);
});

// MongoDB ulanishni monitoring qilish
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB ga ulandi');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB xatosi:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB ulanmadi');
});