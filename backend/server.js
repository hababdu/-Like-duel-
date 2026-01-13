require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== MONGODB ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_users?retryWrites=true&w=majority';

// TO'G'RI SCHEMA (timeseries emas)
const userSchema = new mongoose.Schema({
  telegramId: { 
    type: Number, 
    required: true, 
    unique: true,
    index: true 
  },
  firstName: { type: String, required: true },
  lastName: String,
  username: String,
  languageCode: { type: String, default: 'en' },
  isBot: { type: Boolean, default: false },
  joinDate: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// MongoDB ulanish
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('✅ MongoDB ga ulandi');
  
  // Collection mavjudligini tekshirish
  mongoose.connection.db.listCollections().toArray((err, collections) => {
    if (err) return;
    console.log('📊 MongoDB collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
  });
}).catch(err => {
  console.error('❌ MongoDB xatosi:', err.message);
});

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_TOKEN_HERE';
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_ADMIN_ID';

// TO'G'RI BOT SOZLAMALARI
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    timeout: 10,
    autoStart: false // Avtomatik boshlashni o'chirish
  },
  request: {
    timeout: 30000
  },
  onlyFirstMatch: true,
  filepath: false
});

console.log('🤖 Bot yaratildi...');

// Botni qo'lda ishga tushirish
const startBotPolling = () => {
  bot.startPolling().then(() => {
    console.log('✅ Bot polling ishga tushdi');
  }).catch(err => {
    console.error('❌ Bot polling xatosi:', err.message);
    
    // Agar 409 xatosi bo'lsa, 10 soniya kutib qayta urinish
    if (err.message.includes('409 Conflict')) {
      console.log('🔄 10 soniya kutib qayta urinilmoqda...');
      setTimeout(startBotPolling, 10000);
    }
  });
};

// Avval polling to'xtatish, keyin yangilash
const restartBot = () => {
  bot.stopPolling();
  setTimeout(startBotPolling, 2000); // 2 soniya kutish
};

// Birinchi marta ishga tushirish
setTimeout(startBotPolling, 3000);

// ==================== FOYDALANUVCHI FUNKSIYASI ====================
async function saveOrUpdateUser(telegramUser) {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB ulanmagan');
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

    // TO'G'RI UPDATE - timeseries emas
    const existingUser = await User.findOne({ telegramId: telegramUser.id });
    
    if (existingUser) {
      // Yangilash
      existingUser.visitCount += 1;
      existingUser.lastActivity = new Date();
      if (userData.firstName) existingUser.firstName = userData.firstName;
      if (userData.username) existingUser.username = userData.username;
      
      await existingUser.save();
      console.log(`✅ Foydalanuvchi yangilandi: ${telegramUser.id}`);
      return existingUser;
    } else {
      // Yangi yaratish
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
    return null;
  }
}

// ==================== BOT HANDLERS ====================
bot.onText(/\/start/, async (msg) => {
  console.log(`📨 /start from: ${msg.from.id}`);
  
  await saveOrUpdateUser(msg.from);
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 App'ni ochish",
        web_app: { url: process.env.APP_URL || "http://localhost:3000" }
      }
    ]]
  };
  
  bot.sendMessage(msg.chat.id, `Salom ${msg.from.first_name}!`, {
    reply_markup: keyboard
  });
});

bot.onText(/\/test/, async (msg) => {
  const user = await saveOrUpdateUser(msg.from);
  bot.sendMessage(msg.chat.id, 
    user ? `✅ Saqlandi! Kirishlar: ${user.visitCount}` : '❌ Saqlanmadi'
  );
});

// ==================== EXPRESS SERVER ====================
// Statik fayllar
app.use(express.static(__dirname));

// Admin panel
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Admin</title></head>
    <body>
      <h1>Admin Panel</h1>
      <div id="users">Yuklanmoqda...</div>
      <script>
        fetch('/api/users').then(r => r.json()).then(data => {
          document.getElementById('users').innerHTML = 
            data.users ? JSON.stringify(data.users, null, 2) : 'Xato: ' + data.error;
        });
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().limit(20);
    res.json({ success: true, users });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const total = await User.countDocuments();
    res.json({ success: true, totalUsers: total });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Bosh sahifa
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    admin: '/admin',
    api: {
      users: '/api/users',
      stats: '/api/stats'
    }
  });
});

// ==================== SERVER ====================
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishlayapti`);
  console.log(`🔗 URL: https://telegram-bot-server-2-matj.onrender.com`);
});

// To'xtash signallari
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM: Server to\'xtatilmoqda...');
  bot.stopPolling();
  server.close(() => {
    mongoose.connection.close();
    console.log('✅ Server to\'xtatildi');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT: Server to\'xtatilmoqda...');
  bot.stopPolling();
  server.close(() => {
    mongoose.connection.close();
    console.log('✅ Server to\'xtatildi');
    process.exit(0);
  });
});