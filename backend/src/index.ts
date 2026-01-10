import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// CORS sozlamalari
app.use(cors());
app.use(express.json());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
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

// Socket connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serverni ishga tushirish
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
