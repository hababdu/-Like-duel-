require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/build')));

// MongoDB ulanishi
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://habibullox:6RVgQY%23N27CJY%405@cluster0.mku75qs.mongodb.net/telegram_game?retryWrites=true&w=majority&appName=Cluster0';

console.log('📡 MongoDB ulanishi...');

// Schemalar
const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: String,
    username: String,
    photoUrl: String,
    languageCode: { type: String, default: 'en' },
    isPremium: { type: Boolean, default: false },
    isBot: { type: Boolean, default: false },
    joinDate: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    visitCount: { type: Number, default: 0 },
    
    // O'yin statistikasi
    gameStats: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        totalGames: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        winStreak: { type: Number, default: 0 },
        maxWinStreak: { type: Number, default: 0 },
        totalCoinsEarned: { type: Number, default: 0 },
        duelsWon: { type: Number, default: 0 },
        duelsPlayed: { type: Number, default: 0 }
    }
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    roomCode: String,
    player1: {
        id: Number,
        username: String,
        firstName: String,
        photoUrl: String,
        choice: String,
        ready: Boolean,
        connected: Boolean,
        isBot: { type: Boolean, default: false }
    },
    player2: {
        id: Number,
        username: String,
        firstName: String,
        photoUrl: String,
        choice: String,
        ready: Boolean,
        connected: Boolean,
        isBot: { type: Boolean, default: false }
    },
    status: { type: String, enum: ['waiting', 'playing', 'finished', 'cancelled'], default: 'waiting' },
    result: String,
    winnerId: Number,
    isDraw: { type: Boolean, default: false },
    coinsEarned: {
        player1: { type: Number, default: 0 },
        player2: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now },
    finishedAt: Date,
    duration: Number
}, { timestamps: true });

const coinSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true, index: true },
    balance: { type: Number, default: 1500 },
    earned: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    lastDaily: Date,
    transactions: [{
        type: String,
        amount: Number,
        description: String,
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['avatar', 'frame', 'title', 'effect'], required: true },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    price: { type: Number, required: true },
    icon: String,
    color: String,
    available: { type: Boolean, default: true }
}, { timestamps: true });

const userItemSchema = new mongoose.Schema({
    userId: { type: Number, required: true, index: true },
    itemId: { type: String, required: true },
    purchasedAt: { type: Date, default: Date.now },
    equipped: { type: Boolean, default: false }
}, { timestamps: true });

const leaderboardSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true, index: true },
    username: String,
    firstName: String,
    totalCoins: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    weeklyWins: { type: Number, default: 0 },
    rank: Number,
    gamesPlayed: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }
}, { timestamps: true });

// Modellar
const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);
const Coin = mongoose.model('Coin', coinSchema);
const Item = mongoose.model('Item', itemSchema);
const UserItem = mongoose.model('UserItem', userItemSchema);
const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

// MongoDB ulanish
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB ga muvaffaqiyatli ulandi'))
.catch(err => {
    console.error('❌ MongoDB ulanish xatosi:', err.message);
    process.exit(1);
});

// ==================== TELEGRAM BOT ====================
const BOT_TOKEN = process.env.BOT_TOKEN || 'your_bot_token_here';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Bot ishga tushirilmoqda...');

// Bot komandalari
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log(`👤 Foydalanuvchi: ${user.first_name} (${user.id})`);
    
    // Foydalanuvchini saqlash
    await saveOrUpdateUser(user);
    
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-app.onrender.com';
    
    const keyboard = {
        inline_keyboard: [[
            {
                text: "🎮 O'ynash",
                web_app: { url: webAppUrl }
            }
        ]]
    };
    
    bot.sendMessage(chatId,
        `🎮 *Tosh-Qaychi-Qog'oz* o'yiniga xush kelibsiz ${user.first_name}! 👋\n\n` +
        `O'yinni boshlash uchun quyidagi tugmani bosing va haqiqiy o'yinchilar bilan raqobatlashing!\n\n` +
        `🏆 *Qanday o'ynash:*\n` +
        `• Tosh qaychini yengadi\n` +
        `• Qaychi qog'ozni yengadi\n` +
        `• Qog'oz toshni yengadi\n\n` +
        `🎁 *Mukofotlar:*\n` +
        `• G'alaba: +50-100 koin\n` +
        `• Durrang: +20 koin\n` +
        `• Ketma-ket g'alaba: +10 bonus\n\n` +
        `@rock_paper_scissors_bot`,
        {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
});

bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    const dbUser = await User.findOne({ telegramId: user.id });
    if (!dbUser) {
        return bot.sendMessage(chatId, "❌ Profil topilmadi. /start ni bosing.");
    }
    
    const stats = dbUser.gameStats || {};
    const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
    
    const profileMessage = 
        `👤 *PROFIL*\n\n` +
        `*Ism:* ${dbUser.firstName}\n` +
        `*Username:* @${dbUser.username || 'yoq'}\n` +
        `*ID:* ${dbUser.telegramId}\n\n` +
        `🏆 *Statistika:*\n` +
        `O'yinlar: ${stats.totalGames || 0}\n` +
        `G'alaba: ${stats.wins || 0}\n` +
        `Mag'lubiyat: ${stats.losses || 0}\n` +
        `Durrang: ${stats.draws || 0}\n` +
        `G'alaba %: ${winRate}%\n` +
        `Ketma-ket: ${stats.winStreak || 0}\n\n` +
        `🪙 *Koinlar:* ${await getCoins(user.id)}\n` +
        `📅 *A'zo bo'lgan:* ${new Date(dbUser.joinDate).toLocaleDateString('uz-UZ')}`;
    
    bot.sendMessage(chatId, profileMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const todayGames = await Game.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    const statsMessage = 
        `📊 *GLOBAL STATISTIKA*\n\n` +
        `👥 Foydalanuvchilar: ${totalUsers}\n` +
        `🎮 Jami o'yinlar: ${totalGames}\n` +
        `📈 Bugun: ${todayGames}\n` +
        `🕒 Faol o'yinlar: ${activeGames.size}\n\n` +
        `🏆 *TOP 3 O'YINCHI:*\n`;
    
    const topPlayers = await Leaderboard.find().sort({ totalCoins: -1 }).limit(3);
    
    let leaderboardText = '';
    topPlayers.forEach((player, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        leaderboardText += `${medals[index]} ${player.firstName} - ${player.totalCoins} koin\n`;
    });
    
    bot.sendMessage(chatId, statsMessage + leaderboardText, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = 
        `❓ *YORDAM*\n\n` +
        `*Komandalar:*\n` +
        `/start - O'yinni boshlash\n` +
        `/profile - Profilni ko'rish\n` +
        `/stats - Statistika\n` +
        `/help - Yordam\n` +
        `/invite - Do'stni taklif qilish\n\n` +
        `*Qoidalar:*\n` +
        `✊ Tosh qaychini yengadi\n` +
        `✌️ Qaychi qog'ozni yengadi\n` +
        `✋ Qog'oz toshni yengadi\n\n` +
        `*Mukofotlar:*\n` +
        `🏆 G'alaba: 50-100 koin\n` +
        `🤝 Durrang: 20 koin\n` +
        `🔥 Streak bonus: +10/win\n\n` +
        `Savol va takliflar: @admin_username`;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/invite/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    const inviteLink = `https://t.me/share/url?url=https://t.me/rock_paper_scissors_bot&text=🎮 Salom! Meni Tosh-Qaychi-Qog'oz o'yinida mag'lub qila olasanmi?`;
    
    bot.sendMessage(chatId,
        `🎯 *Do'stlaringizni taklif qiling!*\n\n` +
        `${user.first_name}, do'stlaringiz bilan raqobatlashish uchun ulashish tugmasini bosing.\n\n` +
        `Har bir taklif qilingan do'st uchun +100 koin bonus!`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "📤 Ulashish", url: inviteLink }
                ]]
            }
        }
    );
});

