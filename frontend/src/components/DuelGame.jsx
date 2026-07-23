// ============================================================
// 3. DuelGame.js - TO'LIQ QAYTA YOZILGAN
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './DuelGame.css';

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

  const timerIntervalRef = useRef(null);

  // ======================
  // SOCKET EVENT HANDLERS
  // ======================
  useEffect(() => {
    if (!socket) return;

    // Searching
    const onSearching = (data) => {
      console.log('🔍 Searching:', data);
      setSearching(true);
      setGameState('searching');
      if (data?.stake) setStake(data.stake);
    };

    // Match Found
    const onMatchFound = (data) => {
      console.log('🎯 Match found:', data);
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      if (data.stake) setStake(data.stake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
      setSearching(false);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent.name} bilan duel!`);
    };

    // Timer Tick
    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) {
        triggerHaptic?.('light');
      }
    };

    // Round Result
    const onRoundResult = (result) => {
      console.log('📊 Round result:', result);
      setRoundResult(result);
      setGameState('result');
      
      // Haptic feedback
      if (result.result === 'win') {
        triggerHaptic?.('heavy');
        onNotification?.('🎉 Siz yutdingiz!');
      } else if (result.result === 'lose') {
        triggerHaptic?.('medium');
        onNotification?.('😢 Mag\'lub bo\'ldingiz');
      } else {
        triggerHaptic?.('light');
        onNotification?.('🤝 Durang');
      }
      
      // Update user balance
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

    // Opponent Left
    const onOpponentLeft = () => {
      console.log('🚪 Opponent left');
      setGameState('opponent_left');
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
    };

    // Error
    const onError = (data) => {
      console.error('❌ Server error:', data);
      setSocketError(data.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data.message || 'Xatolik yuz berdi'}`);
    };

    // Register events
    socket.on('searching', onSearching);
    socket.on('match_found', onMatchFound);
    socket.on('timer_tick', onTimerTick);
    socket.on('round_result', onRoundResult);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('error', onError);

    // Cleanup
    return () => {
      socket.off('searching', onSearching);
      socket.off('match_found', onMatchFound);
      socket.off('timer_tick', onTimerTick);
      socket.off('round_result', onRoundResult);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('error', onError);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [socket, triggerHaptic, onNotification, setUser, user]);

  // ======================
  // GAME FUNCTIONS
  // ======================
  const startSearch = useCallback(() => {
    if (!user || user.coins < stake) {
      onNotification?.('⚠️ Yetarli tanga yo\'q!');
      return;
    }

    if (!socket?.connected) {
      setSocketError('Serverga ulanish yo\'q');
      onNotification?.('⚠️ Serverga ulanish yo\'q!');
      return;
    }

    const playerData = {
      tgId: String(user.tgId),
      firstName: user.firstName || "O'yinchi",
      username: user.username || '',
      rating: user.rating || 100,
      coins: user.coins || 0
    };

    setSearching(true);
    setGameState('searching');
    socket.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
  }, [user, stake, socket, onNotification]);

  const cancelSearch = useCallback(() => {
    if (socket) {
      socket.emit('cancel_search');
    }
    setSearching(false);
    setGameState('idle');
  }, [socket]);

  const submitChoice = useCallback((choice) => {
    if (!socket || !roomId) return;
    
    setMyChoice(choice);
    socket.emit('make_choice', { roomId, choice });
  }, [socket, roomId]);

  const resetGame = useCallback(() => {
    setGameState('idle');
    setRoundResult(null);
    setMyChoice(null);
    setOpponent(null);
    setRoomId(null);
    setTimer(30);
    setSearching(false);
  }, []);

  // ======================
  // FORMAT FUNCTIONS
  // ======================
  const formatChoice = (str) => {
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
    <div className="game-screen">
      <button className="back-btn" onClick={() => {
        if (gameState === 'searching') cancelSearch();
        onBack();
        resetGame();
      }}>
        ⬅️ Menuga Qaytish
      </button>

      {/* Error */}
      {socketError && (
        <div className="socket-error">
          ⚠️ {socketError}
          <button onClick={() => setSocketError(null)}>✕</button>
        </div>
      )}

      {/* IDLE */}
      {gameState === 'idle' && (
        <div className="setup-container">
          <h2>⚔️ Onlayn Duel Rejimi</h2>
          <p className="user-current-coins">Balansingiz: 🪙 {user?.coins || 0}</p>
          
          <div className="stake-grid">
            {[10, 20, 50, 100].map(value => (
              <button 
                key={value} 
                className={`stake-card ${stake === value ? 'selected' : ''}`}
                onClick={() => setStake(value)}
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
            onClick={startSearch}
            disabled={!user || user.coins < stake || !socket?.connected}
          >
            {!socket?.connected ? '🔌 Ulanish yo\'q' : '🚀 Jonli Raqib Qidirish'}
          </button>
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
          <button className="btn-action btn-cancel" onClick={cancelSearch}>
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
              ⏳ Siz {formatChoice(myChoice)} tanladingiz. Raqib yurishi kutilmoqda...
            </p>
          )}
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && roundResult && (
        <div className="result-container">
          <div className={`result-banner ${roundResult.result}`}>
            {roundResult.result === 'win' && "🎉 SIZ YUTDINGIZ!"}
            {roundResult.result === 'lose' && "😢 MAG'LUB BO'LDINGIZ"}
            {roundResult.result === 'draw' && "🤝 DURANG"}
          </div>
          
          <div className="battle-card">
            <div className="battle-choices">
              <div className="choice-display">
                <span className="choice-label">Siz</span>
                <span className="choice-value">{formatChoice(roundResult.myChoice)}</span>
              </div>
              <div className="vs-divider">⚡</div>
              <div className="choice-display">
                <span className="choice-label">Raqib</span>
                <span className="choice-value">{formatChoice(roundResult.opponentChoice)}</span>
              </div>
            </div>
            
            <div className="financial-summary">
              <span className={(roundResult.rewardCoins || 0) >= 0 ? "plus" : "minus"}>
                {(roundResult.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult.rewardCoins || 0)}`}
              </span>
              <span className="xp-summary">
                {(roundResult.rewardXP || 0) >= 0 
                  ? `+🏆 ${roundResult.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult.rewardXP || 0)} XP`}
              </span>
            </div>
          </div>
          
          <button className="btn-action btn-restart" onClick={resetGame}>
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* OPPONENT LEFT */}
      {gameState === 'opponent_left' && (
        <div className="disconnected-container">
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <button className="btn-action" onClick={resetGame}>
            Bosh sahifaga
          </button>
        </div>
      )}
    </div>
  );
}

export default DuelGame;