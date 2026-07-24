// ============================================================
// socket.js - TO'G'RILANGAN
// ============================================================
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? 'https://telegram-bot-server-2-matj.onrender.com'
  : 'http://localhost:10000';

console.log('🔌 Connecting to server:', SERVER_URL);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 30000,
  autoConnect: true,
  forceNew: true,
  path: '/socket.io/'
});

// Ulanish holati
socket.on('connect', () => {
  console.log('✅ Socket connected! ID:', socket.id);
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

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Reconnect attempt:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Reconnect error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('❌ Reconnect failed');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Barcha eventlarni log qilish
socket.onAny((event, ...args) => {
  console.log(`📨 Socket event: ${event}`, args);
});

export default socket;