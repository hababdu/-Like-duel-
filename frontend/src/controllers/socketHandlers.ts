// backend/src/controllers/socketHandlers.ts
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// Queue tizimi
const waitingQueue: {
  socketId: string;
  userId: string;
  gender: string;
  joinedAt: Date;
}[] = [];

export const setupSocketHandlers = (io: Server, socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Gender tanlash
  socket.on('select_gender', async (data: { userId: string; gender: string }) => {
    try {
      // Bu yerda MongoDB ga gender update qilish kerak
      console.log(`User ${data.userId} selected gender: ${data.gender}`);
      
      socket.emit('gender_updated', {
        success: true,
        gender: data.gender
      });
      
      // Foydalanuvchiga ma'lumot yuborish
      io.to(socket.id).emit('user_data', {
        id: data.userId,
        gender: data.gender,
        dailySuperLikes: 3,
        coins: 100
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to update gender' });
    }
  });
  
  // Queue ga qo'shilish
  socket.on('join_queue', (userData: any) => {
    const queueEntry = {
      socketId: socket.id,
      userId: userData.userId,
      gender: userData.gender || 'other',
      joinedAt: new Date()
    };
    
    waitingQueue.push(queueEntry);
    console.log(`User ${userData.userId} joined queue. Position: ${waitingQueue.length}`);
    
    // Queue statusini yuborish
    socket.emit('queue_update', {
      position: waitingQueue.length,
      total: waitingQueue.length,
      estimatedWait: 30 // seconds
    });
    
    // Agar queue da 2+ odam bo'lsa, duel boshlash
    if (waitingQueue.length >= 2) {
      startDuel(io);
    }
  });
  
  // Queue dan chiqish
  socket.on('leave_queue', () => {
    const index = waitingQueue.findIndex(entry => entry.socketId === socket.id);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
      console.log(`User left queue. Remaining: ${waitingQueue.length}`);
    }
  });
  
  // Voting handler
  socket.on('vote', (voteData: any) => {
    console.log(`Vote received: ${JSON.stringify(voteData)}`);
    
    // Bu yerda duel logikasi bo'ladi
    // Ikki o'yinchi ham vote bergach, natijani hisoblash
    
    // Test uchun simple response
    io.to(socket.id).emit('vote_accepted', {
      choice: voteData.choice,
      timestamp: new Date().toISOString()
    });
  });
  
  // Duel boshlash
  const startDuel = (io: Server) => {
    if (waitingQueue.length < 2) return;
    
    const player1 = waitingQueue.shift()!;
    const player2 = waitingQueue.shift()!;
    
    const duelId = uuidv4();
    
    // Duel ma'lumotlari
    const duelData = {
      id: duelId,
      player1: player1.userId,
      player2: player2.userId,
      startedAt: new Date(),
      timer: 20 // 20 seconds
    };
    
    // Har ikkala player ga duel ma'lumotlarini yuborish
    io.to(player1.socketId).emit('duel_started', {
      duel: duelData,
      opponent: {
        id: player2.userId,
        gender: player2.gender,
        rating: 1500
      }
    });
    
    io.to(player2.socketId).emit('duel_started', {
      duel: duelData,
      opponent: {
        id: player1.userId,
        gender: player1.gender,
        rating: 1500
      }
    });
    
    console.log(`Duel started: ${duelId} between ${player1.userId} and ${player2.userId}`);
  };
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Queue dan chiqarish
    const index = waitingQueue.findIndex(entry => entry.socketId === socket.id);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
    }
  });
};

// Queue holatini olish
export const getQueueStatus = () => {
  return {
    total: waitingQueue.length,
    users: waitingQueue.map(u => u.userId)
  };
};