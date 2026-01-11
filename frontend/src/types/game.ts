// frontend/src/types/game.ts
export interface User {
    id: string;
    telegramId: string;
    name: string;
    gender: 'male' | 'female' | 'other';
    rating: number;
    coins: number;
    level: number;
    wins: number;
    losses: number;
    streakDays: number;
    dailySuperLikes: number;
    bio?: string;
    lastLogin: Date;
  }
  
  export interface Opponent {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'other';
    rating: number;
    level: number;
    bio?: string;
  }
  
  export interface Duel {
    id: string;
    player1: string; // User ID
    player2: string; // Opponent ID
    choices: {
      player1?: 'like' | 'super_like' | 'skip';
      player2?: 'like' | 'super_like' | 'skip';
    };
    startedAt: Date;
    timer: number; // 20 seconds
  }
  
  export interface QueueStatus {
    position: number;
    total: number;
    waitTime: number;
  }
  
  export interface MatchResult {
    type: 'match' | 'no_match' | 'timeout' | 'mutual_super';
    rewards?: {
      coins: number;
      ratingChange: number;
    };
    opponentChoice?: 'like' | 'super_like' | 'skip';
  }
  
  export interface Quest {
    id: string;
    title: string;
    description: string;
    type: 'daily' | 'weekly' | 'achievement';
    goal: number;
    progress: number;
    reward: number;
    completed: boolean;
  }
  
  export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlockedAt?: Date;
  }