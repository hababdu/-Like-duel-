// src/routes/authRoutes.js
import express from 'express';
import { authController } from '../controllers/authController.js';

const router = express.Router();

router.post('/', authController.auth);

export default router;