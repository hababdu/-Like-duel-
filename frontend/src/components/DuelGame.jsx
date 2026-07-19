import React, { useEffect, useState } from 'react';
import   "./DuelGame.css";

function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif }) {
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'searching' | 'playing' | 'result'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [timer, setTimer] = useState(30);

  // Telegram o'yinchi ma'lumotlarini xavfsiz olish
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user || {
    id: '12345678',
    first_name: 'O\'yinchi',
    username: 'player',
    photo_url: ''
  };

  useEffect(() => {
    // Socket hodisalarini sozlash
    socket.on('connect', () => {
      console.log('🔌 Socket ulangan holatda.');
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Socket ulanish xatosi:', error);
      showNotif("Server bilan aloqa uzildi. Qayta urinib ko'ring!", "error");
      setGameState('menu');
    });

    socket.on('match_found', ({ roomId, opponent }) => {
      console.log('⚔️ Raqib topildi! Xona:', roomId);
      setRoomId(roomId);
      setOpponent(opponent);
      setGameState('playing');
    });

    socket.on('start_round', () => {
      setMyChoice(null);
      setOpponentChoice(null);
      setRoundResult(null);
      setTimer(30);
    });

    socket.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    socket.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
      setMyChoice(myChoice);
      setOpponentChoice(opponentChoice);
      setRoundResult(result);
      setGameState('result');

      // Global statelarni real vaqtda yangilash
      setCoins(prev => Math.max(0, prev + rewardCoins));
      setRating(prev => Math.max(0, prev + rewardXP));
    });

    socket.on('opponent_left', () => {
      showNotif("Raqib o'yinni tark etdi! Texnik g'alaba sizga yozildi 🏆", "success");
      setCoins(prev => prev + 1); // 1 tanga yutuq qaytadi
      setRating(prev => prev + 15);
      resetGame();
    });

    return () => {
      // Event listenerlarni o'chirish (Xotira to'lib ketmasligi uchun)
      socket.off('connect');
      socket.off('connect_error');
      socket.off('match_found');
      socket.off('start_round');
      socket.off('timer_tick');
      socket.off('round_result');
      socket.off('opponent_left');
    };
  }, [socket]);

  const startSearching = () => {
    if (playerCoins < 1) {
      showNotif("Duellarda qatnashish uchun kamida 1 tanga kerak!", "error");
      return;
    }

    setGameState('searching');

    if (!socket.connected) {
      socket.connect();
    }

    // Backend aynan mana shu obyekt strukturasini kutyapti
    const payload = {
      player: {
        tgId: user.id.toString(),
        name: user.first_name,
        avatar: user.photo_url || '',
        rating: currentRating,
        coins: playerCoins
      },
      stake: 1 // 1 tangalik stavka rejimi
    };

    socket.emit('find_match', payload);
  };

  const makeChoice = (choice) => {
    if (myChoice) return; // Ikkinchi marta bosishni bloklash
    setMyChoice(choice);
    socket.emit('player_choice', { roomId, choice });
  };

  const resetGame = () => {
    setGameState('menu');
    setOpponent(null);
    setRoomId(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setRoundResult(null);
  };

  // Tanlov belgisini emoji formatida ko'rsatish funksiyasi
  const getChoiceEmoji = (choice) => {
    if (choice === 'rock') return '🪨 Tosh';
    if (choice === 'paper') return '📄 Qog\'oz';
    if (choice === 'scissors') return '✂️ Qaychi';
    return '⏳ Ulgurmadi';
  };

  return (
    <div className="duel-game-page">
      {/* 1. KIRISH MENYUSI */}
      {gameState === 'menu' && (
        <div className="duel-card animate-fade-in">
          <div className="duel-icon-wrapper">⚔️</div>
          <h2 className="duel-title">Onlayn Arena</h2>
          <p className="duel-description">
            Haqiqiy o'yinchilar bilan jonli duel! <br />
            Har bir o'yin stavkasi: <span className="highlight-text">1 🪙</span>
          </p>
          
          <div className="stats-preview-row">
            <div className="stat-preview-box">
              <span>Balansingiz</span>
              <strong>🪙 {playerCoins}</strong>
            </div>
            <div className="stat-preview-box">
              <span>Reyting</span>
              <strong>🏆 {currentRating} XP</strong>
            </div>
          </div>

          <button className="duel-action-btn start-btn" onClick={startSearching}>
            Raqib Qidirish 🔍
          </button>
          <button className="duel-action-btn cancel-btn" onClick={onBackToMenu}>
            Asosiy Menyu 🚪
          </button>
        </div>
      )}

      {/* 2. RAQIB QIDIRISH EKRANI */}
      {gameState === 'searching' && (
        <div className="duel-card searching-card animate-pulse">
          <div className="radar-spinner">
            <div className="circle-1"></div>
            <div className="circle-2"></div>
            <div className="circle-3"></div>
          </div>
          <h2 className="searching-title">Raqib qidirilmoqda...</h2>
          <p className="searching-subtitle">Siz kabi jasur duelchilar qidirilmoqda. Iltimos, kutib turing.</p>
          <button className="duel-action-btn cancel-btn" onClick={resetGame}>
            Qidiruvni to'xtatish ❌
          </button>
        </div>
      )}

      {/* 3. FAOL O'YIN ARENASI */}
      {gameState === 'playing' && (
        <div className="arena-wrapper animate-fade-in">
          <div className="arena-players-bar">
            <div className="arena-player style-me">
              <span className="arena-avatar">👤</span>
              <div className="arena-meta">
                <h4>{user.first_name}</h4>
                <p>Siz</p>
              </div>
            </div>

            <div className="arena-timer-circle">
              <span className="timer-number">{timer}</span>
              <span className="timer-label">soniya</span>
            </div>

            <div className="arena-player style-opponent">
              <span className="arena-avatar">🎯</span>
              <div className="arena-meta">
                <h4>{opponent?.name || 'Raqib'}</h4>
                <p>🏆 {opponent?.rating || 100} XP</p>
              </div>
            </div>
          </div>

          <div className="arena-main-card">
            <h3>Harakatingizni tanlang:</h3>
            <div className="arena-buttons-grid">
              <button 
                className={`arena-choice-card rock-card ${myChoice === 'rock' ? 'active-choice' : ''}`} 
                onClick={() => makeChoice('rock')} 
                disabled={!!myChoice}
              >
                <span className="choice-emoji">🪨</span>
                <span className="choice-text">Tosh</span>
              </button>

              <button 
                className={`arena-choice-card paper-card ${myChoice === 'paper' ? 'active-choice' : ''}`} 
                onClick={() => makeChoice('paper')} 
                disabled={!!myChoice}
              >
                <span className="choice-emoji">📄</span>
                <span className="choice-text">Qog'oz</span>
              </button>

              <button 
                className={`arena-choice-card scissors-card ${myChoice === 'scissors' ? 'active-choice' : ''}`} 
                onClick={() => makeChoice('scissors')} 
                disabled={!!myChoice}
              >
                <span className="choice-emoji">✂️</span>
                <span className="choice-text">Qaychi</span>
              </button>
            </div>

            {myChoice && (
              <div className="waiting-status animate-flash">
                <p>Siz o'z tanlovingizni qildingiz ({getChoiceEmoji(myChoice)}). <br />Raqib javobi kutilmoqda...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. NATIJA EKRANI */}
      {gameState === 'result' && (
        <div className={`duel-card result-card result-${roundResult} animate-bounce-in`}>
          <div className="result-banner-icon">
            {roundResult === 'win' && '🎉'}
            {roundResult === 'lose' && '😢'}
            {roundResult === 'draw' && '🤝'}
          </div>

          <h2 className="result-main-heading">
            {roundResult === 'win' && "G'alaba!"}
            {roundResult === 'lose' && "Mag'lubiyat"}
            {roundResult === 'draw' && "Durang!"}
          </h2>

          <p className="rewards-notice">
            {roundResult === 'win' && <span className="green-text">+1 Tanga 🪙 | +15 XP 🏆</span>}
            {roundResult === 'lose' && <span className="red-text">-1 Tanga 🪙 | -10 XP 🏆</span>}
            {roundResult === 'draw' && <span className="gray-text">Tangalar o'zgarishsiz qoldi</span>}
          </p>

          <div className="versus-summary-box">
            <div className="summary-col">
              <span>Siz tanladingiz</span>
              <strong>{getChoiceEmoji(myChoice)}</strong>
            </div>
            <div className="summary-vs">VS</div>
            <div className="summary-col">
              <span>Raqib tanladi</span>
              <strong>{getChoiceEmoji(opponentChoice)}</strong>
            </div>
          </div>

          <div className="result-actions">
            <button className="duel-action-btn start-btn" onClick={() => setGameState('playing')}>
              Keyingi Raund 🔄
            </button>
            <button className="duel-action-btn cancel-btn" onClick={resetGame}>
              Arenadan chiqish 🚪
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DuelGame;