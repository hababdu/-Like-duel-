
// socket.js yoki socket.ts
import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://telegram-bot-server-2-matj.onrender.com' 
  : 'http://localhost:10000';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  // CORS uchun
  extraHeaders: {
    'Access-Control-Allow-Origin': '*'
  }
});

// Ulanish holatini kuzatish
socket.on('connect', () => {
  console.log('✅ Socket connected');
  // User ma'lumotlarini yuborish
  socket.emit('user_connect', {
    tgId: user.tgId,
    firstName: user.firstName
  });
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

export default socket;