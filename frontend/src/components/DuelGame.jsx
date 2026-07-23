// ============================================================
// 2. DUELGAME.JS - TUZATILGAN VERSION
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
      setDebugInfo(`Raqib: ${data.opponent.name}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent.name} bilan duel!`);
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

    console.log('📤 Emitting find_match with:', { player: playerData, stake: Number(stake) });
    
    setSearching(true);
    setGameState('searching');
    setDebugInfo('Raqib qidirilmoqda...');
    
    socket.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    }, (response) => {
      console.log('📥 find_match callback:', response);
      if (response?.error) {
        setSocketError(response.error);
        setSearching(false);
        setGameState('idle');
        onNotification?.(`⚠️ ${response.error}`);
      }
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

      {/* DEBUG INFO */}
      <div className="debug-info" style={{ 
        background: '#1a1a2e', 
        color: '#00ff88', 
        padding: '8px', 
        borderRadius: '8px',
        margin: '8px 0',
        fontSize: '12px',
        fontFamily: 'monospace',
        textAlign: 'center'
      }}>
        <div>🔌 Socket: {socket?.connected ? '🟢' : '🔴'} {socket?.id || 'yo\'q'}</div>
        <div>📊 Holat: {gameState} | {debugInfo}</div>
        <div>👥 Queue: {searchQueueLength || '?'}</div>
      </div>

      {/* Error */}
      {socketError && (
        <div className="socket-error" style={{
          background: '#ff4444',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          margin: '8px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          ⚠️ {socketError}
          <button onClick={() => setSocketError(null)} style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer'
          }}>✕</button>
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
                style={{
                  padding: '12px',
                  margin: '4px',
                  borderRadius: '12px',
                  border: stake === value ? '3px solid #667eea' : '2px solid #444',
                  background: user?.coins < value ? '#333' : '#222',
                  color: user?.coins < value ? '#666' : 'white',
                  cursor: user?.coins < value ? 'not-allowed' : 'pointer',
                  fontSize: '18px',
                  minWidth: '60px'
                }}
              >
                <div>🪙</div>
                <div>{value}</div>
                {user?.coins < value && <div style={{fontSize: '12px', color: '#ff4444'}}>❌</div>}
              </button>
            ))}
          </div>

          <button 
            className="btn-action btn-start" 
            onClick={startSearch}
            disabled={!user || user.coins < stake || !socket?.connected}
            style={{
              padding: '16px 40px',
              fontSize: '20px',
              borderRadius: '16px',
              border: 'none',
              background: (!user || user.coins < stake || !socket?.connected) ? '#555' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: (!user || user.coins < stake || !socket?.connected) ? 'not-allowed' : 'pointer',
              marginTop: '20px',
              fontWeight: 'bold',
              transition: 'transform 0.2s'
            }}
          >
            {!socket?.connected ? '🔌 Ulanish yo\'q' : '🚀 Jonli Raqib Qidirish'}
          </button>
        </div>
      )}

      {/* SEARCHING */}
      {gameState === 'searching' && (
        <div className="searching-container" style={{
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div className="radar-animation" style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            margin: '0 auto 20px'
          }}>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '4px solid #764ba2',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite 0.5s'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              border: '4px solid #00ff88',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite 1s'
            }}></div>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '30px'
            }}>🔍</div>
          </div>
          <h3>🔍 Jonli raqib qidirilmoqda...</h3>
          <p>Stavka: 🪙 {stake}</p>
          <p className="search-hint">⏳ O'rtacha 5-30 soniya davom etadi</p>
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
              marginTop: '20px'
            }}
          >
            ✖️ Bekor qilish
          </button>
        </div>
      )}

      {/* PLAYING */}
      {gameState === 'playing' && (
        <div className="arena-container">
          <div className="versus-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: '#1a1a2e',
            borderRadius: '16px',
            marginBottom: '20px'
          }}>
            <div className="fighter" style={{textAlign: 'center'}}>
              <div className="fighter-name" style={{fontSize: '18px', fontWeight: 'bold'}}>🥊 {user?.firstName || "Siz"}</div>
              <div className="fighter-stats" style={{fontSize: '14px', color: '#888'}}>🏆 {user?.rating || 0} XP</div>
            </div>
            <div className="arena-timer" style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: timer <= 5 ? '#ff4444' : '#00ff88'
            }}>
              <span className="timer-value">{timer}</span>
              <span className="timer-label" style={{fontSize: '16px', color: '#888'}}>s</span>
            </div>
            <div className="fighter" style={{textAlign: 'center'}}>
              <div className="fighter-name" style={{fontSize: '18px', fontWeight: 'bold'}}>🥷 {opponent?.name || "Raqib"}</div>
              <div className="fighter-stats" style={{fontSize: '14px', color: '#888'}}>🏆 {opponent?.rating || 0} XP</div>
            </div>
          </div>

          <div className="weapons-row" style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'rock' ? 'active' : ''} 
              onClick={() => submitChoice('rock')}
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                borderRadius: '12px',
                border: myChoice === 'rock' ? '3px solid #667eea' : '2px solid #444',
                background: myChoice === 'rock' ? '#667eea33' : '#222',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s'
              }}
            >
              🪨 Tosh
            </button>
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'paper' ? 'active' : ''} 
              onClick={() => submitChoice('paper')}
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                borderRadius: '12px',
                border: myChoice === 'paper' ? '3px solid #667eea' : '2px solid #444',
                background: myChoice === 'paper' ? '#667eea33' : '#222',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s'
              }}
            >
              📄 Qog'oz
            </button>
            <button 
              disabled={!!myChoice} 
              className={myChoice === 'scissors' ? 'active' : ''} 
              onClick={() => submitChoice('scissors')}
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                borderRadius: '12px',
                border: myChoice === 'scissors' ? '3px solid #667eea' : '2px solid #444',
                background: myChoice === 'scissors' ? '#667eea33' : '#222',
                color: 'white',
                cursor: myChoice ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s'
              }}
            >
              ✂️ Qaychi
            </button>
          </div>

          {myChoice && (
            <p className="wait-msg" style={{
              textAlign: 'center',
              color: '#888',
              fontSize: '16px'
            }}>
              ⏳ Siz {formatChoice(myChoice)} tanladingiz. Raqib yurishi kutilmoqda...
            </p>
          )}
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && roundResult && (
        <div className="result-container" style={{
          textAlign: 'center',
          padding: '20px'
        }}>
          <div className={`result-banner ${roundResult.result}`} style={{
            fontSize: '28px',
            fontWeight: 'bold',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '20px',
            background: roundResult.result === 'win' ? '#00ff8833' : 
                       roundResult.result === 'lose' ? '#ff444433' : '#ffaa0033',
            border: roundResult.result === 'win' ? '2px solid #00ff88' : 
                    roundResult.result === 'lose' ? '2px solid #ff4444' : '2px solid #ffaa00'
          }}>
            {roundResult.result === 'win' && "🎉 SIZ YUTDINGIZ!"}
            {roundResult.result === 'lose' && "😢 MAG'LUB BO'LDINGIZ"}
            {roundResult.result === 'draw' && "🤝 DURANG"}
          </div>
          
          <div className="battle-card" style={{
            background: '#1a1a2e',
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
                <span className="choice-label" style={{color: '#888', fontSize: '14px'}}>Siz</span>
                <span className="choice-value" style={{fontSize: '20px', display: 'block'}}>
                  {formatChoice(roundResult.myChoice)}
                </span>
              </div>
              <div className="vs-divider" style={{fontSize: '24px', color: '#667eea'}}>⚡</div>
              <div className="choice-display" style={{textAlign: 'center'}}>
                <span className="choice-label" style={{color: '#888', fontSize: '14px'}}>Raqib</span>
                <span className="choice-value" style={{fontSize: '20px', display: 'block'}}>
                  {formatChoice(roundResult.opponentChoice)}
                </span>
              </div>
            </div>
            
            <div className="financial-summary" style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              fontSize: '18px'
            }}>
              <span className={(roundResult.rewardCoins || 0) >= 0 ? "plus" : "minus"} style={{
                color: (roundResult.rewardCoins || 0) >= 0 ? '#00ff88' : '#ff4444'
              }}>
                {(roundResult.rewardCoins || 0) >= 0 
                  ? `+🪙 ${roundResult.rewardCoins}` 
                  : `-🪙 ${Math.abs(roundResult.rewardCoins || 0)}`}
              </span>
              <span className="xp-summary" style={{
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
              padding: '16px 40px',
              fontSize: '18px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
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
          padding: '40px 20px'
        }}>
          <h3>⚠️ Raqib o'yinni tark etdi!</h3>
          <p>O'yin xonasi yopildi. Sizga hech qanday jarima berilmadi.</p>
          <button 
            className="btn-action" 
            onClick={resetGame}
            style={{
              padding: '16px 40px',
              fontSize: '18px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              marginTop: '20px',
              fontWeight: 'bold'
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