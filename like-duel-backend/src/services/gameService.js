// src/services/gameService.js
import { getIO } from '../config/socket.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { determineWinner } from '../utils/helpers.js';

class GameService {
  constructor() {
    this.timeLimit = 30;
  }

  // O'yinni boshlash
  startGame(roomId, room, io) {
    let timeLeft = this.timeLimit;

    room.timerInterval = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timer_tick', timeLeft);

      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        this.evaluateRound(roomId);
      }
    }, 1000);
  }

  // Natijani hisoblash
  async evaluateRound(roomId) {
    const room = matchService.getRoom(roomId);
    if (!room) {
      logger.warn(`⚠️ Room ${roomId} topilmadi`);
      return;
    }

    const io = getIO();
    const [p1, p2] = room.players;
    const c1 = room.choices[p1.socketId] || 'timeout';
    const c2 = room.choices[p2.socketId] || 'timeout';

    // Natijani hisoblash
    const result = this.calculateResult(c1, c2, room.stake);
    
    // Ma'lumotlarni yangilash
    await this.updatePlayers(p1, p2, result);

    // Natijalarni yuborish
    io.to(p1.socketId).emit('round_result', {
      myChoice: c1,
      opponentChoice: c2,
      result: result.p1,
      rewardCoins: result.p1Coins,
      rewardXP: result.p1XP
    });

    io.to(p2.socketId).emit('round_result', {
      myChoice: c2,
      opponentChoice: c1,
      result: result.p2,
      rewardCoins: result.p2Coins,
      rewardXP: result.p2XP
    });

    // Xonani tozalash
    delete matchService.activeRooms[roomId];
    logger.info(`🧹 Room ${roomId} tozalandi`);
  }

  // Natijani hisoblash
  calculateResult(c1, c2, stake) {
    let p1Result = 'draw', p2Result = 'draw';
    let p1Coins = 0, p2Coins = 0;
    let p1XP = 0, p2XP = 0;

    if (c1 === 'timeout' && c2 === 'timeout') {
      // Hech narsa o'zgarmaydi
    } else if (c1 === 'timeout') {
      p1Result = 'lose'; p2Result = 'win';
      p1Coins = -stake; p2Coins = stake;
      p1XP = -10; p2XP = 15;
    } else if (c2 === 'timeout') {
      p1Result = 'win'; p2Result = 'lose';
      p1Coins = stake; p2Coins = -stake;
      p1XP = 15; p2XP = -10;
    } else {
      const winner = determineWinner(c1, c2);
      if (winner === 'player1') {
        p1Result = 'win'; p2Result = 'lose';
        p1Coins = stake; p2Coins = -stake;
        p1XP = 15; p2XP = -10;
      } else if (winner === 'player2') {
        p1Result = 'lose'; p2Result = 'win';
        p1Coins = -stake; p2Coins = stake;
        p1XP = -10; p2XP = 15;
      }
    }

    return {
      p1: p1Result,
      p2: p2Result,
      p1Coins,
      p2Coins,
      p1XP,
      p2XP
    };
  }

  // O'yinchilarni yangilash
  async updatePlayers(p1, p2, result) {
    try {
      const [user1, user2] = await Promise.all([
        User.findOne({ tgId: p1.tgId }),
        User.findOne({ tgId: p2.tgId })
      ]);

      if (user1) {
        user1.coins = Math.max(0, user1.coins + result.p1Coins);
        user1.rating = Math.max(0, user1.rating + result.p1XP);
        user1.totalGames += 1;
        user1.lastGameAt = new Date();
        if (result.p1 === 'win') user1.wins += 1;
        else if (result.p1 === 'lose') user1.losses += 1;
        else user1.draws += 1;
        await user1.save();
      }

      if (user2) {
        user2.coins = Math.max(0, user2.coins + result.p2Coins);
        user2.rating = Math.max(0, user2.rating + result.p2XP);
        user2.totalGames += 1;
        user2.lastGameAt = new Date();
        if (result.p2 === 'win') user2.wins += 1;
        else if (result.p2 === 'lose') user2.losses += 1;
        else user2.draws += 1;
        await user2.save();
      }
    } catch (error) {
      logger.error('Balans yangilashda xatolik:', error);
    }
  }

  // Tanlov qilish
  submitChoice(socketId, roomId, choice) {
    const room = matchService.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Xona topilmadi' };
    }

    room.choices[socketId] = choice;
    logger.debug(`🎯 ${socketId} tanladi: ${choice}`);

    // Ikkala o'yinchi ham tanlagan bo'lsa
    if (Object.keys(room.choices).length === 2) {
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
      }
      this.evaluateRound(roomId);
    }

    return { success: true };
  }
}

export const gameService = new GameService();