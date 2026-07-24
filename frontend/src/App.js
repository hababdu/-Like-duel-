// ============================================================
// App.js - TO'LIQ VERSION
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
  // ======================
  // STATE
  // ======================
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
      
      console.log('🔍 Checking Telegram WebApp:', tg);
      
      if (!tg) {
        console.log('❌ Telegram WebApp mavjud emas');
        return null;
      }

      setIsTelegramWebApp(true);
      
      const initDataUnsafe = tg.initDataUnsafe || {};
      const user = initDataUnsafe.user || null;
      
      console.log('📱 initDataUnsafe:', initDataUnsafe);
      console.log('👤 Telegram user:', user);
      
      if (user) {
        console.log('✅ Telegram user found!');
        console.log('📊 ID:', user.id);
        console.log('📊 First name:', user.first_name);
        console.log('📊 Username:', user.username);
        console.log('📊 Photo URL:', user.photo_url);
        console.log('📊 Is Premium:', user.is_premium);
        
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
      console.log('📊 firstName:', firstName);

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

      console.log('📥 Response status:', response.status);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        const text = await response.text();
        console.log('📥 Response text:', text);
        throw new Error('Server javobi noto\'g\'ri formatda');
      }

      console.log('📥 Auth response:', data);

      if (data.success && data.user) {
        const userData = {
          ...data.user,
          tgId: String(data.user.tgId)
        };
        
        console.log('✅ User authenticated!');
        console.log('✅ tgId:', userData.tgId);
        console.log('✅ firstName:', userData.firstName);
        console.log('✅ coins:', userData.coins);
        console.log('✅ rating:', userData.rating);
        
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
        console.error('❌ Auth failed:', data);
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
        console.log('👤 tgUser:', tgUser);
        
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
  }, []);

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
    <div className="app">
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
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
            triggerHaptic={triggerHaptic}
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
      `}</style>
    </div>
  );
}

export default App;