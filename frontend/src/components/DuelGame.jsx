import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './DuelGame.css';

function DuelGame({ 
  user, 
  setUser, 
  backendUrl, 
  wsUrl, 
  onBack, 
  onNotification,
  triggerHaptic 
}) {
  const [gameState, setGameState] = useState('idle');
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);
  const [socketError, setSocketError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const socketRef = useRef(null);

  // Telegram WebApp event'lari
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      // O'yin boshlanganda Main button ni yashirish
      tg.MainButton?.hide();
      
      // Back button ni ko'rsatish
      tg.BackButton?.show();
      tg.BackButton?.onClick(() => {
        if (gameState === 'searching') {
          handleCancelSearch();
        } else if (gameState === 'playing') {
          tg.showAlert('O\'yin davom etmoqda! Raqibni tashlab ketolmaysiz.');
        } else {
          onBack();
        }
      });
    }

    return () => {
      if (tg) {
        tg.BackButton?.hide();
        tg.BackButton?.offClick();
      }
    };
  }, [gameState, onBack]);

  // Socket ulanishi
  useEffect(() => {
    const connectSocket = () => {
      setIsConnecting(true);
      
      socketRef.current = io(wsUrl || backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('✅ Socket ulandi');
        setSocketError(null);
        setIsConnecting(false);
        
        // Haptic feedback
        triggerHaptic?.('light');
        
        // Notification
        onNotification?.('🔌 Serverga ulandi!');
      });

      socket.on('connect_error', (err) => {
        console.error('❌ Socket xatolik:', err);
        setSocketError('Serverga ulanishda xatolik. Qayta urinish...');
        setIsConnecting(false);
      });

      socket.on('reconnect_attempt', (attempt) => {
        setSocketError(`Qayta ulanish ${attempt}...`);
      });

      socket.on('reconnect', () => {
        setSocketError(null);
        onNotification?.('✅ Qayta ulandi!');
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket uzildi:', reason);
        if (reason === 'io server disconnect') {
          // Server tomonidan uzilgan, qayta ulanish
          socket.connect();
        }
        if (gameState === 'playing' || gameState === 'searching') {
          setSocketError('Ulanish uzildi. Qayta ulanish...');
        }
      });

      socket.on('searching', ({ stake: confirmedStake }) => {
        setGameState('searching');
        if (confirmedStake) setStake(confirmedStake);
        triggerHaptic?.('light');
      });

      socket.on('match_found', ({ roomId, opponent, stake: matchStake }) => {
        setRoomId(roomId);
        setOpponent(opponent);
        if (matchStake) setStake(matchStake);
        setMyChoice(null);
        setRoundResult(null);
        setGameState('playing');
        
        // Haptic feedback
        triggerHaptic?.('heavy');
        
        // Notification
        onNotification?.(`🎯 Raqib topildi! ${opponent.name} bilan duel!`);
        
        // Telegram Main button ni yashirish
        window.Telegram?.WebApp?.MainButton?.hide();
      });

      socket.on('timer_tick', (timeLeft) => {
        setTimer(timeLeft);
        // Oxirgi 5 sekundda haptic
        if (timeLeft <= 5 && timeLeft > 0) {
          triggerHaptic?.('light');
        }
      });

      socket.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
        setRoundResult({ myChoice, opponentChoice, result, rewardCoins, rewardXP });
        setGameState('result');
        
        // Haptic feedback
        if (result === 'win') {
          triggerHaptic?.('heavy');
          onNotification?.('🎉 Siz yutdingiz!');
        } else if (result === 'lose') {
          triggerHaptic?.('medium');
          onNotification?.('😢 Mag\'lub bo\'ldingiz');
        } else {
          triggerHaptic?.('light');
          onNotification?.('🤝 Durang');
        }
        
        // Balansni yangilash
        if (setUser && user) {
          setUser(prev => ({
            ...prev,
            coins: Math.max(0, (prev?.coins || 0) + (rewardCoins || 0)),
            rating: Math.max(0, (prev?.rating || 0) + (rewardXP || 0)),
            totalGames: (prev?.totalGames || 0) + 1,
            wins: (prev?.wins || 0) + (result === 'win' ? 1 : 0),
            losses: (prev?.losses || 0) + (result === 'lose' ? 1 : 0)
          }));
        }
      });

      socket.on('opponent_left', () => {
        setGameState('opponent_left');
        triggerHaptic?.('medium');
        onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
      });

      return () => {
        if (socket) {
          socket.off('connect');
          socket.off('connect_error');
          socket.off('reconnect_attempt');
          socket.off('reconnect');
          socket.off('disconnect');
          socket.off('searching');
          socket.off('match_found');
          socket.off('timer_tick');
          socket.off('round_result');
          socket.off('opponent_left');
        }
      };
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [backendUrl, wsUrl, gameState, setUser, user, onNotification, triggerHaptic]);

  const handleStartSearch = () => {
    const currentCoins = user?.coins ?? 0;

    if (currentCoins < stake) {
      // Telegram alert
      window.Telegram?.WebApp?.showAlert('⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo\'q!');
      return;
    }

    if (socketError) {
      setSocketError(null);
    }

    if (!socketRef.current?.connected) {
      setSocketError('Serverga ulanish yo\'q. Qayta ulanish...');
      socketRef.current?.connect();
      return;
    }

    const playerData = {
      tgId: String(user?.tgId || "guest_123"),
      firstName: user?.firstName || "O'yinchi",
      username: user?.username || '',
      rating: user?.rating || 100
    };

    setGameState('searching');
    triggerHaptic?.('light');

    socketRef.current.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
  };

  const handleCancelSearch = () => {
    if (socketRef.current) {
      socketRef.current.emit('cancel_search');
    }
    setGameState('idle');
    triggerHaptic?.('light');
  };

  const submitChoice = (choice) => {
    setMyChoice(choice);
    triggerHaptic?.('medium');
    
    if (socketRef.current && roomId) {
      socketRef.current.emit('player_choice', { roomId, choice });
    }
  };

  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    return '⏳ Kechikdi';
  };

  // Tugmani bosishda haptic
  const handleButtonClick = (action) => {
    triggerHaptic?.('light');
    action();
  };

  return (
    <div className="game-screen">
      {gameState !== 'playing' && onBack && (
        <button 
          className="back-btn" 
          onClick={() => handleButtonClick(onBack)}
        >
          ⬅️ Menuga Qaytish
        </button>
      )}

      {socketError && (
        <div className="socket-error">
          ⚠️ {socketError}
          <button onClick={() => {
            setSocketError(null);
            socketRef.current?.connect();
          }}>
            🔄 Qayta ulanish
          </button>
        </div>
      )}

      {isConnecting && (
        <div className="connecting-indicator">
          <span className="spinner-small"></span>
          <span>Ulanish...</span>
        </div>
      )}

      {gameState === 'idle' && (
        <div className="setup-container">
          <h2>⚔️ Onlayn Duel Rejimi</h2>
          <p className="user-current-coins">Balansingiz: 🪙 {user?.coins ?? 0}</p>
          
          <div className="stake-grid">
            {[10, 20, 50, 100].map(value => (
              <button 
                key={value} 
                className={`stake-card ${stake === value ? 'selected' : ''}`}
                onClick={() => handleButtonClick(() => setStake(value))}
                disabled={user?.coins < value}
              >
                <div className="coin-icon">🪙</div>
                <div className="stake-value">{value}</div>
                {user?.coins < value && <div className="stake-insufficient">❌</div>}
              </button>
            ))}
          </div>

          <button 
            className="btn-action btn-start" 
            onClick={handleStartSearch}
            disabled={!user || user.coins < stake || isConnecting}
          >
            {isConnecting ? '⏳ Ulanish...' : '🚀 Jonli Raqib Qidirish'}
          </button>
        </div>
      )}

      {gameState === 'searching' && (
        <div className="searching-container">
          <div className="radar-animation">
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
          </div>
          <h3>🔍 Jonli raqib qidirilmoqda...</h3>
          <p>Stavka: 🪙 {stake}</p>
          <p className="search-hint">⏳ O'rtacha 5-30 soniya davom etadi</p>
          <button 
            className="btn-action btn-cancel" 
            onClick={handleCancelSearch}
          >
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="arena-container">
          <div className="versus-header">
            <div className="fighter">
              <div className="fighter-name">🥊 {user?.firstName || "Siz"}</div>
              <div className="fighter-stats">🏆 {user?.rating || 0} XP</div>
            </div>
            <div className="arena-timer">
              <span className="timer-value">{timer}</span>
              <span className="timer-label">s</span>
            </div>
            <div className="fighter">
              <div className="fighter-name">🥷 {opponent?.name || "Raqib"}</div>
              <div className="fighter-stats">🏆 {opponent?.rating || 0} XP</div>
            </div>
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

          {myChoice && (
            <p className="wait-msg">⏳ Siz {formatChoice(myChoice)} tanladingiz. Raqib yurishi kutilmoqda...</p>
          )}

          <div className="game-hint">
            <span>💡 Tezroq tanlang! Vaqt tugab boryapti</span>
          </div>
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
            <div className="battle-choices">
              <div className="choice-display">
                <span className="choice-label">Siz</span>
                <span className="choice-value">{formatChoice(roundResult?.myChoice)}</span>
              </div>
              <div className="vs-divider">⚡</div>
              <div className="choice-display">
                <span className="choice-label">Raqib</span>
                <span className="choice-value">{formatChoice(roundResult?.opponentChoice)}</span>
              </div>
            </div>
            
            <div className="financial-summary">
              <span className={(roundResult?.rewardCoins || 0) >= 0 ? "plus" : "minus"}>
                {(roundResult?.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult?.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult?.rewardCoins || 0)}`}
              </span>
              <span className="xp-summary">
                {(roundResult?.rewardXP || 0) >= 0 
                  ? `+🏆 ${roundResult?.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult?.rewardXP || 0)} XP`}
              </span>
            </div>
          </div>
          
          <button 
            className="btn-action btn-restart" 
            onClick={() => handleButtonClick(() => {
              setGameState('idle');
              setRoundResult(null);
              setMyChoice(null);
            })}
          >
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <button 
            className="btn-action" 
            onClick={() => handleButtonClick(() => {
              setGameState('idle');
              setRoundResult(null);
              setMyChoice(null);
            })}
          >
            Bosh sahifaga
          </button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;