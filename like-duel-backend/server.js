import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

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

// Bot /start buyrug'i va Referral ushlash mantiqi
bot.start(async (ctx) => {
  try {
    const tgId = ctx.from.id.toString();
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || '';
    
    // Referral parametrini tekshiramiz: /start ref_1234567
    const startPayload = ctx.payload; // "ref_1234567" ko'rinishida keladi
    let referredBy = null;

    if (startPayload && startPayload.startsWith('ref_')) {
      referredBy = startPayload.replace('ref_', '');
    }

    // Bazadan foydalanuvchini izlaymiz
    let user = await User.findOne({ tgId });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      let startCoins = 100;

      // Agar referral orqali kelgan bo'lsa va o'zini o'zi taklif qilmagan bo'lsa
      if (referredBy && referredBy !== tgId) {
        const referrer = await User.findOne({ tgId: referredBy });
        if (referrer) {
          startCoins = 200; // Yangi o'yinchiga bonus
          
          // Taklif qilgan do'stiga +100 tanga va hisobni oshirish
          referrer.coins += 100;
          referrer.referralsCount += 1;
          await referrer.save();

          // Do'stiga xabar yuborish (agar botni bloklamagan bo'lsa)
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

    // O'yinga kirish uchun chiroyli WebApp Tugmasi (Inline Button)
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

// React Web App ochilganda ma'lumotlarni olish uchun API
app.post('/api/user/auth', async (req, res) => {
  try {
    const { tgId, username, firstName, lastName, photoUrl } = req.body;

    if (!tgId) {
      return res.status(400).json({ error: "Telegram ID talab qilinadi" });
    }

    let user = await User.findOne({ tgId: tgId.toString() });

    // Agar foydalanuvchi botni start qilmasdan to'g'ridan-to'g'ri havoladan kirsa (kamdan-kam holat)
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
      // Profil rasmi yoki boshqa ma'lumotlarni yangilab qo'yamiz
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

// --- RENDER VA WEBHOOK / POLLING SOZLAMASI ---
if (process.env.NODE_ENV === 'production') {
  // Production (Render) rejimida webhook ishlatamiz
  const webhookPath = `/bot${process.env.BOT_TOKEN}`;
  app.use(bot.webhookCallback(webhookPath));
  bot.telegram.setWebhook(`${process.env.APP_URL}${webhookPath}`);
  console.log('🔮 Bot Webhook rejimida ishga tushdi!');
} else {
  // Local (mahalliy) kompyuterda oddiy Polling ishlatamiz
  bot.launch();
  console.log('🤖 Bot Polling (mahalliy) rejimida ishga tushdi!');
}

// Portni eshitish
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} portida ishlamoqda!`);
});

// Kutilmagan to'xtashlarni boshqarish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));