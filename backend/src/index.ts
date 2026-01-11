// backend/src/index.ts faylini oching va quyidagicha qiling:
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyTelegramData } from './controllers/telegramAuth';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// CORS sozlamalari - frontend bilan ishlash uchun muhim
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.post('/api/verify-telegram', verifyTelegramData);

// Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Transport protokollari
});

// Asosiy route
app.get('/', (req, res) => {
  res.json({ message: 'Like Duel Backend API', version: '1.0.0' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket connection handler
io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);
  
  // Oddiy test event
  socket.emit('welcome', { 
    message: 'Connected to Like Duel server', 
    serverTime: new Date().toISOString() 
  });
  
  // Echo test
  socket.on('echo', (data) => {
    console.log('Echo received:', data);
    socket.emit('echo_response', { 
      original: data, 
      timestamp: new Date().toISOString() 
    });
  });
  
  // O'yin logikasi uchun placeholder eventlar
  socket.on('join_queue', (userData) => {
    console.log('User joined queue:', userData);
    // Queue logikasi keyinroq
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Serverni ishga tushirish
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
});