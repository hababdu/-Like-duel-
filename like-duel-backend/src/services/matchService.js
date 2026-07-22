// src/services/matchService.js
import { getIO } from '../config/socket.js';
import { gameService } from './gameService.js';
import logger from '../utils/logger.js';

class MatchService {
  constructor() {
    this.searchQueue = [];
    this.activeRooms = {};
    this.cleanupInterval = null;
    this.startCleanup();
  }

  // Raqib qidirish
  findMatch(socket, player, stake) {
    const io = getIO();
    
    logger.info(`🔍 ${player.firstName} raqib qidirmoqda... (Stavka: ${stake})`);
    logger.info(`📊 Navbatdagi o'yinchilar: ${this.searchQueue.length}`);

    // Eski qidiruvlarni tozalash
    this.cleanSearchQueue();

    const newPlayer = {
      socketId: socket.id,
      tgId: player.tgId,
      name: player.firstName || player.name || "O'yinchi",
      username: player.username || '',
      rating: player.rating || 100,
      stake: Number(stake),
      joinedAt: new Date()
    };

    // Bir xil stavkadagi raqibni qidirish
    const opponentIndex = this.searchQueue.findIndex(p => 
      p.stake === newPlayer.stake && 
      p.tgId !== newPlayer.tgId &&
      p.socketId !== socket.id
    );

    if (opponentIndex !== -1) {
      const opponent = this.searchQueue.splice(opponentIndex, 1)[0];
      return this.createMatch(socket, opponent, newPlayer, io);
    } else {
      this.searchQueue.push(newPlayer);
      socket.emit('searching', { 
        stake: newPlayer.stake,
        queuePosition: this.searchQueue.length
      });
      logger.info(`⏳ ${newPlayer.name} navbatga qo'shildi. Navbat: ${this.searchQueue.length}`);
      return null;
    }
  }

  // Match yaratish
  createMatch(socket, opponent, newPlayer, io) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    socket.join(roomId);
    const oppSocket = io.sockets.sockets.get(opponent.socketId);
    if (oppSocket) {
      oppSocket.join(roomId);
    }

    const room = {
      roomId,
      players: [newPlayer, opponent],
      choices: {},
      stake: newPlayer.stake,
      timerInterval: null,
      createdAt: new Date()
    };

    this.activeRooms[roomId] = room;

    const matchData = {
      roomId,
      stake: newPlayer.stake
    };

    socket.emit('match_found', {
      ...matchData,
      opponent: {
        tgId: opponent.tgId,
        name: opponent.name,
        rating: opponent.rating,
        username: opponent.username
      }
    });

    if (oppSocket) {
      oppSocket.emit('match_found', {
        ...matchData,
        opponent: {
          tgId: newPlayer.tgId,
          name: newPlayer.name,
          rating: newPlayer.rating,
          username: newPlayer.username
        }
      });
    }

    logger.info(`✅ Match topildi: ${newPlayer.name} vs ${opponent.name}`);
    logger.info(`🎮 O'yin boshlandi: ${roomId}`);

    // O'yinni boshlash
    gameService.startGame(roomId, room, io);

    return room;
  }

  // Eski qidiruvlarni tozalash
  cleanSearchQueue() {
    const io = getIO();
    this.searchQueue = this.searchQueue.filter(p => {
      const exists = io.sockets.sockets.has(p.socketId);
      if (!exists) {
        logger.debug(`🧹 Eski qidiruv tozalandi: ${p.name}`);
      }
      return exists;
    });
  }

  // Eski xonalarni tozalash
  cleanRooms() {
    const now = Date.now();
    const timeout = 60000;

    for (const [roomId, room] of Object.entries(this.activeRooms)) {
      const age = now - room.createdAt.getTime();
      if (age > timeout * 2) {
        const io = getIO();
        io.to(roomId).emit('timeout', { message: 'O\'yin vaqti tugadi' });
        delete this.activeRooms[roomId];
        logger.info(`🧹 Eski room tozalandi: ${roomId}`);
      }
    }
  }

  // Tozalashni boshlash
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanSearchQueue();
      this.cleanRooms();
    }, 300000); // 5 daqiqa
  }

  // Qidiruvni bekor qilish
  cancelSearch(socketId) {
    const removed = this.searchQueue.filter(p => p.socketId === socketId);
    this.searchQueue = this.searchQueue.filter(p => p.socketId !== socketId);
    if (removed.length > 0) {
      logger.info(`❌ ${socketId} qidiruvni bekor qildi`);
    }
    return removed;
  }

  // Foydalanuvchini xonadan olib tashlash
  removeFromRoom(socketId) {
    for (const [roomId, room] of Object.entries(this.activeRooms)) {
      if (room.players.some(p => p.socketId === socketId)) {
        const io = getIO();
        io.to(roomId).emit('opponent_left', {
          message: 'Raqib o\'yinni tark etdi',
          timestamp: new Date()
        });
        
        if (room.timerInterval) {
          clearInterval(room.timerInterval);
        }
        
        delete this.activeRooms[roomId];
        logger.info(`🧹 Room ${roomId} o'chirildi`);
        return room;
      }
    }
    return null;
  }

  // Xonani olish
  getRoom(roomId) {
    return this.activeRooms[roomId];
  }

  // Barcha xonalar
  getRooms() {
    return this.activeRooms;
  }

  // Navbatdagi o'yinchilar soni
  getQueueLength() {
    return this.searchQueue.length;
  }
}

export const matchService = new MatchService();