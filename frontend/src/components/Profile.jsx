// ============================================================
// Profile.js - FOYDALANUVCHI PROFILI
// ============================================================
import React, { useState, useEffect } from 'react';

function Profile({ user, onBack, updateUser, API_URL }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${user.tgId}/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('❌ Stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelProgress = () => {
    if (!stats) return 0;
    return (stats.xp / stats.xpToNextLevel) * 100;
  };

  return (
    <div className="profile-page">
      <button className="back-btn" onClick={onBack}>
        ⬅️ Orqaga
      </button>

      <div className="profile-card">
        <div className="profile-avatar">
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="Profile" />
          ) : (
            <span>{user?.firstName?.charAt(0) || '?'}</span>
          )}
          {user?.isPremium && (
            <div className="premium-badge">⭐</div>
          )}
        </div>

        <div className="profile-name">
          <h2>{user?.firstName} {user?.lastName}</h2>
          <p>@{user?.username}</p>
          <p className="profile-id">ID: {user?.tgId}</p>
        </div>

        <div className="profile-stats-grid">
          <div className="stat-box">
            <span className="stat-label">🪙 Tanga</span>
            <span className="stat-value">{user?.coins}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">🏆 Reyting</span>
            <span className="stat-value">{user?.rating}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">📊 Level</span>
            <span className="stat-value">{user?.level || 1}</span>
          </div>
        </div>

        {stats && (
          <>
            <div className="profile-xp">
              <div className="xp-info">
                <span>XP: {stats.xp} / {stats.xpToNextLevel}</span>
                <span>{Math.round(getLevelProgress())}%</span>
              </div>
              <div className="xp-bar">
                <div 
                  className="xp-fill" 
                  style={{ width: `${getLevelProgress()}%` }}
                />
              </div>
            </div>

            <div className="profile-game-stats">
              <h3>📊 O'yin statistikasi</h3>
              <div className="game-stats-grid">
                <div className="game-stat">
                  <span className="stat-number">{stats.totalGames}</span>
                  <span className="stat-name">Jami o'yin</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number" style={{ color: '#00ff88' }}>
                    {stats.wins}
                  </span>
                  <span className="stat-name">G'alaba</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number" style={{ color: '#ff4444' }}>
                    {stats.losses}
                  </span>
                  <span className="stat-name">Mag'lubiyat</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number" style={{ color: '#ffaa00' }}>
                    {stats.draws}
                  </span>
                  <span className="stat-name">Durang</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number">{stats.winRate}%</span>
                  <span className="stat-name">G'alaba %</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number">🔥 {stats.winStreak}</span>
                  <span className="stat-name">G'alaba seriyasi</span>
                </div>
                <div className="game-stat">
                  <span className="stat-number">🏅 {stats.maxWinStreak}</span>
                  <span className="stat-name">Eng yaxshi seriya</span>
                </div>
              </div>
            </div>

            <div className="profile-ref">
              <h3>👥 Referal</h3>
              <div className="ref-stats">
                <div className="ref-stat">
                  <span className="stat-number">{user?.refCount || 0}</span>
                  <span className="stat-name">Taklif qilinganlar</span>
                </div>
                <div className="ref-stat">
                  <span className="stat-number">+{user?.refBonus || 0} 🪙</span>
                  <span className="stat-name">Bonus</span>
                </div>
              </div>
            </div>
          </>
        )}

        <button 
          className="btn-refresh"
          onClick={fetchStats}
          disabled={loading}
        >
          {loading ? '⏳ Yuklanmoqda...' : '🔄 Yangilash'}
        </button>
      </div>
    </div>
  );
}

export default Profile;