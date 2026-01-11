// frontend/src/utils/socket.ts - yangi versiyasi
import { io, Socket } from 'socket.io-client';

// Telegram WebApp tip deklaratsiyalari
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        openTelegramLink: (url: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
      };
    };
  }
}

// Socket instance yaratish
const SOCKET_URL = 'http://localhost:3000';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    console.log('🔌 Connecting to Socket.IO server...');
    
    // Telegram WebApp ni initialize qilish
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand(); // Fullscreen qilish
      
      console.log('Telegram WebApp initialized for user:', tg.initDataUnsafe?.user);
    }
    
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      query: {
        platform: window.Telegram?.WebApp ? 'telegram' : 'web',
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'web-user'
      }
    });
    
    // Connection eventlari
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket?.id);
      
      // Telegram user ma'lumotlarini backendga yuborish
      if (socket && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        socket.emit('telegram_auth', {
          id: tgUser.id.toString(),
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username
        });
      }
    });
    
    socket.on('welcome', (data) => {
      console.log('Server welcome:', data);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
  }
  
  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected');
  }
};

// Telegram link ochish funksiyasi
export const openTelegramLink = (username: string): void => {
  if (window.Telegram?.WebApp) {
    // Telegram Mini App ichida
    window.Telegram.WebApp.openTelegramLink(`https://t.me/${username}`);
  } else {
    // Oddiy brauzerda
    window.open(`https://t.me/${username}`, '_blank');
  }
};

// In-app chat funksiyasi
export const sendChatMessage = (toUserId: string, message: string): void => {
  const socket = getSocket();
  if (socket) {
    socket.emit('chat_message', {
      to: toUserId,
      message,
      timestamp: Date.now()
    });
  }
};

// Echo test funksiyasi
export const sendEcho = (message: string): void => {
  if (socket) {
    socket.emit('echo', message);
    socket.once('echo_response', (data) => {
      console.log('Echo response:', data);
    });
  }
};