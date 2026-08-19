// ============================================================
// Leaderboard.js - SERVERGA MOSLASHTIRILGAN VERSIYA
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import './Leaderboard.css';

function Leaderboard({ API_URL, onBack }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Agar App.js API_URL bermasa ham ishlab tursin - lekin har doim
  // App.js'dan kelgan qiymat ustunlik qiladi, shu bilan backend manzili
  // faqat BITTA joyda (App.js) boshqariladi.
  const BASE_URL = API_URL || (process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000');

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    setError(null);

    // TUZATISH: backend'dagi haqiqiy endpoint /api/leaderboard (server.js'da
    // shunday e'lon qilingan), /api/user/leaderboard emas - shu sabab avval
    // doim 404 qaytarib, oflayn (soxta) ma'lumot ko'rsatilardi.
    fetch(`${BASE_URL}/api/leaderboard`)
      .then((res) => {
        if (!res.ok) throw new Error("Reyting ma'lumotlarini yuklab bo'lmadi");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setLeaders(data.leaders || []);
        } else {
          throw new Error(data.message || "Server noto'g'ri ma'lumot qaytardi");
        }
      })
      .catch((err) => {
        console.error('Leaderboard error:', err);
        setError(err.message || 'Xatolik yuz berdi');
        // MUHIM: bu yerda soxta/o'ylab topilgan o'yinchilar ko'rsatilmaydi -
        // bu foydalanuvchini haqiqiy reyting deb chalg'itardi. Buning o'rniga
        // halol xato holati va qayta urinish imkoni beriladi.
        setLeaders([]);
      })
      .finally(() => setLoading(false));
  }, [BASE_URL]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankBadge = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-header">
        <button className="back-btn-small" onClick={onBack}>⬅️</button>
        <h2>🏆 Peshqadamlar</h2>
        <div style={{ width: '32px' }}></div>
      </div>

      <p className="leaderboard-subtitle">Loyiha bo'yicha eng kuchli TOP 50 o'yinchi</p>

      {loading && (
        <div className="leaderboard-status">
          <div className="spinner-small"></div>
          <p>Reyting yangilanmoqda...</p>
        </div>
      )}

      {error && !loading && (
        <div className="leaderboard-warning">
          <p>⚠️ Serverga ulanib bo'lmadi: {error}</p>
          <button className="leaderboard-retry-btn" onClick={fetchLeaderboard}>
            🔄 Qayta urinish
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="leaderboard-list">
          {leaders.map((player, index) => (
            <div
              key={player.tgId || index}
              className={`leader-card rank-${index + 1}`}
            >
              <div className="leader-left">
                <span className="leader-rank">{getRankBadge(index)}</span>
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt="avatar" className="leader-avatar" />
                ) : (
                  <div className="leader-avatar-placeholder">🕹️</div>
                )}
                <div className="leader-name-block">
                  <span className="leader-name">{player.firstName}</span>
                  {player.username && (
                    <span className="leader-username">@{player.username}</span>
                  )}
                </div>
              </div>

              <div className="leader-right">
                <div className="leader-stat">
                  <span className="stat-icon">🏆</span>
                  <span className="stat-val">{player.rating}</span>
                </div>
                <div className="leader-stat">
                  <span className="stat-icon">📊</span>
                  <span className="stat-val">Lv.{player.level ?? 1}</span>
                </div>
                <div className="leader-stat">
                  <span className="stat-icon">🪙</span>
                  <span className="stat-val">{player.coins}</span>
                </div>
              </div>
            </div>
          ))}

          {leaders.length === 0 && (
            <p className="no-players">Hozircha hech qanday o'yinchi mavjud emas.</p>
          )}
        </div>
      )}

      <style>{`
        .leaderboard-warning {
          text-align: center;
          padding: 20px;
        }
        .leaderboard-warning p {
          color: #ffaa00;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .leaderboard-retry-btn {
          padding: 10px 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #43e97b, #38f9d7);
          color: #0f0c29;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default Leaderboard;