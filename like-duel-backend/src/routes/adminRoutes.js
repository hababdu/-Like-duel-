// src/routes/adminRoutes.js
import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import { adminController } from '../controllers/adminController.js';

const router = express.Router();

// Barcha admin route'lar auth middleware bilan himoyalangan
router.use(adminAuth);

// Statistika
router.get('/stats', adminController.getStats);

// Foydalanuvchilar
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Coin operatsiyalari
router.post('/users/:id/coins', adminController.updateCoins);

export default router;