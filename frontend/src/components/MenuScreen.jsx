// components/MenuScreen.jsx
import React from 'react';
import './MenuScreen.css';

export default function MenuScreen({ user, onMultiplayer, onBotGame }) {
  const userName = user?.first_name || user?.username || 'Do‘st';

  return (
    <main className="menu-screen">
      <div className="welcome-section">
        <h1 className="title">
          Salom, <span className="user-name">{userName}!</span>
        </h1>
        <p className="subtitle">Qaychi-Qog‘oz o‘yiniga xush kelibsiz ✊✋✌️</p>
      </div>

      <div className="mode-cards">
        <div className="card multiplayer-card" onClick={onMultiplayer}>
          <div className="card-icon">👥</div>
          <h2>Do'st bilan o'ynash</h2>
          <p>Real vaqtda raqib toping va bahslashib ko‘ring</p>
          <div className="card-action">O‘ynash →</div>
        </div>

        <div className="card bot-card" onClick={onBotGame}>
          <div className="card-icon">🤖</div>
          <h2>Bot bilan o'ynash</h2>
          <p>Oson, o‘rta yoki qiyin darajada sinab ko‘ring</p>
          <div className="card-action">Boshlash →</div>
        </div>
      </div>

      <div className="extra-info">
        <p className="coins-hint">
          Hozirgi tangalaringiz: <strong>{/* coins bu yerda ko‘rsatilishi mumkin */}</strong>
        </p>
      </div>
    </main>
  );
}