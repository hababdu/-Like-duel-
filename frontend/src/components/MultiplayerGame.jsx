// src/components/game/MultiplayerGame.jsx
import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GameBoard from './GameBoard';
import QueueStatus from './QueueStatus';
import GameInviteModal from './GameInviteModal';
import FriendList from '../friends/FriendList';

const MultiplayerGame = () => {
  const navigate = useNavigate();
  const {
    currentGame,
    matchmakingStatus,
    queuePosition,
    joinQueue,
    leaveQueue,
    sendGameInvite
  } = useGame();
  
  const [gameMode, setGameMode] = useState('casual');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [rounds, setRounds] = useState(3);
  const [searchTime, setSearchTime] = useState(0);

  // O'yin rejimini tanlash
  const handleModeSelect = (mode) => {
    setGameMode(mode);
  };

  // Navbatga qo'shilish
  const handleJoinQueue = async () => {
    try {
      await joinQueue(gameMode);
      
      // Taymer boshlash
      const timer = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    } catch (error) {
      console.error('Failed to join queue:', error);
    }
  };

  // Do'stni taklif qilish
  const handleInviteFriend = (friend) => {
    setSelectedFriend(friend);
    setShowInviteModal(true);
  };

  // Taklifni yuborish
  const handleSendInvite = async () => {
    if (!selectedFriend) return;
    
    try {
      await sendGameInvite(selectedFriend.id, gameMode, rounds);
      setShowInviteModal(false);
      
      // Notification yuborish
      alert(`Taklif ${selectedFriend.name} ga yuborildi`);
    } catch (error) {
      console.error('Failed to send invite:', error);
      alert('Taklif yuborishda xatolik');
    }
  };

  // O'yin boshlanganda
  useEffect(() => {
    if (currentGame && currentGame.status === 'starting') {
      navigate('/game', { state: { game: currentGame } });
    }
  }, [currentGame, navigate]);

  // Format search time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="multiplayer-container">
      <div className="multiplayer-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          ← Ortga
        </button>
        <h1>Multiplayer</h1>
        <div className="game-stats">
          <span className="stat">🕹️ O'yinlar: 0</span>
          <span className="stat">⭐ ELO: 1000</span>
          <span className="stat">👑 Daraja: Bronze</span>
        </div>
      </div>

      {!currentGame ? (
        <div className="multiplayer-content">
          {/* Game mode selection */}
          <div className="mode-selection">
            <h2>O'yin Rejimi</h2>
            <div className="mode-buttons">
              <button
                className={`mode-btn ${gameMode === 'casual' ? 'active' : ''}`}
                onClick={() => handleModeSelect('casual')}
              >
                <span className="emoji">🎮</span>
                <span className="text">Oddiy</span>
                <span className="desc">Tajriba oshirish</span>
              </button>
              
              <button
                className={`mode-btn ${gameMode === 'ranked' ? 'active' : ''}`}
                onClick={() => handleModeSelect('ranked')}
              >
                <span className="emoji">⭐</span>
                <span className="text">Reytingli</span>
                <span className="desc">ELO reyting</span>
              </button>
              
              <button
                className={`mode-btn ${gameMode === 'tournament' ? 'active' : ''}`}
                onClick={() => navigate('/tournaments')}
              >
                <span className="emoji">🏆</span>
                <span className="text">Turnir</span>
                <span className="desc">Jamoa bellashuvi</span>
              </button>
            </div>
          </div>

          {/* Queue status */}
          {matchmakingStatus === 'searching' && (
            <QueueStatus
              position={queuePosition}
              searchTime={searchTime}
              onCancel={leaveQueue}
            />
          )}

          {/* Quick match buttons */}
          {!matchmakingStatus && (
            <div className="quick-match">
              <button
                className="match-btn primary"
                onClick={handleJoinQueue}
              >
                <span className="emoji">⚡</span>
                Tezkor o'yin
                <span className="subtext">30 soniya ichida raqib topiladi</span>
              </button>
              
              <button
                className="match-btn secondary"
                onClick={() => navigate('/friends')}
              >
                <span className="emoji">👥</span>
                Do'st bilan o'ynash
                <span className="subtext">Do'stingizni taklif qiling</span>
              </button>
              
              <button
                className="match-btn outline"
                onClick={() => navigate('/tournaments')}
              >
                <span className="emoji">🏆</span>
                Turnirda qatnashish
                <span className="subtext">Katta sovrinlar yutish</span>
              </button>
            </div>
          )}

          {/* Recent opponents */}
          <div className="recent-opponents">
            <h2>Oxirgi raqiblar</h2>
            <div className="opponents-list">
              {/* Map through recent games */}
              <div className="empty-state">
                <span className="emoji">👤</span>
                <p>Hozircha raqiblar yo'q</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <GameBoard game={currentGame} />
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && selectedFriend && (
          <GameInviteModal
            friend={selectedFriend}
            gameMode={gameMode}
            rounds={rounds}
            onSend={handleSendInvite}
            onClose={() => setShowInviteModal(false)}
            onChangeRounds={setRounds}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiplayerGame;