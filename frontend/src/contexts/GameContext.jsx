import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';

const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const { sendMessage, isConnected } = useSocket();
  
  // Game state
  const [currentGame, setCurrentGame] = useState(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueTime, setQueueTime] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    draws: 0,
    elo: 1000,
    streak: 0
  });

  // Join matchmaking queue
  const joinQueue = useCallback((mode = 'casual') => {
    if (!isConnected) {
      throw new Error('Serverga ulanmagan');
    }
    
    setMatchmakingStatus('searching');
    setQueueTime(0);
    
    // Start queue timer
    const timer = setInterval(() => {
      setQueueTime(prev => prev + 1);
    }, 1000);
    
    // Send join queue message
    const success = sendMessage('join_queue', { mode });
    
    if (!success) {
      clearInterval(timer);
      setMatchmakingStatus(null);
      throw new Error('Navbatga qo‘shilish muvaffaqiyatsiz');
    }
    
    // Store timer reference
    localStorage.setItem('queueTimer', timer);
    
    return () => clearInterval(timer);
  }, [isConnected, sendMessage]);

  // Leave queue
  const leaveQueue = useCallback(() => {
    const timer = localStorage.getItem('queueTimer');
    if (timer) {
      clearInterval(timer);
      localStorage.removeItem('queueTimer');
    }
    
    sendMessage('leave_queue');
    setMatchmakingStatus(null);
    setQueueTime(0);
  }, [sendMessage]);

  // Make choice in game
  const makeChoice = useCallback((gameId, choice) => {
    if (!gameId || !choice) {
      throw new Error('GameId va Choice talab qilinadi');
    }
    
    return sendMessage('make_choice', { gameId, choice });
  }, [sendMessage]);

  // Send game invitation
  const sendGameInvite = useCallback((inviteeId, gameMode = 'casual', rounds = 3) => {
    return sendMessage('invite_player', {
      inviteeId,
      gameMode,
      rounds
    });
  }, [sendMessage]);

  // Respond to invitation
  const respondToInvitation = useCallback((invitationId, response) => {
    return sendMessage('respond_invitation', {
      invitationId,
      response
    });
  }, [sendMessage]);

  // Request rematch
  const requestRematch = useCallback((gameId) => {
    return sendMessage('request_rematch', { gameId });
  }, [sendMessage]);

  // Create tournament
  const createTournament = useCallback((tournamentData) => {
    return sendMessage('create_tournament', tournamentData);
  }, [sendMessage]);

  // Join tournament
  const joinTournament = useCallback((tournamentId) => {
    return sendMessage('join_tournament', { tournamentId });
  }, [sendMessage]);

  // Send chat message
  const sendChatMessage = useCallback((roomId, text, type = 'text') => {
    return sendMessage('chat_message', {
      roomId,
      text,
      type
    });
  }, [sendMessage]);

  // Update status
  const updateStatus = useCallback((status, customStatus = '') => {
    return sendMessage('update_status', { status, customStatus });
  }, [sendMessage]);

  // Get profile
  const getProfile = useCallback((userId = null) => {
    return new Promise((resolve, reject) => {
      // This would typically be a WebSocket message
      // For now, we'll use localStorage
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          resolve(JSON.parse(userData));
        } else {
          reject('Foydalanuvchi topilmadi');
        }
      } catch (error) {
        reject(error.message);
      }
    });
  }, []);

  // Spectate game
  const spectateGame = useCallback((gameId, action = 'join') => {
    return sendMessage('spectate_game', { gameId, action });
  }, [sendMessage]);

  // Add friend
  const addFriend = useCallback((targetId, action = 'add') => {
    return sendMessage('friend_request', { targetId, action });
  }, [sendMessage]);

  // Load game history
  const loadGameHistory = useCallback(async (userId = null) => {
    try {
      const response = await fetch('/api/games');
      const data = await response.json();
      
      if (data.success) {
        setGameHistory(data.games);
        return data.games;
      }
      throw new Error(data.error);
    } catch (error) {
      console.error('Load game history error:', error);
      return [];
    }
  }, []);

  // Load tournaments
  const loadTournaments = useCallback(async () => {
    try {
      const response = await fetch('/api/tournaments');
      const data = await response.json();
      
      if (data.success) {
        setTournaments(data.tournaments);
        return data.tournaments;
      }
      throw new Error(data.error);
    } catch (error) {
      console.error('Load tournaments error:', error);
      return [];
    }
  }, []);

  // Update stats
  const updateStats = useCallback((newStats) => {
    setStats(prev => ({ ...prev, ...newStats }));
  }, []);

  // Context value
  const contextValue = {
    // State
    currentGame,
    matchmakingStatus,
    queuePosition,
    queueTime,
    gameHistory,
    tournaments,
    achievements,
    stats,
    
    // Actions
    joinQueue,
    leaveQueue,
    makeChoice,
    sendGameInvite,
    respondToInvitation,
    requestRematch,
    createTournament,
    joinTournament,
    sendChatMessage,
    updateStatus,
    getProfile,
    spectateGame,
    addFriend,
    loadGameHistory,
    loadTournaments,
    updateStats,
    
    // Setters
    setCurrentGame,
    setMatchmakingStatus,
    setQueuePosition
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};