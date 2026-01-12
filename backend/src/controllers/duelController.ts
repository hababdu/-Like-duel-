import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { QueueManager } from '../utils/queueManager';
import { User } from '../models/User';
import { Duel } from '../models/index';

const queueManager = QueueManager.getInstance();

export const joinQueue = async (req: any, res: Response) => {
  try {
    const userId = req.user.telegramId;
    const socketId = req.body.socketId;
    
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    queueManager.addToQueue({
      id: user.telegramId,
      name: user.firstName,
      rating: user.rating,
      level: user.level,
      socketId: socketId
    });

    const position = queueManager.getPosition(userId);
    const estimatedTime = queueManager.getEstimatedTime(position);

    res.json({
      success: true,
      position,
      estimatedTime,
      onlineCount: queueManager.getOnlineCount()
    });
  } catch (error: any) {
    console.error('Join queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to join queue' });
  }
};

export const leaveQueue = async (req: any, res: Response) => {
  try {
    const userId = req.user.telegramId;
    queueManager.removeFromQueue(userId);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to leave queue' });
  }
};

export const handleVote = async (req: any, res: Response) => {
  try {
    const { choice, duelId } = req.body;
    const userId = req.user.telegramId;

    // Ovozni qo'shish
    const bothVoted = queueManager.addVote(duelId, userId, choice);
    
    // Duel ma'lumotlarini olish
    const duel = queueManager.getDuel(duelId);
    
    if (!duel) {
      return res.status(404).json({ success: false, error: 'Duel not found' });
    }

    let result = null;
    
    // Agar ikkalasi ham ovoz berga bo'lsa
    if (bothVoted) {
      result = await calculateDuelResult(duelId);
      
      // Database'ga saqlash
      await saveDuelResult(duel, result);
      
      // Mukofotlarni berish
      if (result.type === 'match') {
        await updateUserStats(duel, result);
      }
    }

    res.json({ 
      success: true, 
      bothVoted,
      result 
    });
  } catch (error: any) {
    console.error('Vote error:', error);
    res.status(500).json({ success: false, error: 'Vote failed' });
  }
};

export const requestRematch = async (req: any, res: Response) => {
  try {
    const { opponentId } = req.body;
    const userId = req.user.telegramId;
    
    // Bu yerda rematch logikasi
    // ...
    
    res.json({ success: true, message: 'Rematch requested' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Rematch failed' });
  }
};

export const getLiveMatches = async (req: any, res: Response) => {
  try {
    const liveDuels = await Duel.find({
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // 10 minut ichida
    }).limit(10);
    
    res.json({ success: true, matches: liveDuels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to get live matches' });
  }
};

// Yordamchi funksiyalar

async function calculateDuelResult(duelId: string): Promise<any> {
  const duel = queueManager.getDuel(duelId);
  if (!duel) {
    throw new Error('Duel not found');
  }

  const [player1Id, player2Id] = Array.from(duel.votes.keys());
  const player1Choice = duel.votes.get(player1Id);
  const player2Choice = duel.votes.get(player2Id);

  // Duel natijasini hisoblash
  if (!player1Choice || !player2Choice) {
    return {
      type: 'timeout',
      message: 'Time\'s up!',
      reward: 0
    };
  }

  if (player1Choice === 'skip' || player2Choice === 'skip') {
    return {
      type: 'no_match',
      message: 'No match - Someone skipped',
      reward: 0
    };
  }

  // Both liked
  if (player1Choice === 'like' && player2Choice === 'like') {
    return {
      type: 'match',
      message: 'Match! +50 coins',
      reward: 50,
      winner: 'both'
    };
  }

  // Both super liked
  if (player1Choice === 'super_like' && player2Choice === 'super_like') {
    return {
      type: 'match',
      message: 'Super Match! +100 coins',
      reward: 100,
      winner: 'both'
    };
  }

  // Different choices
  return {
    type: 'no_match',
    message: 'No match - Different choices',
    reward: 0
  };
}

async function saveDuelResult(duel: any, result: any) {
  try {
    const duelRecord = new Duel({
      players: duel.players.map((p: any) => ({
        id: p.id,
        name: p.name,
        rating: p.rating,
        choice: duel.votes.get(p.id)
      })),
      result: {
        type: result.type,
        rewards: result.rewards || {},
        winner: result.winner
      },
      duration: Math.floor((Date.now() - duel.createdAt.getTime()) / 1000),
      status: 'completed'
    });

    await duelRecord.save();
    console.log(`✅ Duel ${duel.id} saved to database`);
  } catch (error) {
    console.error('Failed to save duel:', error);
  }
}

async function updateUserStats(duel: any, result: any) {
  try {
    for (const player of duel.players) {
      const user = await User.findOne({ telegramId: player.id });
      if (user) {
        if (result.winner === 'both' || result.winner === player.id) {
          // G'olib
          await User.updateOne(
            { telegramId: player.id },
            { 
              $inc: { 
                coins: result.reward,
                wins: 1,
                rating: 10 // Rating oshishi
              }
            }
          );
        } else {
          // Mag'lub
          await User.updateOne(
            { telegramId: player.id },
            { 
              $inc: { 
                losses: 1,
                rating: -5 // Rating kamayishi
              }
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Failed to update user stats:', error);
  }
}