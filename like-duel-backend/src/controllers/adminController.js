// src/controllers/adminController.js
import User from '../models/User.js';
import { getActiveRooms, getSearchQueue } from '../sockets/index.js';

export const adminController = {
  // Statistika
  async getStats(req, res) {
    try {
      const [
        totalUsers,
        onlineUsersCount,
        totalCoins,
        totalRating,
        totalGames,
        top10
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isOnline: true }),
        User.aggregate([{ $group: { _id: null, total: { $sum: "$coins" } } }]),
        User.aggregate([{ $group: { _id: null, total: { $sum: "$rating" } } }]),
        User.aggregate([{ $group: { _id: null, total: { $sum: "$totalGames" } } }]),
        User.find().sort({ rating: -1, coins: -1 }).limit(10)
          .select('firstName username coins rating totalGames wins')
      ]);

      const activeRooms = getActiveRooms();
      const searchQueue = getSearchQueue();

      res.json({
        success: true,
        data: {
          totalUsers,
          onlineUsers: onlineUsersCount,
          totalCoins: totalCoins[0]?.total || 0,
          totalRating: totalRating[0]?.total || 0,
          totalGames: totalGames[0]?.total || 0,
          top10,
          activeRooms: Object.keys(activeRooms).length,
          searchQueue: searchQueue.length,
          timestamp: new Date()
        }
      });
    } catch (err) {
      console.error('Admin stats xatoligi:', err);
      res.status(500).json({ success: false, message: "Statistika xatoligi" });
    }
  },

  // Foydalanuvchilar ro'yxati
  async getUsers(req, res) {
    try {
      const { search = '', page = 1, limit = 20, sortBy = 'rating' } = req.query;
      
      const query = search ? {
        $or: [
          { tgId: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } }
        ]
      } : {};

      const sortOptions = {
        rating: { rating: -1, coins: -1 },
        coins: { coins: -1, rating: -1 },
        games: { totalGames: -1, rating: -1 },
        newest: { createdAt: -1 }
      };

      const users = await User.find(query)
        .sort(sortOptions[sortBy] || sortOptions.rating)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('-__v');

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        users,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error('Admin users xatoligi:', err);
      res.status(500).json({ success: false, message: "Foydalanuvchilarni yuklashda xatolik" });
    }
  },

  // Bitta foydalanuvchi
  async getUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      res.json({ success: true, user });
    } catch (err) {
      res.status(500).json({ success: false, message: "Xatolik" });
    }
  },

  // Foydalanuvchini yangilash
  async updateUser(req, res) {
    try {
      const { coins, rating, firstName, username, photoUrl } = req.body;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          coins: Math.max(0, coins || 0),
          rating: Math.max(0, rating || 0),
          firstName,
          username,
          photoUrl
        },
        { new: true, runValidators: true }
      );
      
      if (!user) {
        return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      }

      res.json({ success: true, user, message: "Muvaffaqiyatli yangilandi" });
    } catch (err) {
      console.error('Update user xatoligi:', err);
      res.status(500).json({ success: false, message: "Tahrirlashda xatolik" });
    }
  },

  // Foydalanuvchini o'chirish
  async deleteUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      }
      
      await User.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Foydalanuvchi o'chirildi" });
    } catch (err) {
      console.error('Delete user xatoligi:', err);
      res.status(500).json({ success: false, message: "O'chirishda xatolik" });
    }
  },

  // Coin qo'shish
  async updateCoins(req, res) {
    const { amount } = req.body;
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });
      }
      
      const newCoins = Math.max(0, user.coins + (amount || 0));
      user.coins = newCoins;
      await user.save();
      
      res.json({ success: true, user });
    } catch (err) {
      console.error('Coin update xatoligi:', err);
      res.status(500).json({ success: false, message: "Coin o'zgartirishda xatolik" });
    }
  }
};