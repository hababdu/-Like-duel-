// src/controllers/authController.js
import User from '../models/User.js';
import { getIO } from '../config/socket.js';

export const authController = {
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
      let referralBonus = 0;

      if (!user) {
        isNewUser = true;
        
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
          const parent = await User.findOne({ tgId: refParent });
          
          if (parent) {
            parent.coins = (parent.coins || 0) + 100;
            await parent.save();
            
            user.coins = (user.coins || 0) + 100;
            user.isRefRewarded = true;
            referralBonus = 100;

            const io = getIO();
            io.emit(`update_${refParent}`, {
              type: 'REF_BONUS',
              coins: parent.coins,
              message: `👤 ${user.firstName} sizning taklifingiz orqali ro'yxatdan o'tdi! +100 🪙`
            });

            console.log(`✅ Referral: ${parent.firstName} -> ${user.firstName} (+100 tanga)`);
          }
        }

        await user.save();
        console.log(`🆕 Yangi foydalanuvchi: ${user.firstName} (${user.tgId})`);

      } else {
        user.username = username || user.username;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.photoUrl = photoUrl || user.photoUrl;
        user.lastLogin = new Date();
        user.isOnline = true;
        await user.save();
      }

      res.status(200).json({
        success: true,
        user,
        isNewUser,
        referralBonus,
        message: isNewUser && referralBonus > 0
          ? '🎉 Sizga va do\'stingizga 100 tangadan bonus berildi!'
          : 'Muvaffaqiyatli kirdingiz'
      });

    } catch (error) {
      console.error('Auth xatoligi:', error);
      res.status(500).json({
        success: false,
        message: "Avtorizatsiya xatoligi",
        error: error.message
      });
    }
  }
};