// ============================================================
// 2. App.js - TO'LIQ QAYTA YOZILGAN
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket';
import DuelGame from './DuelGame';
import BotGame from './BotGame';
import Leaderboard from './Leaderboard';
import './App.css';

function App() {
  // ======================
  // STATE
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
  const [isBotMode, setIsBotMode] = useState(false);

  // ======================
  // CONSTANTS
  // ======================
  const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

  const BOT_USERNAME = 'like_duel_bot';

  // ======================
  // NOTIFICATION
  // ======================
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // ======================
  // HAPTIC FEEDBACK
  // ======================
  const triggerHaptic = useCallback((type = 'light') => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 80 : 35);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  // ======================
  // USER AUTH
  // ======================
  const authenticateUser = useCallback(async (tgUser, startParam) => {
    try {
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
        if (data.isNewUser && data.referralBonus > 0) {
          showNotification('🎉 Siz va do\'stingiz 100 tangadan bonus oldingiz!');
        }
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Auth error:', error);
      return null;
    }
  }, [BACKEND_URL, showNotification]);

  // ======================
  // INITIALIZE
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
            await authenticateUser(tgUser, startParam);
          } else {
            // Test user for development
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
          }
        } else {
          // Test user for development
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
        }
      } catch (error) {
        console.error('Initialize error:', error);
        // Fallback user
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
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Socket event listeners
    const onConnect = () => {
      console.log('✅ Socket connected');
      setSocketConnected(true);
      if (user) {
        socket.emit('user_connect', {
          tgId: String(user.tgId),
          firstName: user.firstName || "O'yinchi"
        });
      }
    };

    const onDisconnect = () => {
      console.log('❌ Socket disconnected');
      setSocketConnected(false);
    };

    const onConnectError = (error) => {
      console.error('❌ Socket connect error:', error);
      setSocketConnected(false);
    };

    const onUserConnected = (data) => {
      console.log('✅ User connected:', data);
      if (data.success && data.user) {
        setUser(prev => ({ ...prev, ...data.user }));
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_connected', onUserConnected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_connected', onUserConnected);
    };
  }, [authenticateUser, user]);

  // ======================
  // REFERRAL FUNCTIONS
  // ======================
  const fetchReferrals = useCallback(async (tgId) => {
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
  }, [BACKEND_URL]);

  const getReferralLink = useCallback(async () => {
    if (!user) return null;
    return `https://t.me/${BOT_USERNAME}/app?startapp=${user.tgId}`;
  }, [user]);

  const copyReferralLink = useCallback(async () => {
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
  }, [getReferralLink, showNotification]);

  // ======================
  // LEADERBOARD
  // ======================
  const fetchLeaderboard = useCallback(async () => {
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
  }, [BACKEND_URL]);

  // ======================
  // REFRESH USER
  // ======================
  const refreshUserData = useCallback(async () => {
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
        showNotification('✅ Ma\'lumotlar yangilandi');
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, [BACKEND_URL, user, showNotification]);

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Like-Duel yuklanmoqda...</p>
      </div>
    );
  }

  // ======================
  // REFERRAL MODAL
  // ======================
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

  // ======================
  // LEADERBOARD PANEL
  // ======================
  const LeaderboardPanel = () => {
    if (!showLeaderboard) return null;

    useEffect(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard]);

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

  // ======================
  // MAIN MENU
  // ======================
  const MainMenu = () => (
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
          onClick={() => {
            setIsBotMode(false);
            setCurrentScreen('game');
          }}
        >
          ⚔️ Onlayn Duel
          <span className="btn-badge">Jonli</span>
        </button>
        
        <button 
          className="btn-menu btn-play-bot" 
          onClick={() => {
            setIsBotMode(true);
            setCurrentScreen('bot');
          }}
        >
          🤖 Bot bilan o'ynash
          <span className="btn-badge">AI</span>
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
          onClick={() => {
            setShowReferralModal(true);
            fetchReferrals(user?.tgId);
          }}
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
  );

  // ======================
  // APP RENDER
  // ======================
  return (
    <div className="game-app">
      {/* NOTIFICATION */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* MODALS */}
      <ReferralModal />
      <LeaderboardPanel />

      {/* SCREENS */}
      {currentScreen === 'menu' && <MainMenu />}

      {currentScreen === 'game' && (
        <DuelGame
          user={user}
          setUser={setUser}
          backendUrl={BACKEND_URL}
          wsUrl={BACKEND_URL}
          onBack={() => setCurrentScreen('menu')}
          onNotification={showNotification}
          triggerHaptic={triggerHaptic}
          socket={socket}
        />
      )}

      {currentScreen === 'bot' && (
        <BotGame
          user={user}
          setUser={setUser}
          difficulty="medium"
          coins={user?.coins || 0}
          setCoins={(newCoins) => setUser(prev => ({ ...prev, coins: newCoins }))}
          onBackToMenu={() => setCurrentScreen('menu')}
          showNotif={showNotification}
          triggerHaptic={triggerHaptic}
        />
      )}
    </div>
  );
}

export default App;