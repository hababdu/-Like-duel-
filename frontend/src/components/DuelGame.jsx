// ============================================================
// DuelGame.js - TO'LIQ VERSION
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';

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
  const [gameState, setGameState] = useState('idle');
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
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Debug
  const [debugLog, setDebugLog] = useState([]);

  // ======================
  // DEBUG LOG
  // ======================
  const addDebug = (msg) => {
    const log = { time: new Date().toLocaleTimeString(), msg };
    setDebugLog(prev => [...prev.slice(-10), log]);
    console.log('🔍', msg);
  };

  // ======================
  // SCROLL CHAT TO BOTTOM
  // ======================
  const scrollChatToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

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

    const onSearching = (data) => {
      addDebug(`🔍 Searching: ${JSON.stringify(data)}`);
      setGameState('searching');
      setIsSearching(true);
      if (data?.stake) setStake(data.stake);
      if (data?.queueLength !== undefined) setQueueLength(data.queueLength);
    };

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
      setChatMessages([]);
      setUnreadCount(0);
      
      addDebug(`✅ Opponent: ${data.opponent?.name}`);
      addDebug(`🖼️ Opponent photo: ${data.opponent?.photoUrl ? '✅' : '❌'}`);
      
      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`, 'success');
    };

    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) {
        triggerHaptic?.('light');
      }
      if (timeLeft === 0) {
        triggerHaptic?.('heavy');
      }
    };

    const onOpponentChoiceMade = () => {
      addDebug(`👀 Opponent made choice`);
      setOpponentChoiceMade(true);
    };

    const onRoundResult = (result) => {
      addDebug(`📊 Round result: ${JSON.stringify(result)}`);
      setRoundResult(result);
      setGameState('result');
      setShowResult(true);
      setIsSearching(false);
      
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
      
      if (setUser && user) {
        setUser(prev => ({
          ...prev,
          coins: Math.max(0, (prev?.coins || 0) + (result.rewardCoins || 0)),
          rating: Math.max(0, (prev?.rating || 0) + (result.rewardXP || 0)),
          totalGames: (prev?.totalGames || 0) + 1,
          wins: (prev?.wins || 0) + (result.result === 'win' ? 1 : 0),
          losses: (prev?.losses || 0) + (result.result === 'lose' ? 1 : 0),
          draws: (prev?.draws || 0) + (result.result === 'draw' ? 1 : 0),
          level: result.newLevel || prev?.level || 1
        }));
      }
    };

    const onChatMessage = (data) => {
      addDebug(`💬 Chat: ${data.name}: ${data.message}`);
      setChatMessages(prev => [...prev, data]);
      if (!showChat) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const onOpponentLeft = () => {
      addDebug('🚪 Opponent left');
      setGameState('opponent_left');
      setIsSearching(false);
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib o\'yinni tark etdi!', 'error');
    };

    const onError = (data) => {
      addDebug(`❌ Error: ${JSON.stringify(data)}`);
      setSocketError(data?.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data?.message || 'Xatolik yuz berdi'}`, 'error');
      setGameState('idle');
      setIsSearching(false);
    };

    const onSearchCancelled = () => {
      addDebug('🔴 Search cancelled');
      setGameState('idle');
      setIsSearching(false);
      setQueueLength(0);
    };

    const onConnect = () => {
      addDebug(`✅ Socket connected: ${socket.id}`);
      setSocketError(null);
    };

    const onReconnect = () => {
      addDebug('🔄 Socket reconnected');
      setSocketError(null);
      onNotification?.('✅ Serverga qayta ulandi!', 'success');
      
      if (gameState === 'searching' && isSearching) {
        addDebug('🔄 Retrying search after reconnect...');
        startSearch();
      }
    };

    const onDisconnect = () => {
      addDebug('❌ Socket disconnected');
      setSocketError('Serverdan uzildi');
    };

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', (error) => {
      addDebug(`❌ Connect error: ${error.message}`);
      setSocketError('Serverga ulanishda xatolik');
    });
    socket.on('searching', onSearching);
    socket.on('match_found', onMatchFound);
    socket.on('timer_tick', onTimerTick);
    socket.on('opponent_choice_made', onOpponentChoiceMade);
    socket.on('round_result', onRoundResult);
    socket.on('chat_message', onChatMessage);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('error', onError);
    socket.on('search_cancelled', onSearchCancelled);

    return () => {
      addDebug('🧹 Cleaning up DuelGame');
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error');
      socket.off('searching', onSearching);
      socket.off('match_found', onMatchFound);
      socket.off('timer_tick', onTimerTick);
      socket.off('opponent_choice_made', onOpponentChoiceMade);
      socket.off('round_result', onRoundResult);
      socket.off('chat_message', onChatMessage);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('error', onError);
      socket.off('search_cancelled', onSearchCancelled);
    };
  }, [socket, triggerHaptic, onNotification, setUser, user, stake, gameState, isSearching]);

  // ======================
  // START SEARCH
  // ======================
  const startSearch = useCallback(() => {
    addDebug('🚀 Starting search...');
    addDebug(`📊 User: ${user?.tgId} - ${user?.firstName}`);
    addDebug(`📊 Stake: ${stake}`);
    addDebug(`🔌 Socket connected: ${socket?.connected}`);

    if (!user) {
      onNotification?.('⚠️ Iltimos avval tizimga kiring!', 'error');
      return;
    }

    if (!user.tgId || user.tgId === 'undefined' || user.tgId === 'null') {
      onNotification?.('⚠️ Foydalanuvchi ID si topilmadi!', 'error');
      return;
    }

    if ((user.coins || 0) < stake) {
      onNotification?.(`⚠️ Yetarli tanga yo'q! ${stake} 🪙 kerak`, 'error');
      return;
    }

    if (!socket) {
      setSocketError('Socket mavjud emas');
      onNotification?.('⚠️ Socket mavjud emas!', 'error');
      return;
    }

    if (!socket.connected) {
      addDebug('🔄 Socket not connected, trying to connect...');
      setSocketError('Serverga ulanish yo\'q, qayta ulanmoqda...');
      socket.connect();
      
      setTimeout(() => {
        if (socket.connected) {
          addDebug('✅ Socket reconnected, retrying search...');
          startSearch();
        } else {
          setSocketError('Serverga ulanish yo\'q');
          onNotification?.('⚠️ Serverga ulanish yo\'q!', 'error');
        }
      }, 2000);
      return;
    }

    const playerData = {
      tgId: String(user.tgId),
      firstName: user.firstName || "O'yinchi",
      username: user.username || '',
      rating: user.rating || 100,
      coins: user.coins || 0,
      level: user.level || 1,
      photoUrl: user.photoUrl || ''
    };

    addDebug(`📤 Emitting find_match with tgId: ${playerData.tgId}`);
    
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
    
    setMyChoice(choice);
    socket.emit('make_choice', { roomId, choice });
    triggerHaptic?.('light');
    onNotification?.('⏳ Raqib tanlovi kutilmoqda...', 'info');
    
  }, [socket, roomId, triggerHaptic, onNotification]);

  // ======================
  // SEND CHAT MESSAGE
  // ======================
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !roomId || !socket) return;
    
    const message = chatInput.trim();
    setChatInput('');
    
    socket.emit('chat_message', { roomId, message });
    
    const chatData = {
      tgId: user?.tgId,
      name: user?.firstName || "Siz",
      photoUrl: user?.photoUrl || '',
      message: message,
      timestamp: new Date().toISOString(),
      isMine: true
    };
    setChatMessages(prev => [...prev, chatData]);
    
  }, [chatInput, roomId, socket, user]);

  // ======================
  // TOGGLE CHAT
  // ======================
  const toggleChat = useCallback(() => {
    setShowChat(prev => {
      if (!prev) {
        setUnreadCount(0);
        setTimeout(() => {
          if (chatInputRef.current) {
            chatInputRef.current.focus();
          }
        }, 100);
      }
      return !prev;
    });
  }, []);

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
    setChatMessages([]);
    setShowChat(false);
    setUnreadCount(0);
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
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
          <div className="duel-searching-progress">
            <div className="duel-progress-bar">
              <div className="duel-progress-fill" style={{ 
                width: `${Math.min(100, (30 - timer) * 3.33)}%` 
              }} />
            </div>
          </div>
          <div className="duel-searching-buttons">
            <button className="duel-cancel-btn" onClick={cancelSearch}>
              ✖️ Bekor qilish
            </button>
            <button 
              className="duel-retry-btn" 
              onClick={startSearch}
              disabled={!socket?.connected}
            >
              🔄 Qayta urinish
            </button>
          </div>
          {!socket?.connected && (
            <p className="duel-searching-error">🔴 Serverga ulanish yo'q, qayta ulanish kutilmoqda...</p>
          )}
        </div>
      )}

      {/* ===== PLAYING ===== */}
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

          {/* Chat Toggle */}
          <button className="duel-chat-toggle" onClick={toggleChat}>
            💬 {unreadCount > 0 && <span className="chat-unread">{unreadCount}</span>}
          </button>

          {/* Chat Window */}
          {showChat && (
            <div className="duel-chat-window">
              <div className="duel-chat-header">
                <span>💬 Chat</span>
                <button onClick={toggleChat}>✕</button>
              </div>
              <div className="duel-chat-messages">
                {chatMessages.length === 0 ? (
                  <div className="duel-chat-empty">
                    <p>💭 Xabarlar yo'q</p>
                    <p className="duel-chat-hint">Raqib bilan suhbatlashing!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`duel-chat-message ${msg.tgId === user?.tgId ? 'mine' : 'theirs'}`}
                    >
                      <div className="duel-chat-avatar">
                        {msg.photoUrl ? (
                          <img src={msg.photoUrl} alt={msg.name} />
                        ) : (
                          <span>{msg.name?.charAt(0) || '?'}</span>
                        )}
                      </div>
                      <div className="duel-chat-content">
                        <div className="duel-chat-name">
                          {msg.name}
                          <span className="duel-chat-time">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className="duel-chat-text">{msg.message}</div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="duel-chat-input">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Xabar yozing..."
                  maxLength={100}
                />
                <button onClick={sendChatMessage} disabled={!chatInput.trim()}>
                  📤
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== RESULT ===== */}
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

      {/* ===== OPPONENT LEFT ===== */}
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
        @keyframes radarPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .duel-searching-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 16px;
        }
        .duel-retry-btn {
          padding: 12px 24px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #43e97b, #38f9d7);
          color: #0f0c29;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .duel-retry-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(67,233,123,0.4);
        }
        .duel-retry-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .duel-searching-error {
          color: #ff4444;
          font-size: 13px;
          margin-top: 12px;
          animation: blink 1s ease-in-out infinite;
        }
        .duel-chat-toggle {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(102,126,234,0.4);
          transition: all 0.3s;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .duel-chat-toggle .chat-unread {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ff4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          min-width: 20px;
          height: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }
        .duel-chat-window {
          position: fixed;
          bottom: 140px;
          right: 20px;
          width: 320px;
          max-height: 400px;
          background: rgba(15,12,41,0.95);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease-out;
          z-index: 101;
          overflow: hidden;
        }
        .duel-chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }
        .duel-chat-header span {
          font-weight: 600;
          font-size: 14px;
          color: #888;
        }
        .duel-chat-header button {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }
        .duel-chat-messages {
          flex: 1;
          padding: 12px 16px;
          overflow-y: auto;
          max-height: 250px;
          min-height: 100px;
        }
        .duel-chat-messages::-webkit-scrollbar {
          width: 3px;
        }
        .duel-chat-messages::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
        }
        .duel-chat-messages::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 2px;
        }
        .duel-chat-empty {
          text-align: center;
          padding: 20px 0;
          color: #666;
        }
        .duel-chat-empty p {
          margin: 0;
          font-size: 14px;
        }
        .duel-chat-hint {
          font-size: 12px !important;
          color: #444 !important;
          margin-top: 4px !important;
        }
        .duel-chat-message {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          animation: slideUp 0.2s ease-out;
        }
        .duel-chat-message.mine {
          flex-direction: row-reverse;
        }
        .duel-chat-message.mine .duel-chat-content {
          align-items: flex-end;
        }
        .duel-chat-message.mine .duel-chat-text {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          border-radius: 12px 4px 12px 12px;
        }
        .duel-chat-message .duel-chat-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.1);
        }
        .duel-chat-message .duel-chat-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .duel-chat-message .duel-chat-avatar span {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
        }
        .duel-chat-message .duel-chat-content {
          display: flex;
          flex-direction: column;
          max-width: 70%;
        }
        .duel-chat-message .duel-chat-name {
          font-size: 11px;
          color: #888;
          margin-bottom: 2px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .duel-chat-message .duel-chat-time {
          font-size: 9px;
          color: #555;
        }
        .duel-chat-message .duel-chat-text {
          padding: 8px 12px;
          border-radius: 4px 12px 12px 12px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-size: 13px;
          word-wrap: break-word;
          line-height: 1.4;
        }
        .duel-chat-input {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
        }
        .duel-chat-input input {
          flex: 1;
          padding: 8px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .duel-chat-input input:focus {
          border-color: #667eea;
        }
        .duel-chat-input input::placeholder {
          color: #555;
        }
        .duel-chat-input button {
          padding: 8px 14px;
          border-radius: 20px;
          border: none;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          font-size: 16px;
          cursor: pointer;
        }
        .duel-chat-input button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (max-width: 480px) {
          .duel-chat-window {
            right: 10px;
            left: 10px;
            width: auto;
            bottom: 130px;
            max-height: 350px;
          }
          .duel-chat-messages {
            max-height: 200px;
            min-height: 80px;
          }
          .duel-chat-toggle {
            bottom: 70px;
            right: 16px;
            width: 48px;
            height: 48px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default DuelGame;