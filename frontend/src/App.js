// ============================================================
// APP.JS - TELEGRAM ID NI TO'G'RI OLISH
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isBotMode, setIsBotMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

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
    } catch (e) {
      // Silent fail
    }
  }, []);

  // ======================
  // USER AUTH - TELEGRAM UCHUN
  // ======================
  const authenticateUser = useCallback(async (tgUser, startParam) => {
    try {
      // Telegram ID ni string ga o'tkazish
      const tgId = String(tgUser.id);
      console.log('🔑 Authenticating user:', tgId);
      console.log('📱 User data:', tgUser);

      const response = await fetch(`${BACKEND_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: tgId,
          username: tgUser.username || '',
          firstName: tgUser.first_name || "O'yinchi",
          lastName: tgUser.last_name || '',
          photoUrl: tgUser.photo_url || '',
          refParent: startParam ? String(startParam) : null
        })
      });

      const data = await response.json();
      console.log('📥 Auth response:', data);

      if (data.success && data.user) {
        setUser(data.user);
        console.log('✅ User authenticated:', data.user.tgId);
        
        // Socket ga ulanish
        if (socket && socket.connected) {
          socket.emit('user_connect', {
            tgId: String(data.user.tgId),
            firstName: data.user.firstName || "O'yinchi",
            username: data.user.username || ''
          });
        }
        
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('❌ Auth error:', error);
      return null;
    }
  }, [BACKEND_URL]);

  // ======================
  // INITIALIZE - TELEGRAM
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

          if (tgUser) {
            await authenticateUser(tgUser, startParam);
          } else {
            console.error('❌ No Telegram user data');
            // Fallback - test user
            setUser({
              tgId: 'test_' + Date.now(),
              firstName: 'Test User',
              username: 'test_user',
              coins: 300,
              rating: 150,
              totalGames: 0,
              wins: 0,
              losses: 0,
              isRefRewarded: false
            });
          }
        } else {
          console.log('🌐 Web browser detected');
          // Brauzer uchun test user
          const testId = 'web_' + Date.now();
          setUser({
            tgId: testId,
            firstName: 'Web User',
            username: 'web_user',
            coins: 300,
            rating: 150,
            totalGames: 0,
            wins: 0,
            losses: 0,
            isRefRewarded: false
          });
          
          // Socket ga ulanish
          if (socket) {
            socket.emit('user_connect', {
              tgId: testId,
              firstName: 'Web User',
              username: 'web_user'
            });
          }
        }
      } catch (error) {
        console.error('❌ Initialize error:', error);
        // Fallback user
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
      
      // Agar user mavjud bo'lsa, socket ga ulanish
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

    const onUserStatus = (data) => {
      console.log('📊 User status:', data);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_connected', onUserConnected);
    socket.on('user_status', onUserStatus);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_connected', onUserConnected);
      socket.off('user_status', onUserStatus);
    };
  }, [authenticateUser, user]);

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
            <h3>👋 {user?.firstName}</h3>
            <div className="balances-row">
              <span>🪙 {user?.coins || 0}</span>
              <span>🏆 {user?.rating || 0}</span>
            </div>
            <div className="connection-status">
              {socketConnected ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
          
          <button onClick={() => {
            setIsBotMode(false);
            setCurrentScreen('game');
          }}>
            ⚔️ Onlayn Duel
          </button>
          
          <button onClick={() => {
            setIsBotMode(true);
            setCurrentScreen('bot');
          }}>
            🤖 Bot bilan o'ynash
          </button>
          
          <button onClick={() => {
            setShowLeaderboard(true);
            fetchLeaderboard();
          }}>
            🏆 Peshqadamlar
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