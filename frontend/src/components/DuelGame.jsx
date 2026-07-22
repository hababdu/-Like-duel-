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
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Environment URL'lar
  const API_URL = backendUrl || process.env.REACT_APP_API_URL || 'https://telegram-bot-server-2-matj.onrender.com';
  const WS_URL = wsUrl || process.env.REACT_APP_WS_URL || 'wss://telegram-bot-server-2-matj.onrender.com';

  // Socket ulanish funksiyasi
  const connectSocket = () => {
    if (socketRef.current?.connected) {
      console.log('Socket allaqachon ulangan');
      return;
    }

    setIsConnecting(true);
    setSocketError(null);

    try {
      // Socket.io ulanishi
      socketRef.current = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
        path: '/socket.io/'
      });

      const socket = socketRef.current;

      // ULANGANDA
      socket.on('connect', () => {
        console.log('✅ Socket ulandi');
        setSocketError(null);
        setIsConnecting(false);
        setIsReconnecting(false);
        setConnectionAttempts(0);
        
        triggerHaptic?.('light');
        onNotification?.('🔌 Serverga ulandi!');
        
        // Agar o'yinchi avval qidiruvda bo'lsa, qayta qidirish
        if (gameState === 'searching' && user) {
          console.log('🔄 Qayta qidirish...');
          const playerData = {
            tgId: String(user?.tgId || "guest_123"),
            firstName: user?.firstName || "O'yinchi",
            username: user?.username || '',
            rating: user?.rating || 100
          };
          socket.emit('find_match', {
            player: playerData,
            stake: Number(stake)
          });
        }
      });

      // ULANGANDA XATOLIK
      socket.on('connect_error', (err) => {
        console.error('❌ Socket connect_error:', err);
        setSocketError(`Serverga ulanishda xatolik: ${err.message}`);
        setIsConnecting(false);
        setConnectionAttempts(prev => prev + 1);
        
        // 3 marta urinishdan keyin qayta ulanish
        if (connectionAttempts >= 3) {
          setSocketError('⛔ Serverga ulanish imkoni yo\'q. Keyinroq urinib ko\'ring.');
        }
      });

      // QAYTA ULANGANDA
      socket.on('reconnect', (attempt) => {
        console.log(`🔄 Qayta ulandi (${attempt})`);
        setIsReconnecting(false);
        setSocketError(null);
        onNotification?.('✅ Qayta ulandi!');
      });

      socket.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Qayta ulanishga urinish ${attempt}...`);
        setIsReconnecting(true);
        setSocketError(`Qayta ulanish ${attempt}...`);
      });

      socket.on('reconnect_failed', () => {
        console.error('❌ Qayta ulanish muvaffaqiyatsiz');
        setSocketError('⛔ Serverga ulanish imkoni yo\'q. Iltimos, keyinroq urinib ko\'ring.');
        setIsReconnecting(false);
      });

      // UZILGANDA
      socket.on('disconnect', (reason) => {
        console.log('❌ Socket uzildi. Sabab:', reason);
        
        if (reason === 'io server disconnect') {
          // Server tomonidan uzilgan
          setSocketError('Server tomonidan uzilish yuz berdi');
          setIsConnecting(false);
          
          // Qayta ulanish
          setTimeout(() => {
            if (socketRef.current) {
              socketRef.current.connect();
            }
          }, 2000);
        } else if (reason === 'transport close') {
          setSocketError('Ulanish uzildi. Qayta ulanish...');
          setIsReconnecting(true);
        }
      });

 // Match qidirish funksiyasi
const findMatch = (stake = 10) => {
  console.log('🔍 Finding match with stake:', stake);
  
  socket.emit('find_match', {
    player: {
      tgId: user.tgId,
      firstName: user.firstName,
      username: user.username,
      rating: user.rating,
      coins: user.coins
    },
    stake: stake
  });
};

// Match found event
socket.on('match_found', (data) => {
  console.log('🎯 Match found!', data);
  // O'yin boshlanishi
  // data.roomId, data.opponent, data.stake
});

// Searching event
socket.on('searching', (data) => {
  console.log('⏳ Searching...', data);
  // UI da "Qidirilmoqda..." ko'rsatish
});

// Timer tick
socket.on('timer_tick', (timeLeft) => {
  console.log('⏱️ Timer:', timeLeft);
  // UI da timer ko'rsatish
});

// Round result
socket.on('round_result', (result) => {
  console.log('🏆 Round result:', result);
  // Natijani ko'rsatish
});

      // MATCH TOPILDI
      socket.on('match_found', ({ roomId, opponent, stake: matchStake }) => {
        console.log('🎯 Match topildi!', opponent);
        setRoomId(roomId);
        setOpponent(opponent);
        if (matchStake) setStake(matchStake);
        setMyChoice(null);
        setRoundResult(null);
        setGameState('playing');
        
        triggerHaptic?.('heavy');
        onNotification?.(`🎯 Raqib topildi! ${opponent.name} bilan duel!`);
        
        // Telegram Main button yashirish
        const tg = window.Telegram?.WebApp;
        if (tg?.MainButton) {
          tg.MainButton.hide();
        }
      });

      // VAQT TIKI
      socket.on('timer_tick', (timeLeft) => {
        setTimer(timeLeft);
        if (timeLeft <= 5 && timeLeft > 0) {
          triggerHaptic?.('light');
        }
      });

      // NATIJA
      socket.on('round_result', ({ myChoice, opponentChoice, result, rewardCoins, rewardXP }) => {
        console.log('📊 Natija keldi:', result);
        setRoundResult({ myChoice, opponentChoice, result, rewardCoins, rewardXP });
        setGameState('result');
        
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

      // RAQIB KETDI
      socket.on('opponent_left', () => {
        console.log('🚪 Raqib ketdi');
        setGameState('opponent_left');
        triggerHaptic?.('medium');
        onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
      });

      // TIMEOUT
      socket.on('timeout', ({ message }) => {
        console.log('⏰ Timeout:', message);
        onNotification?.('⏰ Vaqt tugadi!');
      });

      // XATOLIK
      socket.on('error', ({ message, code }) => {
        console.error('❌ Server xatoligi:', message, code);
        setSocketError(`Server xatoligi: ${message}`);
        onNotification?.(`⚠️ ${message}`);
      });

      // PONG (keepalive)
      socket.on('pong', () => {
        console.log('🏓 Pong received');
      });

    } catch (error) {
      console.error('❌ Socket yaratish xatoligi:', error);
      setSocketError(`Socket yaratish xatoligi: ${error.message}`);
      setIsConnecting(false);
    }
  };

  // Socket ulanishi
  useEffect(() => {
    connectSocket();

    // Tozalash
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [WS_URL]);

  // Qo'shimcha: har 30 sekundda ping yuborish
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping');
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  // Qayta ulanish funksiyasi
  const handleReconnect = () => {
    setSocketError(null);
    setConnectionAttempts(0);
    setIsReconnecting(false);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      setTimeout(() => {
        connectSocket();
      }, 1000);
    } else {
      connectSocket();
    }
  };

  // Raqib qidirish
  const handleStartSearch = () => {
    const currentCoins = user?.coins ?? 0;

    if (currentCoins < stake) {
      const tg = window.Telegram?.WebApp;
      if (tg?.showAlert) {
        tg.showAlert('⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo\'q!');
      } else {
        alert('⚠️ Balansingizda ushbu stavka uchun yetarli tanga yo\'q!');
      }
      return;
    }

    if (!socketRef.current?.connected) {
      setSocketError('Serverga ulanish yo\'q. Qayta ulanish...');
      handleReconnect();
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

  // Qidiruvni bekor qilish
  const handleCancelSearch = () => {
    if (socketRef.current) {
      socketRef.current.emit('cancel_search');
    }
    setGameState('idle');
    triggerHaptic?.('light');
  };

  // Tanlov qilish
  const submitChoice = (choice) => {
    if (!socketRef.current?.connected) {
      setSocketError('Ulanish yo\'q. Iltimos, qayta urining.');
      return;
    }

    setMyChoice(choice);
    triggerHaptic?.('medium');
    
    socketRef.current.emit('player_choice', { roomId, choice });
  };

  // Format choice
  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    if (str === 'timeout') return '⏳ Kechikdi';
    return '❓ Noma\'lum';
  };

  // Back button
  const handleBack = () => {
    if (gameState === 'searching') {
      handleCancelSearch();
    } else if (gameState === 'playing') {
      const tg = window.Telegram?.WebApp;
      if (tg?.showAlert) {
        tg.showAlert('O\'yin davom etmoqda! Raqibni tashlab ketolmaysiz.');
      }
    } else {
      onBack();
    }
  };

  return (
    <div className="game-screen">
      {/* Header */}
      <div className="game-header">
        {gameState !== 'playing' && (
          <button className="back-btn" onClick={handleBack}>
            ⬅️ Menuga Qaytish
          </button>
        )}
        <div className="connection-status">
          {socketRef.current?.connected ? (
            <span className="status-online">🟢 Online</span>
          ) : (
            <span className="status-offline">🔴 Offline</span>
          )}
        </div>
      </div>

      {/* Xatolik */}
      {socketError && (
        <div className="socket-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{socketError}</div>
          <button 
            className="error-retry-btn"
            onClick={handleReconnect}
            disabled={isReconnecting}
          >
            {isReconnecting ? '⏳ Qayta ulanish...' : '🔄 Qayta ulanish'}
          </button>
        </div>
      )}

      {/* Yuklanish */}
      {isConnecting && (
        <div className="connecting-indicator">
          <div className="spinner-small"></div>
          <span>Serverga ulanish...</span>
        </div>
      )}

      {/* IDLE */}
      {gameState === 'idle' && (
        <div className="setup-container">
          <h2>⚔️ Onlayn Duel Rejimi</h2>
          <p className="user-current-coins">
            Balansingiz: 🪙 {user?.coins ?? 0}
          </p>
          
          <div className="stake-grid">
            {[10, 20, 50, 100].map(value => (
              <button 
                key={value} 
                className={`stake-card ${stake === value ? 'selected' : ''}`}
                onClick={() => setStake(value)}
                disabled={user?.coins < value || isConnecting}
              >
                <div className="coin-icon">🪙</div>
                <div className="stake-value">{value}</div>
                {user?.coins < value && (
                  <div className="stake-insufficient">❌</div>
                )}
              </button>
            ))}
          </div>

          <button 
            className="btn-action btn-start" 
            onClick={handleStartSearch}
            disabled={!user || user.coins < stake || isConnecting || isReconnecting}
          >
            {isConnecting || isReconnecting ? (
              '⏳ Ulanish...'
            ) : !socketRef.current?.connected ? (
              '🔌 Ulanish yo\'q'
            ) : (
              '🚀 Jonli Raqib Qidirish'
            )}
          </button>

          {!socketRef.current?.connected && (
            <p className="hint-text">
              💡 Iltimos, internet ulanishingizni tekshiring
            </p>
          )}
        </div>
      )}

      {/* SEARCHING */}
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

      {/* PLAYING */}
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
            <p className="wait-msg">
              ⏳ Siz {formatChoice(myChoice)} tanladingiz. 
              Raqib yurishi kutilmoqda...
            </p>
          )}

          <div className="game-hint">
            <span>💡 Tezroq tanlang! Vaqt tugab boryapti</span>
          </div>
        </div>
      )}

      {/* RESULT */}
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
                <span className="choice-value">
                  {formatChoice(roundResult?.myChoice)}
                </span>
              </div>
              <div className="vs-divider">⚡</div>
              <div className="choice-display">
                <span className="choice-label">Raqib</span>
                <span className="choice-value">
                  {formatChoice(roundResult?.opponentChoice)}
                </span>
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
            onClick={() => {
              setGameState('idle');
              setRoundResult(null);
              setMyChoice(null);
            }}
          >
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* OPPONENT LEFT */}
      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <button 
            className="btn-action" 
            onClick={() => {
              setGameState('idle');
              setRoundResult(null);
              setMyChoice(null);
            }}
          >
            Bosh sahifaga
          </button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;