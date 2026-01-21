// src/components/tournament/TournamentList.jsx
import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import TournamentCard from './TournamentCard';
import CreateTournamentModal from './CreateTournamentModal';

const TournamentList = () => {
  const { tournaments, createTournament } = useGame();
  
  const [filter, setFilter] = useState('all'); // all, open, in_progress, finished
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Turnirlarni yuklash
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch('/api/tournaments');
      const data = await response.json();
      
      if (data.success) {
        // Tournament context'ni yangilash
      }
    } catch (error) {
      console.error('Fetch tournaments error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (tournamentData) => {
    try {
      await createTournament(tournamentData);
      setShowCreateModal(false);
      
      // Notification
      alert('Turnir muvaffaqiyatli yaratildi!');
    } catch (error) {
      console.error('Create tournament error:', error);
      alert('Turnir yaratishda xatolik');
    }
  };

  const filteredTournaments = tournaments.filter(tournament => {
    if (filter === 'all') return true;
    return tournament.status === filter;
  });

  if (loading) {
    return (
      <div className="loading-tournaments">
        <div className="spinner"></div>
        <p>Turnirlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="tournament-list">
      <div className="tournament-header">
        <h1>🏆 Turnirlar</h1>
        
        <div className="tournament-actions">
          <button
            className="btn-create"
            onClick={() => setShowCreateModal(true)}
          >
            + Yangi Turnir
          </button>
          
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
              Ochiq
            </button>
            <button
              className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setFilter('in_progress')}
            >
              Davom etmoqda
            </button>
            <button
              className={`filter-btn ${filter === 'finished' ? 'active' : ''}`}
              onClick={() => setFilter('finished')}
            >
              Tugagan
            </button>
          </div>
        </div>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="empty-tournaments">
          <div className="empty-icon">🏆</div>
          <h3>Hozircha turnirlar yo'q</h3>
          <p>Birinchi turnirni yaratish uchun "Yangi Turnir" tugmasini bosing</p>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Turnir Yaratish
          </button>
        </div>
      ) : (
        <div className="tournament-grid">
          {filteredTournaments.map(tournament => (
            <TournamentCard
              key={tournament.tournamentId}
              tournament={tournament}
              onJoin={() => handleJoinTournament(tournament.tournamentId)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTournament}
        />
      )}
    </div>
  );
};

export default TournamentList;