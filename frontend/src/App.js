// ============================================================
// APP.JS - TO'LIQ TUZATILGAN VERSION
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

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
    } catch (e) {}
  }, []);

  // ======================
  // TELEGRAM MA'LUMOTLARINI OLISH
  // ======================
  const getTelegramData = useCallback(() => {
    try {
      const tg = window.Telegram?.WebApp;
      
      if (!tg) {
        console.log('❌ Telegram WebApp mavjud emas');
        return null;
      }

      console.log('✅ Telegram WebApp mavjud');
      
      const initDataUnsafe = tg.initDataUnsafe || {};
      const user = initDataUnsafe.user || null;
      
      console.log('📱 initDataUnsafe:', initDataUnsafe);
      console.log('👤 user:', user);

      if (!user) {
        console.warn('⚠️ Telegram user ma\'lumotlari yo\'q');
        return {
          tg: tg,
          user: {
            id: Date.now(),
            first_name: 'Test User',
            username: 'test_user'
          },
          initData: tg.initData || '',
          initDataUnsafe: initDataUnsafe
        };
      }

      return {
        tg: tg,
        user: user,
        initData: tg.initData || '',
        initDataUnsafe: initDataUnsafe
      };
    } catch (error) {
      console.error('❌ Telegram error:', error);
      return null;
    }
  }, []);

  // ======================
  // USER AUTH
  // ======================
  const authenticateUser = useCallback(async (tgUser, startParam) => {
    try {
      let tgId = null;
      
      if (tgUser && tgUser.id) {
        tgId = String(tgUser.id);
      } else {
        tgId = 'test_' + Date.now();
      }

      console.log('🔑 ===== AUTH START =====');
      console.log('📊 tgId:', tgId);
      console.log('📊 tgUser:', tgUser);

      const response = await fetch(`${BACKEND_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tgId: tgId,
          username: tgUser?.username || '',
          firstName: tgUser?.first_name || "O'yinchi",
          lastName: tgUser?.last_name || '',
          photoUrl: tgUser?.photo_url || '',
          refParent: startParam ? String(startParam) : null
        })
      });

      const data = await response.json();
      console.log('📥 Auth response:', data);

      if (data.success && data.user) {
        const userData = {
          ...data.user,
          tgId: String(data.user.tgId)
        };
        
        // USER MA'LUMOTLARINI TEKSHIRISH
        console.log('✅ User data saved:', userData);
        console.log('✅ tgId:', userData.tgId);
        console.log('✅ tgId type:', typeof userData.tgId);
        console.log('✅ firstName:', userData.firstName);
        
        setUser(userData);
        setDebugInfo(`✅ Auth: ${userData.firstName} (${userData.tgId})`);
        
        // Socket ga ulanish
        if (socket && socket.connected) {
          socket.emit('user_connect', {
            tgId: userData.tgId,
            firstName: userData.firstName || "O'yinchi",
            username: userData.username || ''
          });
        }
        
        return userData;
      } else {
        console.error('❌ Auth failed:', data);
        setDebugInfo('❌ Auth failed');
        return null;
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      setDebugInfo('❌ Auth error: ' + error.message);
      return null;
    }
  }, [BACKEND_URL]);

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 ===== INITIALIZING APP =====');
        
        const tgData = getTelegramData();
        console.log('📱 Telegram data:', tgData);
        
        if (tgData) {
          setTelegramUser(tgData.user);
          
          if (tgData.tg) {
            tgData.tg.ready();
            tgData.tg.expand();
            console.log('✅ Telegram WebApp ready');
          }
          
          const tgUser = tgData.user;
          const startParam = tgData.initDataUnsafe?.start_param;
          
          if (tgUser && tgUser.id) {
            await authenticateUser(tgUser, startParam);
          } else {
            console.warn('⚠️ Telegram user topilmadi');
            const testUser = {
              id: Date.now(),
              first_name: 'Test User',
              username: 'test_user'
            };
            await authenticateUser(testUser, null);
          }
        } else {
          console.warn('⚠️ Telegram WebApp topilmadi');
          const testUser = {
            id: Date.now(),
            first_name: 'Web User',
            username: 'web_user'
          };
          await authenticateUser(testUser, null);
        }
      } catch (error) {
        console.error('❌ Initialize error:', error);
        const fallbackId = 'fallback_' + Date.now();
        const fallbackUser = {
          tgId: fallbackId,
          firstName: 'User',
          username: 'user',
          coins: 300,
          rating: 150,
          totalGames: 0,
          wins: 0,
          losses: 0,
          isRefRewarded: false
        };
        setUser(fallbackUser);
        setDebugInfo('❌ Fallback user');
      } finally {
        setLoading(false);
        console.log('✅ ===== INITIALIZATION COMPLETE =====');
        console.log('📊 Final user:', user);
      }
    };

    initializeApp();

    // Socket event listeners
    const onConnect = () => {
      console.log('✅ Socket connected! ID:', socket.id);
      setSocketConnected(true);
      
      // User mavjud bo'lsa socket ga ulanish
      if (user && user.tgId) {
        console.log('📤 Sending user_connect on reconnect');
        socket.emit('user_connect', {
          tgId: String(user.tgId),
          firstName: user.firstName || "O'yinchi",
          username: user.username || ''
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
      console.log('✅ User connected response:', data);
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
  }, []); // Empty dependency array - faqat bir marta ishlaydi

  // ======================
  // USER O'ZGARGANDA SOCKET GA ULASH
  // ======================
  useEffect(() => {
    if (user && user.tgId && socketConnected) {
      console.log('📤 User changed, sending to socket');
      socket.emit('user_connect', {
        tgId: String(user.tgId),
        firstName: user.firstName || "O'yinchi",
        username: user.username || ''
      });
    }
  }, [user, socketConnected]);

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Like-Duel yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Debug Panel */}
      <div className="debug-panel">
        <div className="debug-title">📱 TELEGRAM MA'LUMOTLARI</div>
        {telegramUser ? (
          <div className="debug-content">
            <div>✅ ID: <strong>{telegramUser.id}</strong></div>
            <div>👤 Ism: <strong>{telegramUser.first_name}</strong></div>
            <div>📛 Username: @{telegramUser.username || 'Yo\'q'}</div>
          </div>
        ) : (
          <div className="debug-error">❌ Telegram ma'lumotlari topilmadi</div>
        )}
        <div className="debug-status">
          <span className={socketConnected ? 'online' : 'offline'}>
            🔌 Socket: {socketConnected ? '🟢 Online' : '🔴 Offline'}
          </span>
          <span style={{ marginLeft: '12px', color: '#666' }}>
            App ID: {user?.tgId || '❌ YO\'Q'}
          </span>
        </div>
        <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
          {debugInfo}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {currentScreen === 'menu' && (
          <div className="menu-container">
            {/* Logo */}
            <div className="logo">
              <h1 className="logo-text">💥 LIKE-DUEL</h1>
              <p className="logo-sub">⚡ Tosh, Qog'oz, Qaychi</p>
            </div>

            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-header">
                {telegramUser?.photo_url ? (
                  <img src={telegramUser.photo_url} alt="Profile" className="profile-image" />
                ) : (
                  <div className="profile-image-placeholder">
                    {user?.firstName?.charAt(0) || '?'}
                  </div>
                )}
                <div className="profile-info">
                  <h2 className="profile-name">👋 {user?.firstName || 'User'}</h2>
                  {telegramUser?.username && (
                    <p className="profile-username">@{telegramUser.username}</p>
                  )}
                  <p className="profile-id">
                    ID: {user?.tgId || '❌ YO\'Q'}
                    {!user?.tgId && (
                      <span style={{ color: '#ff4444', marginLeft: '8px' }}>
                        (Ma'lumot olinmadi!)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-icon">🪙</span>
                  <span className="stat-value">{user?.coins || 0}</span>
                  <span className="stat-label">Tanga</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <span className="stat-icon">🏆</span>
                  <span className="stat-value">{user?.rating || 0}</span>
                  <span className="stat-label">XP</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <span className="stat-icon">🎮</span>
                  <span className="stat-value">{user?.totalGames || 0}</span>
                  <span className="stat-label">O'yin</span>
                </div>
              </div>

              <div className="profile-games">
                <span>🏅 {user?.wins || 0} g'alaba</span>
                <span>📊 {user?.totalGames ? Math.round((user.wins / user.totalGames) * 100) : 0}%</span>
              </div>
            </div>

            {/* Menu Buttons */}
            <div className="menu-buttons">
              <button 
                className="btn-play-online"
                onClick={() => {
                  // USER MA'LUMOTLARINI TEKSHIRISH
                  console.log('🔍 Before starting game:', user);
                  console.log('🔍 tgId:', user?.tgId);
                  
                  if (!user || !user.tgId || user.tgId === 'undefined' || user.tgId === 'null') {
                    showNotification('⚠️ Iltimos avval tizimga kiring! Sahifani yangilang', 'warning');
                    // Sahifani yangilash
                    setTimeout(() => {
                      if (window.confirm('Sahifani yangilash kerak. Yangilansinmi?')) {
                        window.location.reload();
                      }
                    }, 1000);
                    return;
                  }
                  
                  setCurrentScreen('game');
                }}
              >
                <span className="btn-icon">⚔️</span>
                Onlayn Duel
                <span className="btn-badge pulse">Jonli</span>
              </button>

              <button 
                className="btn-play-bot"
                onClick={() => setCurrentScreen('bot')}
              >
                <span className="btn-icon">🤖</span>
                Bot bilan o'ynash
                <span className="btn-badge">AI</span>
              </button>

              <button 
                className="btn-refresh"
                onClick={() => {
                  window.location.reload();
                }}
              >
                🔄 Sahifani yangilash
              </button>
            </div>

            {/* Connection Status */}
            <div className="connection-status">
              {socketConnected ? (
                <span className="status-online">🟢 Server bilan ulangan</span>
              ) : (
                <span className="status-offline">🔴 Server bilan ulanish yo'q</span>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'game' && (
           <DuelGame
           user={user}
           setUser={setUser}
           backendUrl={BACKEND_URL}
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

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export default App;