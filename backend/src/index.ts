import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Define User schema if not already defined
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  username: { type: String, default: '' },
  languageCode: { type: String, default: 'en' },
  isPremium: { type: Boolean, default: false },
  rating: { type: Number, default: 1500, min: 0 },
  coins: { type: Number, default: 100, min: 0 },
  level: { type: Number, default: 1, min: 1 },
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },
  dailySuperLikes: { type: Number, default: 3, min: 0 },
  streakDays: { type: Number, default: 0, min: 0 },
  bio: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  filter: { type: String, default: 'any' },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create model if not exists
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Telegram auth controller
export const telegramAuthController = async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const JWT_SECRET = process.env.JWT_SECRET!;

    console.log('📱 Telegram auth request received');

    // Validate Telegram initData
    const isValid = validateTelegramInitData(initData, BOT_TOKEN);
    if (!isValid) {
      console.error('❌ Invalid Telegram initData');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid Telegram authentication data' 
      });
    }

    // Extract user data
    const urlParams = new URLSearchParams(initData);
    const userData = JSON.parse(urlParams.get('user')!);
    
    console.log('✅ Telegram user authenticated:', userData.id);

    // Find or create user in database
    const user = await findOrCreateUser(userData);
    
    // Create JWT token (valid for 7 days)
    const token = jwt.sign(
      { 
        userId: user.telegramId,
        telegramId: user.telegramId,
        name: user.firstName
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create socket token for real-time connection
    const socketToken = generateSocketToken(user.telegramId);

    // Response data
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
        streakDays: user.streakDays,
        bio: user.bio,
        gender: user.gender,
        filter: user.filter,
        lastLogin: user.lastLogin
      },
      token,
      socketToken
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

// Validate Telegram WebApp initData
function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return false;
    
    // Remove hash for validation
    urlParams.delete('hash');
    
    // Create dataCheckString
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    
    // Sort alphabetically
    dataCheckArr.sort((a, b) => a.localeCompare(b));
    const dataCheckString = dataCheckArr.join('\n');
    
    // Calculate secret key
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Calculate hash
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

// Find or create user in database
async function findOrCreateUser(telegramUser: any) {
  const { 
    id, 
    first_name, 
    last_name, 
    username, 
    language_code, 
    is_premium,
    photo_url 
  } = telegramUser;
  
  try {
    // Try to find existing user
    let user = await User.findOne({ telegramId: id.toString() });
    
    if (!user) {
      // Create new user
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
      console.log(`👤 New user created: ${id} (${first_name})`);
    } else {
      // Update existing user's last login
      const now = new Date();
      const lastLogin = new Date(user.lastLogin);
      const hoursDiff = Math.abs(now.getTime() - lastLogin.getTime()) / 36e5;
      
      // Update streak if 24+ hours passed
      if (hoursDiff >= 24) {
        user.streakDays += 1;
        user.dailySuperLikes = 3; // Reset daily super likes
        console.log(`📈 User ${id} streak updated: ${user.streakDays} days`);
      }
      
      user.lastLogin = now;
      await user.save();
      console.log(`👤 User updated: ${id}`);
    }
    
    return user;
  } catch (error: any) {
    console.error('Database error:', error);
    throw new Error(`Failed to save user: ${error.message}`);
  }
}

// Generate socket token for real-time connection
function generateSocketToken(userId: string): string {
  return crypto.createHash('sha256')
    .update(userId + Date.now() + process.env.JWT_SECRET!)
    .digest('hex')
    .substring(0, 32);
}

// JWT authentication middleware
export const authenticateToken = (req: any, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    req.user = user;
    next();
  });
};

// Old function kept for compatibility
export const verifyTelegramData = telegramAuthController;