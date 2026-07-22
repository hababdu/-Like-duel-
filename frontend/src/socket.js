
import { io } from 'socket.io-client';

// SERVER URL - to'g'ri URL ni yozing
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://telegram-bot-server-2-matj.onrender.com' // O'zingizning server URL
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
  // CORS headerlar
  extraHeaders: {
    'Access-Control-Allow-Origin': '*'
  }
});

// Ulanish holatini kuzatish
socket.on('connect', () => {
  console.log('✅ Socket connected successfully!');
  console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection error:', error);
  console.error('Error message:', error.message);
  console.error('Error details:', error);
  
  // Xatolikni UI da ko'rsatish
  // alert('Serverga ulanishda xatolik. Qayta urinib ko\'ring.');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server tomonidan uzilgan, qayta ulanish
    socket.connect();
  }
});

socket.on('error', (error) => {
  console.error('Socket error event:', error);
});

// Xatoliklarni ushlash
socket.on('exception', (data) => {
  console.error('Socket exception:', data);
});

export default socket;