// ============================================================
// APP.JS - TELEGRAM USER ID NI TO'G'RI OLISH
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
  // USER AUTH - TO'G'RILANGAN
  // ======================
  const authenticateUser = useCallback(async (tgUser, startParam) => {
    try {
      // Telegram ID ni to'g'ri olish
      let tgId = null;
      
      if (tgUser) {
        tgId = String(tgUser.id);
      } else {
        // Agar Telegram user bo'lmasa, test ID
        tgId = 'test_' + Date.now();
      }

      console.log('🔑 Authenticating user ID:', tgId);
      console.log('📱 Full user data:', tgUser);

      const response = await fetch(`${BACKEND_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // User ma'lumotlarini saqlash
        const userData = {
          ...data.user,
          tgId: String(data.user.tgId) // String ekanligiga ishonch hosil qilish
        };
        setUser(userData);
        console.log('✅ User authenticated:', userData.tgId);
        console.log('✅ User coins:', userData.coins);
        console.log('✅ User rating:', userData.rating);
        
        // Socket ga ulanish
        if (socket && socket.connected) {
          socket.emit('user_connect', {
            tgId: userData.tgId,
            firstName: userData.firstName || "O'yinchi",
            username: userData.username || ''
          });
        }
        
        return userData;
      }
      return null;
    } catch (error) {
      console.error('❌ Auth error:', error);
      return null;
    }
  }, [BACKEND_URL]);

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...');
        
        // Telegram WebApp ni tekshirish
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
          console.log('📱 Telegram WebApp detected');
          tg.ready();
          tg.expand();
          
          const tgUser = tg.initDataUnsafe?.user;
          const startParam = tg.initDataUnsafe?.start_param;
          
          console.log('👤 Telegram user:', tgUser);
          console.log('🔗 Start param:', startParam);

          if (tgUser && tgUser.id) {
            await authenticateUser(tgUser, startParam);
          } else {
            console.error('❌ No Telegram user data, using test user');
            // Test user
            const testId = 'test_' + Date.now();
            const testUser = {
              id: parseInt(testId.replace('test_', '')),
              first_name: 'Test User',
              username: 'test_user'
            };
            await authenticateUser(testUser, null);
          }
        } else {
          console.log('🌐 Web browser detected');
          // Brauzer uchun test user
          const testId = 'web_' + Date.now();
          const testUser = {
            id: parseInt(testId.replace('web_', '')),
            first_name: 'Web User',
            username: 'web_user'
          };
          await authenticateUser(testUser, null);
        }
      } catch (error) {
        console.error('❌ Initialize error:', error);
        // Fallback
        const fallbackId = 'fallback_' + Date.now();
        setUser({
          tgId: fallbackId,
          firstName: 'User',
          username: 'user',
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
      console.log('✅ Socket connected! ID:', socket.id);
      setSocketConnected(true);
      
      if (user) {
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
  }, [authenticateUser]);

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
    <div className="game-app">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {currentScreen === 'menu' && (
        <div className="main-menu">
          <h1>💥 LIKE-DUEL</h1>
          <div className="profile-badge">
            <h3>👋 {user?.firstName || 'User'}</h3>
            <div style={{ fontSize: '12px', color: '#888' }}>
              ID: {user?.tgId || 'No ID'}
            </div>
            <div className="balances-row">
              <span>🪙 {user?.coins || 0}</span>
              <span>🏆 {user?.rating || 0}</span>
            </div>
            <div className="connection-status">
              {socketConnected ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
          
          <button onClick={() => setCurrentScreen('game')}>
            ⚔️ Onlayn Duel
          </button>
          
          <button onClick={() => setCurrentScreen('bot')}>
            🤖 Bot bilan o'ynash
          </button>
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
  );
}

export default App;