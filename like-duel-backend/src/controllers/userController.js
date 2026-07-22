// src/controllers/userController.js
import User from '../models/User.js';

export const userController = {
  // Leaderboard
  async getLeaderboard(req, res) {
    try {
      const leaders = await User.find()
        .sort({ rating: -1, coins: -1 })
        .limit(50)
        .select('tgId firstName username coins rating photoUrl totalGames wins');

      res.status(200).json({ success: true, leaders });
    } catch (error) {
      console.error('Leaderboard xatoligi:', error);
      res.status(500).json({ success: false, message: "Leaderboard xatoligi" });
    }
  },

  // Buy chat link
  async buyChatLink(req, res) {
    const { tgId } = req.body;
    try {
      const user = await User.findOne({ tgId });
      if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      if (user.coins < 10) return res.status(400).json({ success: false, message: "Yetarli tanga yo'q (10 ta kerak)" });

      user.coins -= 10;
      await user.save();

      res.status(200).json({ success: true, coins: user.coins });
    } catch (error) {
      console.error('Xarid xatoligi:', error);
      res.status(500).json({ success: false, message: "Xarid amalga oshmadi" });
    }
  },

  // User stats
  async getUserStats(req, res) {
    try {
      const user = await User.findOne({ tgId: req.params.tgId });
      if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      
      res.status(200).json({
        success: true,
        stats: {
          coins: user.coins,
          rating: user.rating,
          totalGames: user.totalGames,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          winRate: user.totalGames > 0 ? Math.round((user.wins / user.totalGames) * 100) : 0
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Statistika xatoligi" });
    }
  },

  // Referral stats
  async getReferrals(req, res) {
    try {
      const tgId = req.params.tgId;
      
      const [user, referrals] = await Promise.all([
        User.findOne({ tgId }),
        User.find({ refParent: tgId })
          .select('firstName username coins rating createdAt isRefRewarded')
          .sort({ createdAt: -1 })
      ]);

      if (!user) {
        return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      }

      res.status(200).json({
        success: true,
        data: {
          referrals,
          count: referrals.length,
          totalBonus: referrals.length * 100,
          user: {
            coins: user.coins,
            firstName: user.firstName
          }
        }
      });
    } catch (error) {
      console.error('Referral stats xatoligi:', error);
      res.status(500).json({ success: false, message: "Referal statistikasi xatoligi" });
    }
  },

  // Generate referral link
  async generateReferralLink(req, res) {
    const { tgId } = req.body;
    
    try {
      const user = await User.findOne({ tgId });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Foydalanuvchi topilmadi"
        });
      }

      const botUsername = process.env.BOT_USERNAME || 'like_duel_bot';
      const referralLink = `https://t.me/${botUsername}/app?startapp=${tgId}`;

      res.status(200).json({
        success: true,
        data: {
          link: referralLink,
          tgId: tgId,
          botUsername: botUsername
        }
      });
    } catch (error) {
      console.error('Referral link xatoligi:', error);
      res.status(500).json({
        success: false,
        message: "Referal link yaratishda xatolik"
      });
    }
  }
};