// ==================== WEBSOCKET SERVER ====================
const activeGames = new Map();
const waitingPlayers = new Map();
const playerSockets = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔌 WebSocket yangi ulanish');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('📥 WebSocket xabar:', data.type);
            
            await handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('❌ WebSocket xatosi:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Server xatosi'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket uzildi');
        handleDisconnection(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket xatosi:', error);
    });
});

async function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'register':
            await handleRegister(ws, data);
            break;
            
        case 'quick_game':
            await handleQuickGame(ws, data);
            break;
            
        case 'create_room':
            await handleCreateRoom(ws, data);
            break;
            
        case 'join_room':
            await handleJoinRoom(ws, data);
            break;
            
        case 'make_choice':
            await handleMakeChoice(ws, data);
            break;
            
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
        default:
            console.log('❌ Noma\'lum xabar turi:', data.type);
    }
}

async function handleRegister(ws, data) {
    const { userId, userData } = data;
    
    // Foydalanuvchini saqlash
    const user = await saveOrUpdateUser(userData);
    
    // Socket'ni saqlash
    playerSockets.set(userId, ws);
    
    // Koinlarni olish yoki yaratish
    let userCoins = await Coin.findOne({ userId });
    if (!userCoins) {
        userCoins = new Coin({
            userId,
            balance: 1500,
            earned: 1500,
            transactions: [{
                type: 'initial',
                amount: 1500,
                description: 'Boshlang\'ich koinlar',
                timestamp: new Date()
            }]
        });
        await userCoins.save();
    }
    
    // Leaderboard yaratish
    let leaderboard = await Leaderboard.findOne({ userId });
    if (!leaderboard) {
        leaderboard = new Leaderboard({
            userId,
            username: user.username,
            firstName: user.firstName,
            totalCoins: userCoins.balance
        });
        await leaderboard.save();
    }
    
    ws.send(JSON.stringify({
        type: 'registered',
        user: {
            id: user.telegramId,
            firstName: user.firstName,
            username: user.username,
            photoUrl: user.photoUrl
        },
        coins: userCoins.balance,
        stats: user.gameStats
    }));
}

async function handleQuickGame(ws, data) {
    const { userId } = data;
    
    // O'yin yaratish
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
        ws.send(JSON.stringify({ type: 'error', message: 'Foydalanuvchi topilmadi' }));
        return;
    }
    
    const gameData = {
        gameId,
        player1: {
            id: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            photoUrl: user.photoUrl,
            choice: null,
            ready: false,
            connected: true,
            isBot: false
        },
        player2: null,
        status: 'waiting',
        createdAt: new Date()
    };
    
    activeGames.set(gameId, gameData);
    waitingPlayers.set(userId, { socket: ws, gameId });
    
    // MongoDB'ga saqlash
    const game = new Game(gameData);
    await game.save();
    
    // Raqib qidirish
    await findOpponent(gameId, userId);
    
    ws.send(JSON.stringify({
        type: 'game_created',
        gameId,
        status: 'searching',
        timer: 30
    }));
}

async function findOpponent(gameId, playerId) {
    const game = activeGames.get(gameId);
    if (!game) return;
    
    // Haqiqiy raqib qidirish
    let foundOpponent = null;
    
    for (const [opponentId, playerData] of waitingPlayers.entries()) {
        if (opponentId !== playerId && playerData.gameId !== gameId) {
            foundOpponent = opponentId;
            break;
        }
    }
    
    if (foundOpponent) {
        // Raqib topildi
        const opponentData = waitingPlayers.get(foundOpponent);
        const opponentUser = await User.findOne({ telegramId: foundOpponent });
        
        game.player2 = {
            id: opponentUser.telegramId,
            username: opponentUser.username,
            firstName: opponentUser.firstName,
            photoUrl: opponentUser.photoUrl,
            choice: null,
            ready: false,
            connected: true,
            isBot: false
        };
        game.status = 'playing';
        
        activeGames.set(gameId, game);
        
        // Raqibning o'yinini yangilash
        const opponentGame = activeGames.get(opponentData.gameId);
        if (opponentGame) {
            opponentGame.player2 = {
                id: game.player1.id,
                username: game.player1.username,
                firstName: game.player1.firstName,
                photoUrl: game.player1.photoUrl,
                choice: null,
                ready: false,
                connected: true,
                isBot: false
            };
            opponentGame.status = 'playing';
            activeGames.set(opponentData.gameId, opponentGame);
        }
        
        // Har ikki o'yinchiga xabar
        const playerSocket = playerSockets.get(playerId);
        const opponentSocket = playerSockets.get(foundOpponent);
        
        if (playerSocket) {
            playerSocket.send(JSON.stringify({
                type: 'opponent_found',
                gameId,
                opponent: game.player2,
                isBot: false
            }));
        }
        
        if (opponentSocket) {
            opponentSocket.send(JSON.stringify({
                type: 'opponent_found',
                gameId: opponentData.gameId,
                opponent: game.player1,
                isBot: false
            }));
        }
        
        // Waiting ro'yxatidan o'chirish
        waitingPlayers.delete(playerId);
        waitingPlayers.delete(foundOpponent);
        
        // Taymer boshlash
        startGameTimer(gameId);
        
    } else {
        // Raqib topilmasa, 30 soniyadan keyin bot qo'shish
        setTimeout(async () => {
            if (activeGames.has(gameId) && activeGames.get(gameId).status === 'waiting') {
                await addBotToGame(gameId);
            }
        }, 30000);
    }
}

