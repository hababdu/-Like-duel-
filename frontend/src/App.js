// ============================================================
// App.js - ASOSIY KOMPONENT
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import './App.css';

// ============================================================
// KOMPONENTLAR
// ============================================================
import Profile from './components/Profile';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import Referrals from './components/Referrals';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

  // ============================================================
  // NOTIFICATION
  // ============================================================
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ============================================================
  // HAPTIC FEEDBACK
  // ============================================================
  const triggerHaptic = useCallback((type = 'light') => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 80 : 35);
      }
    } catch (e) {}
  }, []);

  // ============================================================
  // USER AUTH - TELEGRAM MA'LUMOTLARINI OLISH
  // ============================================================
  const authenticateUser = useCallback(async () => {
    try {
      const tg = window.Telegram?.WebApp;
      
      if (tg) {
        tg.ready();
        tg.expand();
        
        const tgUser = tg.initDataUnsafe?.user;
        const startParam = tg.initDataUnsafe?.start_param;
        
        if (tgUser) {
          console.log('📱 Telegram user:', tgUser);
          
          const response = await fetch(`${API_URL}/api/user/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tgId: String(tgUser.id),
              username: tgUser.username || '',
              firstName: tgUser.first_name || "O'yinchi",
              lastName: tgUser.last_name || '',
              photoUrl: tgUser.photo_url || '',
              languageCode: tgUser.language_code || 'uz',
              isPremium: tgUser.is_premium || false,
              refParent: startParam || null
            })
          });

          const data = await response.json();
          
          if (data.success) {
            setUser(data.user);
            console.log('✅ User authenticated:', data.user);
            
            // Socket ga ulanish
            if (socket.connected) {
              socket.emit('user_connect', {
                tgId: String(data.user.tgId)
              });
            }
            
            return data.user;
          }
        }
      }
      
      // Test user (brauzer uchun)
      const testUser = {
        tgId: 'test_' + Date.now(),
        firstName: 'Test User',
        username: 'test_user',
        coins: 100,
        rating: 100,
        level: 1,
        photoUrl: ''
      };
      setUser(testUser);
      return testUser;
      
    } catch (error) {
      console.error('❌ Auth error:', error);
      return null;
    }
  }, [API_URL]);

  // ============================================================
  // INITIALIZE
  // ============================================================
  useEffect(() => {
    const init = async () => {
      await authenticateUser();
      setLoading(false);
    };
    init();

    // Socket events
    const onConnect = () => {
      setSocketConnected(true);
      if (user) {
        socket.emit('user_connect', { tgId: String(user.tgId) });
      }
    };

    const onDisconnect = () => setSocketConnected(false);
    const onUserConnected = (data) => {
      if (data.success && data.user) {
        setUser(prev => ({ ...prev, ...data.user }));
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('user_connected', onUserConnected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('user_connected', onUserConnected);
    };
  }, []);

  // ============================================================
  // UPDATE USER
  // ============================================================
  const updateUser = useCallback((newData) => {
    setUser(prev => ({ ...prev, ...newData }));
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
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
              </div>
              <div className="menu-profile-info">
                <h2>{user?.firstName}</h2>
                <p>@{user?.username || 'username'}</p>
                <div className="menu-profile-stats">
                  <span>🪙 {user?.coins}</span>
                  <span>🏆 {user?.rating}</span>
                  <span>📊 Level {user?.level || 1}</span>
                </div>
              </div>
            </div>

            <div className="menu-buttons">
              <button 
                className="btn-play"
                onClick={() => setCurrentScreen('game')}
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
            updateUser={updateUser}
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
    </div>
  );
}

export default App;