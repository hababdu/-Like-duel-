// ============================================================
// App.js - TO'LIQ TUZATILGAN
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import Profile from './components/Profile';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import Referrals from './components/Referrals';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);

  const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

  // ======================
  // NOTIFICATION
  // ======================
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
  const getTelegramUser = useCallback(() => {
    try {
      const tg = window.Telegram?.WebApp;
      
      if (!tg) {
        console.log('❌ Telegram WebApp mavjud emas');
        return null;
      }

      setIsTelegramWebApp(true);
      
      const initDataUnsafe = tg.initDataUnsafe || {};
      const user = initDataUnsafe.user || null;
      
      if (user) {
        console.log('✅ Telegram user found!');
        console.log('📊 ID:', user.id);
        console.log('📊 First name:', user.first_name);
        console.log('📊 Username:', user.username);
        
        setTelegramUser(user);
        return user;
      } else {
        console.warn('⚠️ Telegram user ma\'lumotlari yo\'q');
        const testUser = {
          id: Date.now(),
          first_name: 'Test User',
          username: 'test_user',
          is_premium: false
        };
        setTelegramUser(testUser);
        return testUser;
      }
    } catch (error) {
      console.error('❌ Telegram ma\'lumotlarini olishda xatolik:', error);
      return null;
    }
  }, []);

  // ======================
  // USER AUTH
  // ======================
  const authenticateUser = useCallback(async (tgUser) => {
    try {
      let tgId = null;
      let firstName = "O'yinchi";
      let username = '';
      let photoUrl = '';
      let isPremium = false;
      
      if (tgUser && tgUser.id) {
        tgId = String(tgUser.id);
        firstName = tgUser.first_name || "O'yinchi";
        username = tgUser.username || '';
        photoUrl = tgUser.photo_url || '';
        isPremium = tgUser.is_premium || false;
      } else {
        tgId = 'test_' + Date.now();
        firstName = 'Test User';
        username = 'test_user';
      }

      console.log('🔑 ===== AUTH START =====');
      console.log('📊 tgId:', tgId);

      const response = await fetch(`${API_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tgId: tgId,
          username: username,
          firstName: firstName,
          lastName: '',
          photoUrl: photoUrl,
          languageCode: 'uz',
          isPremium: isPremium,
          refParent: null
        })
      });

      const data = await response.json();

      if (data.success && data.user) {
        const userData = {
          ...data.user,
          tgId: String(data.user.tgId)
        };
        
        setUser(userData);
        
        if (socket && socket.connected) {
          socket.emit('user_connect', {
            tgId: userData.tgId,
            firstName: userData.firstName || "O'yinchi",
            username: userData.username || ''
          });
        }
        
        return userData;
      } else {
        // Fallback user
        const fallbackUser = {
          tgId: tgId,
          firstName: firstName,
          username: username,
          photoUrl: photoUrl,
          isPremium: isPremium,
          coins: 100,
          rating: 100,
          level: 1,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0
        };
        setUser(fallbackUser);
        showNotification('⚠️ Server bilan bog\'lanmadi. Offline rejim.', 'warning');
        return fallbackUser;
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      const fallbackUser = {
        tgId: tgUser?.id ? String(tgUser.id) : 'fallback_' + Date.now(),
        firstName: tgUser?.first_name || "O'yinchi",
        username: tgUser?.username || '',
        photoUrl: tgUser?.photo_url || '',
        isPremium: tgUser?.is_premium || false,
        coins: 100,
        rating: 100,
        level: 1,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0
      };
      setUser(fallbackUser);
      showNotification('⚠️ Xatolik yuz berdi. Offline rejim.', 'error');
      return fallbackUser;
    }
  }, [API_URL, showNotification]);

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 ===== INITIALIZING APP =====');
        
        const tgUser = getTelegramUser();
        await authenticateUser(tgUser);
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
          console.log('✅ Telegram WebApp ready');
        }
        
      } catch (error) {
        console.error('❌ Initialize error:', error);
        const fallbackUser = {
          tgId: 'fallback_' + Date.now(),
          firstName: 'User',
          username: 'user',
          coins: 100,
          rating: 100,
          level: 1,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0
        };
        setUser(fallbackUser);
      } finally {
        setLoading(false);
        console.log('✅ ===== INITIALIZATION COMPLETE =====');
      }
    };

    initializeApp();

    // Socket event listeners
    const onConnect = () => {
      console.log('✅ Socket connected! ID:', socket.id);
      setSocketConnected(true);
      
      if (user && user.tgId) {
        socket.emit('user_connect', {
          tgId: String(user.tgId),
          firstName: user.firstName || "O'yinchi",
          username: user.username || ''
        });
      }
    };

    const onReconnect = (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setSocketConnected(true);
      
      if (user && user.tgId) {
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
    socket.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_connected', onUserConnected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_connected', onUserConnected);
    };
  }, []); // Empty dependency array

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

  return (
    <div className="app-container">
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1>💥 LIKE-DUEL</h1>
        </div>
        <div className="header-right">
          <div className="header-status">
            {socketConnected ? '🟢' : '🔴'}
          </div>
          <div className="header-coins">
            🪙 {user?.coins || 0}
          </div>
          <div className="header-rating">
            🏆 {user?.rating || 0}
          </div>
          <button 
            className="header-profile"
            onClick={() => setCurrentScreen('profile')}
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" />
            ) : (
              <span>{user?.firstName?.charAt(0) || '?'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Telegram Debug Info */}
      <div className="telegram-debug">
        <div className="debug-row">
          <span>📱 Platform: {isTelegramWebApp ? 'Telegram WebApp' : 'Web Browser'}</span>
          <span>👤 User: {user?.firstName || 'No Name'}</span>
          <span>🆔 ID: {user?.tgId || 'No ID'}</span>
        </div>
        {telegramUser && (
          <div className="debug-row" style={{ fontSize: '11px', color: '#888' }}>
            <span>📛 @{telegramUser.username || 'no_username'}</span>
            <span>⭐ {telegramUser.is_premium ? 'Premium' : 'Free'}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {currentScreen === 'menu' && (
          <div className="menu">
            <div className="menu-profile">
              <div className="menu-profile-avatar">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" />
                ) : (
                  <span>{user?.firstName?.charAt(0) || '?'}</span>
                )}
                {user?.isPremium && (
                  <div className="premium-badge">⭐</div>
                )}
              </div>
              <div className="menu-profile-info">
                <h2>{user?.firstName || 'User'}</h2>
                <p>@{user?.username || 'username'}</p>
                <div className="menu-profile-stats">
                  <span>🪙 {user?.coins || 0}</span>
                  <span>🏆 {user?.rating || 0}</span>
                  <span>📊 Level {user?.level || 1}</span>
                </div>
              </div>
            </div>

            <div className="menu-buttons">
              <button 
                className="btn-play"
                onClick={() => {
                  if (!user?.tgId) {
                    showNotification('⚠️ Iltimos avval tizimga kiring!', 'warning');
                    return;
                  }
                  setCurrentScreen('game');
                }}
              >
                ⚔️ Onlayn Duel
                <span className="badge">Jonli</span>
              </button>

              <button 
                className="btn-bot"
                onClick={() => setCurrentScreen('bot')}
              >
                🤖 Bot bilan
                <span className="badge">AI</span>
              </button>

              <button 
                className="btn-leaderboard"
                onClick={() => setCurrentScreen('leaderboard')}
              >
                🏆 Peshqadamlar
              </button>

              <button 
                className="btn-referrals"
                onClick={() => setCurrentScreen('referrals')}
              >
                👥 Do'stlarni taklif qilish
                <span className="badge">+100 🪙</span>
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'profile' && (
          <Profile 
            user={user} 
            onBack={() => setCurrentScreen('menu')}
            updateUser={setUser}
            API_URL={API_URL}
          />
        )}

        {currentScreen === 'game' && (
          <DuelGame
            user={user}
            setUser={setUser}
            API_URL={API_URL}
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
            onBackToMenu={() => setCurrentScreen('menu')}
            showNotif={showNotification}
            triggerHaptic={triggerHaptic}
            API_URL={API_URL}
          />
        )}

        {currentScreen === 'leaderboard' && (
          <Leaderboard
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
          />
        )}

        {currentScreen === 'referrals' && (
          <Referrals
            user={user}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
          />
        )}
      </div>

      <style>{`
        .telegram-debug {
          background: rgba(0,0,0,0.5);
          border-radius: 8px;
          padding: 8px 12px;
          margin: 8px 0;
          font-size: 12px;
          font-family: monospace;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .debug-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: #888;
        }
        .debug-row span {
          color: #00ff88;
        }
        .premium-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          background: #ffaa00;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid #0f0c29;
        }
        .menu-profile-avatar {
          position: relative;
        }
        .loading-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f0c29, #302b63);
        }
        .spinner {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
          color: #ffffff;
          padding: 16px;
          padding-bottom: 80px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          margin-bottom: 16px;
          backdrop-filter: blur(10px);
        }
        .header-left h1 {
          font-size: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-coins {
          background: rgba(0,255,136,0.15);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: #00ff88;
        }
        .header-rating {
          background: rgba(102,126,234,0.15);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: #667eea;
        }
        .header-profile {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #667eea;
          background: none;
          cursor: pointer;
          overflow: hidden;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-profile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .header-profile span {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
        }
        .menu {
          max-width: 400px;
          margin: 0 auto;
        }
        .menu-profile {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(255,255,255,0.05);
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 16px;
        }
        .menu-profile-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 3px solid #667eea;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .menu-profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .menu-profile-avatar span {
          font-size: 28px;
          font-weight: 600;
        }
        .menu-profile-info {
          flex: 1;
        }
        .menu-profile-info h2 {
          font-size: 18px;
          margin-bottom: 2px;
        }
        .menu-profile-info p {
          color: #888;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .menu-profile-stats {
          display: flex;
          gap: 12px;
          font-size: 14px;
        }
        .menu-profile-stats span {
          background: rgba(255,255,255,0.05);
          padding: 2px 10px;
          border-radius: 12px;
        }
        .menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .menu-buttons button {
          padding: 16px 20px;
          border-radius: 16px;
          border: none;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.3s;
        }
        .menu-buttons button:hover {
          transform: translateY(-2px);
        }
        .btn-play {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
          box-shadow: 0 4px 20px rgba(102,126,234,0.4);
        }
        .btn-bot {
          background: linear-gradient(135deg, #f093fb, #f5576c);
          color: #fff;
          box-shadow: 0 4px 20px rgba(245,87,108,0.4);
        }
        .btn-leaderboard {
          background: linear-gradient(135deg, #43e97b, #38f9d7);
          color: #0f0c29;
          box-shadow: 0 4px 20px rgba(67,233,123,0.4);
        }
        .btn-referrals {
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          color: #0f0c29;
          box-shadow: 0 4px 20px rgba(79,172,254,0.4);
        }
        .badge {
          font-size: 10px;
          background: rgba(255,255,255,0.2);
          padding: 2px 10px;
          border-radius: 12px;
          font-weight: 600;
        }
        .notification {
          position: fixed;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 20px;
          border-radius: 12px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 90%;
          font-weight: 500;
          animation: slideDown 0.3s ease-out;
        }
        .notification.info {
          background: rgba(102,126,234,0.9);
          color: #fff;
        }
        .notification.success {
          background: rgba(0,255,136,0.9);
          color: #0f0c29;
        }
        .notification.error {
          background: rgba(255,68,68,0.9);
          color: #fff;
        }
        .notification.warning {
          background: rgba(255,170,0,0.9);
          color: #0f0c29;
        }
        .notification button {
          background: none;
          border: none;
          color: inherit;
          font-size: 20px;
          cursor: pointer;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @media (max-width: 480px) {
          .app-container {
            padding: 12px;
            padding-bottom: 60px;
          }
          .header-left h1 {
            font-size: 16px;
          }
          .header-coins, .header-rating {
            font-size: 12px;
            padding: 2px 8px;
          }
          .header-profile {
            width: 32px;
            height: 32px;
          }
          .menu-buttons button {
            font-size: 16px;
            padding: 14px 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default App; // <-- MUHIM: App ni export qilish