// src/controllers/authController.js
import User from '../models/User.js';
import { referralService } from '../services/referralService.js';
import logger from '../utils/logger.js';

export const authController = {
  // Foydalanuvchi autentifikatsiyasi
  async auth(req, res) {
    const { 
      tgId, 
      username, 
      firstName, 
      lastName, 
      photoUrl, 
      refParent 
    } = req.body;

    try {
      let user = await User.findOne({ tgId });
      let isNewUser = false;
      let referralResult = null;

      if (!user) {
        isNewUser = true;
        
        // Yangi foydalanuvchi yaratish
        user = new User({
          tgId,
          username: username || '',
          firstName: firstName || "O'yinchi",
          lastName: lastName || '',
          photoUrl: photoUrl || '',
          coins: 100,
          rating: 100,
          refParent: refParent && refParent !== tgId ? refParent : null,
          isRefRewarded: false
        });

        // Referral bonus
        if (refParent && refParent !== tgId) {
          referralResult = await referralService.processReferral(user, refParent);
        }

        await user.save();
        logger.info(`🆕 Yangi foydalanuvchi: ${user.firstName} (${user.tgId})`);

      } else {
        // Mavjud foydalanuvchini yangilash
        user.username = username || user.username;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.photoUrl = photoUrl || user.photoUrl;
        user.lastLogin = new Date();
        user.isOnline = true;
        await user.save();
        
        logger.info(`👤 Mavjud foydalanuvchi: ${user.firstName} (${user.tgId})`);
      }

      res.status(200).json({
        success: true,
        user,
        isNewUser,
        referralBonus: referralResult?.success ? referralService.BONUS_AMOUNT : 0,
        message: referralResult?.success 
          ? '🎉 Sizga va do\'stingizga 100 tangadan bonus berildi!' 
          : 'Muvaffaqiyatli kirdingiz'
      });

    } catch (error) {
      logger.error('Auth xatoligi:', error);
      res.status(500).json({
        success: false,
        message: "Avtorizatsiya xatoligi",
        error: error.message
      });
    }
  }
};