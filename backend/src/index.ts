import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import { telegramAuthController, authenticateToken } from './controllers/telegramAuth';
import duelRoutes from './routes/duelRoutes';
import userRoutes from './routes/duelRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.post('/api/auth/telegram', telegramAuthController);
app.use('/api/duel', authenticateToken, duelRoutes);
app.use('/api/user', authenticateToken, userRoutes);

// Socket.io setup
import { setupSocket } from './utils/socket';
setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});