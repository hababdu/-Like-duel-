import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './DuelGame.css'; // O'z stillaringizni ulab olasiz

function DuelGame({ user, setUser, onBack }) {
  const [gameState, setGameState] = useState('idle'); // 'idle', 'searching', 'playing', 'result', 'opponent_left'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10); 

  const socketRef = useRef(null);
  const BACKEND_URL = "https://telegram-bot-server-2-matj.onrender.com";

  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('match_found', ({ roomId, opponent }) => {
      setRoomId(roomId);
      setOpponent(opponent);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
    });

    socketRef.current.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    socketRef.current.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
      setRoundResult({ myChoice, opponentChoice, result, rewardCoins, rewardXP });
      setGameState('result');
      
      setUser(prev => ({
        ...prev,
        coins: Math.max(0, prev.coins + rewardCoins),
        rating: Math.max(0, prev.rating + rewardXP)
      }));
    });

    socketRef.current.on('opponent_left', () => {
      setGameState('opponent_left');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [setUser]);

  const startSearch = () => {
    if (user.coins < stake) {
      alert("⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo'q!");
      return;
    }
    setGameState('searching');
    socketRef.current.emit('find_match', {
      player: { tgId: user.tgId, name: user.firstName, rating: user.rating, username: user.username },
      stake: stake
    });
  };

  const cancelSearch = () => {
    socketRef.current.emit('cancel_search', { tgId: user.tgId });
    setGameState('idle');
  };

  const submitChoice = (choice) => {
    setMyChoice(choice);
    socketRef.current.emit('player_choice', { roomId, choice });
  };

  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    return '⏳ Kechikdi';
  };

  return (
    <div className="game-screen">
      {gameState !== 'playing' && (
        <button className="back-btn" onClick={onBack}>⬅️ Menuga Qaytish</button>
      )}

      {gameState === 'idle' && (
        <div className="setup-container">
          <h2>Onlayn Duel Rejimi</h2>
          <p className="user-current-coins">Balansingiz: 🪙 {user.coins}</p>
          
          <div className="stake-grid">
            {[10, 20, 50, 100].map(value => (
              <button 
                key={value} 
                className={`stake-card ${stake === value ? 'selected' : ''}`}
                onClick={() => setStake(value)}
              >
                <div className="coin-icon">🪙</div>
                <div className="stake-value">{value}</div>
              </button>
            ))}
          </div>

          <button className="btn-action btn-start" onClick={startSearch}>
            🚀 Jonli Raqib Qidirish
          </button>
        </div>
      )}

      {gameState === 'searching' && (
        <div className="searching-container">
          <div className="radar-animation"><div className="ring"></div><div className="ring"></div></div>
          <h3>Jonli raqib qidirilmoqda...</h3>
          <p>Stavka: 🪙 {stake}</p>
          <button className="btn-action btn-cancel" onClick={cancelSearch}>✖️ Bekor qilish</button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="arena-container">
          <div className="versus-header">
            <div className="fighter">🥊 {user.firstName} (Siz)</div>
            <div className="arena-timer"><span>{timer}</span>s</div>
            <div className="fighter">🥷 {opponent?.name || "Raqib"}</div>
          </div>

          <div className="weapons-row">
            <button disabled={!!myChoice} className={myChoice === 'rock' ? 'active' : ''} onClick={() => submitChoice('rock')}>🪨 Tosh</button>
            <button disabled={!!myChoice} className={myChoice === 'paper' ? 'active' : ''} onClick={() => submitChoice('paper')}>📄 Qog'oz</button>
            <button disabled={!!myChoice} className={myChoice === 'scissors' ? 'active' : ''} onClick={() => submitChoice('scissors')}>✂️ Qaychi</button>
          </div>

          {myChoice && <p className="wait-msg">Siz yurgansiz. Raqib yurishi kutilmoqda...</p>}
        </div>
      )}

      {gameState === 'result' && (
        <div className="result-container">
          <div className={`result-banner ${roundResult?.result}`}>
            {roundResult?.result === 'win' && "🎉 SIZ YUTDINGIZ!"}
            {roundResult?.result === 'lose' && "😢 MAG'LUB BO'LDINGIZ"}
            {roundResult?.result === 'draw' && "🤝 DURANG"}
          </div>
          <div className="battle-card">
            <p>Siz: {formatChoice(roundResult?.myChoice)}</p>
            <p>Raqib: {formatChoice(roundResult?.opponentChoice)}</p>
            <div className="financial-summary">
              <span className="plus">{roundResult?.rewardCoins >= 0 ? `+🪙 ${roundResult.rewardCoins}` : `-🪙 ${Math.abs(roundResult.rewardCoins)}`}</span>
            </div>
          </div>
          <button className="btn-action btn-restart" onClick={() => setGameState('idle')}>🔄 Yana Qidirish</button>
        </div>
      )}

      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib tark etdi!</h3>
          <button className="btn-action" onClick={() => setGameState('idle')}>Orqaga</button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;