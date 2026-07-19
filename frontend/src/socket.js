import { io } from 'socket.io-client';

// Jonli backend Render serveringiz manzili 🚀
const SOCKET_URL = 'https://telegram-bot-server-2-matj.onrender.com';

const socket = io(SOCKET_URL, {
  autoConnect: false, // App.jsx o'zi enterDuelMode ichida connect qiladi
  transports: ['websocket', 'polling'] // Render tarmog'i uchun ikkala transport ham ochiq bo'lishi kerak
});

export default socket;