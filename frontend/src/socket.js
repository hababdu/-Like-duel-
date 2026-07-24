// ============================================================
// socket.js - SOCKET CONNECTION
// ============================================================
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? 'https://telegram-bot-server-2-matj.onrender.com'
  : 'http://localhost:10000';

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: true
});

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

export default socket;