async function addBotToGame(gameId) {
    const game = activeGames.get(gameId);
    if (!game || game.player2) return;
    
    // Bot yaratish
    const botNames = ['AI_Pro', 'SmartBot', 'CyberPlayer', 'GameMaster'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    
    game.player2 = {
        id: 999999999,
        username: randomName.toLowerCase(),
        firstName: randomName,
        photoUrl: null,
        choice: null,
        ready: false,
        connected: true,
        isBot: true
    };
    game.status = 'playing';
    
    activeGames.set(gameId, game);
    
    // O'yinchiga xabar
    const playerSocket = playerSockets.get(game.player1.id);
    if (playerSocket) {
        playerSocket.send(JSON.stringify({
            type: 'opponent_found',
            gameId,
            opponent: game.player2,
            isBot: true
        }));
    }
    
    // Bot tanlov qilish
    setTimeout(() => {
        if (activeGames.has(gameId)) {
            const currentGame = activeGames.get(gameId);
            if (currentGame.status === 'playing' && !currentGame.player2.choice) {
                const choices = ['rock', 'paper', 'scissors'];
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                
                currentGame.player2.choice = botChoice;
                currentGame.player2.ready = true;
                
                activeGames.set(gameId, currentGame);
                
                // O'yinchiga xabar
                if (playerSocket) {
                    playerSocket.send(JSON.stringify({
                        type: 'opponent_choice_made',
                        gameId
                    }));
                }
                
                // Agar o'yinchi ham tanlagan bo'lsa, natijani hisoblash
                if (currentGame.player1.ready) {
                    calculateResult(gameId);
                }
            }
        }
    }, Math.random() * 3000 + 2000);
    
    // Taymer boshlash
    startGameTimer(gameId);
}

function startGameTimer(gameId) {
    const timer = setTimeout(async () => {
        if (activeGames.has(gameId)) {
            const game = activeGames.get(gameId);
            if (game.status === 'playing') {
                game.status = 'finished';
                game.result = 'timeout';
                game.finishedAt = new Date();
                
                activeGames.set(gameId, game);
                
                // Har ikki o'yinchiga xabar
                const player1Socket = playerSockets.get(game.player1.id);
                const player2Socket = game.player2.isBot ? null : playerSockets.get(game.player2.id);
                
                const timeoutMessage = {
                    type: 'game_result',
                    gameId,
                    result: 'timeout',
                    message: 'O\'yin vaqti tugadi'
                };
                
                if (player1Socket) player1Socket.send(JSON.stringify(timeoutMessage));
                if (player2Socket) player2Socket.send(JSON.stringify(timeoutMessage));
                
                // Ma'lumotlarni saqlash
                await saveGameResult(gameId);
                
                // Faol o'yinlardan o'chirish
                setTimeout(() => activeGames.delete(gameId), 10000);
            }
        }
    }, 60000); // 60 soniya
    
    // Taymer ID'sini saqlash
    gameTimers.set(gameId, timer);
}

const gameTimers = new Map();

async function handleMakeChoice(ws, data) {
    const { userId, gameId, choice } = data;
    
    const game = activeGames.get(gameId);
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'O\'yin topilmadi' }));
        return;
    }
    
    // O'yinchi tanlovini saqlash
    if (game.player1.id === userId) {
        game.player1.choice = choice;
        game.player1.ready = true;
    } else if (game.player2.id === userId) {
        game.player2.choice = choice;
        game.player2.ready = true;
    } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Siz bu o\'yinda emassiz' }));
        return;
    }
    
    activeGames.set(gameId, game);
    
    // Raqibga xabar
    const opponentId = game.player1.id === userId ? game.player2.id : game.player1.id;
    const opponentSocket = playerSockets.get(opponentId);
    
    if (opponentSocket && !game.player2.isBot) {
        opponentSocket.send(JSON.stringify({
            type: 'opponent_choice_made',
            gameId
        }));
    }
    
    // Ikkala o'yinchi ham tanlagan bo'lsa
    if (game.player1.ready && game.player2.ready) {
        await calculateResult(gameId);
    } else if (game.player1.ready && game.player2.isBot) {
        // Agar bot tanlamagan bo'lsa, botga tanlash
        setTimeout(() => {
            if (activeGames.has(gameId)) {
                const currentGame = activeGames.get(gameId);
                if (currentGame.player2.isBot && !currentGame.player2.choice) {
                    const choices = ['rock', 'paper', 'scissors'];
                    const botChoice = choices[Math.floor(Math.random() * choices.length)];
                    
                    currentGame.player2.choice = botChoice;
                    currentGame.player2.ready = true;
                    
                    activeGames.set(gameId, currentGame);
                    
                    calculateResult(gameId);
                }
            }
        }, 1000);
    }
    
    ws.send(JSON.stringify({
        type: 'choice_accepted',
        choice,
        gameId
    }));
}

