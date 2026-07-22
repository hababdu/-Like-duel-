// src/sockets/index.js
import User from '../models/User.js';

let searchQueue = [];
let activeRooms = {};
let onlineUsers = new Map();

// ======================
// YORDAMCHI FUNKSIYALAR
// ======================
function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) return 'player1';
  return 'player2';
}

async function evaluateRound(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;

  const [p1, p2] = room.players;
  const c1 = room.choices[p1.socketId] || 'timeout';
  const c2 = room.choices[p2.socketId] || 'timeout';

  let result1 = 'draw', result2 = 'draw';
  let coinChange1 = 0, coinChange2 = 0;
  let xpChange1 = 0, xpChange2 = 0;

  if (c1 === 'timeout' && c2 === 'timeout') {
    // Hech narsa o'zgarmaydi
  } else if (c1 === 'timeout') {
    result1 = 'lose'; result2 = 'win';
    coinChange1 = -room.stake; coinChange2 = room.stake;
    xpChange1 = -10; xpChange2 = 15;
  } else if (c2 === 'timeout') {
    result1 = 'win'; result2 = 'lose';
    coinChange1 = room.stake; coinChange2 = -room.stake;
    xpChange1 = 15; xpChange2 = -10;
  } else {
    const winner = determineWinner(c1, c2);
    if (winner === 'player1') {
      result1 = 'win'; result2 = 'lose';
      coinChange1 = room.stake; coinChange2 = -room.stake;
      xpChange1 = 15; xpChange2 = -10;
    } else if (winner === 'player2') {
      result1 = 'lose'; result2 = 'win';
      coinChange1 = -room.stake; coinChange2 = room.stake;
      xpChange1 = -10; xpChange2 = 15;
    }
  }

  try {
    const [user1, user2] = await Promise.all([
      User.findOne({ tgId: p1.tgId }),
      User.findOne({ tgId: p2.tgId })
    ]);

    if (user1) {
      user1.coins = Math.max(0, user1.coins + coinChange1);
      user1.rating = Math.max(0, user1.rating + xpChange1);
      user1.totalGames = (user1.totalGames || 0) + 1;
      user1.lastGameAt = new Date();
      if (result1 === 'win') user1.wins = (user1.wins || 0) + 1;
      else if (result1 === 'lose') user1.losses = (user1.losses || 0) + 1;
      else user1.draws = (user1.draws || 0) + 1;
      await user1.save();
    }

    if (user2) {
      user2.coins = Math.max(0, user2.coins + coinChange2);
      user2.rating = Math.max(0, user2.rating + xpChange2);
      user2.totalGames = (user2.totalGames || 0) + 1;
      user2.lastGameAt = new Date();
      if (result2 === 'win') user2.wins = (user2.wins || 0) + 1;
      else if (result2 === 'lose') user2.losses = (user2.losses || 0) + 1;
      else user2.draws = (user2.draws || 0) + 1;
      await user2.save();
    }

    const io = require('../config/socket.js').getIO();
    io.to(p1.socketId).emit('round_result', {
      myChoice: c1, opponentChoice: c2, result: result1,
      rewardCoins: coinChange1, rewardXP: xpChange1
    });

    io.to(p2.socketId).emit('round_result', {
      myChoice: c2, opponentChoice: c1, result: result2,
      rewardCoins: coinChange2, rewardXP: xpChange2
    });

  } catch (err) {
    console.error("Balans yangilashda xatolik:", err);
  }

  delete activeRooms[roomId];
}

function startRoomTimer(roomId, io) {
  let timeLeft = 30;
  const room = activeRooms[roomId];
  if (!room) return;

  room.timerInterval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      evaluateRound(roomId);
    }
  }, 1000);
}

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Yangi ulanish: ${socket.id}`);
    console.log(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);

    // User connect
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

        console.log(`👤 ${firstName} (${tgId}) online bo'ldi`);
      } catch (error) {
        console.error('User connect error:', error);
      }
    });

    // Find match
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

        // Eski qidiruvlarni tozalash
        searchQueue = searchQueue.filter(p => io.sockets.sockets.has(p.socketId));

        const newPlayer = {
          socketId: socket.id,
          tgId: player.tgId,
          name: player.firstName || player.name || "O'yinchi",
          username: player.username || '',
          rating: player.rating || 100,
          stake: Number(stake),
          joinedAt: new Date()
        };

        const opponentIndex = searchQueue.findIndex(p => 
          p.stake === newPlayer.stake && 
          p.tgId !== newPlayer.tgId &&
          p.socketId !== socket.id
        );

        if (opponentIndex !== -1) {
          const opponent = searchQueue.splice(opponentIndex, 1)[0];
          const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

          socket.join(roomId);
          const oppSocket = io.sockets.sockets.get(opponent.socketId);
          if (oppSocket) oppSocket.join(roomId);

          activeRooms[roomId] = {
            roomId,
            players: [newPlayer, opponent],
            choices: {},
            stake: newPlayer.stake,
            timerInterval: null,
            createdAt: new Date()
          };

          socket.emit('match_found', { 
            roomId, 
            opponent: { 
              tgId: opponent.tgId, 
              name: opponent.name, 
              rating: opponent.rating,
              username: opponent.username 
            }, 
            stake: newPlayer.stake 
          });
          
          if (oppSocket) {
            oppSocket.emit('match_found', { 
              roomId, 
              opponent: { 
                tgId: newPlayer.tgId, 
                name: newPlayer.name, 
                rating: newPlayer.rating,
                username: newPlayer.username 
              }, 
              stake: newPlayer.stake 
            });
          }

          console.log(`✅ Match topildi: ${newPlayer.name} vs ${opponent.name}`);
          startRoomTimer(roomId, io);
        } else {
          searchQueue.push(newPlayer);
          socket.emit('searching', { stake: newPlayer.stake });
          console.log(`⏳ ${newPlayer.name} navbatga qo'shildi. Navbat: ${searchQueue.length}`);
        }
      } catch (error) {
        console.error('Find match error:', error);
        socket.emit('error', { message: 'Xatolik yuz berdi' });
      }
    });

    // Player choice
    socket.on('player_choice', ({ roomId, choice }) => {
      const room = activeRooms[roomId];
      if (!room) {
        socket.emit('error', { message: 'Xona topilmadi' });
        return;
      }

      room.choices[socket.id] = choice;
      console.log(`🎯 ${socket.id} tanladi: ${choice}`);

      if (Object.keys(room.choices).length === 2) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        evaluateRound(roomId);
      }
    });

    // Cancel search
    socket.on('cancel_search', () => {
      searchQueue = searchQueue.filter(p => p.socketId !== socket.id);
      socket.emit('search_cancelled', { success: true });
      console.log(`❌ ${socket.id} qidiruvni bekor qildi`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Uzilish: ${socket.id}`);

      searchQueue = searchQueue.filter(p => p.socketId !== socket.id);

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

      for (const roomId in activeRooms) {
        const room = activeRooms[roomId];
        if (room.players.some(p => p.socketId === socket.id)) {
          socket.to(roomId).emit('opponent_left');
          if (room.timerInterval) clearInterval(room.timerInterval);
          delete activeRooms[roomId];
          break;
        }
      }

      console.log(`📊 Jami ulanishlar: ${io.engine.clientsCount}`);
    });

    // Ping/Pong
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✅ Socket handlers o\'rnatildi');
};

export const getOnlineUsers = () => onlineUsers;
export const getActiveRooms = () => activeRooms;
export const getSearchQueue = () => searchQueue;