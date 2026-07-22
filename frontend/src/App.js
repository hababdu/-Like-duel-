import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ============================================================
// TO'LIQ QAYTA YOZILGAN APP - LIKE-DUEL
// ============================================================

function App() {
  // ======================
  // STATE'LAR
  // ======================
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [leaders, setLeaders] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralBonus, setReferralBonus] = useState(0);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [notification, setNotification] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // O'YIN STATE'LARI
  const [gameState, setGameState] = useState('idle');
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [timer, setTimer] = useState(30);
  const [myChoice, setMyChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [stake, setStake] = useState(10);
  const [searching, setSearching] = useState(false);
  const [socketError, setSocketError] = useState(null);

  // ======================
  // REF'LAR
  // ======================
  const socketRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // ======================
  // KONSTANTALAR
  // ======================
  const BACKEND_URL = 'https://telegram-bot-server-2-matj.onrender.com';
  const WS_URL = 'wss://telegram-bot-server-2-matj.onrender.com';
  const BOT_USERNAME = 'like_duel_bot';

  // ======================
  // 1. TELEGRAM WEBAPP BOSHLANG'ICH SOZLAMALAR
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
          tg.ready();
          tg.expand();
          
          const tgUser = tg.initDataUnsafe?.user;
          const startParam = tg.initDataUnsafe?.start_param;

          if (tgUser) {
            // Serverga auth so'rovi
            const response = await fetch(`${BACKEND_URL}/api/user/auth`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tgId: String(tgUser.id),
                username: tgUser.username || '',
                firstName: tgUser.first_name || "O'yinchi",
                lastName: tgUser.last_name || '',
                photoUrl: tgUser.photo_url || '',
                refParent: startParam ? String(startParam) : null
              })
            });
            
            const data = await response.json();
            
            if (data.success && data.user) {
              setUser(data.user);
              
              // Referral bonus notification
              if (data.isNewUser && data.referralBonus > 0) {
                showNotification('🎉 Siz va do\'stingiz 100 tangadan bonus oldingiz!');
              }
              
              // Referral statistikasini yuklash
              if (data.user.tgId) {
                fetchReferrals(data.user.tgId);
              }
            } else {
              // Fallback: test user
              setTestUser();
            }
          } else {
            setTestUser();
          }
        } else {
          setTestUser();
        }
      } catch (error) {
        console.error('Initialize error:', error);
        setTestUser();
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ======================
  // 2. TEST USER (FALLBACK)
  // ======================
  const setTestUser = () => {
    setUser({
      tgId: '123456789',
      firstName: 'Habibullo',
      username: 'habibullo_dev',
      coins: 300,
      rating: 150,
      totalGames: 0,
      wins: 0,
      losses: 0,
      isRefRewarded: false
    });
  };

  // ======================
  // 3. NOTIFICATION
  // ======================
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
  };

  // ======================
  // 4. REFERRAL FUNKSIYALARI
  // ======================
  const fetchReferrals = async (tgId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/${tgId}/referrals`);
      const data = await response.json();
      
      if (data.success) {
        setReferrals(data.data.referrals || []);
        setReferralCount(data.data.count || 0);
        setReferralBonus(data.data.totalBonus || 0);
      }
    } catch (error) {
      console.error('Referral fetch error:', error);
    }
  };

  const getReferralLink = async () => {
    if (!user) return null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/generate-referral-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.tgId })
      });
      
      const data = await response.json();
      if (data.success) {
        return data.data.link;
      }
    } catch (error) {
      console.error('Referral link error:', error);
    }
    return `https://t.me/${BOT_USERNAME}/app?startapp=${user.tgId}`;
  };

  const copyReferralLink = async () => {
    const link = await getReferralLink();
    if (!link) {
      showNotification('❌ Referal link yaratishda xatolik');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      showNotification('✅ Havola nusxalandi!');
    } catch (error) {
      alert(`🔗 Taklif havolasi:\n\n${link}`);
    }
  };

  // ======================
  // 5. LEADERBOARD
  // ======================
  const fetchLeaderboard = async () => {
    setLeadersLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/leaderboard`);
      const data = await response.json();
      
      if (data.success) {
        setLeaders(data.leaders || []);
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
    } finally {
      setLeadersLoading(false);
    }
  };

  // ======================
  // 6. SOCKET.IO ULAGI - TO'LIQ QAYTA YOZILGAN
  // ======================
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    try {
      import('socket.io-client').then(({ io }) => {
        socketRef.current = io(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 30000,
          autoConnect: true,
          forceNew: true,
          withCredentials: true
        });

        const socket = socketRef.current;

        // ULANGANDA
        socket.on('connect', () => {
          console.log('✅ Socket connected');
          setSocketConnected(true);
          setSocketError(null);
          
          if (user) {
            socket.emit('user_connect', {
              tgId: String(user.tgId),
              firstName: user.firstName || "O'yinchi"
            });
          }
        });

        // ULANGANDA XATOLIK
        socket.on('connect_error', (err) => {
          console.error('❌ Socket connect error:', err);
          setSocketError('Serverga ulanishda xatolik');
          setSocketConnected(false);
        });

        // UZILGANDA
        socket.on('disconnect', (reason) => {
          console.log('❌ Socket disconnected:', reason);
          setSocketConnected(false);
        });

        // USER CONNECTED
        socket.on('user_connected', (data) => {
          console.log('✅ User connected:', data);
          if (data.success && data.user) {
            setUser(prev => ({ ...prev, ...data.user }));
          }
        });

        // QIDIRUV
        socket.on('searching', (data) => {
          console.log('🔍 Searching:', data);
          setSearching(true);
          if (data?.stake) setStake(data.stake);
        });

        // MATCH TOPILDI
        socket.on('match_found', (data) => {
          console.log('🎯 Match found:', data);
          setRoomId(data.roomId);
          setOpponent(data.opponent);
          if (data.stake) setStake(data.stake);
          setMyChoice(null);
          setRoundResult(null);
          setGameState('playing');
          setSearching(false);
          
          showNotification(`🎯 Raqib topildi! ${data.opponent.name} bilan duel!`);
        });

        // TIMER
        socket.on('timer_tick', (timeLeft) => {
          setTimer(timeLeft);
        });

        // NATIJA
        socket.on('round_result', (result) => {
          console.log('📊 Round result:', result);
          setRoundResult(result);
          setGameState('result');
          
          // Balansni yangilash
          if (user) {
            setUser(prev => ({
              ...prev,
              coins: Math.max(0, (prev?.coins || 0) + (result.rewardCoins || 0)),
              rating: Math.max(0, (prev?.rating || 0) + (result.rewardXP || 0)),
              totalGames: (prev?.totalGames || 0) + 1,
              wins: (prev?.wins || 0) + (result.result === 'win' ? 1 : 0),
              losses: (prev?.losses || 0) + (result.result === 'lose' ? 1 : 0)
            }));
          }
          
          if (result.result === 'win') {
            showNotification('🎉 Siz yutdingiz!');
          } else if (result.result === 'lose') {
            showNotification('😢 Mag\'lub bo\'ldingiz');
          } else {
            showNotification('🤝 Durang');
          }
        });

        // RAQIB KETDI
        socket.on('opponent_left', () => {
          console.log('🚪 Opponent left');
          setGameState('opponent_left');
          showNotification('⚠️ Raqib o\'yinni tark etdi!');
        });

        // XATOLIK
        socket.on('error', (data) => {
          console.error('❌ Server error:', data);
          setSocketError(data.message || 'Xatolik yuz berdi');
          showNotification(`⚠️ ${data.message || 'Xatolik yuz berdi'}`);
        });

        // USER STATUS
        socket.on('user_status', (data) => {
          // Online/offline status
        });

        // PONG
        socket.on('pong', () => {
          // Keepalive
        });
      });
    } catch (error) {
      console.error('Socket init error:', error);
      setSocketError('Socket yaratishda xatolik');
    }
  }, [WS_URL, user]);

  // Socket ulanishi
  useEffect(() => {
    if (user) {
      connectSocket();
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, connectSocket]);

  // ======================
  // 7. O'YIN FUNKSIYALARI
  // ======================
  const startSearch = () => {
    if (!user || user.coins < stake) {
      showNotification('⚠️ Yetarli tanga yo\'q!');
      return;
    }

    if (!socketConnected) {
      showNotification('⚠️ Serverga ulanish yo\'q!');
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
    socketRef.current.emit('find_match', {
      player: playerData,
      stake: Number(stake)
    });
  };

  const cancelSearch = () => {
    if (socketRef.current) {
      socketRef.current.emit('cancel_search');
    }
    setSearching(false);
    setGameState('idle');
  };

  const submitChoice = (choice) => {
    if (!socketRef.current || !roomId) return;
    
    setMyChoice(choice);
    socketRef.current.emit('player_choice', { roomId, choice });
  };

  const resetGame = () => {
    setGameState('idle');
    setRoundResult(null);
    setMyChoice(null);
    setOpponent(null);
    setRoomId(null);
    setTimer(30);
    setSearching(false);
  };

  // ======================
  // 8. USER MA'LUMOTLARINI YANGILASH
  // ======================
  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: String(user.tgId),
          firstName: user.firstName || "O'yinchi",
          username: user.username || ""
        })
      });
      
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  // ======================
  // 9. FORMAT FUNKSIYALARI
  // ======================
  const formatChoice = (str) => {
    if (str === 'rock') return '🪨 Tosh';
    if (str === 'paper') return '📄 Qog\'oz';
    if (str === 'scissors') return '✂️ Qaychi';
    if (str === 'timeout') return '⏳ Kechikdi';
    return '❓ Noma\'lum';
  };

  // ============================================================
  // 10. LOADING
  // ============================================================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Like-Duel yuklanmoqda...</p>
      </div>
    );
  }

  // ============================================================
  // 11. REFERRAL MODAL
  // ============================================================
  const ReferralModal = () => {
    if (!showReferralModal) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowReferralModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>👥 Do'stlarni Taklif Qilish</h3>
            <button className="modal-close" onClick={() => setShowReferralModal(false)}>✕</button>
          </div>
          
          <div className="modal-body">
            <div className="referral-stats">
              <div className="stat-item">
                <span className="stat-label">👥 Taklif qilinganlar</span>
                <span className="stat-value">{referralCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">🪙 Bonus</span>
                <span className="stat-value">{referralBonus}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">💰 Jami tangalar</span>
                <span className="stat-value">{user?.coins || 0}</span>
              </div>
            </div>

            <div className="referral-link-box">
              <button className="btn-copy" onClick={copyReferralLink}>
                📋 Taklif havolasini nusxalash
              </button>
            </div>

            <div className="referral-info">
              <p>💡 Har bir taklif qilgan do'stingiz uchun sizga <strong>100 tanga</strong> bonus!</p>
              <p>🎯 Do'stingiz ham <strong>100 tanga</strong> boshlang'ich bonus oladi!</p>
            </div>

            {referrals.length > 0 && (
              <div className="referral-list">
                <h4>📋 Taklif qilinganlar:</h4>
                {referrals.map((ref, index) => (
                  <div key={ref._id || index} className="referral-item">
                    <span className="ref-name">👤 {ref.firstName}</span>
                    <span className="ref-bonus">+100 🪙</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 12. LEADERBOARD PANEL
  // ============================================================
  const LeaderboardPanel = () => {
    if (!showLeaderboard) return null;

    useEffect(() => {
      fetchLeaderboard();
    }, []);

    return (
      <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
        <div className="modal-content leaderboard-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🏆 Peshqadamlar</h3>
            <button className="modal-close" onClick={() => setShowLeaderboard(false)}>✕</button>
          </div>
          
          <div className="modal-body">
            {leadersLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Yuklanmoqda...</p>
              </div>
            ) : leaders.length === 0 ? (
              <div className="empty-state">
                <p>📭 Hozircha hech qanday o'yinchi yo'q</p>
              </div>
            ) : (
              <div className="leaderboard-list">
                {leaders.map((player, index) => (
                  <div key={player.tgId || index} className={`leader-item rank-${index + 1}`}>
                    <span className="leader-rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <img 
                      src={player.photoUrl || `https://ui-avatars.com/api/?name=${player.firstName}&background=667eea&color=fff`}
                      alt={player.firstName}
                      className="leader-avatar"
                      onError={(e) => e.target.src = `https://ui-avatars.com/api/?name=${player.firstName}&background=667eea&color=fff`}
                    />
                    <div className="leader-info">
                      <span className="leader-name">{player.firstName}</span>
                      {player.username && <span className="leader-username">@{player.username}</span>}
                    </div>
                    <div className="leader-stats">
                      <span className="leader-rating">🏆 {player.rating}</span>
                      <span className="leader-coins">🪙 {player.coins}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 13. ASOSIY UI
  // ============================================================
  return (
    <div className="game-app">
      {/* NOTIFICATION */}
      {notification && (
        <div className="notification">
          <span>{notification}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* REFERRAL MODAL */}
      <ReferralModal />

      {/* LEADERBOARD MODAL */}
      <LeaderboardPanel />

      {/* ====================== */}
      {/* MENU EKRANI */}
      {/* ====================== */}
      {currentScreen === 'menu' && (
        <div className="main-menu">
          <div className="game-logo">
            <h1>💥 LIKE-DUEL 💥</h1>
            <p className="subtitle">⚡ Tosh, Qog'oz, Qaychi</p>
          </div>

          <div className="profile-badge">
            <div className="profile-info">
              <h3>👋 {user?.firstName}</h3>
              {user?.username && <span className="username">@{user.username}</span>}
            </div>
            <div className="balances-row">
              <div className="balance-item">
                <span className="balance-icon">🪙</span>
                <span className="balance-value">{user?.coins || 0}</span>
                <span className="balance-label">Tanga</span>
              </div>
              <div className="balance-item">
                <span className="balance-icon">🏆</span>
                <span className="balance-value">{user?.rating || 0}</span>
                <span className="balance-label">XP</span>
              </div>
            </div>
            <div className="stats-row">
              <span>🎮 {user?.totalGames || 0} o'yin</span>
              <span>🏅 {user?.wins || 0} g'alaba</span>
              <span>📊 {user?.totalGames ? Math.round((user.wins / user.totalGames) * 100) : 0}%</span>
            </div>
          </div>

          <div className="menu-buttons">
            <button 
              className="btn-menu btn-play-online" 
              onClick={() => setCurrentScreen('game')}
            >
              ⚔️ Onlayn Duel
              <span className="btn-badge">Jonli</span>
            </button>
            
            <button 
              className="btn-menu btn-leader" 
              onClick={() => {
                setShowLeaderboard(true);
                fetchLeaderboard();
              }}
            >
              🏆 Peshqadamlar
              <span className="btn-badge">TOP</span>
            </button>
            
            <button 
              className="btn-menu btn-invite" 
              onClick={() => setShowReferralModal(true)}
            >
              👥 Do'stlarni Taklif Qilish
              <span className="btn-badge">+100 🪙</span>
            </button>

            <button 
              className="btn-menu btn-refresh" 
              onClick={refreshUserData}
            >
              🔄 Yangilash
            </button>
          </div>

          <div className="connection-status">
            {socketConnected ? (
              <span className="status-online">🟢 Server bilan ulangan</span>
            ) : (
              <span className="status-offline">🔴 Server bilan ulanish yo'q</span>
            )}
          </div>
        </div>
      )}

      {/* ====================== */}
      {/* O'YIN EKRANI */}
      {/* ====================== */}
      {currentScreen === 'game' && (
        <div className="game-screen">
          <button className="back-btn" onClick={() => {
            if (gameState === 'searching') cancelSearch();
            setCurrentScreen('menu');
            resetGame();
          }}>
            ⬅️ Menuga Qaytish
          </button>

          {/* XATOLIK */}
          {socketError && (
            <div className="socket-error">
              ⚠️ {socketError}
              <button onClick={() => {
                setSocketError(null);
                connectSocket();
              }}>Qayta ulanish</button>
            </div>
          )}

          {/* ===== IDLE ===== */}
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
                disabled={!user || user.coins < stake || !socketConnected}
              >
                {!socketConnected ? '🔌 Ulanish yo\'q' : '🚀 Jonli Raqib Qidirish'}
              </button>
            </div>
          )}

          {/* ===== SEARCHING ===== */}
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

          {/* ===== PLAYING ===== */}
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

          {/* ===== RESULT ===== */}
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
              
              <button className="btn-action btn-restart" onClick={resetGame}>
                🔄 Yana O'ynash
              </button>
            </div>
          )}

          {/* ===== OPPONENT LEFT ===== */}
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
      )}
    </div>
  );
}

export default App;