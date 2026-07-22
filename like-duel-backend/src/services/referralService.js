// src/services/referralService.js
import User from '../models/User.js';
import { getIO } from '../config/socket.js';
import logger from '../utils/logger.js';

class ReferralService {
  constructor() {
    this.BONUS_AMOUNT = 100;
  }

  // Referral bonus berish
  async processReferral(newUser, refParent) {
    if (!refParent || refParent === newUser.tgId) {
      return { success: false, message: 'Referal parent not valid' };
    }

    try {
      const parent = await User.findOne({ tgId: refParent });
      
      if (!parent) {
        logger.warn(`⚠️ Referal parent topilmadi: ${refParent}`);
        return { success: false, message: 'Parent not found' };
      }

      // Ikkala foydalanuvchiga ham bonus
      const parentCoins = parent.coins + this.BONUS_AMOUNT;
      const userCoins = newUser.coins + this.BONUS_AMOUNT;

      await User.findOneAndUpdate(
        { tgId: refParent },
        { coins: parentCoins }
      );

      newUser.coins = userCoins;
      newUser.isRefRewarded = true;
      await newUser.save();

      // Socket orqali xabar yuborish
      const io = getIO();
      io.emit(`update_${refParent}`, {
        type: 'REF_BONUS',
        coins: parentCoins,
        message: `👤 ${newUser.firstName} sizning taklifingiz orqali ro'yxatdan o'tdi! +${this.BONUS_AMOUNT} 🪙`
      });

      logger.info(`✅ Referral: ${parent.firstName} -> ${newUser.firstName} (+${this.BONUS_AMOUNT} tanga)`);

      return {
        success: true,
        parentCoins,
        userCoins,
        parent: parent.firstName,
        user: newUser.firstName
      };

    } catch (error) {
      logger.error('Referral xatoligi:', error);
      return { success: false, message: error.message };
    }
  }

  // Referral statistikasi
  async getReferralStats(tgId) {
    try {
      const [user, referrals] = await Promise.all([
        User.findOne({ tgId }),
        User.find({ refParent: tgId })
          .select('firstName username coins rating createdAt isRefRewarded')
          .sort({ createdAt: -1 })
      ]);

      if (!user) {
        return { success: false, message: 'Foydalanuvchi topilmadi' };
      }

      return {
        success: true,
        data: {
          referrals,
          count: referrals.length,
          totalBonus: referrals.length * this.BONUS_AMOUNT,
          user: {
            coins: user.coins,
            firstName: user.firstName
          }
        }
      };

    } catch (error) {
      logger.error('Referral stats xatoligi:', error);
      return { success: false, message: error.message };
    }
  }

  // Referral link yaratish
  generateReferralLink(tgId, botUsername) {
    if (!botUsername) {
      botUsername = process.env.BOT_USERNAME || 'like_duel_bot';
    }
    return `https://t.me/${botUsername}/app?startapp=${tgId}`;
  }
}

export const referralService = new ReferralService();