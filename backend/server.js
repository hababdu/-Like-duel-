// server.js - Telegram Mini App Backend
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Express app yaratish
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== MONGODB ULANISHI ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_users?retryWrites=true&w=majority';

// User model
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  languageCode: String,
  isBot: Boolean,
  joinDate: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// MongoDB ulanish
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB ga ulandi');
  } catch (error) {
    console.error('❌ MongoDB ulanish xatosi:', error.message);
    console.log('📊 Ma\'lumotlar bazasi: Ulanmagan');
  }
};

connectDB();

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID';

const bot = new TelegramBot(BOT_TOKEN, { 
  polling: true,
  filepath: false
});

console.log('🤖 Bot ishga tushdi...');

// Foydalanuvchini saqlash
async function saveOrUpdateUser(telegramUser) {
  try {
    if (mongoose.connection.readyState !== 1) {
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
      lastActivity: new Date()
    };

    const result = await User.findOneAndUpdate(
      { telegramId: telegramUser.id },
      { 
        $set: userData,
        $inc: { visitCount: 1 },
        $setOnInsert: { joinDate: new Date() }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Foydalanuvchi saqlandi: ${telegramUser.id} - ${telegramUser.first_name}`);
    return result;
  } catch (error) {
    console.error('❌ Foydalanuvchini saqlashda xato:', error.message);
    return null;
  }
}

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await saveOrUpdateUser(user);
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 App'ni ochish",
        web_app: { 
          url: process.env.APP_URL || "http://localhost:3000" 
        }
      }
    ]]
  };
  
  bot.sendMessage(chatId, `Salom ${user.first_name}! 👋\nMini App'ni ochish uchun:`, {
    reply_markup: keyboard,
    parse_mode: 'HTML'
  });
});

// /admin komandasi
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  const adminUrl = `${backendUrl}/admin`;
  
  if (user.id.toString() === ADMIN_ID) {
    bot.sendMessage(chatId, 
      `👑 Admin panel:\n🔗 ${adminUrl}\n\n` +
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
    if (mongoose.connection.readyState !== 1) {
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

// /users komandasi
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (user.id.toString() !== ADMIN_ID) {
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
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Foydalanuvchilarni olishda xato');
  }
});

// Web App ma'lumotlari
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    await saveOrUpdateUser(user);
    
    if (msg.web_app_data) {
      const data = JSON.parse(msg.web_app_data.data);
      console.log('📨 Web App ma\'lumoti:', data);
      
      bot.sendMessage(chatId, `✅ Ma'lumotlar qabul qilindi!`);
    }
  } catch (error) {
    console.error('Web App xatosi:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi');
  }
});

// Har qanday xabar
bot.on('message', async (msg) => {
  if (msg.from && !msg.text?.startsWith('/')) {
    await saveOrUpdateUser(msg.from);
  }
});

// ==================== EXPRESS SERVER ====================

