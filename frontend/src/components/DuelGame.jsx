// ============================================================
// DuelGame.js - TO'LIQ VERSION (UZLUKSIZ RAUNDLAR + CHIQISH TUGMASI)
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
  // gameState: 'idle' | 'searching' | 'playing' | 'ended'
  const [gameState, setGameState] = useState('idle');
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundResult, setRoundResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState(null); // 'opponent_left' | 'opponent_disconnected' | 'insufficient_funds' | null (=o'zi chiqdi/normal)
  const [stake, setStake] = useState(10);
  const [socketError, setSocketError] = useState(null);
  const [queueLength, setQueueLength] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [opponentChoiceMade, setOpponentChoiceMade] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Socket callbacklar ichida eskirmagan holda o'qish uchun
  const gameStateRef = useRef(gameState);
  const isSearchingRef = useRef(isSearching);
  const stakeRef = useRef(stake);
  const roomIdRef = useRef(roomId);
  const nextRoundTimeoutRef = useRef(null);
  const startSearchRef = useRef(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // ======================
  // SCROLL CHAT TO BOTTOM
  // ======================
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // ======================
  // START SEARCH
  // ======================
  const startSearch = useCallback(() => {
    if (!user) {
      onNotification?.('⚠️ Iltimos avval tizimga kiring!', 'error');
      return;
    }

    if (!user.tgId || user.tgId === 'undefined' || user.tgId === 'null') {
      onNotification?.('⚠️ Foydalanuvchi ID si topilmadi!', 'error');
      return;
    }

    if ((user.coins || 0) < stakeRef.current) {
      onNotification?.(`⚠️ Yetarli tanga yo'q! ${stakeRef.current} 🪙 kerak`, 'error');
      return;
    }

    if (!socket) {
      setSocketError('Socket mavjud emas');
      onNotification?.('⚠️ Socket mavjud emas!', 'error');
      return;
    }

    if (!socket.connected) {
      setSocketError('Serverga ulanish yo\'q, qayta ulanmoqda...');
      socket.connect();

      setTimeout(() => {
        if (socket.connected) {
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

    setGameState('searching');
    setIsSearching(true);

    socket.emit('find_match', {
      player: playerData,
      stake: Number(stakeRef.current)
    });

  }, [user, socket, onNotification]);

  useEffect(() => { startSearchRef.current = startSearch; }, [startSearch]);

  // ======================
  // LEAVE DUEL (YANGI) - "Chiqish" tugmasi
  // ======================
  const leaveDuel = useCallback(() => {
    if (roomIdRef.current && socket) {
      socket.emit('leave_room', { roomId: roomIdRef.current });
      triggerHaptic?.('medium');
    }
  }, [socket, triggerHaptic]);

  // ======================
  // SOCKET EVENT HANDLERS
  // ======================
  useEffect(() => {
    if (!socket) return;

    const onSearching = (data) => {
      setGameState('searching');
      setIsSearching(true);
      if (data?.stake) setStake(data.stake);
      if (data?.queueLength !== undefined) setQueueLength(data.queueLength);
    };

    const onMatchFound = (data) => {
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      setStake(data.stake || stakeRef.current);
      setMyChoice(null);
      setRoundNumber(1);
      setRoundResult(null);
      setSessionEndReason(null);
      setGameState('playing');
      setIsSearching(false);
      setShowResult(false);
      setOpponentChoiceMade(false);
      setChatMessages([]);
      setUnreadCount(0);

      triggerHaptic?.('heavy');
      onNotification?.(`🎯 Raqib topildi! ${data.opponent?.name || 'Noma\'lum'} bilan duel!`, 'success');
    };

    // Stavka xona ochilganda/har yangi raundda serverda darhol "ushlab turiladi" (escrow).
    const onBalanceUpdated = (data) => {
      if (typeof data?.coins === 'number' && setUser) {
        setUser(prev => ({ ...prev, coins: data.coins }));
      }
    };

    const onTimerTick = (timeLeft) => {
      setTimer(timeLeft);
      if (timeLeft <= 5 && timeLeft > 0) triggerHaptic?.('light');
      if (timeLeft === 0) triggerHaptic?.('heavy');
    };

    const onOpponentChoiceMade = () => {
      setOpponentChoiceMade(true);
    };

    // Har raund natijasi serverdan keladi. Agar sessionContinues=true bo'lsa,
    // qisqa vaqt natija ko'rsatilib, keyin avtomatik yangi raundga o'tiladi
    // (next_round_started orqali). Aks holda duel butunlay tugaydi.
    const onRoundResult = (result) => {
      setRoundResult(result);
      setShowResult(true);
      setIsSearching(false);
      setOpponentChoiceMade(false);

      if (result.result === 'win') {
        triggerHaptic?.('heavy');
        onNotification?.(`🎉 Siz yutdingiz! +${result.rewardCoins} 🪙`, 'success');
      } else if (result.result === 'lose') {
        triggerHaptic?.('medium');
        onNotification?.(`😢 Mag'lub bo'ldingiz ${result.rewardCoins} 🪙`, 'error');
      } else {
        triggerHaptic?.('light');
        onNotification?.(`🤝 Durang — stavka qaytarildi`, 'info');
      }

      if (setUser) {
        setUser(prev => ({
          ...prev,
          coins: result.newCoins ?? prev?.coins ?? 0,
          rating: result.newRating ?? prev?.rating ?? 0,
          level: result.newLevel ?? prev?.level ?? 1,
          totalGames: (prev?.totalGames || 0) + 1,
          wins: (prev?.wins || 0) + (result.result === 'win' ? 1 : 0),
          losses: (prev?.losses || 0) + (result.result === 'lose' ? 1 : 0),
          draws: (prev?.draws || 0) + (result.result === 'draw' ? 1 : 0)
        }));
      }

      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);

      if (!result.sessionContinues) {
        // Duel shu yerda tugaydi
        nextRoundTimeoutRef.current = setTimeout(() => {
          setGameState('ended');
        }, 1200);
      } else {
        // Qisqa vaqtdan keyin natija oynasini yopib, yangi raundga tayyorlanamiz
        nextRoundTimeoutRef.current = setTimeout(() => {
          setShowResult(false);
          setMyChoice(null);
        }, 2200);
      }
    };

    const onNextRoundStarted = (data) => {
      if (data?.roundNumber) setRoundNumber(data.roundNumber);
      setOpponentChoiceMade(false);
    };

    const onChatMessage = (data) => {
      setChatMessages(prev => [...prev, data]);
      setShowChat(prevShow => {
        if (!prevShow) setUnreadCount(c => c + 1);
        return prevShow;
      });
    };

    // Raqib ulanishi uzildi (majburiy)
    const onOpponentLeft = () => {
      setSessionEndReason('opponent_disconnected');
      triggerHaptic?.('medium');
      onNotification?.('⚠️ Raqib bilan aloqa uzildi! Natija hisoblanmoqda...', 'error');
    };

    // Raqib "Chiqish" tugmasini bosdi (o'z hohishi bilan)
    const onOpponentLeftRoom = () => {
      setSessionEndReason('opponent_left');
      triggerHaptic?.('medium');
      onNotification?.('🚪 Raqib duelni tark etdi. Natija hisoblanmoqda...', 'info');
    };

    // Keyingi raund uchun kimdadir mablag' yetmadi - duel majburan tugaydi
    const onDuelEnded = (data) => {
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      if (data?.reason === 'insufficient_funds') {
        setSessionEndReason('insufficient_funds');
        onNotification?.('⚠️ Keyingi raund uchun mablag\' yetarli emas, duel tugadi.', 'error');
      }
      setShowResult(false);
      setGameState('ended');
    };

    const onError = (data) => {
      setSocketError(data?.message || 'Xatolik yuz berdi');
      onNotification?.(`⚠️ ${data?.message || 'Xatolik yuz berdi'}`, 'error');
      setGameState('idle');
      setIsSearching(false);
    };

    const onSearchCancelled = () => {
      setGameState('idle');
      setIsSearching(false);
      setQueueLength(0);
    };

    const onConnect = () => setSocketError(null);

    const onReconnect = () => {
      setSocketError(null);
      onNotification?.('✅ Serverga qayta ulandi!', 'success');
      if (gameStateRef.current === 'searching' && isSearchingRef.current) {
        startSearchRef.current?.();
      }
    };

    const onDisconnect = () => setSocketError('Serverdan uzildi');
    const onConnectError = () => setSocketError('Serverga ulanishda xatolik');

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('searching', onSearching);
    socket.on('match_found', onMatchFound);
    socket.on('balance_updated', onBalanceUpdated);
    socket.on('timer_tick', onTimerTick);
    socket.on('opponent_choice_made', onOpponentChoiceMade);
    socket.on('round_result', onRoundResult);
    socket.on('next_round_started', onNextRoundStarted);
    socket.on('chat_message', onChatMessage);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('opponent_left_room', onOpponentLeftRoom);
    socket.on('duel_ended', onDuelEnded);
    socket.on('error', onError);
    socket.on('search_cancelled', onSearchCancelled);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('searching', onSearching);
      socket.off('match_found', onMatchFound);
      socket.off('balance_updated', onBalanceUpdated);
      socket.off('timer_tick', onTimerTick);
      socket.off('opponent_choice_made', onOpponentChoiceMade);
      socket.off('round_result', onRoundResult);
      socket.off('next_round_started', onNextRoundStarted);
      socket.off('chat_message', onChatMessage);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('opponent_left_room', onOpponentLeftRoom);
      socket.off('duel_ended', onDuelEnded);
      socket.off('error', onError);
      socket.off('search_cancelled', onSearchCancelled);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
    // Diqqat: bu ro'yxatda ataylab faqat "socket" qoldirilgan. `user`, `startSearch`
    // kabi har raundda o'zgaradigan qiymatlarni bu yerga qo'shish har safar bu
    // effect'ni qayta ishga tushirib (socket.off/on), o'zimiz qo'ygan
    // nextRoundTimeoutRef'ni bekor qilib yuborardi - shu sabab 2-raundda
    // tanlov tugmalari hech qachon qaytmasdi. `user`ga muhtoj joylar
    // (startSearch, sendChatMessage) alohida ref/useCallback orqali ishlaydi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Xavfsizlik to'ri: komponent faol duel davomida ekrandan chiqib ketsa
  // (masalan boshqa ekranga o'tilsa), xonani ham tark etamiz - aks holda
  // socket ilova bo'ylab umumiy bo'lgani uchun duel "osilib" qolib,
  // raqib har raundda vaqt tugashi bilan "yutib" o'tiraveradi.
  useEffect(() => {
    return () => {
      if (roomIdRef.current && (gameStateRef.current === 'playing')) {
        socket?.emit('leave_room', { roomId: roomIdRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================
  // CANCEL SEARCH
  // ======================
  const cancelSearch = useCallback(() => {
    if (socket) socket.emit('cancel_search');
    setGameState('idle');
    setIsSearching(false);
    setQueueLength(0);
  }, [socket]);

  // ======================
  // SUBMIT CHOICE
  // ======================
  const submitChoice = useCallback((choice) => {
    if (!socket || !roomId) {
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
  // MUHIM: bu yerda xabar LOKAL ravishda qo'shilmaydi. Backend
  // `io.to(roomId).emit('chat_message', ...)` orqali xabarni xona ichidagi
  // HAMMAGA (jumladan yuboruvchining o'ziga ham) qaytarib yuboradi.
  // Agar shu yerda ham lokal qo'shsak, yuboruvchi xabarni ikki marta ko'rardi.
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !roomId || !socket) return;

    const message = chatInput.trim();
    setChatInput('');

    socket.emit('chat_message', { roomId, message });
  }, [chatInput, roomId, socket]);

  // ======================
  // TOGGLE CHAT
  // ======================
  const toggleChat = useCallback(() => {
    setShowChat(prev => {
      if (!prev) {
        setUnreadCount(0);
        setTimeout(() => chatInputRef.current?.focus(), 100);
      }
      return !prev;
    });
  }, []);

  // ======================
  // RESET GAME (yangi duel qidirish uchun)
  // ======================
  const resetGame = useCallback(() => {
    setGameState('idle');
    setRoundResult(null);
    setSessionEndReason(null);
    setMyChoice(null);
    setOpponent(null);
    setRoomId(null);
    setRoundNumber(1);
    setTimer(30);
    setIsSearching(false);
    setQueueLength(0);
    setShowResult(false);
    setOpponentChoiceMade(false);
    setChatMessages([]);
    setShowChat(false);
    setUnreadCount(0);
  }, []);

  // Bosh menyuga qaytish - agar duel faol bo'lsa, avval uni tark etamiz
  const goToMenu = useCallback(() => {
    if (roomId && gameState === 'playing') {
      leaveDuel();
    } else if (gameState === 'searching') {
      cancelSearch();
    }
    resetGame();
    onBack();
  }, [roomId, gameState, leaveDuel, cancelSearch, resetGame, onBack]);

  // ======================
  // FORMAT FUNCTIONS
  // ======================
  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    if (str === 'timeout') return '⏳ Kechikdi';
    if (str === 'disconnected') return '🔌 Chiqib ketdi';
    if (str === 'left') return '🚪 Chiqdi';
    return '❓ Noma\'lum';
  };

  const getChoiceEmoji = (str) => {
    if (str === 'rock') return '🪨';
    if (str === 'paper') return '📄';
    if (str === 'scissors') return '✂️';
    return '❓';
  };

  const getChoiceName = (str) => {
    if (str === 'rock') return 'Tosh';
    if (str === 'paper') return 'Qog\'oz';
    if (str === 'scissors') return 'Qaychi';
    if (str === 'timeout') return 'Kechikdi';
    if (str === 'disconnected') return 'Chiqib ketdi';
    if (str === 'left') return 'Chiqdi';
    return '';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  };

  const endReasonText = () => {
    if (sessionEndReason === 'opponent_left') return '🚪 Raqib duelni tark etdi';
    if (sessionEndReason === 'opponent_disconnected') return '🔌 Raqib bilan aloqa uzildi';
    if (sessionEndReason === 'insufficient_funds') return '💸 Keyingi raund uchun mablag\' yetarli emas';
    return null;
  };

  // ======================
  // RENDER
  // ======================
  return (
    <div className="duel-game">
      {/* Back Button */}
      <button className="duel-back-btn" onClick={goToMenu}>
        ⬅️ Menuga Qaytish
      </button>

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
            <p className="duel-stake-hint">
              🔒 Har raund boshlanganda stavka hamyoningizdan ushlab turiladi.
              Duel siz "Chiqish" tugmasini bosmaguningizcha yangi raundlar bilan
              davom etadi. G'alaba qozonsangiz — stavkangiz + raqibniki qaytariladi.
            </p>
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

      {/* ===== PLAYING (raund davom etmoqda yoki natija ko'rsatilmoqda) ===== */}
      {gameState === 'playing' && (
        <div className="duel-playing">
          <div className="duel-round-badge">Raund #{roundNumber}</div>

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
              {myChoice && !showResult && (
                <div className="duel-player-choice">✅ {formatChoice(myChoice)}</div>
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
              {opponentChoiceMade && !showResult && (
                <div className="duel-player-choice" style={{ color: '#ffaa00' }}>
                  ⏳ Tanlov qildi
                </div>
              )}
              {!opponentChoiceMade && myChoice && !showResult && (
                <div className="duel-player-choice" style={{ color: '#888' }}>
                  ⏳ Kutilmoqda...
                </div>
              )}
            </div>
          </div>

          {/* Raund natijasi - qisqa muddatli overlay */}
          {showResult && roundResult && (
            <div className={`duel-round-overlay ${roundResult.result}`}>
              <div className="duel-round-overlay-banner">
                {roundResult.result === 'win' && '🎉 Bu raundni yutdingiz!'}
                {roundResult.result === 'lose' && '😢 Bu raundda mag\'lub bo\'ldingiz'}
                {roundResult.result === 'draw' && '🤝 Durang'}
              </div>
              <div className="duel-round-overlay-choices">
                <span>{getChoiceEmoji(roundResult.myChoice)} {getChoiceName(roundResult.myChoice)}</span>
                <span>vs</span>
                <span>{getChoiceEmoji(roundResult.opponentChoice)} {getChoiceName(roundResult.opponentChoice)}</span>
              </div>
              <div className="duel-round-overlay-reward">
                {roundResult.rewardCoins >= 0 ? '+' : ''}{roundResult.rewardCoins} 🪙
              </div>
              {roundResult.sessionContinues ? (
                <p className="duel-round-overlay-hint">⏳ Keyingi raund boshlanmoqda...</p>
              ) : (
                <p className="duel-round-overlay-hint">🏁 Duel yakunlanmoqda...</p>
              )}
            </div>
          )}

          {!showResult && (
            <>
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
            </>
          )}

          {/* Chiqish tugmasi - istalgan vaqtda duel to'liq yakunlanadi */}
          <button className="duel-leave-btn" onClick={leaveDuel}>
            🚪 Duelni tark etish
          </button>

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

      {/* ===== ENDED - duel butunlay yakunlangan ===== */}
      {gameState === 'ended' && roundResult && (
        <div className="duel-result">
          {endReasonText() && (
            <div className="duel-end-reason">{endReasonText()}</div>
          )}

          <div className={`duel-result-banner ${roundResult.result}`}>
            {roundResult.result === 'win' && '🎉 SO\'NGGI RAUNDNI YUTDINGIZ!'}
            {roundResult.result === 'lose' && '😢 SO\'NGGI RAUNDDA MAG\'LUB BO\'LDINGIZ'}
            {roundResult.result === 'draw' && '🤝 SO\'NGGI RAUND DURANG'}
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
                <span className="stat-value">{roundResult.newCoins ?? user?.coins ?? 0}</span>
              </div>
              <div className="duel-result-stat">
                <span>🏆 Yangi reyting</span>
                <span className="stat-value">{roundResult.newRating ?? user?.rating ?? 0}</span>
              </div>
              <div className="duel-result-stat">
                <span>📊 Yangi level</span>
                <span className="stat-value">{roundResult.newLevel ?? user?.level ?? 1}</span>
              </div>
              <div className="duel-result-stat">
                <span>🔁 Jami raundlar</span>
                <span className="stat-value">{roundNumber}</span>
              </div>
            </div>
          </div>

          <div className="duel-result-buttons">
            <button className="duel-restart-btn" onClick={() => { resetGame(); startSearch(); }}>
              🔄 Yana O'ynash
            </button>
            <button className="duel-menu-btn" onClick={() => { resetGame(); onBack(); }}>
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
        .duel-round-badge {
          text-align: center;
          font-size: 12px;
          color: #888;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 4px 10px;
          display: inline-block;
          margin: 0 auto 10px;
        }
        .duel-round-overlay {
          text-align: center;
          padding: 20px 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          margin: 12px 0;
          animation: slideUp 0.25s ease-out;
        }
        .duel-round-overlay.win { border-color: rgba(67,233,123,0.4); }
        .duel-round-overlay.lose { border-color: rgba(255,68,68,0.4); }
        .duel-round-overlay.draw { border-color: rgba(255,170,0,0.4); }
        .duel-round-overlay-banner {
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .duel-round-overlay-choices {
          display: flex;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          color: #ccc;
          margin-bottom: 8px;
        }
        .duel-round-overlay-reward {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .duel-round-overlay-hint {
          font-size: 12px;
          color: #888;
          margin: 0;
        }
        .duel-leave-btn {
          display: block;
          margin: 14px auto 0;
          padding: 10px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255,68,68,0.3);
          background: rgba(255,68,68,0.08);
          color: #ff6b6b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .duel-leave-btn:hover {
          background: rgba(255,68,68,0.16);
        }
        .duel-end-reason {
          text-align: center;
          font-size: 13px;
          color: #ffaa00;
          background: rgba(255,170,0,0.08);
          border: 1px solid rgba(255,170,0,0.2);
          border-radius: 10px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }
        .duel-stake-hint {
          font-size: 11px;
          color: #777;
          text-align: center;
          margin-top: 10px;
          line-height: 1.5;
          padding: 0 8px;
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