async function calculateResult(gameId) {
    const game = activeGames.get(gameId);
    if (!game || !game.player1.choice || !game.player2.choice) return;
    
    // Natijani hisoblash
    const choices = {
        rock: { beats: 'scissors', loses: 'paper' },
        paper: { beats: 'rock', loses: 'scissors' },
        scissors: { beats: 'paper', loses: 'rock' }
    };
    
    const player1Choice = game.player1.choice;
    const player2Choice = game.player2.choice;
    
    let result, winnerId, isDraw;
    
    if (player1Choice === player2Choice) {
        result = 'draw';
        winnerId = null;
        isDraw = true;
    } else if (choices[player1Choice].beats === player2Choice) {
        result = 'player1_win';
        winnerId = game.player1.id;
        isDraw = false;
    } else {
        result = 'player2_win';
        winnerId = game.player2.id;
        isDraw = false;
    }
    
    // Koinlarni hisoblash
    const coinsResult = await calculateCoins(game, result, winnerId);
    
    // O'yinni yangilash
    game.status = 'finished';
    game.result = result;
    game.winnerId = winnerId;
    game.isDraw = isDraw;
    game.coinsEarned = {
        player1: coinsResult.player1Coins,
        player2: coinsResult.player2Coins
    };
    game.finishedAt = new Date();
    game.duration = game.finishedAt - game.createdAt;
    
    activeGames.set(gameId, game);
    
    // Taymerni to'xtatish
    if (gameTimers.has(gameId)) {
        clearTimeout(gameTimers.get(gameId));
        gameTimers.delete(gameId);
    }
    
    // O'yinchilarga natija haqida xabar
    const resultMessage = {
        type: 'game_result',
        gameId,
        result: result,
        winnerId: winnerId,
        isDraw: isDraw,
        choices: {
            player1: player1Choice,
            player2: player2Choice
        },
        coins: coinsResult,
        players: {
            player1: game.player1,
            player2: game.player2
        }
    };
    
    const player1Socket = playerSockets.get(game.player1.id);
    const player2Socket = game.player2.isBot ? null : playerSockets.get(game.player2.id);
    
    if (player1Socket) player1Socket.send(JSON.stringify(resultMessage));
    if (player2Socket) player2Socket.send(JSON.stringify(resultMessage));
    
    // Ma'lumotlarni saqlash
    await saveGameResult(gameId);
    
    // Faol o'yinlardan o'chirish
    setTimeout(() => activeGames.delete(gameId), 30000);
}

async function calculateCoins(game, result, winnerId) {
    let player1Coins = 0;
    let player2Coins = 0;
    
    // Asosiy mukofotlar
    const baseWin = game.player2.isBot ? 50 : 100; // Bot bilan 50, o'yinchi bilan 100
    const baseLose = 10;
    const drawReward = 20;
    
    if (result === 'draw') {
        player1Coins = drawReward;
        player2Coins = drawReward;
    } else if (result === 'player1_win') {
        player1Coins = baseWin;
        player2Coins = baseLose;
        
        // Ketma-ket g'alaba bonusini qo'shish
        const user = await User.findOne({ telegramId: game.player1.id });
        if (user && user.gameStats.winStreak > 0) {
            player1Coins += user.gameStats.winStreak * 10;
        }
    } else {
        player1Coins = baseLose;
        player2Coins = baseWin;
        
        // Ketma-ket g'alaba bonusini qo'shish
        const user = await User.findOne({ telegramId: game.player2.id });
        if (user && user.gameStats.winStreak > 0) {
            player2Coins += user.gameStats.winStreak * 10;
        }
    }
    
    // Random bonus (10% ehtimol)
    if (Math.random() < 0.1) {
        const bonus = Math.floor(Math.random() * 50) + 10;
        if (result === 'player1_win') {
            player1Coins += bonus;
        } else if (result === 'player2_win') {
            player2Coins += bonus;
        } else {
            player1Coins += Math.floor(bonus / 2);
            player2Coins += Math.floor(bonus / 2);
        }
    }
    
    // Koinlarni saqlash
    if (player1Coins > 0) {
        await addCoins(game.player1.id, player1Coins, 'game_reward', `O'yin: ${result === 'player1_win' ? 'G\'alaba' : result === 'draw' ? 'Durrang' : 'Mag\'lubiyat'}`);
    }
    
    if (player2Coins > 0 && !game.player2.isBot) {
        await addCoins(game.player2.id, player2Coins, 'game_reward', `O'yin: ${result === 'player2_win' ? 'G\'alaba' : result === 'draw' ? 'Durrang' : 'Mag\'lubiyat'}`);
    }
    
    return { player1Coins, player2Coins };
}

async function saveGameResult(gameId) {
    try {
        const game = activeGames.get(gameId);
        if (!game) return;
        
        // MongoDB'ga saqlash
        await Game.updateOne(
            { gameId },
            {
                player2: game.player2,
                status: game.status,
                result: game.result,
                winnerId: game.winnerId,
                isDraw: game.isDraw,
                coinsEarned: game.coinsEarned,
                finishedAt: game.finishedAt,
                duration: game.duration
            }
        );
        
        // Statistika yangilash
        if (!game.player2.isBot) {
            await updateGameStats(game.player1.id, game.player2.id, game.result);
        }
        
        // Leaderboard yangilash
        if (game.player1Coins > 0) {
            await updateLeaderboard(game.player1.id, game.player1Coins);
        }
        if (game.player2Coins > 0 && !game.player2.isBot) {
            await updateLeaderboard(game.player2.id, game.player2Coins);
        }
        
    } catch (error) {
        console.error('❌ Oyin natijasini saqlash xatosi:', error);
    }
}

