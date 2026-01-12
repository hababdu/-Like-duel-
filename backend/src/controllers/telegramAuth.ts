import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// User Schema (MongoDB)
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  username: { type: String, default: '' },
  languageCode: { type: String, default: 'en' },
  isPremium: { type: Boolean, default: false },
  rating: { type: Number, default: 1500 },
  coins: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  dailySuperLikes: { type: Number, default: 3 },
  streakDays: { type: Number, default: 0 },
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Telegram auth controller
export const telegramAuthController = async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const JWT_SECRET = process.env.JWT_SECRET!;

    console.log('📱 Telegram auth request received');

    // 1. Telegram initData ni validate qilish
    const isValid = validateTelegramInitData(initData, BOT_TOKEN);
    if (!isValid) {
      console.error('❌ Invalid Telegram initData');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid Telegram authentication data' 
      });
    }

    // 2. Foydalanuvchi ma'lumotlarini olish
    const urlParams = new URLSearchParams(initData);
    const userData = JSON.parse(urlParams.get('user')!);
    
    console.log('✅ Telegram user authenticated:', userData.id);

    // 3. Database'da foydalanuvchini topish yoki yaratish
    const user = await findOrCreateUser(userData);
    
    // 4. JWT token yaratish (7 kun amal qiladi)
    const token = jwt.sign(
      { 
        userId: user.telegramId,
        telegramId: user.telegramId 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Frontend'ga jo'natish uchun ma'lumotlar
    const responseData = {
      success: true,
      user: {
        id: user.telegramId,
        telegramId: user.telegramId,
        name: user.firstName,
        username: user.username,
        rating: user.rating,
        coins: user.coins,
        level: user.level,
        wins: user.wins,
        losses: user.losses,
        dailySuperLikes: user.dailySuperLikes,
        streakDays: user.streakDays
      },
      token,
      socketToken: generateSocketToken(user.telegramId)
    };

    console.log(`✅ User ${user.telegramId} authenticated successfully`);
    res.json(responseData);

  } catch (error: any) {
    console.error('🔥 Auth error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};

// Telegram initData ni validate qilish
function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return false;
    
    urlParams.delete('hash');
    
    // DataCheckString yaratish
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    
    dataCheckArr.sort((a, b) => a.localeCompare(b));
    const dataCheckString = dataCheckArr.join('\n');
    
    // Secret key hisoblash
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Hash hisoblash
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

// Database'da foydalanuvchini topish/yangi yaratish
async function findOrCreateUser(telegramUser: any) {
  const { id, first_name, last_name, username, language_code, is_premium } = telegramUser;
  
  try {
    // MongoDB'da foydalanuvchini qidirish
    let user = await User.findOne({ telegramId: id.toString() });
    
    if (!user) {
      // Yangi foydalanuvchi yaratish
      user = new User({
        telegramId: id.toString(),
        firstName: first_name,
        lastName: last_name || '',
        username: username || '',
        languageCode: language_code || 'en',
        isPremium: is_premium || false,
        rating: 1500,
        coins: 100,
        level: 1,
        wins: 0,
        losses: 0,
        dailySuperLikes: 3,
        streakDays: 0,
        lastLogin: new Date()
      });
      
      await user.save();
      console.log(`👤 New user created: ${id}`);
    } else {
      // Mavjud foydalanuvchi - lastLogin yangilash
      user.lastLogin = new Date();
      
      // Streak hisoblash (har 24 soatda 1 marta)
      const now = new Date();
      const lastLogin = new Date(user.lastLogin);
      const hoursDiff = Math.abs(now.getTime() - lastLogin.getTime()) / 36e5;
      
      if (hoursDiff >= 24) {
        user.streakDays += 1;
        user.dailySuperLikes = 3; // Reset daily super likes
        console.log(`📈 User ${id} streak updated: ${user.streakDays}`);
      }
      
      await user.save();
      console.log(`👤 User updated: ${id}`);
    }
    
    return user;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// Socket.io uchun token generate qilish
function generateSocketToken(userId: string): string {
  return crypto.createHash('sha256')
    .update(userId + Date.now() + process.env.JWT_SECRET!)
    .digest('hex')
    .substring(0, 32);
}

// Middleware: JWT token tekshirish
export const authenticateToken = (req: any, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  });
};