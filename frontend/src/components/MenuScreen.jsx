import React from 'react';
import './MenuScreen.css';

export default function MenuScreen({ user, onMultiplayer, onBotGame }) {
  const name = user?.first_name || user?.username || 'Do‘st';

  return (
    <div className="menu">
      <div className="greeting">
        <h1>
          Salom, <span>{name}</span>!
        </h1>
        <p>Tosh-qaychi-qog‘oz ✊✋✌️</p>
      </div>

      <div className="modes">
        <button className="mode multiplayer" onClick={onMultiplayer}>
          <span className="emoji">👥</span>
          <div>
            <h2>Do'st bilan</h2>
            <p>Real raqib</p>
          </div>
          <span className="arrow">→</span>
        </button>

        <button className="mode bot" onClick={onBotGame}>
          <span className="emoji">🤖</span>
          <div>
            <h2>Bot bilan</h2>
            <p>Oson / Qiyin</p>
          </div>
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}