async function updateGameStats(player1Id, player2Id, result) {
    try {
        const player1 = await User.findOne({ telegramId: player1Id });
        const player2 = await User.findOne({ telegramId: player2Id });
        
        if (!player1 || !player2) return;
        
        // Player 1 statistikasi
        player1.gameStats.totalGames += 1;
        player1.lastActivity = new Date();
        
        // Player 2 statistikasi
        player2.gameStats.totalGames += 1;
        player2.lastActivity = new Date();
        
        if (result === 'player1_win') {
            player1.gameStats.wins += 1;
            player1.gameStats.winStreak += 1;
            player1.gameStats.duelsWon += 1;
            player1.gameStats.duelsPlayed += 1;
            
            player2.gameStats.losses += 1;
            player2.gameStats.winStreak = 0;
            player2.gameStats.duelsPlayed += 1;
            
            if (player1.gameStats.winStreak > player1.gameStats.maxWinStreak) {
                player1.gameStats.maxWinStreak = player1.gameStats.winStreak;
            }
            
        } else if (result === 'player2_win') {
            player2.gameStats.wins += 1;
            player2.gameStats.winStreak += 1;
            player2.gameStats.duelsWon += 1;
            player2.gameStats.duelsPlayed += 1;
            
            player1.gameStats.losses += 1;
            player1.gameStats.winStreak = 0;
            player1.gameStats.duelsPlayed += 1;
            
            if (player2.gameStats.winStreak > player2.gameStats.maxWinStreak) {
                player2.gameStats.maxWinStreak = player2.gameStats.winStreak;
            }
            
        } else { // draw
            player1.gameStats.draws += 1;
            player2.gameStats.draws += 1;
            player1.gameStats.winStreak = 0;
            player2.gameStats.winStreak = 0;
            player1.gameStats.duelsPlayed += 1;
            player2.gameStats.duelsPlayed += 1;
        }
        
        // G'alaba foizini hisoblash
        player1.gameStats.winRate = player1.gameStats.totalGames > 0 
            ? Math.round((player1.gameStats.wins / player1.gameStats.totalGames) * 100)
            : 0;
            
        player2.gameStats.winRate = player2.gameStats.totalGames > 0
            ? Math.round((player2.gameStats.wins / player2.gameStats.totalGames) * 100)
            : 0;
        
        await player1.save();
        await player2.save();
        
    } catch (error) {
        console.error('❌ Statistika yangilash xatosi:', error);
    }
}

function handleDisconnection(ws) {
    // O'yinchi socket'ini topish
    let disconnectedUserId = null;
    for (const [userId, socket] of playerSockets.entries()) {
        if (socket === ws) {
            disconnectedUserId = userId;
            break;
        }
    }
    
    if (!disconnectedUserId) return;
    
    // Socket'ni o'chirish
    playerSockets.delete(disconnectedUserId);
    
    // Waiting ro'yxatidan o'chirish
    waitingPlayers.delete(disconnectedUserId);
    
    // O'yinchining faol o'yinlarini bekor qilish
    for (const [gameId, game] of activeGames.entries()) {
        if ((game.player1.id === disconnectedUserId || game.player2.id === disconnectedUserId) && game.status === 'playing') {
            game.status = 'cancelled';
            game.result = 'disconnected';
            game.finishedAt = new Date();
            
            activeGames.set(gameId, game);
            
            // Qolgan o'yinchiga xabar
            const opponentId = game.player1.id === disconnectedUserId ? game.player2.id : game.player1.id;
            const opponentSocket = playerSockets.get(opponentId);
            
            if (opponentSocket) {
                opponentSocket.send(JSON.stringify({
                    type: 'opponent_disconnected',
                    gameId
                }));
            }
            
            // Taymerni to'xtatish
            if (gameTimers.has(gameId)) {
                clearTimeout(gameTimers.get(gameId));
                gameTimers.delete(gameId);
            }
            
            // Ma'lumotlarni saqlash
            saveGameResult(gameId);
            
            // 10 soniyadan keyin o'chirish
            setTimeout(() => activeGames.delete(gameId), 10000);
        }
    }
}

