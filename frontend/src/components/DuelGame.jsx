// ============================================================
// DUELGAME.JS - TO'LIQ TUZATILGAN VERSION
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
  const [debugInfo, setDebugInfo] = useState('');
  const [queueLength, setQueueLength] = useState(0);

  const timerIntervalRef = useRef(null);

  // ======================
  // SOCKET EVENT HANDLERS
  // ======================
  useEffect(() => {
    if (!socket) {
      console.error('❌ Socket is null!');
      setSocketError('Socket mavjud emas');
      return;
    }

    console.log('🔥 DuelGame mounted, socket ID:', socket.id);
    console.log('🔥 Socket connected:', socket.connected);

    // CONNECT
    const onConnect = () => {
      console.log('✅ Socket connected in DuelGame:', socket.id);
      setSocketError(null);
      onNotification?.('✅ Serverga ulandi!');
    };

    // DISCONNECT
    const onDisconnect = (reason) => {
      console.log('❌ Socket disconnected in DuelGame:', reason);
      setSocketError('Serverdan uzildi: ' + reason);
    };

    // CONNECT ERROR
    const onConnectError = (error) => {
      console.error('❌ Socket connect error in DuelGame:', error);
      setSocketError('Serverga ulanishda xatolik: ' + error.message);
    };

    // SEARCHING
    const onSearching = (data) => {
      console.log('🔍 Searching event:', data);
      setSearching(true);
      setGameState('searching');
      if (data?.stake) setStake(data.stake);
      if (data?.queueLength !== undefined) setQueueLength(data.queueLength);
      setDebugInfo(`Queue: ${data?.queueLength || '?'} o'yinchi`);
    };

    // MATCH FOUND
    const onMatchFound = (data) => {
      console.log('🎯 MATCH FOUND!!!', data);
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      if (data.stake) setStake(data.stake);
      setMyChoice(null);
      setRoundResult(null);
      setGameState('playing');
      setSearching(false);
      setDebugInfo(`Raqib: ${data.opponent?.name || 'Noma\'lum'}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`);
    };

    // TIMER TICK
    const onTimerTick = (timeLeft) => {
      console.log('⏱️ Timer tick:', timeLeft);
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) {
        triggerHaptic?.('light');
      }
    };

    // ROUND RESULT
    const onRoundResult = (result) => {
      console.log('📊 Round result:', result);
      setRoundResult(result);
      setGameState('result');
      setDebugInfo(`Natija: ${result.result}`);
      
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

    // OPPONENT LEFT
    const onOpponentLeft = () => {
      console.log('🚪 Opponent left');
      setGameState('opponent_left');
      setDebugInfo('Raqib chiqib ketdi');
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!');
    };

    // ERROR
    const onError = (data) => {
      console.error('❌ Server error event:', data);
      setSocketError(data.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data.message || 'Xatolik yuz berdi'}`);
    };

    // SEARCH CANCELLED
    const onSearchCancelled = () => {
      console.log('🔴 Search cancelled');
      setSearching(false);
      setGameState('idle');
      setDebugInfo('');
      setQueueLength(0);
    };

    // Register all events
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
      console.log('🧹 Cleaning up DuelGame socket listeners');
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
  }, [socket, triggerHaptic, onNotification, setUser, user]);

  // ======================
  // GAME FUNCTIONS
  // ======================
  const startSearch = useCallback(() => {
    console.log('🚀 Starting search...');
    console.log('📊 User:', user);
    console.log('📊 Stake:', stake);
    console.log('🔌 Socket connected:', socket?.connected);
    console.log('🔌 Socket id:', socket?.id);

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

    console.log('📤 Emitting find_match with:', { player: playerData, stake: Number(stake) });
    
    setSearching(true);
    setGameState('searching');
    setDebugInfo('Raqib qidirilmoqda...');
    
    socket.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
  }, [user, stake, socket, onNotification]);

  const cancelSearch = useCallback(() => {
    console.log('❌ Cancelling search...');
    if (socket) {
      socket.emit('cancel_search');
    }
    setSearching(false);
    setGameState('idle');
    setDebugInfo('');
    setQueueLength(0);
  }, [socket]);

  const submitChoice = useCallback((choice) => {
    console.log('✋ Submitting choice:', choice, 'roomId:', roomId);
    if (!socket || !roomId) {
      console.error('❌ No socket or roomId');
      return;
    }
    
    setMyChoice(choice);
    socket.emit('make_choice', { roomId, choice });
  }, [socket, roomId]);

  const resetGame = useCallback(() => {
    console.log('🔄 Resetting game');
    setGameState('idle');
    setRoundResult(null);
    setMyChoice(null);
    setOpponent(null);
    setRoomId(null);
    setTimer(30);
    setSearching(false);
    setDebugInfo('');
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
    <div className="game-screen" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: 'white',
      padding: '16px',
      position: 'relative'
    }}>
      {/* Back Button */}
      <button 
        className="back-btn" 
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
          zIndex: 10,
          fontSize: '14px'
        }}
      >
        ⬅️ Menuga Qaytish
      </button>

      {/* DEBUG INFO */}
      <div className="debug-info" style={{ 
        background: 'rgba(0,0,0,0.5)',
        color: '#00ff88',
        padding: '8px 12px',
        borderRadius: '8px',
        margin: '60px 0 16px 0',
        fontSize: '12px',
        fontFamily: 'monospace',
        textAlign: 'center',
        border: '1px solid rgba(0,255,136,0.2)'
      }}>
        <div>🔌 Socket: {socket?.connected ? '🟢' : '🔴'} {socket?.id ? socket.id.substring(0, 8) : 'yo\'q'}</div>
        <div>📊 Holat: {gameState} | {debugInfo || 'Kutish'}</div>
        <div>👥 Navbat: {queueLength || 0} o'yinchi</div>
      </div>

      {/* Error */}
      {socketError && (
        <div className="socket-error" style={{
          background: 'rgba(255,68,68,0.2)',
          border: '1px solid #ff4444',
          borderRadius: '8px',
          padding: '12px',
          margin: '8px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ff4444'
        }}>
          ⚠️ {socketError}
          <button 
            onClick={() => setSocketError(null)} 
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff4444',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* IDLE */}
      {gameState === 'idle' && (
        <div className="setup-container" style={{
          maxWidth: '400px',
          margin: '40px auto 0',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>⚔️ Onlayn Duel</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>Raqib bilan jonli duel!</p>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '18px' }}>
              🪙 Balans: <strong style={{ color: '#00ff88' }}>{user?.coins || 0}</strong>
            </p>
            <p style={{ fontSize: '14px', color: '#888' }}>
              🏆 Reyting: {user?.rating || 0}
            </p>
          </div>
          
          <p style={{ color: '#888', marginBottom: '12px' }}>Stavka tanlang:</p>
          <div className="stake-grid" style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px'
          }}>
            {[10, 20, 50, 100].map(value => (
              <button 
                key={value} 
                className={`stake-card ${stake === value ? 'selected' : ''}`}
                onClick={() => setStake(value)}
                disabled={(user?.coins || 0) < value}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: stake === value ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                  background: (user?.coins || 0) < value ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)',
                  color: (user?.coins || 0) < value ? '#666' : 'white',
                  cursor: (user?.coins || 0) < value ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  minWidth: '60px',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ fontSize: '20px' }}>🪙</div>
                <div style={{ fontWeight: 'bold' }}>{value}</div>
                {(user?.coins || 0) < value && (
                  <div style={{ fontSize: '10px', color: '#ff4444' }}>❌</div>
                )}
              </button>
            ))}
          </div>

          <button 
            className="btn-action btn-start" 
            onClick={startSearch}
            disabled={!user || (user?.coins || 0) < stake || !socket?.connected}
            style={{
              padding: '16px 40px',
              fontSize: '18px',
              borderRadius: '12px',
              border: 'none',
              background: (!user || (user?.coins || 0) < stake || !socket?.connected) 
                ? '#555' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: (!user || (user?.coins || 0) < stake || !socket?.connected) 
                ? 'not-allowed' 
                : 'pointer',
              fontWeight: 'bold',
              width: '100%',
              transition: 'all 0.3s'
            }}
          >
            {!socket?.connected ? '🔌 Ulanish yo\'q' : '🚀 Jonli Raqib Qidirish'}
          </button>
          
          <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
            💡 O'rtacha 5-30 soniya davom etadi
          </p>
        </div>
      )}

      {/* SEARCHING */}
      {gameState === 'searching' && (
        <div className="searching-container" style={{
          textAlign: 'center',
          padding: '60px 20px',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <div className="radar-animation" style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            margin: '0 auto 30px'
          }}>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '3px solid #667eea',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '3px solid #764ba2',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite 0.5s'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '3px solid #00ff88',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite 1s'
            }}></div>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '40px'
            }}>🔍</div>
          </div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Raqib qidirilmoqda...</h3>
          <p style={{ color: '#888' }}>Stavka: 🪙 {stake}</p>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            ⏳ Navbatda: {queueLength} o'yinchi
          </p>
          <button 
            className="btn-action btn-cancel" 
            onClick={cancelSearch}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              borderRadius: '12px',
              border: 'none',
              background: '#ff4444',
              color: 'white',
              cursor: 'pointer',
              marginTop: '30px',
              fontWeight: 'bold'
            }}
          >
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {/* PLAYING */}
      {gameState === 'playing' && (
        <div className="arena-container" style={{
          maxWidth: '400px',
          margin: '20px auto 0',
          textAlign: 'center'
        }}>
          <div className="versus-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            marginBottom: '20px'
          }}>
            <div className="fighter" style={{textAlign: 'center'}}>
              <div className="fighter-name" style={{fontSize: '16px', fontWeight: 'bold'}}>
                🥊 {user?.firstName || "Siz"}
              </div>
              <div className="fighter-stats" style={{fontSize: '12px', color: '#888'}}>
                🏆 {user?.rating || 0}
              </div>
            </div>
            <div className="arena-timer" style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: timer <= 5 ? '#ff4444' : '#00ff88'
            }}>
              {timer}
              <span style={{fontSize: '14px', color: '#888', marginLeft: '4px'}}>s</span>
            </div>
            <div className="fighter" style={{textAlign: 'center'}}>
              <div className="fighter-name" style={{fontSize: '16px', fontWeight: 'bold'}}>
                🥷 {opponent?.name || "Raqib"}
              </div>
              <div className="fighter-stats" style={{fontSize: '12px', color: '#888'}}>
                🏆 {opponent?.rating || 0}
              </div>
            </div>
          </div>

          <p style={{ color: '#888', marginBottom: '16px', fontSize: '14px' }}>
            Tanlovingizni qiling:
          </p>

          <div className="weapons-row" style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button 
              disabled={!!myChoice} 
              onClick={() => submitChoice('rock')}
              style={{
                padding: '14px 20px',
                fontSize: '18px',
                borderRadius: '12px',
                border: myChoice === 'rock' ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                background: myChoice === 'rock' ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                opacity: myChoice ? 0.5 : 1,
                transition: 'all 0.3s',
                minWidth: '80px'
              }}
            >
              🪨 Tosh
            </button>
            <button 
              disabled={!!myChoice} 
              onClick={() => submitChoice('paper')}
              style={{
                padding: '14px 20px',
                fontSize: '18px',
                borderRadius: '12px',
                border: myChoice === 'paper' ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                background: myChoice === 'paper' ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                opacity: myChoice ? 0.5 : 1,
                transition: 'all 0.3s',
                minWidth: '80px'
              }}
            >
              📄 Qog'oz
            </button>
            <button 
              disabled={!!myChoice} 
              onClick={() => submitChoice('scissors')}
              style={{
                padding: '14px 20px',
                fontSize: '18px',
                borderRadius: '12px',
                border: myChoice === 'scissors' ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.1)',
                background: myChoice === 'scissors' ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                opacity: myChoice ? 0.5 : 1,
                transition: 'all 0.3s',
                minWidth: '80px'
              }}
            >
              ✂️ Qaychi
            </button>
          </div>

          {myChoice && (
            <p style={{
              color: '#00ff88',
              fontSize: '14px'
            }}>
              ⏳ Siz <strong>{formatChoice(myChoice)}</strong> tanladingiz. Raqib kutilmoqda...
            </p>
          )}
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && roundResult && (
        <div className="result-container" style={{
          textAlign: 'center',
          padding: '20px',
          maxWidth: '400px',
          margin: '20px auto 0'
        }}>
          <div className={`result-banner ${roundResult.result}`} style={{
            fontSize: '24px',
            fontWeight: 'bold',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '20px',
            background: roundResult.result === 'win' ? 'rgba(0,255,136,0.2)' : 
                       roundResult.result === 'lose' ? 'rgba(255,68,68,0.2)' : 'rgba(255,170,0,0.2)',
            border: roundResult.result === 'win' ? '2px solid #00ff88' : 
                    roundResult.result === 'lose' ? '2px solid #ff4444' : '2px solid #ffaa00'
          }}>
            {roundResult.result === 'win' && "🎉 SIZ YUTDINGIZ!"}
            {roundResult.result === 'lose' && "😢 MAG'LUB BO'LDINGIZ"}
            {roundResult.result === 'draw' && "🤝 DURANG"}
          </div>
          
          <div className="battle-card" style={{
            background: 'rgba(255,255,255,0.05)',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '20px'
          }}>
            <div className="battle-choices" style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div className="choice-display" style={{textAlign: 'center'}}>
                <span style={{color: '#888', fontSize: '12px'}}>Siz</span>
                <div style={{fontSize: '18px', marginTop: '4px'}}>
                  {formatChoice(roundResult.myChoice)}
                </div>
              </div>
              <div style={{fontSize: '24px', color: '#667eea'}}>⚡</div>
              <div className="choice-display" style={{textAlign: 'center'}}>
                <span style={{color: '#888', fontSize: '12px'}}>Raqib</span>
                <div style={{fontSize: '18px', marginTop: '4px'}}>
                  {formatChoice(roundResult.opponentChoice)}
                </div>
              </div>
            </div>
            
            <div className="financial-summary" style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              fontSize: '16px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{
                color: (roundResult.rewardCoins || 0) >= 0 ? '#00ff88' : '#ff4444'
              }}>
                {(roundResult.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult.rewardCoins || 0)}`}
              </span>
              <span style={{
                color: (roundResult.rewardXP || 0) >= 0 ? '#00ff88' : '#ff4444'
              }}>
                {(roundResult.rewardXP || 0) >= 0 
                  ? `+🏆 ${roundResult.rewardXP} XP` 
                  : `-🏆 ${Math.abs(roundResult.rewardXP || 0)} XP`}
              </span>
            </div>
          </div>
          
          <button 
            className="btn-action btn-restart" 
            onClick={resetGame}
            style={{
              padding: '14px 40px',
              fontSize: '16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            🔄 Yana O'ynash
          </button>
        </div>
      )}

      {/* OPPONENT LEFT */}
      {gameState === 'opponent_left' && (
        <div className="disconnected-container" style={{
          textAlign: 'center',
          padding: '60px 20px',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Raqib o'yinni tark etdi!</h3>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.
          </p>
          <button 
            className="btn-action" 
            onClick={resetGame}
            style={{
              padding: '14px 40px',
              fontSize: '16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            Bosh sahifaga
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default DuelGame;