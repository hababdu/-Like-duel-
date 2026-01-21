import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

// Components
import GameModeSelector from '../components/game/GameModeSelector';
import QueueStatus from '../components/game/QueueStatus';
import GameInviteModal from '../components/game/GameInviteModal';
import FriendListModal from '../components/friends/FriendListModal';
import RecentGames from '../components/game/RecentGames';
import StatsCard from '../components/game/StatsCard';

// Icons
import {
  FaGamepad,
  FaTrophy,
  FaUsers,
  FaRobot,
  FaBolt,
  FaUserFriends,
  FaCrown,
  FaSearch
} from 'react-icons/fa';

const MultiplayerPage = () => {
  const navigate = useNavigate();
  const { 
    joinQueue, 
    leaveQueue, 
    matchmakingStatus, 
    queueTime,
    sendGameInvite,
    stats
  } = useGame();
  
  const { isConnected } = useSocket();
  
  const [gameMode, setGameMode] = useState('casual');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFriendList, setShowFriendList] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [rounds, setRounds] = useState(3);
  const [recentGames, setRecentGames] = useState([]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle join queue
  const handleJoinQueue = async () => {
    if (!isConnected) {
      toast.error('Serverga ulanmagan');
      return;
    }
    
    try {
      await joinQueue(gameMode);
      toast.success(`Navbatga qo'shildingiz (${gameMode})`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Handle invite friend
  const handleInviteFriend = (friend) => {
    setSelectedFriend(friend);
    setShowInviteModal(true);
  };

  // Handle send invite
  const handleSendInvite = async () => {
    if (!selectedFriend) return;
    
    try {
      await sendGameInvite(selectedFriend.id, gameMode, rounds);
      toast.success(`Taklif ${selectedFriend.name} ga yuborildi`);
      setShowInviteModal(false);
    } catch (error) {
      toast.error('Taklif yuborishda xatolik');
    }
  };

  // Handle play with bot
  const handlePlayWithBot = () => {
    navigate('/bot');
  };

  // Handle view tournaments
  const handleViewTournaments = () => {
    navigate('/tournaments');
  };

  // Load recent games
  useEffect(() => {
    const loadGames = () => {
      const games = JSON.parse(localStorage.getItem('gameHistory') || '[]');
      setRecentGames(games.slice(0, 5));
    };
    
    loadGames();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="multiplayer-page"
    >
      <div className="page-header">
        <button 
          className="btn-back"
          onClick={() => navigate('/')}
        >
          ← Ortga
        </button>
        <h1 className="page-title">Multiplayer</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Ulandi' : 'Uzilgan'}</span>
        </div>
      </div>

      <div className="multiplayer-content">
        {/* Stats overview */}
        <div className="stats-overview">
          <StatsCard
            title="ELO Reyting"
            value={stats.elo}
            icon={<FaCrown />}
            color="gold"
            change={stats.eloChange || 0}
          />
          <StatsCard
            title="G'alabalar"
            value={stats.wins}
            icon={<FaTrophy />}
            color="green"
          />
          <StatsCard
            title="Seriya"
            value={stats.streak}
            icon={<FaBolt />}
            color="orange"
          />
          <StatsCard
            title="O'yinlar"
            value={stats.wins + stats.losses + stats.draws}
            icon={<FaGamepad />}
            color="blue"
          />
        </div>

        {/* Game mode selection */}
        <div className="section game-mode-section">
          <h2 className="section-title">
            <FaGamepad /> O'yin Rejimi
          </h2>
          
          <div className="mode-grid">
            <button
              className={`mode-card ${gameMode === 'casual' ? 'active' : ''}`}
              onClick={() => setGameMode('casual')}
            >
              <div className="mode-icon casual">
                <FaGamepad />
              </div>
              <h3>Oddiy</h3>
              <p>Tajriba oshirish uchun</p>
              <div className="mode-stats">
                <span>♻️ Reyting o'zgarmaydi</span>
                <span>⚡ Tezkor o'yin</span>
              </div>
            </button>
            
            <button
              className={`mode-card ${gameMode === 'ranked' ? 'active' : ''}`}
              onClick={() => setGameMode('ranked')}
            >
              <div className="mode-icon ranked">
                <FaCrown />
              </div>
              <h3>Reytingli</h3>
              <p>ELO reyting uchun</p>
              <div className="mode-stats">
                <span>⭐ ELO o'zgaradi</span>
                <span>🏆 Darajalar</span>
              </div>
            </button>
            
            <button
              className="mode-card"
              onClick={handleViewTournaments}
            >
              <div className="mode-icon tournament">
                <FaTrophy />
              </div>
              <h3>Turnir</h3>
              <p>Katta sovrinlar</p>
              <div className="mode-stats">
                <span>👥 Ko'p o'yinchi</span>
                <span>💰 Sovrinlar</span>
              </div>
            </button>
          </div>
        </div>

        {/* Queue status */}
        <AnimatePresence>
          {matchmakingStatus === 'searching' && (
            <QueueStatus
              time={formatTime(queueTime)}
              mode={gameMode}
              onCancel={leaveQueue}
            />
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {!matchmakingStatus && (
          <div className="section action-section">
            <h2 className="section-title">
              <FaBolt /> Tezkor Harakatlar
            </h2>
            
            <div className="action-grid">
              <button
                className="action-btn primary"
                onClick={handleJoinQueue}
                disabled={!isConnected}
              >
                <div className="action-icon">
                  <FaSearch />
                </div>
                <div className="action-content">
                  <h3>Tezkor o'yin</h3>
                  <p>30 soniya ichida raqib topiladi</p>
                </div>
              </button>
              
              <button
                className="action-btn secondary"
                onClick={() => setShowFriendList(true)}
                disabled={!isConnected}
              >
                <div className="action-icon">
                  <FaUserFriends />
                </div>
                <div className="action-content">
                  <h3>Do'st bilan o'ynash</h3>
                  <p>Do'stingizni taklif qiling</p>
                </div>
              </button>
              
              <button
                className="action-btn outline"
                onClick={handlePlayWithBot}
              >
                <div className="action-icon">
                  <FaRobot />
                </div>
                <div className="action-content">
                  <h3>Bot bilan mashq</h3>
                  <p>Ko'nikmalaringizni oshiring</p>
                </div>
              </button>
              
              <button
                className="action-btn outline"
                onClick={handleViewTournaments}
              >
                <div className="action-icon">
                  <FaTrophy />
                </div>
                <div className="action-content">
                  <h3>Turnirlar</h3>
                  <p>Katta sovrinlar yutib oling</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Recent games */}
        <div className="section recent-games-section">
          <h2 className="section-title">
            <FaGamepad /> Oxirgi O'yinlar
          </h2>
          
          <RecentGames games={recentGames} />
        </div>
      </div>

      {/* Modals */}
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
        
        {showFriendList && (
          <FriendListModal
            onSelect={handleInviteFriend}
            onClose={() => setShowFriendList(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MultiplayerPage;