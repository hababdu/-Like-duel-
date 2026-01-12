import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { QueueManager } from './queueManager';

const queueManager = QueueManager.getInstance();

export const setupSocket = (io: Server) => {
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.user = {
        telegramId: decoded.telegramId,
        name: decoded.name
      };
      
      // Foydalanuvchini online holatga o'tkazish
      const user = await User.findOne({ telegramId: decoded.telegramId });
      if (user) {
        queueManager.setOnline(socket.id, user.telegramId, socket);
      }
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user?.telegramId;
    const userName = socket.data.user?.name;
    
    console.log(`🔌 New socket connection: ${userName} (${userId}), socket: ${socket.id}`);

    // Navbatga qo'shilish
    socket.on('join_queue', () => {
      if (userId) {
        // User ratingini database'dan olish
        User.findOne({ telegramId: userId }).then(user => {
          if (user) {
            queueManager.addToQueue({
              id: userId,
              name: userName || user.firstName,
              rating: user.rating || 1500,
              level: user.level || 1,
              socketId: socket.id
            });
            
            // Navbat pozitsiyasini yuborish
            const position = queueManager.getPosition(userId);
            socket.emit('queue_position', { position });
            
            console.log(`📊 User ${userName} joined queue at position ${position}`);
          }
        }).catch(error => {
          console.error('Database error:', error);
        });
      }
    });

    // Ovoz berish
    socket.on('player_vote', async (data: { choice: 'like' | 'super_like' | 'skip', duelId: string }) => {
      const { choice, duelId } = data;
      
      if (!userId) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      // Ovozni qo'shish
      const bothVoted = queueManager.addVote(duelId, userId, choice);
      
      // Duel ma'lumotlarini olish
      const duel = queueManager.getDuel(duelId);
      
      if (!duel) {
        socket.emit('error', { message: 'Duel not found' });
        return;
      }

      // Hamkasbga ovoz haqida habar yuborish
      const opponent = duel.players.find(p => p.id !== userId);
      if (opponent) {
        // playerSocketMap orqali opponent socketId ni topish
        const opponentSocketId = queueManager.getSocketIdByUserId(opponent.id);
        if (opponentSocketId) {
          socket.to(opponentSocketId).emit('opponent_vote', { 
            choice,
            duelId 
          });
          console.log(`📤 Sent vote notification to opponent ${opponent.name}`);
        } else {
          console.log(`⚠️ Opponent ${opponent.name} not connected`);
        }
      }

      // Agar ikkalasi ham ovoz berga bo'lsa
      if (bothVoted) {
        try {
          const result = await calculateDuelResult(duelId);
          
          // Duel natijasini hamma o'yinchilarga yuborish
          for (const player of duel.players) {
            const playerSocketId = queueManager.getSocketIdByUserId(player.id);
            if (playerSocketId) {
              io.to(playerSocketId).emit('duel_result', {
                ...result,
                duelId,
                players: duel.players.map(p => ({
                  id: p.id,
                  name: p.name,
                  choice: duel.votes.get(p.id)
                }))
              });
              console.log(`🏆 Sent duel result to ${player.name}`);
            }
          }
          
          console.log(`✅ Duel ${duelId} completed: ${result.type}`);
          
          // Duelni tozalash (10 sekunddan keyin)
          setTimeout(() => {
            queueManager.removeDuel(duelId);
            console.log(`🗑️ Duel ${duelId} cleaned up`);
          }, 10000);
          
        } catch (error) {
          console.error('Duel calculation error:', error);
          socket.emit('error', { message: 'Failed to calculate duel result' });
        }
      }
    });

    // Rematch so'rash
    socket.on('request_rematch', (data: { opponentId: string }) => {
      const { opponentId } = data;
      
      if (userId) {
        const opponentSocketId = queueManager.getSocketIdByUserId(opponentId);
        if (opponentSocketId) {
          socket.to(opponentSocketId).emit('rematch_request', {
            fromUserId: userId,
            fromUserName: userName
          });
          console.log(`🔄 Rematch request from ${userName} to ${opponentId}`);
        }
      }
    });

    // Navbatni tark etish
    socket.on('leave_queue', () => {
      if (userId) {
        queueManager.removeFromQueue(userId);
        console.log(`🚪 User ${userName} left queue`);
      }
    });

    // Online o'yinchilar sonini olish
    socket.on('get_online_count', () => {
      socket.emit('online_count', queueManager.getOnlineCount());
    });

    // Live matches so'rash
    socket.on('get_live_matches', () => {
      const queue = queueManager.getQueue();
      const debugInfo = queueManager.getDebugInfo();
      socket.emit('live_matches', {
        queue,
        activeDuels: debugInfo.activeDuels
      });
    });

    // Debug information
    socket.on('get_debug_info', () => {
      const debugInfo = queueManager.getDebugInfo();
      socket.emit('debug_info', debugInfo);
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (userId) {
        queueManager.setOffline(userId);
      }
      console.log(`🔌 Socket disconnected: ${socket.id} (${userName})`);
    });

    // Connection error
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Send welcome message with debug info
    socket.emit('welcome', {
      message: 'Connected to Like Duel server',
      userId,
      userName,
      timestamp: new Date().toISOString()
    });
  });
};

// Helper function for duel calculation
async function calculateDuelResult(duelId: string): Promise<any> {
  const queueManager = QueueManager.getInstance();
  const duel = queueManager.getDuel(duelId);
  
  if (!duel) {
    throw new Error('Duel not found');
  }

  const votes = Array.from(duel.votes.entries());
  if (votes.length !== 2) {
    throw new Error('Not all players voted');
  }

  const [player1Id, player1Choice] = votes[0];
  const [player2Id, player2Choice] = votes[1];

  // Test uchun players ma'lumotlari
  const player1 = duel.players.find(p => p.id === player1Id);
  const player2 = duel.players.find(p => p.id === player2Id);

  console.log(`🎲 Calculating duel result for ${duelId}`);
  console.log(`👤 Player 1: ${player1?.name} chose ${player1Choice}`);
  console.log(`👤 Player 2: ${player2?.name} chose ${player2Choice}`);

  // Natijani hisoblash
  if (player1Choice === 'skip' || player2Choice === 'skip') {
    return {
      type: 'no_match',
      message: 'No match - Someone skipped',
      reward: 0,
      players: [
        { id: player1Id, name: player1?.name, choice: player1Choice },
        { id: player2Id, name: player2?.name, choice: player2Choice }
      ]
    };
  }

  if (player1Choice === 'like' && player2Choice === 'like') {
    return {
      type: 'match',
      message: 'Match! +50 coins',
      reward: 50,
      players: [
        { id: player1Id, name: player1?.name, choice: player1Choice },
        { id: player2Id, name: player2?.name, choice: player2Choice }
      ]
    };
  }

  if (player1Choice === 'super_like' && player2Choice === 'super_like') {
    return {
      type: 'match',
      message: 'Super Match! +100 coins',
      reward: 100,
      players: [
        { id: player1Id, name: player1?.name, choice: player1Choice },
        { id: player2Id, name: player2?.name, choice: player2Choice }
      ]
    };
  }

  // One super-like, one like = match
  if ((player1Choice === 'super_like' && player2Choice === 'like') ||
      (player1Choice === 'like' && player2Choice === 'super_like')) {
    return {
      type: 'match',
      message: 'Match! +50 coins',
      reward: 50,
      players: [
        { id: player1Id, name: player1?.name, choice: player1Choice },
        { id: player2Id, name: player2?.name, choice: player2Choice }
      ]
    };
  }

  return {
    type: 'no_match',
    message: 'No match - Different choices',
    reward: 0,
    players: [
      { id: player1Id, name: player1?.name, choice: player1Choice },
      { id: player2Id, name: player2?.name, choice: player2Choice }
    ]
  };
}