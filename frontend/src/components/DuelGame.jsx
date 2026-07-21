import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './DuelGame.css';

// Backend URL manzili
const BACKEND_URL = "https://telegram-bot-server-2-matj.onrender.com";

function DuelGame({ user, setUser, onBack }) {
  const [gameState, setGameState] = useState('idle'); // 'idle', 'searching', 'playing', 'result', 'opponent_left'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);

  // Socket obyekti uchun ref (re-render bo'lganda ulanish qayta yaratilmasligi uchun)
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Socket ulanishini hosil qilish
    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    // 2. Server Event tinglovchilari
    socket.on('searching', ({ stake: confirmedStake }) => {
      setGameState('searching');
      if (confirmedStake) setStake(confirmedStake);
    });

    socket.on('match_found', ({ roomId, opponent, stake: matchStake }) => {
      setRoomId(roomId);
      setOpponent(opponent);
      if (matchStake) setStake(matchStake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
    });

    socket.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    socket.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
      setRoundResult({ myChoice, opponentChoice, result, rewardCoins, rewardXP });
      setGameState('result');
      
      // Balans va reytingni xavfsiz yangilash
      if (setUser) {
        setUser(prev => ({
          ...prev,
          coins: Math.max(0, (prev?.coins || 0) + (rewardCoins || 0)),
          rating: Math.max(0, (prev?.rating || 0) + (rewardXP || 0))
        }));
      }
    });

    socket.on('opponent_left', () => {
      setGameState('opponent_left');
    });

    // 3. Komponent yopilganda soketni toza uzish
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [setUser]);

  // 🚀 Raqib qidirishni boshlash funksiyasi
  const handleStartSearch = () => {
    // User ma'lumotlarini xavfsiz shakllantirish
    const currentCoins = user?.coins ?? 0;

    if (currentCoins < stake) {
      alert("⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo'q!");
      return;
    }

    const playerData = {
      tgId: String(user?.tgId || user?.id || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "guest_123"),
      firstName: user?.firstName || user?.first_name || window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "O'yinchi",
      username: user?.username || '',
      rating: user?.rating || 100
    };

    setGameState('searching');

    // Serverga ma'lumot yuborish
    if (socketRef.current) {
      socketRef.current.emit('find_match', {
        player: playerData,
        stake: Number(stake)
      });
    }
  };

  // ✖️ Qidiruvni bekor qilish
  const handleCancelSearch = () => {
    if (socketRef.current) {
      socketRef.current.emit('cancel_search');
    }
    setGameState('idle');
  };

  // 🪨📄✂️ Tosh, qog'oz yoki qaychi tanlash
  const submitChoice = (choice) => {
    setMyChoice(choice);
    if (socketRef.current && roomId) {
      socketRef.current.emit('player_choice', { roomId, choice });
    }
  };

  // Matnlarni emoji bilan formatlash
  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    return '⏳ Kechikdi (Timeout)';
  };

  return (
    <div className="game-screen">
      {/* O'yin o'ynalayotgan paytdan tashqari orqaga qaytish tugmasi */}
      {gameState !== 'playing' && onBack && (
        <button className="back-btn" onClick={onBack}>⬅️ Menuga Qaytish</button>
      )}

      {/* 1-HOLAT: IDLE (Asosiy menyu va stavka tanlash) */}
      {gameState === 'idle' && (
        <div className="setup-container">
          <h2>⚔️ Onlayn Duel Rejimi</h2>
          <p className="user-current-coins">Balansingiz: 🪙 {user?.coins ?? 0}</p>
          
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

          <button className="btn-action btn-start" onClick={handleStartSearch}>
            🚀 Jonli Raqib Qidirish
          </button>
        </div>
      )}

      {/* 2-HOLAT: SEARCHING (Raqib qidirilmoqda) */}
      {gameState === 'searching' && (
        <div className="searching-container">
          <div className="radar-animation">
            <div className="ring"></div>
            <div className="ring"></div>
          </div>
          <h3>Jonli raqib qidirilmoqda...</h3>
          <p>Stavka: 🪙 {stake}</p>
          <button className="btn-action btn-cancel" onClick={handleCancelSearch}>
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {/* 3-HOLAT: PLAYING (O'yin Maydoni / Arena) */}
      {gameState === 'playing' && (
        <div className="arena-container">
          <div className="versus-header">
            <div className="fighter">🥊 {user?.firstName || "Siz"}</div>
            <div className="arena-timer"><span>{timer}</span>s</div>
            <div className="fighter">🥷 {opponent?.firstName || opponent?.name || "Raqib"}</div>
          </div>

          <div className="weapons-row">
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'rock' ? 'active' : ''} 
              onClick={() => submitChoice('rock')}
            >
              🪨 Tosh
            </button>
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'paper' ? 'active' : ''} 
              onClick={() => submitChoice('paper')}
            >
              📄 Qog'oz
            </button>
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'scissors' ? 'active' : ''} 
              onClick={() => submitChoice('scissors')}
            >
              ✂️ Qaychi
            </button>
          </div>

          {myChoice && <p className="wait-msg">Siz yurgansiz. Raqib yurishi kutilmoqda...</p>}
        </div>
      )}

      {/* 4-HOLAT: RESULT (Natijalar) */}
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
              <span className={(roundResult?.rewardCoins || 0) >= 0 ? "plus" : "minus"}>
                {(roundResult?.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult?.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult?.rewardCoins || 0)}`}
              </span>
              <span className="xp-summary" style={{ marginLeft: '15px', color: '#ffb703', fontWeight: 'bold' }}>
                {(roundResult?.rewardXP || 0) >= 0 
                  ? `+🏆 ${roundResult?.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult?.rewardXP || 0)} XP`}
              </span>
            </div>
          </div>
          
          <button className="btn-action btn-restart" onClick={() => setGameState('idle')}>
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* 5-HOLAT: OPPONENT LEFT (Raqib tark etgan xolat) */}
      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi.</p>
          <button className="btn-action" onClick={() => setGameState('idle')}>
            Bosh sahifaga
          </button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;