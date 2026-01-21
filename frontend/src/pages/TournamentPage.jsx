import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

// Components
import TournamentCard from '../components/tournament/TournamentCard';
import TournamentBracket from '../components/tournament/TournamentBracket';
import CreateTournamentModal from '../components/tournament/CreateTournamentModal';

// Icons
import {
  FaTrophy,
  FaPlus,
  FaUsers,
  FaCoins,
  FaCalendar,
  FaFire,
  FaCrown,
  FaSearch
} from 'react-icons/fa';

const TournamentPage = () => {
  const navigate = useNavigate();
  const { tournaments, loadTournaments, joinTournament, createTournament } = useGame();
  const { isConnected } = useSocket();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, open, in_progress, finished
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  
  // Load tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true);
        await loadTournaments();
      } catch (error) {
        toast.error('Turnirlarni yuklashda xatolik');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTournaments();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchTournaments, 30000);
    return () => clearInterval(interval);
  }, [loadTournaments]);
  
  // Filter tournaments
  const filteredTournaments = tournaments.filter(tournament => {
    // Status filter
    if (filter !== 'all' && tournament.status !== filter) {
      return false;
    }
    
    // Search filter
    if (searchQuery && !tournament.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  // Handle join tournament
  const handleJoinTournament = async (tournamentId) => {
    if (!isConnected) {
      toast.error('Serverga ulanmagan');
      return;
    }
    
    try {
      await joinTournament(tournamentId);
      toast.success('Turnirga qo‘shildingiz!');
      navigate(`/tournament/${tournamentId}`);
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Handle create tournament
  const handleCreateTournament = async (tournamentData) => {
    if (!isConnected) {
      toast.error('Serverga ulanmagan');
      return;
    }
    
    try {
      const result = await createTournament(tournamentData);
      toast.success('Turnir yaratildi!');
      setShowCreateModal(false);
      return result;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };
  
  // Handle view tournament
  const handleViewTournament = (tournament) => {
    setSelectedTournament(tournament);
  };
  
  // Render tournament cards
  const renderTournaments = () => {
    if (loading) {
      return (
        <div className="loading-tournaments">
          <div className="loading-spinner" />
          <p>Turnirlar yuklanmoqda...</p>
        </div>
      );
    }
    
    if (filteredTournaments.length === 0) {
      return (
        <div className="empty-tournaments">
          <div className="empty-icon">
            <FaTrophy size={48} />
          </div>
          <h3>Hozircha turnirlar yo'q</h3>
          <p>Birinchi turnirni siz yarating!</p>
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <FaPlus /> Turnir yaratish
          </button>
        </div>
      );
    }
    
    return (
      <div className="tournaments-grid">
        {filteredTournaments.map(tournament => (
          <TournamentCard
            key={tournament.tournamentId}
            tournament={tournament}
            onJoin={() => handleJoinTournament(tournament.tournamentId)}
            onView={() => handleViewTournament(tournament)}
          />
        ))}
      </div>
    );
  };
  
  // Tournament stats
  const tournamentStats = {
    total: tournaments.length,
    active: tournaments.filter(t => t.status === 'in_progress').length,
    open: tournaments.filter(t => t.status === 'open').length,
    finished: tournaments.filter(t => t.status === 'finished').length
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="tournament-page"
    >
      <div className="page-header">
        <button 
          className="btn-back"
          onClick={() => navigate('/')}
        >
          ← Ortga
        </button>
        <h1 className="page-title">
          <FaTrophy /> Turnirlar
        </h1>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={!isConnected}
        >
          <FaPlus /> Turnir yaratish
        </button>
      </div>
      
      <div className="tournament-content">
        {/* Stats overview */}
        <div className="tournament-stats">
          <div className="stat-card">
            <div className="stat-icon total">
              <FaTrophy />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tournamentStats.total}</div>
              <div className="stat-label">Jami turnirlar</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon active">
              <FaFire />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tournamentStats.active}</div>
              <div className="stat-label">Faol turnirlar</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon open">
              <FaUsers />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tournamentStats.open}</div>
              <div className="stat-label">Ochiq turnirlar</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon prize">
              <FaCoins />
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {tournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0)}
              </div>
              <div className="stat-label">Jami sovrin</div>
            </div>
          </div>
        </div>
        
        {/* Filters and search */}
        <div className="tournament-filters">
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Barchasi
            </button>
            <button
              className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
              onClick={() => setFilter('open')}
            >
              <FaUsers /> Ochiq
            </button>
            <button
              className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setFilter('in_progress')}
            >
              <FaFire /> Faol
            </button>
            <button
              className={`filter-btn ${filter === 'finished' ? 'active' : ''}`}
              onClick={() => setFilter('finished')}
            >
              <FaCrown /> Tugagan
            </button>
          </div>
          
          <div className="search-box">
            <FaSearch />
            <input
              type="text"
              placeholder="Turnir nomi bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {/* Tournaments list */}
        <div className="tournaments-section">
          <div className="section-header">
            <h2>Mavjud turnirlar</h2>
            <span className="tournament-count">
              {filteredTournaments.length} ta turnir
            </span>
          </div>
          
          {renderTournaments()}
        </div>
        
        {/* Featured tournament */}
        {tournaments.length > 0 && (
          <div className="featured-tournament">
            <div className="section-header">
              <h2>
                <FaFire /> Taniqli turnir
              </h2>
            </div>
            
            <TournamentCard
              tournament={tournaments[0]}
              featured={true}
              onJoin={() => handleJoinTournament(tournaments[0].tournamentId)}
              onView={() => handleViewTournament(tournaments[0])}
            />
          </div>
        )}
      </div>
      
      {/* Create tournament modal */}
      <CreateTournamentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateTournament}
      />
      
      {/* Tournament detail modal */}
      {selectedTournament && (
        <div className="tournament-detail-modal">
          <div className="modal-content">
            <button 
              className="close-modal"
              onClick={() => setSelectedTournament(null)}
            >
              ×
            </button>
            
            <div className="tournament-detail">
              <h2>{selectedTournament.name}</h2>
              <p className="tournament-description">
                {selectedTournament.description || 'Tavsif kiritilmagan'}
              </p>
              
              <div className="tournament-info-grid">
                <div className="info-item">
                  <FaUsers />
                  <span>Ishtirokchilar:</span>
                  <strong>
                    {selectedTournament.currentPlayers}/{selectedTournament.maxPlayers}
                  </strong>
                </div>
                
                <div className="info-item">
                  <FaCoins />
                  <span>Sovrin fondi:</span>
                  <strong>{selectedTournament.prizePool || 0} coins</strong>
                </div>
                
                <div className="info-item">
                  <FaCalendar />
                  <span>Holat:</span>
                  <strong className={`status-${selectedTournament.status}`}>
                    {selectedTournament.status === 'open' ? 'Ochiq' : 
                     selectedTournament.status === 'in_progress' ? 'Faol' : 
                     selectedTournament.status === 'finished' ? 'Tugagan' : 'Bekor qilingan'}
                  </strong>
                </div>
                
                <div className="info-item">
                  <FaCrown />
                  <span>G'olib:</span>
                  <strong>
                    {selectedTournament.winnerId ? 
                      `ID: ${selectedTournament.winnerId}` : 
                      'Aniqlanmagan'}
                  </strong>
                </div>
              </div>
              
              {/* Bracket preview */}
              {selectedTournament.bracket && (
                <div className="bracket-preview">
                  <h3>Turnir jadvali</h3>
                  <TournamentBracket
                    bracket={selectedTournament.bracket}
                    compact={true}
                  />
                </div>
              )}
              
              {/* Actions */}
              <div className="tournament-actions">
                {selectedTournament.status === 'open' && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      handleJoinTournament(selectedTournament.tournamentId);
                      setSelectedTournament(null);
                    }}
                  >
                    Qatnashish
                  </button>
                )}
                
                {selectedTournament.status === 'in_progress' && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      navigate(`/tournament/${selectedTournament.tournamentId}`);
                    }}
                  >
                    Kuzatish
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TournamentPage;