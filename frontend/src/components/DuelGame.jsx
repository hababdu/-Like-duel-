// ============================================================
// DUELGAME.JS - SODDA VA ISHONCHLI VERSION
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
  const [gameState, setGameState] = useState('idle'); // idle, searching, playing, result
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);
  const [socketError, setSocketError] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  // Debug log qo'shish
  const addDebug = (msg) => {
    console.log('🔍', msg);
    setDebugLog(prev => [...prev.slice(-20), { time: new Date().toLocaleTimeString(), msg }]);
  };

  // ======================
  // SOCKET EVENT HANDLERS
  // ======================
  useEffect(() => {
    if (!socket) {
      addDebug('❌ Socket is null!');
      return;
    }

    addDebug(`✅ DuelGame mounted, socket ID: ${socket.id}`);
    addDebug(`✅ Socket connected: ${socket.connected}`);

    // ====== MATCH FOUND ======
    const onMatchFound = (data) => {
      addDebug(`🎯 MATCH FOUND!!! ${JSON.stringify(data)}`);
      
      // State ni to'g'ridan-to'g'ri o'zgartirish
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      setStake(data.stake || stake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
      
      addDebug(`✅ Game state changed to: playing`);
      addDebug(`👤 Opponent: ${data.opponent?.name || 'Noma\'lum'}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`);
    };

    // ====== SEARCHING ======
    const onSearching = (data) => {
      addDebug(`🔍 Searching: ${JSON.stringify(data)}`);
      setGameState('searching');
      setStake(data?.stake || stake);
    };

    // ====== TIMER TICK ======
    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5) {
        triggerHaptic?.('light');
      }
    };

    // ====== ROUND RESULT ======
    const onRoundResult = (result) => {
      addDebug(`📊 Round result: ${JSON.stringify(result)}`);
      setRoundResult(result);
      setGameState('result');
      
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
      
      // User ma'lumotlarini yangilash
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
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
    };

    // ====== ERROR ======
    const onError = (data) => {
      addDebug(`❌ Error: ${JSON.stringify(data)}`);
      setSocketError(data?.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data?.message || 'Xatolik yuz berdi'}`);
      setGameState('idle');
    };

    // ====== SEARCH CANCELLED ======
    const onSearchCancelled = () => {
      addDebug('🔴 Search cancelled');
      setGameState('idle');
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

    // Test uchun - 5 sekundda bir marta ping
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping', { time: Date.now() });
      }
    }, 5000);

    socket.on('pong', (data) => {
      addDebug(`🏓 Pong: ${data?.time ? Date.now() - data.time : '?'}ms`);
    });

    // Cleanup
    return () => {
      addDebug('🧹 Cleaning up DuelGame');
      clearInterval(pingInterval);
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
      socket.off('pong');
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
      onNotification?.('⚠️ Iltimos avval tizimga kiring!');
      return;
    }

    if ((user.coins || 0) < stake) {
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

    addDebug(`📤 Emitting find_match: ${JSON.stringify({ player: playerData, stake: Number(stake) })}`);
    
    setGameState('searching');
    
    socket.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
    
    // Agar 5 sekunddan keyin hech narsa bo'lmasa, qayta urinish
    setTimeout(() => {
      if (gameState === 'searching') {
        addDebug('⏳ Still searching...');
      }
    }, 5000);
    
  }, [user, stake, socket, onNotification, gameState]);

  // ======================
  // CANCEL SEARCH
  // ======================
  const cancelSearch = useCallback(() => {
    addDebug('❌ Cancelling search');
    if (socket) {
      socket.emit('cancel_search');
    }
    setGameState('idle');
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: 'white',
      padding: '16px',
      position: 'relative'
    }}>
      {/* BACK BUTTON */}
      <button 
        onClick={() => {
          if (gameState === 'searching') cancelSearch();
          onBack();
          resetGame();
        }}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          color: 'white',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        ⬅️ Orqaga
      </button>

      {/* DEBUG PANEL */}
      <div style={{
        marginTop: '60px',
        background: 'rgba(0,0,0,0.8)',
        borderRadius: '8px',
        padding: '8px',
        maxHeight: '150px',
        overflow: 'auto',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#00ff88',
        border: '1px solid rgba(0,255,136,0.2)',
        marginBottom: '16px'
      }}>
        <div>🔌 Socket: {socket?.connected ? '🟢' : '🔴'} {socket?.id?.substring(0, 8) || 'yo\'q'}</div>
        <div>📊 State: <strong>{gameState}</strong> | Timer: {timer}s</div>
        <div>👤 User: {user?.tgId} - {user?.firstName}</div>
        <div>👥 Opponent: {opponent?.name || 'yo\'q'}</div>
        {debugLog.slice(-5).map((log, i) => (
          <div key={i} style={{ color: '#aaa', fontSize: '10px' }}>
            [{log.time}] {log.msg}
          </div>
        ))}
      </div>

      {/* ERROR */}
      {socketError && (
        <div style={{
          background: 'rgba(255,68,68,0.2)',
          border: '1px solid #ff4444',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          color: '#ff4444',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          ⚠️ {socketError}
          <button onClick={() => setSocketError(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ===== IDLE ===== */}
      {gameState === 'idle' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px' }}>⚔️ Onlayn Duel</h2>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '16px',
            margin: '16px 0'
          }}>
            <p>🪙 Balans: <strong style={{ color: '#00ff88' }}>{user?.coins || 0}</strong></p>
            <p>🏆 Reyting: {user?.rating || 0}</p>
          </div>
          
          <p>Stavka tanlang:</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[10, 20, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setStake(v)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: stake === v ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                  background: (user?.coins || 0) < v ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)',
                  color: (user?.coins || 0) < v ? '#666' : 'white',
                  cursor: (user?.coins || 0) < v ? 'not-allowed' : 'pointer',
                  minWidth: '60px'
                }}
                disabled={(user?.coins || 0) < v}
              >
                🪙 {v}
              </button>
            ))}
          </div>

          <button
            onClick={startSearch}
            disabled={!user || (user?.coins || 0) < stake || !socket?.connected}
            style={{
              width: '100%',
              padding: '16px',
              marginTop: '20px',
              borderRadius: '12px',
              border: 'none',
              background: (!user || (user?.coins || 0) < stake || !socket?.connected) 
                ? '#555' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: (!user || (user?.coins || 0) < stake || !socket?.connected) 
                ? 'not-allowed' 
                : 'pointer'
            }}
          >
            {!socket?.connected ? '🔌 Ulanish yo\'q' : '🚀 Raqib Qidirish'}
          </button>
        </div>
      )}

      {/* ===== SEARCHING ===== */}
      {gameState === 'searching' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3>Raqib qidirilmoqda...</h3>
          <p style={{ color: '#888' }}>Stavka: 🪙 {stake}</p>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            margin: '20px 0',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #667eea, #764ba2)',
              animation: 'loading 2s ease-in-out infinite'
            }} />
          </div>
          <button
            onClick={cancelSearch}
            style={{
              padding: '12px 30px',
              borderRadius: '12px',
              border: 'none',
              background: '#ff4444',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ✖️ Bekor qilish
          </button>
          <style>{`
            @keyframes loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}

      {/* ===== PLAYING ===== */}
      {gameState === 'playing' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <div>
              <div>🥊 {user?.firstName || 'Siz'}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>🏆 {user?.rating || 0}</div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: timer <= 5 ? '#ff4444' : '#00ff88' }}>
              {timer}s
            </div>
            <div>
              <div>🥷 {opponent?.name || 'Raqib'}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>🏆 {opponent?.rating || 0}</div>
            </div>
          </div>

          <p style={{ color: '#888', marginBottom: '16px' }}>Tanlovingizni qiling:</p>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['rock', 'paper', 'scissors'].map(choice => {
              const emoji = choice === 'rock' ? '🪨' : choice === 'paper' ? '📄' : '✂️';
              const name = choice === 'rock' ? 'Tosh' : choice === 'paper' ? 'Qog\'oz' : 'Qaychi';
              return (
                <button
                  key={choice}
                  onClick={() => submitChoice(choice)}
                  disabled={!!myChoice}
                  style={{
                    padding: '16px 24px',
                    borderRadius: '12px',
                    border: myChoice === choice ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                    background: myChoice === choice ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: '18px',
                    cursor: myChoice ? 'not-allowed' : 'pointer',
                    opacity: myChoice ? 0.5 : 1,
                    minWidth: '80px'
                  }}
                >
                  <div>{emoji}</div>
                  <div style={{ fontSize: '14px' }}>{name}</div>
                </button>
              );
            })}
          </div>

          {myChoice && (
            <p style={{ color: '#00ff88', marginTop: '16px' }}>
              ⏳ Siz <strong>{formatChoice(myChoice)}</strong> tanladingiz. Raqib kutilmoqda...
            </p>
          )}
        </div>
      )}

      {/* ===== RESULT ===== */}
      {gameState === 'result' && roundResult && (
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '20px',
            background: roundResult.result === 'win' ? 'rgba(0,255,136,0.2)' : 
                       roundResult.result === 'lose' ? 'rgba(255,68,68,0.2)' : 'rgba(255,170,0,0.2)',
            border: roundResult.result === 'win' ? '2px solid #00ff88' : 
                    roundResult.result === 'lose' ? '2px solid #ff4444' : '2px solid #ffaa00'
          }}>
            {roundResult.result === 'win' && '🎉 SIZ YUTDINGIZ!'}
            {roundResult.result === 'lose' && '😢 MAG\'LUB BO\'LDINGIZ'}
            {roundResult.result === 'draw' && '🤝 DURANG'}
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px' }}>
              <div>
                <div style={{ color: '#888', fontSize: '12px' }}>Siz</div>
                <div style={{ fontSize: '20px' }}>{formatChoice(roundResult.myChoice)}</div>
              </div>
              <div style={{ fontSize: '24px', color: '#667eea' }}>⚡</div>
              <div>
                <div style={{ color: '#888', fontSize: '12px' }}>Raqib</div>
                <div style={{ fontSize: '20px' }}>{formatChoice(roundResult.opponentChoice)}</div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ color: (roundResult.rewardCoins || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(roundResult.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult.rewardCoins || 0)}`}
              </span>
              <span style={{ color: (roundResult.rewardXP || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                {(roundResult.rewardXP || 0) >= 0 
                  ? `+🏆 ${roundResult.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult.rewardXP || 0)} XP`}
              </span>
            </div>
          </div>
          
          <button
            onClick={resetGame}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* ===== OPPONENT LEFT ===== */}
      {gameState === 'opponent_left' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h3>Raqib o'yinni tark etdi!</h3>
          <p style={{ color: '#888' }}>O'yin xonasi yopildi.</p>
          <button
            onClick={resetGame}
            style={{
              padding: '16px 40px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              marginTop: '20px'
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