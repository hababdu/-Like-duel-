require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

// Express server yaratish
const app = express();
app.use(cors());
app.use(express.json());

// Bot tokenini .env faylidan olish
const token = process.env.BOT_TOKEN;

// Botni yaratish
const bot = new TelegramBot(token, { 
  polling: true,
  filepath: false
});

console.log('🤖 Bot ishga tushdi...');

// /start komandasi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📱 Mini App'ni ochish",
        web_app: { 
          url: process.env.APP_URL || "https://sizning-app.vercel.app" 
        }
      }
    ]]
  };
  
  bot.sendMessage(chatId, `Salom ${firstName}! 👋\n\nQuyidagi tugma orqali Mini App'ni oching:`, {
    reply_markup: keyboard,
    parse_mode: 'HTML'
  });
});

// /help komandasi
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `
<b>📋 Mavjud komandalar:</b>
/start - Botni ishga tushirish
/help - Yordam olish
/app - Mini App'ni ochish

<b>🔗 Mini App havolasi:</b>
${process.env.APP_URL || "Havola sozlanmagan"}

<b>📞 Aloqa:</b>
Muammo bo'lsa: @sizning_username
  `;
  
  bot.sendMessage(chatId, helpText, {
    parse_mode: 'HTML'
  });
});

// Web App'dan kelgan ma'lumotlarni qabul qilish
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const data = JSON.parse(msg.web_app_data.data);
  
  console.log('📨 Web App dan ma\'lumot keldi:', data);
  
  // Ma'lumot turiga qarab ishlov berish
  if (data.type === 'order') {
    // Buyurtmani qayta ishlash
    await processOrder(chatId, data);
  } else if (data.type === 'feedback') {
    // Fikr-mulohazani qayta ishlash
    await processFeedback(chatId, data);
  }
  
  // Foydalanuvchiga javob qaytarish
  bot.sendMessage(chatId, "✅ Ma'lumot qabul qilindi!");
});

// Buyurtmani qayta ishlash funksiyasi
async function processOrder(chatId, orderData) {
  try {
    const message = `
🛒 <b>Yangi buyurtma!</b>

<b>Mijoz:</b> ${orderData.userName || 'Noma\'lum'}
<b>Telefon:</b> ${orderData.phone || 'Ko\'rsatilmagan'}
<b>Mahsulot:</b> ${orderData.productName}
<b>Miqdor:</b> ${orderData.quantity}
<b>Jami:</b> ${orderData.totalPrice} so'm
<b>Vaqt:</b> ${new Date().toLocaleString()}
    `;
    
    // Mijozga xabar
    await bot.sendMessage(chatId, `📦 Buyurtmangiz qabul qilindi!\nBuyurtma raqami: #${Date.now()}`, {
      parse_mode: 'HTML'
    });
    
    // Admin'ga bildirishnoma
    const adminId = process.env.ADMIN_ID;
    if (adminId) {
      await bot.sendMessage(adminId, message, {
        parse_mode: 'HTML'
      });
    }
    
    // Ma'lumotlar bazasiga saqlash (agar bo'lsa)
    // await saveToDatabase(orderData);
    
  } catch (error) {
    console.error('Buyurtma qayta ishlash xatosi:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi, iltimos qayta urinib ko\'ring.');
  }
}

// Fikr-mulohazani qayta ishlash
async function processFeedback(chatId, feedbackData) {
  const adminId = process.env.ADMIN_ID;
  
  if (adminId) {
    await bot.sendMessage(adminId, 
      `📝 <b>Yangi fikr-mulohaza</b>\n\n` +
      `<b>Kimdan:</b> ${feedbackData.userName || 'Anonim'}\n` +
      `<b>Xabar:</b> ${feedbackData.message}\n` +
      `<b>Bahosi:</b> ${'⭐'.repeat(feedbackData.rating || 0)}`,
      { parse_mode: 'HTML' }
    );
  }
  
  await bot.sendMessage(chatId, '🙏 Fikringiz uchun rahmat!');
}

// Oddiy text xabarlarni qayta ishlash
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Agar bu / komanda bo'lmasa
  if (!text.startsWith('/')) {
    bot.sendMessage(chatId, 
      `Sizning xabaringiz: "${text}"\n\n` +
      `Mini App orqali ishlash uchun /start ni bosing`,
      { reply_markup: {
        inline_keyboard: [[
          { text: "🔄 /start", callback_data: "restart" }
        ]]
      }}
    );
  }
});

// Callback query (inline tugmalar)
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  
  if (data === 'restart') {
    bot.deleteMessage(msg.chat.id, msg.message_id);
    bot.sendMessage(msg.chat.id, "Qaytadan boshlaymiz...");
    // /start komandasini simulyatsiya qilish
    msg.text = '/start';
    msg.from = callbackQuery.from;
    bot.processUpdate({ message: msg });
  }
});

// Express server ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server ${PORT}-portda ishga tushdi`);
});

// Server test uchun endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    bot: 'running',
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint (agar kerak bo'lsa)
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Bot'ni to'xtatish signalini ushlash
process.once('SIGINT', () => bot.stopPolling());
process.once('SIGTERM', () => bot.stopPolling());