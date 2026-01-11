// frontend/src/stores/useGameStore.ts
import { create } from 'zustand';
import type { 
  User, 
  Duel, 
  Opponent, 
  QueueStatus, 
  MatchResult 
} from '../types/game';
import { getSocket } from '../utils/socket';

interface GameState {
  user: User | null;
  opponent: Opponent | null;
  duel: Duel | null;
  queueStatus: QueueStatus;
  matchResult: MatchResult | null;
  isInQueue: boolean;
  isInDuel: boolean;
  
  // Actions
  setUser: (user: User) => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  setOpponent: (opponent: Opponent | null) => void;
  startDuel: (duel: Duel) => void;
  vote: (choice: 'like' | 'super_like' | 'skip') => void;
  setMatchResult: (result: MatchResult | null) => void;
  resetGame: () => void;
}

const initialQueueStatus: QueueStatus = {
  position: 0,
  total: 0,
  waitTime: 0
};

const useGameStore = create<GameState>((set, get) => ({
  user: null,
  opponent: null,
  duel: null,
  queueStatus: initialQueueStatus,
  matchResult: null,
  isInQueue: false,
  isInDuel: false,
  
  setUser: (user) => set({ user }),
  
  joinQueue: () => {
    const socket = getSocket();
    const { user } = get();
    
    if (socket && user) {
      socket.emit('join_queue', {
        userId: user.id,
        gender: user.gender,
        rating: user.rating
      });
      
      set({ 
        isInQueue: true, 
        queueStatus: { ...initialQueueStatus, position: 1 } 
      });
    }
  },
  
  leaveQueue: () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_queue');
    }
    
    set({ 
      isInQueue: false, 
      opponent: null,
      queueStatus: initialQueueStatus 
    });
  },
  
  setOpponent: (opponent) => set({ opponent }),
  
  startDuel: (duel) => set({ 
    duel, 
    isInQueue: false, 
    isInDuel: true 
  }),
  
  vote: (choice) => {
    const socket = getSocket();
    const { duel } = get();
    
    if (socket && duel) {
      socket.emit('vote', {
        duelId: duel.id,
        choice,
        timestamp: Date.now()
      });
    }
  },
  
  setMatchResult: (result) => set({ 
    matchResult: result, 
    isInDuel: false 
  }),
  
  resetGame: () => set({
    opponent: null,
    duel: null,
    queueStatus: initialQueueStatus,
    matchResult: null,
    isInQueue: false,
    isInDuel: false
  })
}));

export default useGameStore;