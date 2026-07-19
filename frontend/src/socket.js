import { io } from 'socket.io-client';

const socket = io('https://telegram-bot-server-2-matj.onrender.com', {
  autoConnect: false // App.jsx o'zi boshqaradi
});

export default socket;