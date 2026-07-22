// src/sockets/index.js
import { matchService } from '../services/matchService.js';
import { gameService } from '../services/gameService.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

let onlineUsers = new Map();

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    logger.info(`🔌 Yangi ulanish: ${socket.id}`);
    logger.info(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);

    // ===== USER CONNECT =====
    socket.on('user_connect', async (data) => {
      const { tgId, firstName } = data;
      try {
        await User.findOneAndUpdate(
          { tgId },
          { isOnline: true, lastLogin: new Date() }
        );
        
        onlineUsers.set(tgId, {
          socketId: socket.id,
          firstName,
          connectedAt: new Date()
        });

        io.emit('user_status', {
          tgId,
          status: 'online',
          firstName
        });

        logger.info(`👤 ${firstName} (${tgId}) online bo'ldi`);
        logger.info(`📊 Online foydalanuvchilar: ${onlineUsers.size}`);
      } catch (error) {
        logger.error('User connect error:', error);
      }
    });

    // ===== FIND MATCH =====
    socket.on('find_match', async ({ player, stake = 10 }) => {
      try {
        const user = await User.findOne({ tgId: player.tgId });
        
        if (!user) {
          socket.emit('error', { message: 'Foydalanuvchi topilmadi' });
          return;
        }
        
        if (user.coins < stake) {
          socket.emit('error', { message: 'Yetarli tanga yo\'q' });
          return;
        }

        matchService.findMatch(socket, player, stake);
      } catch (error) {
        logger.error('Find match error:', error);
        socket.emit('error', { message: 'Xatolik yuz berdi' });
      }
    });

    // ===== PLAYER CHOICE =====
    socket.on('player_choice', ({ roomId, choice }) => {
      const result = gameService.submitChoice(socket.id, roomId, choice);
      if (!result.success) {
        socket.emit('error', { message: result.error });
      }
    });

    // ===== CANCEL SEARCH =====
    socket.on('cancel_search', () => {
      matchService.cancelSearch(socket.id);
      socket.emit('search_cancelled', { success: true });
    });

    // ===== DISCONNECT =====
    socket.on('disconnect', () => {
      logger.info(`🔌 Uzilish: ${socket.id}`);

      // Qidiruvdan o'chirish
      matchService.cancelSearch(socket.id);

      // Online foydalanuvchilardan o'chirish
      let disconnectedUser = null;
      for (const [tgId, data] of onlineUsers.entries()) {
        if (data.socketId === socket.id) {
          disconnectedUser = { tgId, ...data };
          onlineUsers.delete(tgId);
          break;
        }
      }

      if (disconnectedUser) {
        io.emit('user_status', {
          tgId: disconnectedUser.tgId,
          status: 'offline',
          firstName: disconnectedUser.firstName
        });
      }

      // Faol xonalarni tekshirish
      matchService.removeFromRoom(socket.id);

      logger.info(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);
    });

    // ===== PING/PONG =====
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  logger.info('✅ Socket handlers o\'rnatildi');
};

export const getOnlineUsers = () => onlineUsers;