// Admin HTML faylni yaratish (agar mavjud bo'lmasa)
const adminHTML = `<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Telegram Bot</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
        h1 { margin-bottom: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-card h3 { color: #333; margin-bottom: 10px; font-size: 14px; }
        .stat-card .value { font-size: 28px; font-weight: bold; color: #667eea; }
        table { width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; }
        .btn { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .btn:hover { background: #5a67d8; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .error { color: #e53e3e; background: #fed7d7; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>👑 Telegram Bot Admin Paneli</h1>
            <p>Foydalanuvchilar va statistika monitoringi</p>
        </header>
        
        <div class="stats">
            <div class="stat-card">
                <h3>👥 Jami Foydalanuvchilar</h3>
                <div class="value" id="totalUsers">0</div>
            </div>
            <div class="stat-card">
                <h3>🆕 Bugun Qo'shilgan</h3>
                <div class="value" id="newToday">0</div>
            </div>
            <div class="stat-card">
                <h3>🔵 Faol (24 soat)</h3>
                <div class="value" id="activeToday">0</div>
            </div>
            <div class="stat-card">
                <h3>📊 Database</h3>
                <div class="value" id="dbStatus">Yuklanmoqda...</div>
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="loadUsers()">🔄 Yangilash</button>
            <button class="btn" onclick="loadStats()">📊 Statistika</button>
            <span style="margin-left: 20px; color: #666;" id="lastUpdate"></span>
        </div>
        
        <div id="errorContainer"></div>
        
        <div id="usersTable">
            <div class="loading">
                <p>Foydalanuvchilar ma'lumotlari yuklanmoqda...</p>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        
        async function loadStats() {
            try {
                const response = await fetch(API_BASE + '/api/stats');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('totalUsers').textContent = data.stats.totalUsers || 0;
                    document.getElementById('newToday').textContent = data.stats.newToday || 0;
                    document.getElementById('activeToday').textContent = data.stats.activeToday || 0;
                    document.getElementById('dbStatus').textContent = data.stats.databaseStatus === 'connected' ? '✅' : '❌';
                    document.getElementById('lastUpdate').textContent = 'Yangilandi: ' + new Date().toLocaleTimeString();
                    document.getElementById('errorContainer').innerHTML = '';
                }
            } catch (error) {
                document.getElementById('errorContainer').innerHTML = 
                    '<div class="error">❌ Statistika yuklashda xato: ' + error.message + '</div>';
            }
        }
        
        async function loadUsers() {
            try {
                const response = await fetch(API_BASE + '/api/users');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                
                if (data.success && data.users.length > 0) {
                    let html = '<table><thead><tr><th>#</th><th>Ism</th><th>ID</th><th>Username</th><th>Kirishlar</th><th>So\'nggi faollik</th></tr></thead><tbody>';
                    
                    data.users.forEach((user, index) => {
                        html += '<tr>' +
                            '<td>' + (index + 1) + '</td>' +
                            '<td>' + (user.name || 'Noma\'lum') + '</td>' +
                            '<td>' + user.id + '</td>' +
                            '<td>' + (user.username ? '@' + user.username : '—') + '</td>' +
                            '<td>' + (user.visits || 0) + '</td>' +
                            '<td>' + new Date(user.lastActivity).toLocaleDateString() + '</td>' +
                            '</tr>';
                    });
                    
                    html += '</tbody></table>';
                    document.getElementById('usersTable').innerHTML = html;
                    document.getElementById('errorContainer').innerHTML = '';
                } else {
                    document.getElementById('usersTable').innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Hozircha foydalanuvchilar yoʻq</p>';
                }
            } catch (error) {
                document.getElementById('errorContainer').innerHTML = 
                    '<div class="error">❌ Foydalanuvchilarni yuklashda xato: ' + error.message + '</div>';
            }
        }
        
        // Sahifa yuklanganda
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            loadUsers();
            setInterval(loadStats, 30000); // 30 soniyada bir
        });
    </script>
</body>
</html>`;

// Faylni yaratish (agar mavjud bo'lmasa)
const adminFilePath = path.join(__dirname, 'admin.html');
if (!fs.existsSync(adminFilePath)) {
  fs.writeFileSync(adminFilePath, adminHTML);
  console.log('✅ admin.html fayli yaratildi');
}

// Statik fayllar (admin.html uchun)
app.use(express.static(__dirname));

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(adminFilePath);
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
      api_users: '/api/users',
      api_stats: '/api/stats',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// API: Foydalanuvchilar
app.get('/api/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
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
        visits: user.visitCount
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
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        stats: {
          totalUsers: 0,
          newToday: 0,
          activeToday: 0,
          databaseStatus: 'disconnected'
        }
      });
    }
    
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
        databaseStatus: 'connected'
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

// API: Frontend'dan foydalanuvchi ma'lumotlari
app.post('/api/save-user', async (req, res) => {
  try {
    const userData = req.body;
    
    if (!userData || !userData.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telegram user data required' 
      });
    }
    
    const savedUser = await saveOrUpdateUser(userData);
    
    res.json({
      success: true,
      message: 'User saved',
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    available: ['/', '/admin', '/api/users', '/api/stats', '/health']
  });
});

// Server ishga tushirish
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`🔗 Bosh sahifa: http://localhost:${PORT}`);
  console.log(`👑 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`📊 API: http://localhost:${PORT}/api/users`);
  console.log(`🤖 Bot token: ${BOT_TOKEN ? 'OK' : 'Missing!'}`);
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