import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './DuelGame.css'; // Stillaringiz uchun

function DuelGame({ user, setUser, onBack }) {
  const [gameState, setGameState] = useState('idle'); // 'idle', 'searching', 'playing', 'result', 'opponent_left'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10); 

  const socketRef = useRef(null);
  // Backend URL manzilingiz
  const BACKEND_URL = "https://telegram-bot-server-2-matj.onrender.com";

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
  
    socket.on("match_found", (data) => {
      console.log("Raqib topildi:", data);
      // Game arena'ga o'tish kodi
    });
  
    return () => {
      socket.off("match_found");
    };
    // Soket ulanishini sozlash
    socketRef.current = io(BACKEND_URL);

    // Server navbatga muvaffaqiyatli qo'shganda yuboradigan event
    socketRef.current.on('searching', ({ stake: confirmedStake }) => {
      setGameState('searching');
      setStake(confirmedStake);
    });

    // Raqib topilganda xonaga ulanish va ma'lumotlarni sozlash
    socketRef.current.on('match_found', ({ roomId, opponent, stake: matchStake }) => {
      setRoomId(roomId);
      setOpponent(opponent);
      setStake(matchStake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
    });

    // Har soniyada serverdan keladigan taymer hisobi
    socketRef.current.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    // Raund yakunlanganda natijalar va o'zgargan balans/XP ni olish
    socketRef.current.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
      setRoundResult({ myChoice, opponentChoice, result, rewardCoins, rewardXP });
      setGameState('result');
      
      // MongoDB-dagi o'zgarishlar bilan sinxron holatda local state-ni yangilash
      setUser(prev => ({
        ...prev,
        // Serverdagi $max: 0 logikasiga mos ravishda 0 dan pastga tushib ketmasligini ta'minlaymiz
        coins: Math.max(0, prev.coins + rewardCoins),
        rating: Math.max(0, prev.rating + rewardXP)
      }));
    });

    // O'yin davomida raqib o'yinni tark etganda (soket uzilganda)
    socketRef.current.on('opponent_left', () => {
      setGameState('opponent_left');
    });

    // Komponent unmount bo'lganda (yopilganda) soketni toza uzish
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [setUser]);

  // Raqib qidirishni boshlash
  const startSearch = () => {
    if (user.coins < stake) {
      alert("⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo'q!");
      return;
    }
    
    // Serveringiz kutayotgan struktura formatida ma'lumot yuboramiz
    socketRef.current.emit('find_match', {
      player: { 
        tgId: String(user.tgId), 
        firstName: user.firstName, 
        username: user.username || '', 
        rating: user.rating || 100 
      },
      stake: Number(stake)
    });
  };

  // Qidiruvni bekor qilish
  const cancelSearch = () => {
    socketRef.current.emit('cancel_search');
    setGameState('idle');
  };

  // Tosh, qog'oz yoki qaychi tanlanganda
  const submitChoice = (choice) => {
    setMyChoice(choice);
    socketRef.current.emit('player_choice', { roomId, choice });
  };

  // Natija ekranida tanlovlarni chiroyli formatlash funksiyasi
  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    return '⏳ Kechikdi (Timeout)';
  };

  return (
    <div className="game-screen">
      {/* O'yin jarayonida orqaga qaytish tugmasini yashiramiz */}
      {gameState !== 'playing' && (
        <button className="back-btn" onClick={onBack}>⬅️ Menuga Qaytish</button>
      )}

      {/* IDLE - Asosiy menyu va stavka tanlash */}
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

      {/* SEARCHING - Raqib qidirish jarayoni */}
      {gameState === 'searching' && (
        <div className="searching-container">
          <div className="radar-animation">
            <div className="ring"></div>
            <div className="ring"></div>
          </div>
          <h3>Jonli raqib qidirilmoqda...</h3>
          <p>Stavka: 🪙 {stake}</p>
          <button className="btn-action btn-cancel" onClick={cancelSearch}>✖️ Bekor qilish</button>
        </div>
      )}

      {/* PLAYING - Arena (O'yin maydoni) */}
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

      {/* RESULT - O'yin tugaganda natijalar paneli */}
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
              {/* Tanga o'zgarishi */}
              <span className={roundResult?.rewardCoins >= 0 ? "plus" : "minus"}>
                {roundResult?.rewardCoins >= 0 ? `+🪙 ${roundResult.rewardCoins}` : `-🪙 ${Math.abs(roundResult.rewardCoins)}`}
              </span>
              {/* Reyting (XP) o'zgarishi */}
              <span className="xp-summary" style={{ marginLeft: '15px', color: '#ffb703', fontWeight: 'bold' }}>
                {roundResult?.rewardXP >= 0 ? `+🏆 ${roundResult.rewardXP} XP` : `-🏆 ${Math.abs(roundResult.rewardXP)} XP`}
              </span>
            </div>
          </div>
          
          <button className="btn-action btn-restart" onClick={() => setGameState('idle')}>🔄 Yana O'ynash</button>
        </div>
      )}

      {/* OPPONENT LEFT - Raqib chiqib ketgandagi holat */}
      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi.</p>
          <button className="btn-action" onClick={() => setGameState('idle')}>Bosh sahifaga</button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;