// ============================================================
// DuelGame.js - TO'LIQ TUZATILGAN VERSION
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './DuelGame.css'

function DuelGame({ 
  user, 
  setUser, 
  API_URL, 
  onBack, 
  onNotification,
  triggerHaptic,
  socket 
}) {
  // ======================
  // STATE
  // ======================
  const [gameState, setGameState] = useState('idle'); // idle, searching, playing, result
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);
  const [socketError, setSocketError] = useState(null);
  const [queueLength, setQueueLength] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [opponentChoiceMade, setOpponentChoiceMade] = useState(false);
  const [debugLog, setDebugLog] = useState([]);

  const timerIntervalRef = useRef(null);

  // ======================
  // DEBUG LOG
  // ======================
  const addDebug = (msg) => {
    const log = { time: new Date().toLocaleTimeString(), msg };
    setDebugLog(prev => [...prev.slice(-10), log]);
    console.log('🔍', msg);
  };

  // ======================
  // SOCKET EVENT HANDLERS
  // ======================
  useEffect(() => {
    if (!socket) {
      addDebug('❌ Socket is null!');
      return;
    }

    addDebug(`✅ DuelGame mounted, socket: ${socket.id}`);
    addDebug(`✅ Socket connected: ${socket.connected}`);
    addDebug(`👤 User: ${user?.firstName} (${user?.tgId})`);
    addDebug(`🪙 Coins: ${user?.coins}`);

    // ====== SEARCHING ======
    const onSearching = (data) => {
      addDebug(`🔍 Searching: ${JSON.stringify(data)}`);
      setGameState('searching');
      setIsSearching(true);
      if (data?.stake) setStake(data.stake);
      if (data?.queueLength !== undefined) setQueueLength(data.queueLength);
    };

    // ====== MATCH FOUND ======
    const onMatchFound = (data) => {
      addDebug(`🎯 MATCH FOUND!!! ${JSON.stringify(data)}`);
      
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      setStake(data.stake || stake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
      setIsSearching(false);
      setShowResult(false);
      setOpponentChoiceMade(false);
      
      addDebug(`✅ Game state: playing`);
      addDebug(`👤 Opponent: ${data.opponent?.name || 'Noma\'lum'}`);
      addDebug(`🏆 Opponent rating: ${data.opponent?.rating || 0}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`, 'success');
    };

    // ====== TIMER TICK ======
    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) {
        triggerHaptic?.('light');
      }
      if (timeLeft === 0) {
        triggerHaptic?.('heavy');
      }
    };

    // ====== OPPONENT CHOICE MADE ======
    const onOpponentChoiceMade = (data) => {
      addDebug(`👀 Opponent made choice: ${JSON.stringify(data)}`);
      setOpponentChoiceMade(true);
    };

    // ====== ROUND RESULT ======
    const onRoundResult = (result) => {
      addDebug(`📊 Round result: ${JSON.stringify(result)}`);
      setRoundResult(result);
      setGameState('result');
      setShowResult(true);
      setIsSearching(false);
      
      // Haptic va notification
      if (result.result === 'win') {
        triggerHaptic?.('heavy');
        onNotification?.(`🎉 Siz yutdingiz! +${result.rewardCoins} 🪙`, 'success');
      } else if (result.result === 'lose') {
        triggerHaptic?.('medium');
        onNotification?.(`😢 Mag'lub bo'ldingiz -${Math.abs(result.rewardCoins)} 🪙`, 'error');
      } else {
        triggerHaptic?.('light');
        onNotification?.(`🤝 Durang`, 'info');
      }
      
      // User ma'lumotlarini yangilash
      if (setUser && user) {
        setUser(prev => ({
          ...prev,
          coins: Math.max(0, (prev?.coins || 0) + (result.rewardCoins || 0)),
          rating: Math.max(0, (prev?.rating || 0) + (result.rewardXP || 0)),
          totalGames: (prev?.totalGames || 0) + 1,
          wins: (prev?.wins || 0) + (result.result === 'win' ? 1 : 0),
          losses: (prev?.losses || 0) + (result.result === 'lose' ? 1 : 0),
          draws: (prev?.draws || 0) + (result.result === 'draw' ? 1 : 0),
          level: result.newLevel || prev?.level || 1,
          xp: (prev?.xp || 0) + Math.max(0, result.rewardXP || 0)
        }));
      }
    };

    // ====== OPPONENT LEFT ======
    const onOpponentLeft = () => {
      addDebug('🚪 Opponent left');
      setGameState('opponent_left');
      setIsSearching(false);
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!', 'error');
    };

    // ====== ERROR ======
    const onError = (data) => {
      addDebug(`❌ Error: ${JSON.stringify(data)}`);
      setSocketError(data?.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data?.message || 'Xatolik yuz berdi'}`, 'error');
      setGameState('idle');
      setIsSearching(false);
    };

    // ====== SEARCH CANCELLED ======
    const onSearchCancelled = () => {
      addDebug('🔴 Search cancelled');
      setGameState('idle');
      setIsSearching(false);
      setQueueLength(0);
    };

    // ====== CONNECT ======
    const onConnect = () => {
      addDebug(`✅ Socket connected: ${socket.id}`);
      setSocketError(null);
    };

    // ====== DISCONNECT ======
    const onDisconnect = () => {
      addDebug('❌ Socket disconnected');
      setSocketError('Serverdan uzildi');
    };

    // ====== CONNECT ERROR ======
    const onConnectError = (error) => {
      addDebug(`❌ Connect error: ${error.message}`);
      setSocketError('Serverga ulanishda xatolik');
    };

    // Eventlarni ro'yxatdan o'tkazish
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('searching', onSearching);
    socket.on('match_found', onMatchFound);
    socket.on('timer_tick', onTimerTick);
    socket.on('opponent_choice_made', onOpponentChoiceMade);
    socket.on('round_result', onRoundResult);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('error', onError);
    socket.on('search_cancelled', onSearchCancelled);

    // Cleanup
    return () => {
      addDebug('🧹 Cleaning up DuelGame');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('searching', onSearching);
      socket.off('match_found', onMatchFound);
      socket.off('timer_tick', onTimerTick);
      socket.off('opponent_choice_made', onOpponentChoiceMade);
      socket.off('round_result', onRoundResult);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('error', onError);
      socket.off('search_cancelled', onSearchCancelled);
    };
  }, [socket, triggerHaptic, onNotification, setUser, user, stake]);

  // ======================
  // START SEARCH
  // ======================
  const startSearch = useCallback(() => {
    addDebug('🚀 Starting search...');
    addDebug(`📊 User: ${user?.tgId} - ${user?.firstName}`);
    addDebug(`📊 Stake: ${stake}`);
    addDebug(`🪙 User coins: ${user?.coins}`);
    addDebug(`🔌 Socket connected: ${socket?.connected}`);

    // 1. User tekshirish
    if (!user) {
      onNotification?.('⚠️ Iltimos avval tizimga kiring!', 'error');
      return;
    }

    // 2. tgId tekshirish
    if (!user.tgId || user.tgId === 'undefined' || user.tgId === 'null') {
      onNotification?.('⚠️ Foydalanuvchi ID si topilmadi!', 'error');
      addDebug('❌ Invalid tgId: ' + user.tgId);
      return;
    }

    // 3. Tanga tekshirish
    if ((user.coins || 0) < stake) {
      onNotification?.(`⚠️ Yetarli tanga yo'q! ${stake} 🪙 kerak`, 'error');
      return;
    }

    // 4. Socket tekshirish
    if (!socket?.connected) {
      setSocketError('Serverga ulanish yo\'q');
      onNotification?.('⚠️ Serverga ulanish yo\'q!', 'error');
      return;
    }

    // 5. Player ma'lumotlarini tayyorlash
    const playerData = {
      tgId: String(user.tgId),
      firstName: user.firstName || "O'yinchi",
      username: user.username || '',
      rating: user.rating || 100,
      coins: user.coins || 0,
      level: user.level || 1,
      photoUrl: user.photoUrl || ''
    };

    addDebug(`📤 Emitting find_match: ${JSON.stringify({ player: playerData, stake: Number(stake) })}`);
    
    setGameState('searching');
    setIsSearching(true);
    
    socket.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
    
  }, [user, stake, socket, onNotification]);

  // ======================
  // CANCEL SEARCH
  // ======================
  const cancelSearch = useCallback(() => {
    addDebug('❌ Cancelling search');
    if (socket) {
      socket.emit('cancel_search');
    }
    setGameState('idle');
    setIsSearching(false);
    setQueueLength(0);
  }, [socket]);

  // ======================
  // SUBMIT CHOICE
  // ======================
  const submitChoice = useCallback((choice) => {
    addDebug(`✋ Submitting choice: ${choice}, roomId: ${roomId}`);
    
    if (!socket || !roomId) {
      addDebug('❌ No socket or roomId');
      onNotification?.('⚠️ Xatolik yuz berdi', 'error');
      return;
    }
    
    // Tanlovni saqlash
    setMyChoice(choice);
    
    // Serverga yuborish
    socket.emit('make_choice', { roomId, choice });
    triggerHaptic?.('light');
    
    // Raqib tanlovini kutish xabari
    onNotification?.('⏳ Raqib tanlovi kutilmoqda...', 'info');
    
  }, [socket, roomId, triggerHaptic, onNotification]);

  // ======================
  // RESET GAME
  // ======================
  const resetGame = useCallback(() => {
    addDebug('🔄 Resetting game');
    setGameState('idle');
    setRoundResult(null);
    setMyChoice(null);
    setOpponent(null);
    setRoomId(null);
    setTimer(30);
    setIsSearching(false);
    setQueueLength(0);
    setShowResult(false);
    setOpponentChoiceMade(false);
  }, []);

  // ======================
  // FORMAT FUNCTIONS
  // ======================
  const formatChoice = (str) => {
    if (!str) return '❓ Noma\'lum';
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    if (str === 'timeout') return '⏳ Kechikdi';
    return '❓ Noma\'lum';
  };

  const getChoiceEmoji = (str) => {
    if (!str) return '❓';
    if (str === 'rock') return '🪨';
    if (str === 'paper') return '📄';
    if (str === 'scissors') return '✂️';
    return '❓';
  };

  const getChoiceName = (str) => {
    if (!str) return '';
    if (str === 'rock') return 'Tosh';
    if (str === 'paper') return 'Qog\'oz';
    if (str === 'scissors') return 'Qaychi';
    return '';
  };

  // ======================
  // RENDER
  // ======================
  return (
    <div className="duel-game">
      {/* Back Button */}
      <button 
        className="duel-back-btn"
        onClick={() => {
          if (gameState === 'searching') cancelSearch();
          onBack();
          resetGame();
        }}
      >
        ⬅️ Menuga Qaytish
      </button>

      {/* Debug Panel */}
      <div className="duel-debug">
        <div className="duel-debug-row">
          <span>🔌 {socket?.connected ? '🟢' : '🔴'} {socket?.id?.substring(0, 6) || 'no'}</span>
          <span>📊 <strong>{gameState}</strong></span>
          <span>⏱️ {timer}s</span>
          <span>👥 {queueLength}</span>
        </div>
        <div className="duel-debug-logs">
          {debugLog.slice(-3).map((log, i) => (
            <div key={i} className="duel-debug-log">[{log.time}] {log.msg}</div>
          ))}
        </div>
      </div>

      {/* Error */}
      {socketError && (
        <div className="duel-error">
          ⚠️ {socketError}
          <button onClick={() => setSocketError(null)}>✕</button>
        </div>
      )}

      {/* ============================================================
          IDLE STATE
          ============================================================ */}
      {gameState === 'idle' && (
        <div className="duel-idle">
          <div className="duel-idle-header">
            <h2>⚔️ Onlayn Duel</h2>
            <p>Jonli raqib bilan tosh-qog'oz-qaychi o'ynang!</p>
          </div>

          <div className="duel-balance">
            <div className="duel-balance-item">
              <span>🪙 Balans</span>
              <span className="duel-balance-value">{user?.coins || 0}</span>
            </div>
            <div className="duel-balance-item">
              <span>🏆 Reyting</span>
              <span className="duel-balance-value">{user?.rating || 0}</span>
            </div>
            <div className="duel-balance-item">
              <span>📊 Level</span>
              <span className="duel-balance-value">{user?.level || 1}</span>
            </div>
          </div>

          <div className="duel-stake-section">
            <p className="duel-stake-label">💰 Stavka tanlang:</p>
            <div className="duel-stake-grid">
              {[10, 20, 50, 100].map(value => (
                <button
                  key={value}
                  className={`duel-stake-btn ${stake === value ? 'active' : ''}`}
                  onClick={() => setStake(value)}
                  disabled={(user?.coins || 0) < value}
                >
                  <span className="duel-stake-icon">🪙</span>
                  <span className="duel-stake-value">{value}</span>
                  {(user?.coins || 0) < value && (
                    <span className="duel-stake-insufficient">❌</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            className="duel-search-btn"
            onClick={startSearch}
            disabled={!user || (user?.coins || 0) < stake || !socket?.connected}
          >
            {!socket?.connected ? '🔌 Ulanish yo\'q' : '🚀 Raqib Qidirish'}
          </button>

          <p className="duel-search-hint">⏳ O'rtacha 5-30 soniya davom etadi</p>
        </div>
      )}

      {/* ============================================================
          SEARCHING STATE
          ============================================================ */}
      {gameState === 'searching' && (
        <div className="duel-searching">
          <div className="duel-radar">
            <div className="duel-ring"></div>
            <div className="duel-ring delay-1"></div>
            <div className="duel-ring delay-2"></div>
            <div className="duel-radar-icon">🔍</div>
          </div>
          <h3>Raqib qidirilmoqda...</h3>
          <p className="duel-searching-stake">Stavka: 🪙 {stake}</p>
          <p className="duel-searching-queue">Navbatda: {queueLength} o'yinchi</p>
          <div className="duel-searching-progress">
            <div className="duel-progress-bar">
              <div className="duel-progress-fill" style={{ 
                width: `${Math.min(100, (30 - timer) * 3.33)}%` 
              }} />
            </div>
          </div>
          <button className="duel-cancel-btn" onClick={cancelSearch}>
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {/* ============================================================
          PLAYING STATE
          ============================================================ */}
      {gameState === 'playing' && (
        <div className="duel-playing">
          <div className="duel-versus">
            <div className="duel-player">
              <div className="duel-player-avatar">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt={user.firstName} />
                ) : (
                  <span>{user?.firstName?.charAt(0) || 'S'}</span>
                )}
              </div>
              <div className="duel-player-name">🥊 {user?.firstName || 'Siz'}</div>
              <div className="duel-player-rating">🏆 {user?.rating || 0}</div>
              <div className="duel-player-level">📊 Lv.{user?.level || 1}</div>
              {myChoice && (
                <div className="duel-player-choice">
                  ✅ {formatChoice(myChoice)}
                </div>
              )}
            </div>

            <div className="duel-timer">
              <span className={`duel-timer-value ${timer <= 5 ? 'warning' : ''}`}>
                {timer}
              </span>
              <span className="duel-timer-label">s</span>
              <div className="duel-vs">⚔️</div>
            </div>

            <div className="duel-player">
              <div className="duel-player-avatar">
                {opponent?.photoUrl ? (
                  <img src={opponent.photoUrl} alt={opponent.name} />
                ) : (
                  <span>{opponent?.name?.charAt(0) || 'R'}</span>
                )}
              </div>
              <div className="duel-player-name">🥷 {opponent?.name || 'Raqib'}</div>
              <div className="duel-player-rating">🏆 {opponent?.rating || 0}</div>
              <div className="duel-player-level">📊 Lv.{opponent?.level || 1}</div>
              {opponentChoiceMade && (
                <div className="duel-player-choice" style={{ color: '#ffaa00' }}>
                  ⏳ Tanlov qildi
                </div>
              )}
              {!opponentChoiceMade && myChoice && (
                <div className="duel-player-choice" style={{ color: '#888' }}>
                  ⏳ Kutilmoqda...
                </div>
              )}
            </div>
          </div>

          <p className="duel-choice-label">🎯 Tanlovingizni qiling:</p>

          <div className="duel-choices">
            <button
              className={`duel-choice-btn ${myChoice === 'rock' ? 'active' : ''}`}
              onClick={() => submitChoice('rock')}
              disabled={!!myChoice}
            >
              <span className="duel-choice-emoji">🪨</span>
              <span className="duel-choice-name">Tosh</span>
            </button>
            <button
              className={`duel-choice-btn ${myChoice === 'paper' ? 'active' : ''}`}
              onClick={() => submitChoice('paper')}
              disabled={!!myChoice}
            >
              <span className="duel-choice-emoji">📄</span>
              <span className="duel-choice-name">Qog'oz</span>
            </button>
            <button
              className={`duel-choice-btn ${myChoice === 'scissors' ? 'active' : ''}`}
              onClick={() => submitChoice('scissors')}
              disabled={!!myChoice}
            >
              <span className="duel-choice-emoji">✂️</span>
              <span className="duel-choice-name">Qaychi</span>
            </button>
          </div>

          {myChoice && (
            <div className="duel-waiting">
              <div className="duel-waiting-spinner"></div>
              <p>
                ⏳ Siz <strong>{formatChoice(myChoice)}</strong> tanladingiz. 
                Raqib kutilmoqda...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          RESULT STATE
          ============================================================ */}
      {gameState === 'result' && roundResult && showResult && (
        <div className="duel-result">
          <div className={`duel-result-banner ${roundResult.result}`}>
            {roundResult.result === 'win' && '🎉 SIZ YUTDINGIZ!'}
            {roundResult.result === 'lose' && '😢 MAG\'LUB BO\'LDINGIZ'}
            {roundResult.result === 'draw' && '🤝 DURANG'}
          </div>

          <div className="duel-result-card">
            <div className="duel-result-choices">
              <div className="duel-result-choice">
                <span className="duel-result-label">Siz</span>
                <div className="duel-result-choice-display">
                  <span className="duel-result-emoji">{getChoiceEmoji(roundResult.myChoice)}</span>
                  <span className="duel-result-choice-name">{getChoiceName(roundResult.myChoice)}</span>
                </div>
              </div>

              <div className="duel-result-vs">⚡</div>

              <div className="duel-result-choice">
                <span className="duel-result-label">Raqib</span>
                <div className="duel-result-choice-display">
                  <span className="duel-result-emoji">{getChoiceEmoji(roundResult.opponentChoice)}</span>
                  <span className="duel-result-choice-name">{getChoiceName(roundResult.opponentChoice)}</span>
                </div>
              </div>
            </div>

            <div className="duel-result-rewards">
              <div className={`duel-result-reward ${roundResult.rewardCoins >= 0 ? 'positive' : 'negative'}`}>
                <span className="reward-icon">{roundResult.rewardCoins >= 0 ? '🪙' : '💸'}</span>
                <span className="reward-value">
                  {roundResult.rewardCoins >= 0 ? '+' : ''}{roundResult.rewardCoins}
                </span>
                <span className="reward-label">Tanga</span>
              </div>
              <div className={`duel-result-reward ${roundResult.rewardXP >= 0 ? 'positive' : 'negative'}`}>
                <span className="reward-icon">{roundResult.rewardXP >= 0 ? '🏆' : '📉'}</span>
                <span className="reward-value">
                  {roundResult.rewardXP >= 0 ? '+' : ''}{roundResult.rewardXP}
                </span>
                <span className="reward-label">XP</span>
              </div>
            </div>

            <div className="duel-result-stats">
              <div className="duel-result-stat">
                <span>🪙 Yangi balans</span>
                <span className="stat-value">{roundResult.newCoins || user?.coins || 0}</span>
              </div>
              <div className="duel-result-stat">
                <span>🏆 Yangi reyting</span>
                <span className="stat-value">{roundResult.newRating || user?.rating || 0}</span>
              </div>
              <div className="duel-result-stat">
                <span>📊 Yangi level</span>
                <span className="stat-value">{roundResult.newLevel || user?.level || 1}</span>
              </div>
            </div>
          </div>

          <div className="duel-result-buttons">
            <button className="duel-restart-btn" onClick={resetGame}>
              🔄 Yana O'ynash
            </button>
            <button className="duel-menu-btn" onClick={() => {
              resetGame();
              onBack();
            }}>
              📋 Menuga
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          OPPONENT LEFT STATE
          ============================================================ */}
      {gameState === 'opponent_left' && (
        <div className="duel-opponent-left">
          <div className="duel-opponent-left-icon">⚠️</div>
          <h3>Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <div className="duel-result-buttons">
            <button className="duel-restart-btn" onClick={resetGame}>
              🔄 Yana O'ynash
            </button>
            <button className="duel-menu-btn" onClick={() => {
              resetGame();
              onBack();
            }}>
              📋 Menuga
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default DuelGame;