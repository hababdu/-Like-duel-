const { Telegraf } = require('telegraf');

// BotFather bergan tokenni shu yerga qo'ying
const bot = new Telegraf('8190087923:AAHf41SYoQwBjOpcvPBkjDP9AJYJu6BxJm4');

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