import React, { useEffect, useState, useRef } from 'react';
import './DuelGame.css';

function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif }) {
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'searching' | 'playing' | 'result'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [timer, setTimer] = useState(30);
  
  // 💬 Chat statelari
  const [chatMessages, setChatMessages] = useState([]);
  const chatEndRef = useRef(null);

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user || {
    id: '12345678',
    first_name: 'O\'yinchi',
    username: 'player',
    photo_url: ''
  };

  // 📝 Tezkor xabarlar ro'yxati
  const quickMessages = [
    "Salom! 👋", 
    "Omad yor bo'lsin! 🍀", 
    "Yaxshi harakat! 👍", 
    "Qoyil! 😮", 
    "Raxmat o'yin uchun! 🤝", 
    "Yana bitta o'yin? 🔄"
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    socket.on('connect', () => { console.log('🔌 Socket ulandi.'); });

    socket.on('connect_error', (error) => {
      console.error('🔴 Socket xatosi:', error);
      showNotif("Server bilan aloqa uzildi!", "error");
      setGameState('menu');
    });

    socket.on('match_found', ({ roomId, opponent }) => {
      setRoomId(roomId);
      setOpponent(opponent);
      setGameState('playing');
      setChatMessages([]); // Yangi o'yinda chatni tozalash
    });

    socket.on('start_round', () => {
      setMyChoice(null);
      setOpponentChoice(null);
      setRoundResult(null);
      setTimer(30);
    });

    socket.on('timer_tick', (timeLeft) => { setTimer(timeLeft); });

    socket.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
      setMyChoice(myChoice);
      setOpponentChoice(opponentChoice);
      setRoundResult(result);
      setGameState('result');

      const newCoins = Math.max(0, playerCoins + rewardCoins);
      const newRating = Math.max(0, currentRating + rewardXP);

      // 1. Frontendni yangilash
      setCoins(newCoins);
      setRating(newRating);

      // 2. 💾 Tangalarni ma'lumotlar bazasida (MongoDB) saqlash
      saveBalanceToDatabase(user.id, newCoins, newRating);
    });

    // 💬 Chat xabarini qabul qilish
    socket.on('chat_message', ({ senderId, text }) => {
      setChatMessages(prev => [...prev, { senderId, text }]);
    });

    socket.on('opponent_left', () => {
      showNotif("Raqib tark etdi! Texnik g'alaba 🏆", "success");
      const newCoins = playerCoins + 1;
      const newRating = currentRating + 15;
      setCoins(newCoins);
      setRating(newRating);
      saveBalanceToDatabase(user.id, newCoins, newRating);
      resetGame();
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('match_found');
      socket.off('start_round');
      socket.off('timer_tick');
      socket.off('round_result');
      socket.off('chat_message');
      socket.off('opponent_left');
    };
  }, [socket, playerCoins, currentRating]);

  // 🛰️ Tangalarni DB ga yozish funksiyasi
  const saveBalanceToDatabase = async (tgId, finalCoins, finalRating) => {
    try {
      await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: tgId,
          coins: finalCoins,
          rating: finalRating
        })
      });
      console.log("💾 Balans bazada muvaffaqiyatli yangilandi!");
    } catch (err) {
      console.error("Bazaga yozishda xatolik:", err);
    }
  };

  const startSearching = () => {
    if (playerCoins < 1) {
      showNotif("Kamida 1 tanga kerak!", "error");
      return;
    }
    setGameState('searching');
    if (!socket.connected) socket.connect();

    socket.emit('find_match', {
      player: {
        tgId: user.id.toString(),
        name: user.first_name,
        avatar: user.photo_url || '',
        rating: currentRating,
        coins: playerCoins
      },
      stake: 1
    });
  };

  const makeChoice = (choice) => {
    if (myChoice) return;
    setMyChoice(choice);
    socket.emit('player_choice', { roomId, choice });
  };

  // 💬 Chat xabari yuborish
  const sendChatMessage = (text) => {
    socket.emit('send_chat_message', { roomId, senderId: user.id.toString(), text });
    setChatMessages(prev => [...prev, { senderId: user.id.toString(), text }]);
  };

  const resetGame = () => {
    setGameState('menu');
    setOpponent(null);
    setRoomId(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setRoundResult(null);
  };

  const getChoiceEmoji = (choice) => {
    if (choice === 'rock') return '🪨 Tosh';
    if (choice === 'paper') return '📄 Qog\'oz';
    if (choice === 'scissors') return '✂️ Qaychi';
    return '⏳ Ulgurmadi';
  };

  return (
    <div className="duel-game-page">
      {gameState === 'menu' && (
        <div className="duel-card animate-fade-in">
          <div className="duel-icon-wrapper">⚔️</div>
          <h2 className="duel-title">Onlayn Arena</h2>
          <p className="duel-description">Stavka: <span className="highlight-text">1 🪙</span></p>
          <div className="stats-preview-row">
            <div className="stat-preview-box"><span>Balans</span><strong>🪙 {playerCoins}</strong></div>
            <div className="stat-preview-box"><span>Reyting</span><strong>🏆 {currentRating} XP</strong></div>
          </div>
          <button className="duel-action-btn start-btn" onClick={startSearching}>Raqib Qidirish 🔍</button>
          <button className="duel-action-btn cancel-btn" onClick={onBackToMenu}>Asosiy Menyu 🚪</button>
        </div>
      )}

      {gameState === 'searching' && (
        <div className="duel-card searching-card animate-pulse">
          <div className="radar-spinner"><div className="circle-1"></div><div className="circle-2"></div><div className="circle-3"></div></div>
          <h2 className="searching-title">Raqib qidirilmoqda...</h2>
          <button className="duel-action-btn cancel-btn" onClick={resetGame}>To'xtatish ❌</button>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'result') && (
        <div className="arena-wrapper animate-fade-in">
          {/* O'yinchilar paneli */}
          <div className="arena-players-bar">
            <div className="arena-player style-me">
              <span className="arena-avatar">👤</span>
              <div className="arena-meta"><h4>{user.first_name}</h4><p>Siz</p></div>
            </div>
            <div className="arena-timer-circle">
              <span className="timer-number">{gameState === 'playing' ? timer : '⚡'}</span>
            </div>
            <div className="arena-player style-opponent">
              <span className="arena-avatar">🎯</span>
              <div className="arena-meta"><h4>{opponent?.name || 'Raqib'}</h4><p>🏆 {opponent?.rating || 100} XP</p></div>
            </div>
          </div>

          {/* O'yin maydoni */}
          {gameState === 'playing' ? (
            <div className="arena-main-card">
              <h3>Harakatingizni tanlang:</h3>
              <div className="arena-buttons-grid">
                <button className={`arena-choice-card rock-card ${myChoice === 'rock' ? 'active-choice' : ''}`} onClick={() => makeChoice('rock')} disabled={!!myChoice}><span className="choice-emoji">🪨</span><span className="choice-text">Tosh</span></button>
                <button className={`arena-choice-card paper-card ${myChoice === 'paper' ? 'active-choice' : ''}`} onClick={() => makeChoice('paper')} disabled={!!myChoice}><span className="choice-emoji">📄</span><span className="choice-text">Qog'oz</span></button>
                <button className={`arena-choice-card scissors-card ${myChoice === 'scissors' ? 'active-choice' : ''}`} onClick={() => makeChoice('scissors')} disabled={!!myChoice}><span className="choice-emoji">✂️</span><span className="choice-text">Qaychi</span></button>
              </div>
              {myChoice && <div className="waiting-status animate-flash"><p>Raqib kutilmoqda...</p></div>}
            </div>
          ) : (
            <div className={`duel-card result-card result-${roundResult} animate-bounce-in`} style={{marginTop: 0}}>
              <h2 className="result-main-heading">{roundResult === 'win' && "G'alaba!"}{roundResult === 'lose' && "Mag'lubiyat"}{roundResult === 'draw' && "Durang!"}</h2>
              <p className="rewards-notice">{roundResult === 'win' && <span className="green-text">+1 🪙 | +15 XP</span>}{roundResult === 'lose' && <span className="red-text">-1 🪙 | -10 XP</span>}{roundResult === 'draw' && <span className="gray-text">O'zgarishsiz</span>}</p>
              <div className="versus-summary-box">
                <div className="summary-col"><span>Siz</span><strong>{getChoiceEmoji(myChoice)}</strong></div>
                <div className="summary-vs">VS</div>
                <div className="summary-col"><span>Raqib</span><strong>{getChoiceEmoji(opponentChoice)}</strong></div>
              </div>
              <div className="result-actions">
                <button className="duel-action-btn start-btn" onClick={() => setGameState('playing')}>Keyingi Raund 🔄</button>
                <button className="duel-action-btn cancel-btn" onClick={resetGame}>Chiqish 🚪</button>
              </div>
            </div>
          )}

          {/* 💬 CHAT OYNASI */}
          <div className="chat-container">
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.senderId === user.id.toString() ? 'me' : 'opponent'}`}>
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="quick-chat-grid">
              {quickMessages.map((msg, idx) => (
                <button key={idx} className="quick-chat-btn" onClick={() => sendChatMessage(msg)}>
                  {msg}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default DuelGame;