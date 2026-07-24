// ============================================================
// SOCKET.JS - TELEGRAM UCHUN MAXSUS
// ============================================================
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://telegram-bot-server-2-matj.onrender.com'
  : 'http://localhost:10000';

console.log('🔌 Connecting to server:', SERVER_URL);

// HAR BIR SAHIFA UCHUN UNIQ SOCKET ID

// socket.js - har bir sahifa uchun yangi ulanish
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  forceNew: true, // MUHIM!
  path: '/socket.io/'
});

// Ulanish holati
socket.on('connect', () => {
  console.log('✅ Socket connected! ID:', socket.id);
  console.log('📱 Platform:', window.Telegram?.WebApp ? 'Telegram' : 'Web');
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Barcha eventlarni log qilish
socket.onAny((event, ...args) => {
  console.log(`📨 Socket event: ${event}`, args);
});

export default socket;