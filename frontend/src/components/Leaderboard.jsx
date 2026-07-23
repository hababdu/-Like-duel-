// ============================================================
// 5. Leaderboard.js - QAYTA YOZILGAN
// ============================================================
import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

function Leaderboard({ onBack }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/user/leaderboard`)
      .then((res) => {
        if (!res.ok) throw new Error("Reyting ma'lumotlarini yuklab bo'lmadi");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setLeaders(data.leaders || []);
        } else {
          throw new Error("Server noto'g'ri ma'lumot qaytardi");
        }
      })
      .catch((err) => {
        console.error("Leaderboard error:", err);
        setError(err.message);
        // Fallback data
        setLeaders([
          { tgId: "1", firstName: "Alijon", username: "ali_pro", rating: 450, coins: 1200 },
          { tgId: "2", firstName: "Madina", username: "madina_game", rating: 380, coins: 950 },
          { tgId: "3", firstName: "Sardor", username: "sardor_99", rating: 310, coins: 800 },
          { tgId: "4", firstName: "Shaxzod", username: "", rating: 280, coins: 650 },
          { tgId: "5", firstName: "Zilola", username: "zee_lola", rating: 210, coins: 500 }
        ]);
      })
      .finally(() => setLoading(false));
  }, [BACKEND_URL]);

  const getRankBadge = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
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
          ⚠️ Serverga ulanib bo'lmadi, oflayn reyting ko'rsatilmoqda.
        </div>
      )}

      {!loading && (
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
                  <span className="stat-val">{player.rating} XP</span>
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
    </div>
  );
}

export default Leaderboard;