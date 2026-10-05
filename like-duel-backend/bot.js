const { Telegraf } = require('telegraf');

// Token endi .env dan olinadi (kodga yozilmaydi). Eski token BotFather'da yangilanishi shart!
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Foydalanuvchi /start bosganda ishlaydigan kod
bot.start((ctx) => ctx.reply('Salom! "Like-duel" botiga xush kelibsiz!'));

// Oddiy matnli xabarlarga javob qaytarish
bot.on('text', (ctx) => {
    ctx.reply(`Siz yozdingiz: ${ctx.message.text}`);
});

// Botni ishga tushirish
bot.launch().then(() => {
    console.log('Bot muvaffaqiyatli ishga tushdi!');
});

// Botni xavfsiz to'xtatish uchun tizim signallari
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));