// ==================== UTILITY FUNCTIONS ====================
async function saveOrUpdateUser(telegramUser) {
    try {
        const userData = {
            telegramId: telegramUser.id,
            firstName: telegramUser.first_name || 'Foydalanuvchi',
            lastName: telegramUser.last_name || '',
            username: telegramUser.username || '',
            photoUrl: telegramUser.photo_url || '',
            languageCode: telegramUser.language_code || 'en',
            isPremium: telegramUser.is_premium || false,
            isBot: telegramUser.is_bot || false,
            lastActivity: new Date()
        };
        
        let user = await User.findOne({ telegramId: userData.telegramId });
        
        if (user) {
            // Yangilash
            user.visitCount += 1;
            user.lastActivity = userData.lastActivity;
            user.firstName = userData.firstName;
            user.username = userData.username;
            user.photoUrl = userData.photoUrl;
            user.isPremium = userData.isPremium;
            
            await user.save();
            console.log(`✅ Foydalanuvchi yangilandi: ${userData.firstName}`);
        } else {
            // Yangi foydalanuvchi
            user = new User({
                ...userData,
                joinDate: new Date(),
                visitCount: 1,
                gameStats: {
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    totalGames: 0,
                    winRate: 0,
                    winStreak: 0,
                    maxWinStreak: 0,
                    totalCoinsEarned: 0,
                    duelsWon: 0,
                    duelsPlayed: 0
                }
            });
            
            await user.save();
            console.log(`🎉 Yangi foydalanuvchi: ${userData.firstName}`);
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Foydalanuvchi saqlash xatosi:', error);
        return null;
    }
}

async function getCoins(userId) {
    try {
        const coin = await Coin.findOne({ userId });
        return coin ? coin.balance : 0;
    } catch (error) {
        console.error('❌ Koin olish xatosi:', error);
        return 0;
    }
}

async function addCoins(userId, amount, type, description) {
    try {
        let coin = await Coin.findOne({ userId });
        
        if (!coin) {
            coin = new Coin({
                userId,
                balance: amount,
                earned: amount,
                spent: 0
            });
        } else {
            coin.balance += amount;
            coin.earned += amount;
        }
        
        coin.transactions.push({
            type,
            amount,
            description,
            timestamp: new Date()
        });
        
        await coin.save();
        return coin.balance;
        
    } catch (error) {
        console.error('❌ Koin qoshish xatosi:', error);
        return 0;
    }
}

async function updateLeaderboard(userId, coinsAdded) {
    try {
        const user = await User.findOne({ telegramId: userId });
        if (!user) return;
        
        let leaderboard = await Leaderboard.findOne({ userId });
        
        if (!leaderboard) {
            leaderboard = new Leaderboard({
                userId,
                username: user.username,
                firstName: user.firstName,
                totalCoins: coinsAdded,
                gamesPlayed: 1,
                winRate: user.gameStats.winRate || 0
            });
        } else {
            leaderboard.totalCoins += coinsAdded;
            leaderboard.gamesPlayed = user.gameStats.totalGames || 0;
            leaderboard.winRate = user.gameStats.winRate || 0;
            leaderboard.winStreak = user.gameStats.winStreak || 0;
            leaderboard.weeklyWins = Math.floor(user.gameStats.wins / 7);
        }
        
        await leaderboard.save();
        
        // Ranking qayta hisoblash
        await calculateRanks();
        
    } catch (error) {
        console.error('❌ Leaderboard yangilash xatosi:', error);
    }
}

async function calculateRanks() {
    try {
        const leaders = await Leaderboard.find().sort({ totalCoins: -1 });
        
        for (let i = 0; i < leaders.length; i++) {
            leaders[i].rank = i + 1;
            await leaders[i].save();
        }
    } catch (error) {
        console.error('❌ Rank hisoblash xatosi:', error);
    }
}

// ==================== API ENDPOINTS ====================

// 1. Foydalanuvchi ma'lumotlari
app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }
        
        const coins = await Coin.findOne({ userId });
        const items = await UserItem.find({ userId });
        const equippedItems = await UserItem.find({ userId, equipped: true });
        
        res.json({
            success: true,
            user: {
                id: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                photoUrl: user.photoUrl,
                languageCode: user.languageCode,
                isPremium: user.isPremium,
                joinDate: user.joinDate,
                lastActivity: user.lastActivity,
                visitCount: user.visitCount
            },
            stats: user.gameStats,
            coins: coins ? coins.balance : 0,
            items: items.map(item => item.itemId),
            equipped: equippedItems.reduce((acc, item) => {
                acc[item.itemId] = true;
                return acc;
            }, {})
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Kunlik bonus
app.post('/api/daily-bonus', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId talab qilinadi' });
        }
        
        const coin = await Coin.findOne({ userId });
        if (!coin) {
            return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
        }
        
        const now = new Date();
        
        // Daily bonus tekshirish
        if (coin.lastDaily) {
            const lastDate = new Date(coin.lastDaily);
            const diffHours = (now - lastDate) / (1000 * 60 * 60);
            
            if (diffHours < 20) {
                return res.json({
                    success: false,
                    message: `Kunlik bonus ${Math.ceil(20 - diffHours)} soatdan keyin`,
                    nextIn: Math.ceil(20 - diffHours)
                });
            }
            
            // Streak davom ettirish
            if (diffHours < 48) {
                coin.dailyStreak += 1;
            } else {
                coin.dailyStreak = 1;
            }
        } else {
            coin.dailyStreak = 1;
        }
        
        // Bonus miqdori
        let bonusAmount = 100;
        bonusAmount += coin.dailyStreak * 25;
        
        // Max 300 gacha
        if (bonusAmount > 300) bonusAmount = 300;
        
        // Random extra bonus
        if (Math.random() < 0.2) {
            bonusAmount += Math.floor(Math.random() * 50);
        }
        
        // Koinlarni qo'shish
        coin.balance += bonusAmount;
        coin.earned += bonusAmount;
        coin.lastDaily = now;
        
        coin.transactions.push({
            type: 'daily',
            amount: bonusAmount,
            description: `Kunlik bonus (${coin.dailyStreak} kun)`,
            timestamp: now
        });
        
        await coin.save();
        
        // Leaderboard yangilash
        await updateLeaderboard(userId, bonusAmount);
        
        res.json({
            success: true,
            amount: bonusAmount,
            streak: coin.dailyStreak,
            newBalance: coin.balance,
            message: `+${bonusAmount} koin! (${coin.dailyStreak} kun ketma-ket)`
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. O'yin tarixi
app.get('/api/games/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const games = await Game.find({
            $or: [
                { 'player1.id': userId },
                { 'player2.id': userId }
            ],
            status: 'finished'
        })
        .sort({ finishedAt: -1 })
        .skip(skip)
        .limit(limit);
        
        const totalGames = await Game.countDocuments({
            $or: [
                { 'player1.id': userId },
                { 'player2.id': userId }
            ],
            status: 'finished'
        });
        
        const enrichedGames = await Promise.all(games.map(async (game) => {
            // Raqib ma'lumotlari
            const opponent = game.player1.id === userId ? game.player2 : game.player1;
            
            // O'yin natijasi
            let result = 'draw';
            let coinsEarned = 0;
            
            if (game.result === 'player1_win') {
                result = game.player1.id === userId ? 'win' : 'lose';
                coinsEarned = game.player1.id === userId ? game.coinsEarned.player1 : game.coinsEarned.player2;
            } else if (game.result === 'player2_win') {
                result = game.player2.id === userId ? 'win' : 'lose';
                coinsEarned = game.player2.id === userId ? game.coinsEarned.player2 : game.coinsEarned.player1;
            } else {
                coinsEarned = game.player1.id === userId ? game.coinsEarned.player1 : game.coinsEarned.player2;
            }
            
            return {
                gameId: game.gameId,
                opponent: {
                    id: opponent.id,
                    name: opponent.firstName,
                    username: opponent.username,
                    isBot: opponent.isBot || false
                },
                result: result,
                choices: {
                    player: game.player1.id === userId ? game.player1.choice : game.player2.choice,
                    opponent: game.player1.id === userId ? game.player2.choice : game.player1.choice
                },
                coinsEarned: coinsEarned,
                date: game.finishedAt,
                duration: game.duration
            };
        }));
        
        res.json({
            success: true,
            games: enrichedGames,
            pagination: {
                page,
                limit,
                total: totalGames,
                pages: Math.ceil(totalGames / limit)
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const type = req.query.type || 'coins'; // coins, wins, streak
        
        let sortCriteria = {};
        switch (type) {
            case 'wins':
                sortCriteria = { 'stats.wins': -1 };
                break;
            case 'streak':
                sortCriteria = { 'stats.winStreak': -1 };
                break;
            default:
                sortCriteria = { totalCoins: -1 };
        }
        
        const leaders = await Leaderboard.find()
            .sort(sortCriteria)
            .limit(limit);
        
        // Foydalanuvchi ma'lumotlarini to'ldirish
        const enrichedLeaders = await Promise.all(leaders.map(async (leader, index) => {
            const user = await User.findOne({ telegramId: leader.userId });
            const coin = await Coin.findOne({ userId: leader.userId });
            
            return {
                rank: index + 1,
                id: leader.userId,
                name: leader.firstName,
                username: leader.username,
                stats: {
                    totalCoins: leader.totalCoins,
                    balance: coin ? coin.balance : 0,
                    wins: user ? user.gameStats.wins : 0,
                    winRate: user ? user.gameStats.winRate : 0,
                    winStreak: user ? user.gameStats.winStreak : 0,
                    gamesPlayed: user ? user.gameStats.totalGames : 0
                },
                photoUrl: user ? user.photoUrl : null
            };
        }));
        
        res.json({
            success: true,
            leaderboard: enrichedLeaders,
            type: type
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Do'kon mahsulotlari
app.get('/api/shop/items', async (req, res) => {
    try {
        const items = await Item.find({ available: true });
        
        res.json({
            success: true,
            items: items.map(item => ({
                id: item.itemId,
                name: item.name,
                description: item.description,
                type: item.type,
                rarity: item.rarity,
                price: item.price,
                icon: item.icon,
                color: item.color
            }))
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Sovg'a sotib olish
app.post('/api/shop/purchase', async (req, res) => {
    try {
        const { userId, itemId } = req.body;
        
        if (!userId || !itemId) {
            return res.status(400).json({ success: false, error: 'userId va itemId talab qilinadi' });
        }
        
        // Sovg'ani tekshirish
        const item = await Item.findOne({ itemId, available: true });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Sovg\'a topilmadi' });
        }
        
        // Koinlarni tekshirish
        const coin = await Coin.findOne({ userId });
        if (!coin || coin.balance < item.price) {
            return res.status(400).json({ success: false, error: 'Koinlar yetarli emas' });
        }
        
        // Sovg'ani allaqachon sotib olganligini tekshirish
        const alreadyOwned = await UserItem.findOne({ userId, itemId });
        if (alreadyOwned) {
            return res.status(400).json({ success: false, error: 'Sizda bu sovg\'a bor' });
        }
        
        // Tranzaksiya
        coin.balance -= item.price;
        coin.spent += item.price;
        
        coin.transactions.push({
            type: 'purchase',
            amount: -item.price,
            description: `Sovg'a: ${item.name}`,
            timestamp: new Date()
        });
        
        await coin.save();
        
        // Sovg'ani qo'shish
        const userItem = new UserItem({
            userId,
            itemId,
            purchasedAt: new Date()
        });
        
        await userItem.save();
        
        res.json({
            success: true,
            message: `"${item.name}" sovg'asi sotib olindi`,
            newBalance: coin.balance,
            item: {
                id: item.itemId,
                name: item.name,
                type: item.type
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Sovg'alarni kiyish
app.post('/api/items/equip', async (req, res) => {
    try {
        const { userId, itemId } = req.body;
        
        if (!userId || !itemId) {
            return res.status(400).json({ success: false, error: 'userId va itemId talab qilinadi' });
        }
        
        // Sovg'a mavjudligini tekshirish
        const userItem = await UserItem.findOne({ userId, itemId });
        if (!userItem) {
            return res.status(404).json({ success: false, error: 'Sovg\'a topilmadi' });
        }
        
        // Sovg'a turini aniqlash
        const item = await Item.findOne({ itemId });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Sovg\'a ma\'lumotlari topilmadi' });
        }
        
        // Barcha shu turdagi sovg'alarni kiyilmagan qilish
        await UserItem.updateMany(
            {
                userId,
                itemId: { $in: await Item.find({ type: item.type }).distinct('itemId') }
            },
            { $set: { equipped: false } }
        );
        
        // Yangi sovg'ani kiyish
        userItem.equipped = true;
        await userItem.save();
        
        res.json({
            success: true,
            message: 'Sovg\'a kiyildi',
            item: {
                id: itemId,
                type: item.type,
                equipped: true
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. Foydalanuvchi sovg'alari
app.get('/api/items/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        const userItems = await UserItem.find({ userId });
        
        // Sovg'a ma'lumotlarini to'ldirish
        const items = await Promise.all(
            userItems.map(async (userItem) => {
                const item = await Item.findOne({ itemId: userItem.itemId });
                return item ? {
                    itemId: item.itemId,
                    name: item.name,
                    description: item.description,
                    type: item.type,
                    rarity: item.rarity,
                    icon: item.icon,
                    color: item.color,
                    price: item.price,
                    purchasedAt: userItem.purchasedAt,
                    equipped: userItem.equipped
                } : null;
            })
        );
        
        const filteredItems = items.filter(item => item !== null);
        
        res.json({
            success: true,
            items: filteredItems
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. Server statistikasi
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalGames = await Game.countDocuments();
        const activeUsers = await User.countDocuments({
            lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayGames = await Game.countDocuments({
            createdAt: { $gte: today }
        });
        
        const topPlayer = await Leaderboard.findOne().sort({ totalCoins: -1 });
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalGames,
                activeUsers,
                todayGames,
                activeGames: activeGames.size,
                waitingPlayers: waitingPlayers.size,
                connectedPlayers: playerSockets.size,
                topPlayer: topPlayer ? {
                    name: topPlayer.firstName,
                    coins: topPlayer.totalCoins
                } : null
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. Xona yaratish
app.post('/api/room/create', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId talab qilinadi' });
        }
        
        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
        }
        
        // Xona kodi yaratish
        const generateRoomCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };
        
        const roomCode = generateRoomCode();
        
        // O'yin yaratish
        const gameId = `room_${Date.now()}_${roomCode}`;
        
        const gameData = {
            gameId,
            roomCode,
            player1: {
                id: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                photoUrl: user.photoUrl,
                choice: null,
                ready: false,
                connected: true,
                isBot: false
            },
            player2: null,
            status: 'waiting',
            createdAt: new Date()
        };
        
        activeGames.set(gameId, gameData);
        
        // MongoDB'ga saqlash
        const game = new Game(gameData);
        await game.save();
        
        res.json({
            success: true,
            roomCode,
            gameId,
            message: `Xona yaratildi: ${roomCode}`
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. Xonaga ulanish
app.post('/api/room/join', async (req, res) => {
    try {
        const { userId, roomCode } = req.body;
        
        if (!userId || !roomCode) {
            return res.status(400).json({ success: false, error: 'userId va roomCode talab qilinadi' });
        }
        
        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
        }
        
        // Xonani topish
        let gameId = null;
        let targetGame = null;
        
        for (const [id, game] of activeGames.entries()) {
            if (game.roomCode === roomCode.toUpperCase() && game.status === 'waiting' && !game.player2) {
                gameId = id;
                targetGame = game;
                break;
            }
        }
        
        if (!targetGame) {
            return res.status(404).json({ success: false, error: 'Xona topilmadi yoki to\'ldi' });
        }
        
        // O'yinchini qo'shish
        targetGame.player2 = {
            id: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            photoUrl: user.photoUrl,
            choice: null,
            ready: false,
            connected: true,
            isBot: false
        };
        targetGame.status = 'playing';
        
        activeGames.set(gameId, targetGame);
        
        // Ikkala o'yinchiga xabar
        const player1Socket = playerSockets.get(targetGame.player1.id);
        const player2Socket = playerSockets.get(userId);
        
        if (player1Socket) {
            player1Socket.send(JSON.stringify({
                type: 'room_joined',
                gameId,
                opponent: targetGame.player2,
                message: 'Raqib xonaga ulandi'
            }));
        }
        
        if (player2Socket) {
            player2Socket.send(JSON.stringify({
                type: 'room_joined',
                gameId,
                opponent: targetGame.player1,
                message: 'Xonaga muvaffaqiyatli ulandingiz'
            }));
        }
        
        // Taymer boshlash
        startGameTimer(gameId);
        
        res.json({
            success: true,
            gameId,
            opponent: targetGame.player1,
            message: 'Xonaga ulandingiz'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. Faol xonalar ro'yxati
app.get('/api/rooms/active', async (req, res) => {
    try {
        const activeRooms = [];
        
        for (const [gameId, game] of activeGames.entries()) {
            if (game.roomCode && game.status === 'waiting' && !game.player2) {
                activeRooms.push({
                    roomCode: game.roomCode,
                    host: game.player1.firstName,
                    players: 1,
                    maxPlayers: 2,
                    createdAt: game.createdAt,
                    gameId
                });
            }
        }
        
        res.json({
            success: true,
            rooms: activeRooms,
            count: activeRooms.length
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 13. Sovg'a yaratish (Admin uchun)
app.post('/api/admin/items/create', async (req, res) => {
    try {
        const { itemId, name, description, type, rarity, price, icon, color } = req.body;
        
        if (!itemId || !name || !type || !price) {
            return res.status(400).json({ success: false, error: 'Barcha majburiy maydonlar talab qilinadi' });
        }
        
        // Sovg'ani yaratish
        const item = new Item({
            itemId,
            name,
            description,
            type,
            rarity: rarity || 'common',
            price,
            icon: icon || '🎁',
            color: color || '#ffffff',
            available: true
        });
        
        await item.save();
        
        res.json({
            success: true,
            message: 'Sovg\'a yaratildi',
            item
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 14. Server holati
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        bot: true,
        database: mongoose.connection.readyState === 1,
        active_games: activeGames.size,
        waiting_players: waitingPlayers.size,
        connected_players: playerSockets.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// ==================== FRONTEND TAYYORLASH ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// ==================== SERVER ISHGA TUSHIRISH ====================
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server ${PORT}-portda ishlayapti`);
    console.log(`🌐 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log('=======================================');
    
    // Dastlabki ma'lumotlarni yaratish
    initializeData();
});

async function initializeData() {
    try {
        // Boshlang'ich sovg'alarni yaratish
        const initialItems = [
            {
                itemId: 'avatar_default',
                name: 'Boshlang\'ich Avatar',
                description: 'Standart profil avatari',
                type: 'avatar',
                rarity: 'common',
                price: 0,
                icon: '👤',
                color: '#4CAF50'
            },
            {
                itemId: 'frame_basic',
                name: 'Oddiy Ramka',
                description: 'Asosiy profil ramkasi',
                type: 'frame',
                rarity: 'common',
                price: 0,
                icon: '🔲',
                color: '#2196F3'
            },
            {
                itemId: 'avatar_gold',
                name: 'Oltin Avatar',
                description: 'Eksklyuziv oltin avatar',
                type: 'avatar',
                rarity: 'legendary',
                price: 5000,
                icon: '👑',
                color: '#FFD700'
            },
            {
                itemId: 'avatar_dragon',
                name: 'Ajdarho Avatar',
                description: 'Kuchli ajdarho avatari',
                type: 'avatar',
                rarity: 'epic',
                price: 2500,
                icon: '🐉',
                color: '#FF5722'
            },
            {
                itemId: 'frame_fire',
                name: 'Olov Ramkasi',
                description: 'Alangali ramka',
                type: 'frame',
                rarity: 'epic',
                price: 2000,
                icon: '🔥',
                color: '#FF9800'
            },
            {
                itemId: 'frame_diamond',
                name: 'Olmos Ramka',
                description: 'Yorqin olmos ramka',
                type: 'frame',
                rarity: 'legendary',
                price: 4000,
                icon: '💎',
                color: '#00BCD4'
            },
            {
                itemId: 'title_champion',
                name: 'Chempion',
                description: 'G\'olib unvoni',
                type: 'title',
                rarity: 'epic',
                price: 3000,
                icon: '🏆',
                color: '#9C27B0'
            },
            {
                itemId: 'title_king',
                name: 'Shoh',
                description: 'Eng yuqori unvon',
                type: 'title',
                rarity: 'legendary',
                price: 5000,
                icon: '👑',
                color: '#FFC107'
            }
        ];
        
        for (const itemData of initialItems) {
            const existingItem = await Item.findOne({ itemId: itemData.itemId });
            if (!existingItem) {
                const item = new Item(itemData);
                await item.save();
            }
        }
        
        console.log('✅ Dastlabki ma\'lumotlar yaratildi');
        
    } catch (error) {
        console.error('❌ Dastlabki ma\'lumotlarni yaratish xatosi:', error);
    }
}

// Server to'xtash signallari
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
    console.log('🛑 Server to\'xtatilmoqda...');
    
    // Botni to'xtatish
    bot.stopPolling();
    
    // WebSocket'ni yopish
    wss.close();
    
    // Barcha socket'larni yopish
    for (const socket of playerSockets.values()) {
        socket.close();
    }
    
    // MongoDB ulanmasini yopish
    await mongoose.connection.close();
    
    console.log('✅ Server to\'xtatildi');
    process.exit(0);
}