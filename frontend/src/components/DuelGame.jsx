// ============================================================
// DUELGAME.JS - TO'LIQ VERSION
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';

function DuelGame({ 
  user, 
  setUser, 
  backendUrl, 
  onBack, 
  onNotification,
  triggerHaptic,
  socket 
}) {
  const [gameState, setGameState] = useState('idle');
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);
  const [socketError, setSocketError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [debugLog, setDebugLog] = useState([]);

  const timerIntervalRef = useRef(null);

  // ======================
  // DEBUG LOG
  // ======================
  const addDebug = (msg) => {
    const log = { time: new Date().toLocaleTimeString(), msg };
    setDebugLog(prev => [...prev.slice(-15), log]);
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

    // ====== MATCH FOUND ======
    const onMatchFound = (data) => {
      addDebug(`🎯 MATCH FOUND!!! ${JSON.stringify(data)}`);
      
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      setStake(data.stake || stake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
      setSearching(false);
      
      addDebug(`✅ Game state: playing`);
      addDebug(`👤 Opponent: ${data.opponent?.name || 'Noma\'lum'}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`);
    };

    // ====== SEARCHING ======
    const onSearching = (data) => {
      addDebug(`🔍 Searching: ${JSON.stringify(data)}`);
      setGameState('searching');
      setSearching(true);
      if (data?.stake) setStake(data.stake);
      if (data?.queueLength !== undefined) setQueueLength(data.queueLength);
    };

    // ====== TIMER TICK ======
    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) {
        triggerHaptic?.('light');
      }
    };

    // ====== ROUND RESULT ======
    const onRoundResult = (result) => {
      addDebug(`📊 Round result: ${JSON.stringify(result)}`);
      setRoundResult(result);
      setGameState('result');
      setSearching(false);
      
      if (result.result === 'win') {
        triggerHaptic?.('heavy');
        onNotification?.('🎉 Siz yutdingiz! +' + result.rewardCoins + ' 🪙');
      } else if (result.result === 'lose') {
        triggerHaptic?.('medium');
        onNotification?.('😢 Mag\'lub bo\'ldingiz -' + Math.abs(result.rewardCoins) + ' 🪙');
      } else {
        triggerHaptic?.('light');
        onNotification?.('🤝 Durang');
      }
      
      if (setUser && user) {
        setUser(prev => ({
          ...prev,
          coins: Math.max(0, (prev?.coins || 0) + (result.rewardCoins || 0)),
          rating: Math.max(0, (prev?.rating || 0) + (result.rewardXP || 0)),
          totalGames: (prev?.totalGames || 0) + 1,
          wins: (prev?.wins || 0) + (result.result === 'win' ? 1 : 0),
          losses: (prev?.losses || 0) + (result.result === 'lose' ? 1 : 0)
        }));
      }
    };

    // ====== OPPONENT LEFT ======
    const onOpponentLeft = () => {
      addDebug('🚪 Opponent left');
      setGameState('opponent_left');
      setSearching(false);
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
    };

    // ====== ERROR ======
    const onError = (data) => {
      addDebug(`❌ Error: ${JSON.stringify(data)}`);
      setSocketError(data?.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data?.message || 'Xatolik yuz berdi'}`);
      setGameState('idle');
      setSearching(false);
    };

    // ====== SEARCH CANCELLED ======
    const onSearchCancelled = () => {
      addDebug('🔴 Search cancelled');
      setGameState('idle');
      setSearching(false);
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
    addDebug(`🔌 Socket connected: ${socket?.connected}`);

    if (!user) {
      onNotification?.('⚠️ Iltimos avval tizimga kiring!', 'warning');
      return;
    }

    if (!user.tgId || user.tgId === 'undefined' || user.tgId === 'null') {
      onNotification?.('⚠️ Foydalanuvchi ID si topilmadi!', 'error');
      addDebug('❌ Invalid tgId: ' + user.tgId);
      return;
    }

    if ((user.coins || 0) < stake) {
      onNotification?.('⚠️ Yetarli tanga yo\'q!', 'warning');
      return;
    }

    if (!socket?.connected) {
      setSocketError('Serverga ulanish yo\'q');
      onNotification?.('⚠️ Serverga ulanish yo\'q!', 'error');
      return;
    }

    const playerData = {
      tgId: String(user.tgId),
      firstName: user.firstName || "O'yinchi",
      username: user.username || '',
      rating: user.rating || 100,
      coins: user.coins || 0
    };

    addDebug(`📤 Emitting find_match: ${JSON.stringify({ player: playerData, stake: Number(stake) })}`);
    
    setGameState('searching');
    setSearching(true);
    
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
    setSearching(false);
    setQueueLength(0);
  }, [socket]);

  // ======================
  // SUBMIT CHOICE
  // ======================
  const submitChoice = useCallback((choice) => {
    addDebug(`✋ Submitting choice: ${choice}, roomId: ${roomId}`);
    if (!socket || !roomId) {
      addDebug('❌ No socket or roomId');
      return;
    }
    
    setMyChoice(choice);
    socket.emit('make_choice', { roomId, choice });
  }, [socket, roomId]);

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
    setSearching(false);
    setQueueLength(0);
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

  // ======================
  // RENDER
  // ======================
  return (
    <div className="duel-game-container">
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
      <div className="duel-debug-panel">
        <div className="duel-debug-row">
          <span>🔌 Socket: {socket?.connected ? '🟢' : '🔴'} {socket?.id?.substring(0, 8) || 'yo\'q'}</span>
          <span>📊 State: <strong>{gameState}</strong></span>
          <span>⏱️ Timer: {timer}s</span>
        </div>
        <div className="duel-debug-row">
          <span>👤 User: {user?.tgId || '❌'} - {user?.firstName}</span>
          <span>👥 Queue: {queueLength}</span>
        </div>
        <div className="duel-debug-logs">
          {debugLog.slice(-4).map((log, i) => (
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

      {/* ===== IDLE ===== */}
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
          </div>

          <div className="duel-stake-section">
            <p className="duel-stake-label">Stavka tanlang:</p>
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

      {/* ===== SEARCHING ===== */}
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
          <button className="duel-cancel-btn" onClick={cancelSearch}>
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {/* ===== PLAYING ===== */}
      {gameState === 'playing' && (
        <div className="duel-playing">
          <div className="duel-versus">
            <div className="duel-player">
              <div className="duel-player-name">🥊 {user?.firstName || 'Siz'}</div>
              <div className="duel-player-rating">🏆 {user?.rating || 0}</div>
            </div>
            <div className="duel-timer">
              <span className="duel-timer-value">{timer}</span>
              <span className="duel-timer-label">s</span>
            </div>
            <div className="duel-player">
              <div className="duel-player-name">🥷 {opponent?.name || 'Raqib'}</div>
              <div className="duel-player-rating">🏆 {opponent?.rating || 0}</div>
            </div>
          </div>

          <p className="duel-choice-label">Tanlovingizni qiling:</p>

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
            <p className="duel-waiting">
              ⏳ Siz <strong>{formatChoice(myChoice)}</strong> tanladingiz. Raqib kutilmoqda...
            </p>
          )}
        </div>
      )}

      {/* ===== RESULT ===== */}
      {gameState === 'result' && roundResult && (
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
                <span className="duel-result-value">{formatChoice(roundResult.myChoice)}</span>
              </div>
              <div className="duel-result-vs">⚡</div>
              <div className="duel-result-choice">
                <span className="duel-result-label">Raqib</span>
                <span className="duel-result-value">{formatChoice(roundResult.opponentChoice)}</span>
              </div>
            </div>

            <div className="duel-result-rewards">
              <span className={roundResult.rewardCoins >= 0 ? 'positive' : 'negative'}>
                {roundResult.rewardCoins >= 0 
                  ? `+🪙 ${roundResult.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult.rewardCoins)}`}
              </span>
              <span className={roundResult.rewardXP >= 0 ? 'positive' : 'negative'}>
                {roundResult.rewardXP >= 0 
                  ? `+🏆 ${roundResult.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult.rewardXP)} XP`}
              </span>
            </div>
          </div>

          <button className="duel-restart-btn" onClick={resetGame}>
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* ===== OPPONENT LEFT ===== */}
      {gameState === 'opponent_left' && (
        <div className="duel-opponent-left">
          <div className="duel-opponent-left-icon">⚠️</div>
          <h3>Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <button className="duel-restart-btn" onClick={resetGame}>
            Bosh sahifaga
          </button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;