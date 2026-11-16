import React from 'react';
import './GameHub.css';

export default function GameHub({ onOnlineDuel, onBotGame, onImposter, onJumanji }) {
  return (
    <section className="game-hub">
      <div className="game-hub__intro">
        <button className="game-hub__back" onClick={() => window.dispatchEvent(new CustomEvent('app:back'))} aria-label="Orqaga">←</button>
        <div>
          <p className="game-hub__eyebrow">GAME CENTER</p>
          <h2>O'yinlar markazi</h2>
          <p className="game-hub__subtitle">Do'stlaringiz bilan yoki botga qarshi o'ynang.</p>
        </div>
      </div>

      <button className="game-hub__card game-hub__card--duel" onClick={onOnlineDuel}>
        <span className="game-hub__symbol">⚔️</span>
        <span className="game-hub__copy">
          <strong>Like Duel</strong>
          <small>Haqiqiy o'yinchiga qarshi onlayn duel</small>
        </span>
        <span className="game-hub__tag">ONLINE</span>
        <span className="game-hub__arrow">→</span>
      </button>

      <button className="game-hub__card game-hub__card--bot" onClick={onBotGame}>
        <span className="game-hub__symbol">🤖</span>
        <span className="game-hub__copy">
          <strong>Bot bilan o'yin</strong>
          <small>Sun'iy raqibga qarshi mashq qiling</small>
        </span>
        <span className="game-hub__tag">AI</span>
        <span className="game-hub__arrow">→</span>
      </button>

      <button className="game-hub__card game-hub__card--imposter" onClick={onImposter}>
        <span className="game-hub__symbol">🕵️</span>
        <span className="game-hub__copy">
          <strong>Imposter</strong>
          <small>Yashirin rolni toping va jamoangizni sinang</small>
        </span>
        <span className="game-hub__tag">PLAY</span>
        <span className="game-hub__arrow">→</span>
      </button>


      <button className="game-hub__card game-hub__card--jumanji" onClick={onJumanji}>
        <span className="game-hub__symbol">🌿</span>
        <span className="game-hub__copy">
          <strong>Jumanji: Sirli O‘rmon</strong>
          <small>Xarita, qahramonlar va jamoaviy jumboqlar</small>
        </span>
        <span className="game-hub__tag">NEW</span>
        <span className="game-hub__arrow">→</span>
      </button>

      <p className="game-hub__note">O‘zingizga yoqqan o‘yinni tanlang va do‘stlaringiz bilan sarguzasht boshlang.</p>
    </section>
  );
}
