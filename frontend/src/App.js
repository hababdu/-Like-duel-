// ============================================================
// App.js - TO'LIQ VA MUKAMMAL INTEGRATSIYA QILINGAN VERSIYA
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket';

// Komponentlar
import Profile from './components/Profile';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import Referrals from './components/Referrals';
import Wallet from './components/Wallet';
import Shop from './components/Shop';

import './App.css';

function App() {
  // ======================
  // STATE MANAGEMENT
  // ======================
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('menu'); // 'menu', 'profile', 'game', 'bot', 'leaderboard', 'referrals', 'wallet', 'shop'
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // Socket event'larida xavfsiz o'qish uchun User Ref
  const userRef = useRef(null);
  useEffect(() => { 
    userRef.current = user; 
  }, [user]);

  // Server URL
  const API_URL = process.env.REACT_APP_API_URL || (
    process.env.NODE_ENV === 'production'
      ? 'https://telegram-bot-server-2-matj.onrender.com'
      : 'http://localhost:10000'
  );

  // ======================
  // NOTIFICATION SYSTEM
  // ======================
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ======================
  // HAPTIC FEEDBACK (Vibratsiya)
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
  // SOCKET CONNECT ANNOUNCEMENT
  // ======================
  const announceUserConnect = useCallback((userData) => {
    if (!userData?.tgId || !socket?.connected) return;
    socket.emit('user_connect', {
      tgId: String(userData.tgId),
      firstName: userData.firstName || "O'yinchi",
      username: userData.username || ''
    });
  }, []);

  // URL'dan Referal link parametri haqida ma'lumot olish
  const getRefParentFromUrl = () => {
    try {
      const tg = window.Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;
      if (startParam) {
        const match = startParam.match(/ref_?(\d+)/i);
        if (match) return match[1];
        if (/^\d+$/.test(startParam)) return startParam;
      }
      const params = new URLSearchParams(window.location.search);
      return params.get('ref') || null;
    } catch {
      return null;
    }
  };

  // ======================
  // USER AUTHENTICATION
  // ======================
  const authenticateUser = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const rawInitData = tg?.initData;
    const unsafeUser = tg?.initDataUnsafe?.user || null;

    setIsTelegramWebApp(!!tg && !!rawInitData);
    if (unsafeUser) setTelegramUser(unsafeUser);

    // Dev/Brauzer rejimi (Telegram ichida bo'lmaganda)
    if (!rawInitData) {
      console.warn('⚠️ Telegram initData topilmadi — dev/test rejimi.');
      setIsDevMode(true);
      setAuthError(null);
      const devUser = {
        tgId: 'dev_local_user',
        firstName: 'Test User',
        username: 'test_user',
        photoUrl: '',
        isPremium: false,
        coins: 1000,
        rating: 100,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        maxWinStreak: 0,
        refCount: 0,
        inventory: []
      };
      setUser(devUser);
      showNotification('🧪 Dev rejimi: Telegram initData topilmadi.', 'warning');
      return devUser;
    }

    // Telegram backend autentifikatsiyasi
    try {
      console.log('🔑 ===== AUTH START (Telegram initData) =====');

      const response = await fetch(`${API_URL}/api/user/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          initData: rawInitData,
          refParent: getRefParentFromUrl()
        })
      });

      if (response.status === 401) {
        throw new Error('Telegram autentifikatsiyasi rad etildi.');
      }

      const data = await response.json();

      if (!data.success || !data.user) {
        throw new Error(data.message || 'Auth muvaffaqiyatsiz');
      }

      const userData = {
        ...data.user,
        tgId: String(data.user.tgId)
      };

      console.log('✅ User authenticated:', userData.tgId);
      setUser(userData);
      setAuthError(null);
      setIsDevMode(false);
      announceUserConnect(userData);
      return userData;

    } catch (error) {
      console.error('❌ Auth error:', error);
      setUser(null);
      setAuthError(error.message || 'Autentifikatsiya xatosi');
      showNotification('❌ Kirish muvaffaqiyatsiz: ' + (error.message || 'nomalum xato'), 'error');
      return null;
    }
  }, [API_URL, showNotification, announceUserConnect]);

  // ======================
  // INITIALIZE & SOCKET EVENTS
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 ===== INITIALIZING APP =====');
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }
        await authenticateUser();
      } catch (error) {
        console.error('❌ Initialize error:', error);
        setAuthError(error.message || 'Ilovani ishga tushirishda xato');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    const onConnect = () => {
      setSocketConnected(true);
      if (userRef.current) {
        announceUserConnect(userRef.current);
      }
    };

    const onReconnect = () => {
      setSocketConnected(true);
      if (userRef.current) {
        announceUserConnect(userRef.current);
      }
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onConnectError = () => {
      setSocketConnected(false);
    };

    const onUserConnected = (data) => {
      if (data.success && data.user) {
        setUser(prev => ({ ...prev, ...data.user }));
      }
    };

    const onServerError = (data) => {
      showNotification('⚠️ ' + (data?.message || 'Server xatoligi'), 'error');
    };

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_connected', onUserConnected);
    socket.on('error', onServerError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_connected', onUserConnected);
      socket.off('error', onServerError);
    };
  }, [authenticateUser, announceUserConnect, showNotification]);

  // ======================
  // RENDER UI
  // ======================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Like-Duel yuklanmoqda...</p>
      </div>
    );
  }

  if (!user && authError && !isDevMode) {
    return (
      <div className="loading-screen">
        <p>❌ Kirishda xatolik: {authError}</p>
        <button
          onClick={async () => {
            setLoading(true);
            await authenticateUser();
            setLoading(false);
          }}
        >
          🔄 Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Main Header */}
      <div className="header">
        <div className="header-left">
          <h1 onClick={() => setCurrentScreen('menu')} style={{ cursor: 'pointer' }}>
            💥 LIKE-DUEL
          </h1>
        </div>
        <div className="header-right">
          <div className="header-status" title={socketConnected ? 'Serverga ulangan' : 'Ulanish uzilgan'}>
            {socketConnected ? '🟢' : '🔴'}
          </div>
          
          {/* Wallet / Balans Tugmasi */}
          <button 
            className="header-coins-btn"
            onClick={() => {
              triggerHaptic('light');
              setCurrentScreen('wallet');
            }}
          >
            🪙 {user?.coins ?? 0}
          </button>

          <div className="header-rating">
            🏆 {user?.rating ?? 0}
          </div>

          <button
            className="header-profile"
            onClick={() => {
              triggerHaptic('light');
              setCurrentScreen('profile');
            }}
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" />
            ) : (
              <span>{user?.firstName?.charAt(0) || '?'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Debug Info Bar */}
      <div className="telegram-debug">
        <div className="debug-row">
          <span>📱 {isTelegramWebApp ? 'Telegram WebApp' : 'Web Browser'}</span>
          <span>👤 {user?.firstName || 'No Name'}</span>
          <span>🆔 {user?.tgId || 'No ID'}</span>
          {isDevMode && <span style={{ color: '#ffaa00' }}>🧪 DEV MODE</span>}
        </div>
      </div>

      {/* Dynamic Screen Routing */}
      <div className="main-content">
        {/* MENU SCREEN */}
        {currentScreen === 'menu' && (
          <div className="menu">
            <div className="menu-profile">
              <div className="menu-profile-avatar">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" />
                ) : (
                  <span>{user?.firstName?.charAt(0) || '?'}</span>
                )}
                {user?.isPremium && <div className="premium-badge">⭐</div>}
              </div>
              <div className="menu-profile-info">
                <h2>{user?.firstName || 'User'}</h2>
                <p>{user?.username ? `@${user.username}` : 'username yo\'q'}</p>
                <div className="menu-profile-stats">
                  <span>🪙 {user?.coins ?? 0}</span>
                  <span>🏆 {user?.rating ?? 0}</span>
                  <span>📊 Lvl {user?.level ?? 1}</span>
                </div>
              </div>
            </div>

            <div className="menu-buttons">
              <button
                className="btn-play"
                onClick={() => {
                  triggerHaptic('medium');
                  if (!user?.tgId) {
                    showNotification('⚠️ Iltimos avval tizimga kiring!', 'warning');
                    return;
                  }
                  if (isDevMode) {
                    showNotification('⚠️ Dev rejimida onlayn duel ishlamaydi.', 'warning');
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
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentScreen('bot');
                }}
              >
                🤖 Bot bilan
                <span className="badge">AI</span>
              </button>

              <div className="menu-secondary-row">
                <button
                  className="btn-shop"
                  onClick={() => {
                    triggerHaptic('light');
                    setCurrentScreen('shop');
                  }}
                >
                  🛍️ Do'kon
                </button>

                <button
                  className="btn-wallet"
                  onClick={() => {
                    triggerHaptic('light');
                    setCurrentScreen('wallet');
                  }}
                >
                  💳 Hamyon
                </button>
              </div>

              <button
                className="btn-leaderboard"
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentScreen('leaderboard');
                }}
              >
                🏆 Peshqadamlar
              </button>

              <button
                className="btn-referrals"
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentScreen('referrals');
                }}
              >
                👥 Do'stlarni taklif qilish
                <span className="badge">+100 🪙</span>
              </button>
            </div>
          </div>
        )}

        {/* PROFILE SCREEN */}
        {currentScreen === 'profile' && (
          <Profile
            user={user}
            onBack={() => setCurrentScreen('menu')}
            updateUser={setUser}
            API_URL={API_URL}
          />
        )}

        {/* ONLINE GAME SCREEN */}
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

        {/* BOT GAME SCREEN */}
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

        {/* LEADERBOARD SCREEN */}
        {currentScreen === 'leaderboard' && (
          <Leaderboard
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
          />
        )}

        {/* REFERRALS SCREEN */}
        {currentScreen === 'referrals' && (
          <Referrals
            user={user}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
          />
        )}

        {/* WALLET SCREEN */}
        {currentScreen === 'wallet' && (
          <Wallet
            user={user}
            setUser={setUser}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
            triggerHaptic={triggerHaptic}
          />
        )}

        {/* SHOP SCREEN */}
        {currentScreen === 'shop' && (
          <Shop
            user={user}
            setUser={setUser}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
            triggerHaptic={triggerHaptic}
          />
        )}
      </div>

      <style>{`
        .header-coins-btn {
          background: rgba(255, 215, 0, 0.15);
          border: 1px solid rgba(255, 215, 0, 0.4);
          color: #ffd700;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .menu-secondary-row {
          display: flex;
          gap: 10px;
          width: 100%;
        }
        .btn-shop, .btn-wallet {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          font-weight: bold;
          border: none;
          cursor: pointer;
          color: #fff;
        }
        .btn-shop {
          background: linear-gradient(135deg, #e91e63, #9c27b0);
        }
        .btn-wallet {
          background: linear-gradient(135deg, #00b09b, #96c93d);
        }
        .telegram-debug {
          background: rgba(0,0,0,0.4);
          padding: 6px 12px;
          border-radius: 6px;
          margin-bottom: 8px;
          font-size: 11px;
        }
        .debug-row {
          display: flex;
          justify-content: space-between;
          color: #aaa;
        }
      `}</style>
    </div>
  );
}

export default App;