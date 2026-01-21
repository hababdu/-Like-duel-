import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';

// Components
import GameBoard from './GameBoard';
import GameChat from './GameChat';
import PlayerInfo from './PlayerInfo';
import RoundInfo from './RoundInfo';
import SpectatorList from './SpectatorList';

// Icons
import {
  FaHandRock,
  FaHandPaper,
  FaHandScissors,
  FaClock,
  FaTrophy,
  FaCrown,
  FaUsers,
  FaComment
} from 'react-icons/fa';

const CHOICES = {
  rock: { icon: <FaHandRock />, name: 'Tosh', color: '#64748b' },
  paper: { icon: <FaHandPaper />, name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { icon: <FaHandScissors />, name: 'Qaychi', color: '#10b981' }
};

const GameRoom = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { makeChoice } = useGame();
  const { isConnected } = useSocket();
  
  const [game, setGame] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [roundResults, setRoundResults] = useState([]);
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  
  // Load game data
  useEffect(() => {
    const loadGame = () => {
      const savedGame = localStorage.getItem('currentGame');
      if (savedGame) {
        const gameData = JSON.parse(savedGame);
        if (gameData.gameId === gameId) {
          setGame(gameData);
          
          // Load chat messages
          const messages = JSON.parse(localStorage.getItem(`chat_game_${gameId}`) || '[]');
          setChatMessages(messages);
        }
      }
    };
    
    loadGame();
    
    // Simulate game updates
    const interval = setInterval(loadGame, 2000);
    
    return () => clearInterval(interval);
  }, [gameId]);
  
  // Timer
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [game]);
  
  // Handle choice selection
  const handleChoiceSelect = useCallback((choice) => {
    if (!game || game.status !== 'playing' || selectedChoice) return;
    
    setSelectedChoice(choice);
    
    // Send choice to server
    try {
      makeChoice(gameId, choice);
      toast.success(`Tanlovingiz: ${CHOICES[choice].name}`);
    } catch (error) {
      toast.error('Tanlov yuborishda xatolik');
      setSelectedChoice(null);
    }
  }, [game, gameId, makeChoice, selectedChoice]);
  
  // Handle surrender
  const handleSurrender = () => {
    if (window.confirm('Rostan ham taslim bo‘lmoqchimisiz?')) {
      // Send surrender signal
      toast.error('Taslim bo‘ldingiz');
      navigate('/');
    }
  };
  
  // Handle rematch request
  const handleRematch = () => {
    // Request rematch
    toast('Qayta oynash sorovi yuborildi');
  };
  
  // Send chat message
  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      sender: 'You',
      text,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    localStorage.setItem(`chat_game_${gameId}`, JSON.stringify([...chatMessages, newMessage]));
  };
  
  if (!game) {
    return (
      <div className="game-loading">
        <div className="loading-spinner" />
        <p>O'yin yuklanmoqda...</p>
      </div>
    );
  }
  
  const isPlayer1 = game.player1?.id === parseInt(localStorage.getItem('userId'));
  const opponent = isPlayer1 ? game.player2 : game.player1;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="game-room"
    >
      <div className="game-header">
        <button 
          className="btn-back"
          onClick={() => navigate('/')}
        >
          ← Chiqish
        </button>
        
        <div className="game-info">
          <div className="game-mode">
            {game.mode === 'ranked' ? '⭐ Reytingli' : '🎮 Oddiy'}
          </div>
          <div className="game-id">
            ID: {gameId.slice(0, 8)}
          </div>
        </div>
        
        <div className="game-timer">
          <FaClock />
          <span>{timeLeft}s</span>
        </div>
      </div>
      
      <div className="game-container">
        {/* Player info */}
        <div className="players-section">
          <PlayerInfo
            player={game.player1}
            isYou={isPlayer1}
            score={game.player1?.score || 0}
            choice={game.player1?.choice}
          />
          
          <div className="vs-divider">
            <span className="vs-text">VS</span>
            <div className="round-info">
              Raund {game.currentRound || 1}/{game.rounds || 3}
            </div>
          </div>
          
          <PlayerInfo
            player={opponent}
            isYou={!isPlayer1}
            score={game.player2?.score || 0}
            choice={game.player2?.choice}
          />
        </div>
        
        {/* Game board */}
        <div className="game-board-section">
          <GameBoard
            choices={CHOICES}
            selectedChoice={selectedChoice}
            onSelect={handleChoiceSelect}
            disabled={selectedChoice !== null || timeLeft === 0}
            opponentChoice={opponent?.choice}
            showOpponentChoice={game.showOpponentChoice || false}
          />
          
          {/* Round results */}
          {roundResults.length > 0 && (
            <div className="round-results">
              <h4>Raund natijalari:</h4>
              {roundResults.map((result, index) => (
                <RoundInfo key={index} result={result} />
              ))}
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="game-sidebar">
          {/* Spectators */}
          <SpectatorList gameId={gameId} />
          
          {/* Chat */}
          <div className="chat-section">
            <div className="chat-header">
              <FaComment />
              <span>Chat</span>
              <button 
                className="toggle-chat"
                onClick={() => setShowChat(!showChat)}
              >
                {showChat ? '−' : '+'}
              </button>
            </div>
            
            {showChat && (
              <GameChat
                messages={chatMessages}
                onSend={handleSendMessage}
                disabled={!isConnected}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="game-actions">
        <button
          className="btn-secondary"
          onClick={handleSurrender}
          disabled={game.status !== 'playing'}
        >
          Taslim bo'lish
        </button>
        
        <button
          className="btn-primary"
          onClick={handleRematch}
          disabled={game.status === 'playing'}
        >
          Qayta o'ynash
        </button>
      </div>
    </motion.div>
  );
};

export default GameRoom;