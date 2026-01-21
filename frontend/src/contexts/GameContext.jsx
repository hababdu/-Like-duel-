// src/contexts/GameContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { sendMessage, subscribeToMessages } from '../utils/gameWebSocket';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [currentGame, setCurrentGame] = useState(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [tournaments, setTournaments] = useState([]);
  const [friends, setFriends] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // O'yin taklifini yuborish
  const sendGameInvite = useCallback(async (inviteeId, gameMode = 'casual', rounds = 3) => {
    try {
      const response = await sendMessage({
        type: 'invite_player',
        inviteeId,
        gameMode,
        rounds
      });
      
      return response;
    } catch (error) {
      console.error('Send game invite error:', error);
      throw error;
    }
  }, []);

  // Navbatga qo'shilish
  const joinQueue = useCallback(async (mode = 'casual') => {
    try {
      const response = await sendMessage({
        type: 'join_queue',
        mode
      });
      
      setMatchmakingStatus('searching');
      setQueuePosition(response.position);
      
      return response;
    } catch (error) {
      console.error('Join queue error:', error);
      throw error;
    }
  }, []);

  // Navbatdan chiqish
  const leaveQueue = useCallback(async () => {
    try {
      await sendMessage({
        type: 'leave_queue'
      });
      
      setMatchmakingStatus(null);
      setQueuePosition(0);
    } catch (error) {
      console.error('Leave queue error:', error);
    }
  }, []);

  // Tanlov qilish
  const makeChoice = useCallback(async (gameId, choice, round = 1) => {
    try {
      const response = await sendMessage({
        type: 'make_choice',
        gameId,
        choice,
        round
      });
      
      return response;
    } catch (error) {
      console.error('Make choice error:', error);
      throw error;
    }
  }, []);

  // Chat xabarini yuborish
  const sendChatMessage = useCallback(async (roomId, text) => {
    try {
      const response = await sendMessage({
        type: 'chat_message',
        roomId,
        text
      });
      
      return response;
    } catch (error) {
      console.error('Send chat message error:', error);
      throw error;
    }
  }, []);

  // Turnir yaratish
  const createTournament = useCallback(async (tournamentData) => {
    try {
      const response = await sendMessage({
        type: 'create_tournament',
        ...tournamentData
      });
      
      return response;
    } catch (error) {
      console.error('Create tournament error:', error);
      throw error;
    }
  }, []);

  // Do'stlik so'rovi
  const sendFriendRequest = useCallback(async (targetId, action = 'add') => {
    try {
      const response = await sendMessage({
        type: 'friend_request',
        targetId,
        action
      });
      
      return response;
    } catch (error) {
      console.error('Friend request error:', error);
      throw error;
    }
  }, []);

  // O'yin natijasini olish
  const getGameResult = useCallback(async (gameId) => {
    try {
      // Serverdan so'rov yuborish yoki local holatdan olish
      if (currentGame && currentGame.gameId === gameId) {
        return currentGame;
      }
      
      // Agar serverdan kerak bo'lsa
      const response = await fetch(`/api/games/${gameId}`);
      return response.json();
    } catch (error) {
      console.error('Get game result error:', error);
      throw error;
    }
  }, [currentGame]);

  // Server xabarlariga obuna bo'lish
  useEffect(() => {
    const unsubscribe = subscribeToMessages((data) => {
      switch (data.type) {
        case 'match_found':
          setCurrentGame({
            gameId: data.gameId,
            opponent: data.opponent,
            mode: data.gameMode,
            isRanked: data.isRanked,
            status: 'starting'
          });
          setMatchmakingStatus(null);
          break;
          
        case 'game_invitation':
          setNotifications(prev => [...prev, {
            id: data.invitationId,
            type: 'game_invite',
            title: 'O\'yin taklifi',
            message: `${data.inviter.firstName} sizni o'yinga taklif qildi`,
            data,
            createdAt: new Date()
          }]);
          break;
          
        case 'tournament_invite':
          setNotifications(prev => [...prev, {
            id: data.tournamentId,
            type: 'tournament_invite',
            title: 'Turnir taklifi',
            message: `${data.creatorName} yangi turnir yaratdi`,
            data,
            createdAt: new Date()
          }]);
          break;
          
        case 'friend_request':
          setNotifications(prev => [...prev, {
            id: data.from,
            type: 'friend_request',
            title: 'Do\'stlik so\'rovi',
            message: `${data.fromName} sizni do'st qilishni xohlaydi`,
            data,
            createdAt: new Date()
          }]);
          break;
          
        case 'joined_queue':
          setQueuePosition(data.position);
          break;
          
        case 'game_result':
          setCurrentGame(prev => prev ? {
            ...prev,
            result: data.result,
            winnerId: data.winnerId,
            scores: data.scores,
            status: 'finished'
          } : null);
          break;
      }
    });
    
    return unsubscribe;
  }, []);

  const value = {
    currentGame,
    matchmakingStatus,
    queuePosition,
    tournaments,
    friends,
    notifications,
    
    // Actions
    sendGameInvite,
    joinQueue,
    leaveQueue,
    makeChoice,
    sendChatMessage,
    createTournament,
    sendFriendRequest,
    getGameResult,
    
    // Setters
    setCurrentGame,
    setMatchmakingStatus,
    setTournaments,
    setFriends,
    setNotifications
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};