// src/config/socket.js
import { Server } from 'socket.io';
import { setupSocketHandlers } from '../sockets/index.js';

let io = null;

export const setupSocket = (server) => {
  const NODE_ENV = process.env.NODE_ENV || 'production';
  
  const allowedOrigins = NODE_ENV === 'production'
    ? [
        'https://telegram-mini-app-gsny.onrender.com',
        'https://like-admin-m9j1n851q-habibulloabdumutallibovs-projects.vercel.app',
        'https://like-admin-*.vercel.app'
      ]
    : '*';

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6
  });

  console.log('🔌 Socket.io konfiguratsiyasi tayyor');

  // Socket handler'larni o'rnatish
  setupSocketHandlers(io);

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};