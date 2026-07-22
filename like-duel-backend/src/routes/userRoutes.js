// src/routes/userRoutes.js
import express from 'express';
import User from '../models/User.js';
import { referralService } from '../services/referralService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find()
      .sort({ rating: -1, coins: -1 })
      .limit(50)
      .select('tgId firstName username coins rating photoUrl totalGames wins');

    res.status(200).json({ success: true, leaders });
  } catch (error) {
    logger.error('Leaderboard xatoligi:', error);
    res.status(500).json({ success: false, message: "Leaderboard xatoligi" });
  }
});

// Buy chat link
router.post('/buy-chat-link', async (req, res) => {
  const { tgId } = req.body;
  try {
    const user = await User.findOne({ tgId });
    if (!user) {
      return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }
    if (user.coins < 10) {
      return res.status(400).json({ success: false, message: "Yetarli tanga yo'q (10 ta kerak)" });
    }

    user.coins -= 10;
    await user.save();

    res.status(200).json({ success: true, coins: user.coins });
  } catch (error) {
    logger.error('Xarid xatoligi:', error);
    res.status(500).json({ success: false, message: "Xarid amalga oshmadi" });
  }
});

// User stats
router.get('/:tgId/stats', async (req, res) => {
  try {
    const user = await User.findOne({ tgId: req.params.tgId });
    if (!user) {
      return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
    }
    
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
    logger.error('Stats xatoligi:', error);
    res.status(500).json({ success: false, message: "Statistika xatoligi" });
  }
});

// Referral stats
router.get('/:tgId/referrals', async (req, res) => {
  const result = await referralService.getReferralStats(req.params.tgId);
  if (result.success) {
    res.status(200).json({ success: true, data: result.data });
  } else {
    res.status(404).json({ success: false, message: result.message });
  }
});

// Generate referral link
router.post('/generate-referral-link', async (req, res) => {
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
    const link = referralService.generateReferralLink(tgId, botUsername);

    res.status(200).json({
      success: true,
      data: {
        link,
        tgId,
        botUsername
      }
    });
  } catch (error) {
    logger.error('Referral link xatoligi:', error);
    res.status(500).json({
      success: false,
      message: "Referal link yaratishda xatolik"
    });
  }
});

export default router;