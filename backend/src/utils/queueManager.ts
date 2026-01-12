import { Socket } from 'socket.io';

interface QueuePlayer {
  id: string;
  name: string;
  rating: number;
  level: number;
  socketId: string;
  joinedAt: Date;
}

interface Duel {
  id: string;
  players: QueuePlayer[];
  votes: Map<string, 'like' | 'super_like' | 'skip'>;
  timer: number;
  createdAt: Date;
  status: 'waiting' | 'voting' | 'completed';
}

export class QueueManager {
  private static instance: QueueManager;
  private queue: QueuePlayer[] = [];
  private activeDuels = new Map<string, Duel>(); // Bu yerda to'g'ri e'lon qilingan
  private onlinePlayers = new Map<string, { socket: Socket; userId: string }>();
  private playerSocketMap = new Map<string, string>(); // userId -> socketId

  private constructor() {
    console.log('🚀 QueueManager initialized');
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  addToQueue(player: Omit<QueuePlayer, 'joinedAt'>): void {
    // Agar allaqachon navbatda bo'lsa, o'chirish
    this.removeFromQueue(player.id);
    
    this.queue.push({
      ...player,
      joinedAt: new Date()
    });

    console.log(`✅ ${player.name} (${player.id}) added to queue. Queue size: ${this.queue.length}`);
    this.tryMatchPlayers();
  }

  removeFromQueue(playerId: string): void {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(p => p.id !== playerId);
    
    if (initialLength !== this.queue.length) {
      console.log(`🗑️ Removed ${playerId} from queue. New size: ${this.queue.length}`);
    }
  }

  getPosition(playerId: string): number {
    const index = this.queue.findIndex(p => p.id === playerId);
    return index !== -1 ? index + 1 : 0;
  }

  getEstimatedTime(position: number): number {
    // Har bir pozitsiya uchun 2 sekund
    return Math.max(5, position * 2);
  }

  getOnlineCount(): number {
    return this.onlinePlayers.size;
  }

  setOnline(socketId: string, userId: string, socket: Socket): void {
    this.onlinePlayers.set(socketId, { socket, userId });
    this.playerSocketMap.set(userId, socketId);
    console.log(`👤 User ${userId} (socket: ${socketId}) is now online`);
  }

  setOffline(userId: string): void {
    const socketId = this.playerSocketMap.get(userId);
    if (socketId) {
      this.onlinePlayers.delete(socketId);
      this.playerSocketMap.delete(userId);
      this.removeFromQueue(userId);
      console.log(`👤 User ${userId} is now offline`);
    }
  }

  getDuel(duelId: string): Duel | undefined {
    const duel = this.activeDuels.get(duelId);
    if (!duel) {
      console.log(`❓ Duel ${duelId} not found in activeDuels`);
      console.log(`📊 Active duels: ${Array.from(this.activeDuels.keys())}`);
    }
    return duel;
  }

  // Yangi method: socketId orqali userId ni topish
  getUserIdBySocketId(socketId: string): string | undefined {
    const playerInfo = this.onlinePlayers.get(socketId);
    return playerInfo?.userId;
  }

  // Yangi method: userId orqali socket ni topish
  getSocketByUserId(userId: string): Socket | undefined {
    const socketId = this.playerSocketMap.get(userId);
    if (socketId) {
      return this.onlinePlayers.get(socketId)?.socket;
    }
    return undefined;
  }

  // Yangi method: userId orqali socketId ni topish
  getSocketIdByUserId(userId: string): string | undefined {
    return this.playerSocketMap.get(userId);
  }

  private tryMatchPlayers(): void {
    if (this.queue.length < 2) {
      console.log(`⏳ Waiting for more players. Current queue: ${this.queue.length}`);
      return;
    }

    // Reytingga qarab moslash
    const player1 = this.queue[0];
    const player2 = this.findBestMatch(player1);

    if (player2) {
      // Duel yaratish
      const duelId = `duel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const duel: Duel = {
        id: duelId,
        players: [player1, player2],
        votes: new Map(),
        timer: 10,
        createdAt: new Date(),
        status: 'voting'
      };
      
      this.activeDuels.set(duelId, duel);
      console.log(`🎮 New duel created: ${duelId}`);
      console.log(`👥 Players: ${player1.name} vs ${player2.name}`);
      console.log(`📊 Active duels count: ${this.activeDuels.size}`);

      // Navbatdan o'chirish
      this.removeFromQueue(player1.id);
      this.removeFromQueue(player2.id);

      // Socket orqali habar yuborish
      this.notifyDuelFound(player1, player2, duelId);
    } else {
      console.log(`🔍 No suitable match found for ${player1.name}`);
    }
  }

  private findBestMatch(player: QueuePlayer): QueuePlayer | null {
    // ±150 rating oralig'i
    const ratingRange = 150;
    
    const match = this.queue.find(p => 
      p.id !== player.id && 
      Math.abs(p.rating - player.rating) <= ratingRange
    );
    
    if (match) {
      console.log(`🤝 Found match: ${player.name} (${player.rating}) vs ${match.name} (${match.rating})`);
    }
    
    return match || null;
  }

  notifyDuelFound(player1: QueuePlayer, player2: QueuePlayer, duelId: string): void {
    const player1Socket = this.getSocketByUserId(player1.id);
    const player2Socket = this.getSocketByUserId(player2.id);

    const opponentData = (player: QueuePlayer) => ({
      id: player.id,
      name: player.name,
      rating: player.rating,
      level: player.level,
      avatar: player.name.charAt(0),
      wins: Math.floor(Math.random() * 20) + 5,
      losses: Math.floor(Math.random() * 10) + 2,
      online: true
    });

    if (player1Socket) {
      player1Socket.emit('duel_found', {
        duelId,
        opponent: opponentData(player2)
      });
      console.log(`📨 Duel notification sent to ${player1.name}`);
    } else {
      console.log(`⚠️ Cannot send notification to ${player1.name} - socket not found`);
    }

    if (player2Socket) {
      player2Socket.emit('duel_found', {
        duelId,
        opponent: opponentData(player1)
      });
      console.log(`📨 Duel notification sent to ${player2.name}`);
    } else {
      console.log(`⚠️ Cannot send notification to ${player2.name} - socket not found`);
    }
  }

  addVote(duelId: string, userId: string, choice: 'like' | 'super_like' | 'skip'): boolean {
    const duel = this.activeDuels.get(duelId);
    if (!duel) {
      console.error(`❌ Duel ${duelId} not found`);
      return false;
    }

    // User dueldagi o'yinchilardan bormi?
    const playerInDuel = duel.players.some(p => p.id === userId);
    if (!playerInDuel) {
      console.error(`❌ User ${userId} not in duel ${duelId}`);
      return false;
    }

    duel.votes.set(userId, choice);
    console.log(`🗳️ User ${userId} voted ${choice} in duel ${duelId}`);
    console.log(`📊 Duel votes: ${Array.from(duel.votes.entries()).map(([id, choice]) => `${id}:${choice}`)}`);

    // Agar ikkala o'yinchi ham ovoz berga bo'lsa
    if (duel.votes.size === 2) {
      duel.status = 'completed';
      console.log(`✅ Both players voted in duel ${duelId}`);
      return true; // bothVoted = true
    }

    return false; // bothVoted = false
  }

  getQueue(): QueuePlayer[] {
    return [...this.queue];
  }

  // Duelda qatnashgan o'yinchilar
  getDuelPlayers(duelId: string): QueuePlayer[] | undefined {
    const duel = this.activeDuels.get(duelId);
    return duel?.players;
  }

  // Userning joriy dueli
  getUserCurrentDuel(userId: string): Duel | undefined {
    for (const [duelId, duel] of this.activeDuels.entries()) {
      if (duel.players.some(p => p.id === userId)) {
        return duel;
      }
    }
    return undefined;
  }

  // Duelni o'chirish
  removeDuel(duelId: string): boolean {
    const deleted = this.activeDuels.delete(duelId);
    if (deleted) {
      console.log(`🗑️ Removed duel ${duelId} from activeDuels`);
    }
    return deleted;
  }

  // Debug ma'lumotlari
  getDebugInfo(): any {
    return {
      queueSize: this.queue.length,
      queuePlayers: this.queue.map(p => ({ 
        id: p.id, 
        name: p.name, 
        rating: p.rating,
        socketId: p.socketId 
      })),
      activeDuels: Array.from(this.activeDuels.entries()).map(([id, duel]) => ({
        id,
        players: duel.players.map(p => ({ name: p.name, id: p.id })),
        votes: Array.from(duel.votes.entries()),
        status: duel.status,
        createdAt: duel.createdAt
      })),
      onlineCount: this.onlinePlayers.size,
      playerSocketMap: Array.from(this.playerSocketMap.entries()).map(([userId, socketId]) => ({
        userId,
        socketId
      }))
    };
  }

  // O'yinchini navbatdan chiqarish socketId orqali
  removeBySocketId(socketId: string): void {
    const userId = this.getUserIdBySocketId(socketId);
    if (userId) {
      this.removeFromQueue(userId);
      console.log(`🚪 Player ${userId} removed from queue via socket ${socketId}`);
    }
  }
}