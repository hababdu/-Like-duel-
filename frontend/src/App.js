// ============================================================
// APP.JS - TELEGRAM MA'LUMOTLARINI OLISH
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
  const [telegramInitData, setTelegramInitData] = useState(null);

  const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

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
      
      // Telegram ma'lumotlarini olish
      const initData = tg.initData || '';
      const initDataUnsafe = tg.initDataUnsafe || {};
      const user = initDataUnsafe.user || null;
      
      console.log('📱 Telegram initData:', initData);
      console.log('📱 Telegram initDataUnsafe:', initDataUnsafe);
      console.log('👤 Telegram user:', user);
      
      if (user) {
        console.log('✅ User ID:', user.id);
        console.log('✅ User first_name:', user.first_name);
        console.log('✅ User username:', user.username);
        console.log('✅ User photo_url:', user.photo_url);
      }
      
      return {
        initData,
        initDataUnsafe,
        user,
        tg
      };
    } catch (error) {
      console.error('❌ Telegram ma\'lumotlarini olishda xatolik:', error);
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
        // Test user
        tgId = 'test_' + Date.now();
      }

      console.log('🔑 Authenticating user ID:', tgId);
      console.log('📱 User data:', tgUser);

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
        const userData = {
          ...data.user,
          tgId: String(data.user.tgId)
        };
        setUser(userData);
        console.log('✅ User authenticated:', userData);
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
        console.log('🚀 ===== INITIALIZING APP =====');
        
        // 1. Telegram ma'lumotlarini olish
        const tgData = getTelegramData();
        console.log('📱 Telegram data:', tgData);
        
        if (tgData) {
          setTelegramUser(tgData.user);
          setTelegramInitData(tgData.initData);
          
          const tg = tgData.tg;
          const tgUser = tgData.user;
          const startParam = tgData.initDataUnsafe?.start_param;
          
          // Telegram WebApp ni tayyorlash
          if (tg) {
            tg.ready();
            tg.expand();
            console.log('✅ Telegram WebApp ready');
          }
          
          if (tgUser && tgUser.id) {
            console.log('👤 Telegram user found:', tgUser);
            await authenticateUser(tgUser, startParam);
          } else {
            console.warn('⚠️ Telegram user ma\'lumotlari yo\'q');
            // Test user
            const testUser = {
              id: Date.now(),
              first_name: 'Test User',
              username: 'test_user'
            };
            await authenticateUser(testUser, null);
          }
        } else {
          console.warn('⚠️ Telegram WebApp topilmadi, test user ishlatiladi');
          // Brauzer test user
          const testUser = {
            id: Date.now(),
            first_name: 'Web User',
            username: 'web_user'
          };
          await authenticateUser(testUser, null);
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
        console.log('✅ ===== INITIALIZATION COMPLETE =====');
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

    const onUserConnected = (data) => {
      console.log('✅ User connected response:', data);
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
  }, [authenticateUser, getTelegramData, user]);

  // ======================
  // RENDER - TELEGRAM MA'LUMOTLARINI KO'RSATISH
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
      {/* TELEGRAM MA'LUMOTLARI - DEBUG PANEL */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(0,0,0,0.95)',
        color: '#00ff88',
        padding: '12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        borderBottom: '2px solid #00ff88',
        maxHeight: '200px',
        overflow: 'auto'
      }}>
        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
          📱 TELEGRAM MA'LUMOTLARI
        </div>
        
        {/* Telegram User */}
        <div style={{ color: '#ffaa00' }}>
          <strong>Telegram User:</strong>
        </div>
        {telegramUser ? (
          <div style={{ paddingLeft: '16px', color: '#00ff88' }}>
            <div>✅ ID: <strong>{telegramUser.id}</strong></div>
            <div>👤 First Name: <strong>{telegramUser.first_name}</strong></div>
            <div>👤 Last Name: {telegramUser.last_name || '❌ Yo\'q'}</div>
            <div>📛 Username: @{telegramUser.username || '❌ Yo\'q'}</div>
            <div>🖼️ Photo: {telegramUser.photo_url ? '✅ Bor' : '❌ Yo\'q'}</div>
            <div>🔗 Language: {telegramUser.language_code || '❌ Yo\'q'}</div>
          </div>
        ) : (
          <div style={{ paddingLeft: '16px', color: '#ff4444' }}>
            ❌ Telegram user ma'lumotlari topilmadi!
          </div>
        )}
        
        {/* App User */}
        <div style={{ color: '#ffaa00', marginTop: '8px' }}>
          <strong>App User:</strong>
        </div>
        {user ? (
          <div style={{ paddingLeft: '16px', color: '#00ff88' }}>
            <div>✅ ID: <strong>{user.tgId}</strong></div>
            <div>👤 Name: <strong>{user.firstName}</strong></div>
            <div>🪙 Coins: <strong>{user.coins}</strong></div>
            <div>🏆 Rating: <strong>{user.rating}</strong></div>
          </div>
        ) : (
          <div style={{ paddingLeft: '16px', color: '#ff4444' }}>
            ❌ App user ma'lumotlari topilmadi!
          </div>
        )}
        
        {/* Connection Status */}
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
          <div>🔌 Socket: {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
          <div>📱 Platform: {window.Telegram?.WebApp ? 'Telegram WebApp' : 'Web Browser'}</div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ marginTop: '220px' }}>
        {currentScreen === 'menu' && (
          <div className="main-menu">
            <h1>💥 LIKE-DUEL</h1>
            
            {/* User Profile */}
            <div className="profile-badge" style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '20px',
              margin: '16px 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {telegramUser?.photo_url ? (
                  <img 
                    src={telegramUser.photo_url} 
                    alt="Profile" 
                    style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                  />
                ) : (
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    {user?.firstName?.charAt(0) || '?'}
                  </div>
                )}
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0 }}>👋 {user?.firstName || 'User'}</h3>
                  {telegramUser?.username && (
                    <div style={{ color: '#888', fontSize: '14px' }}>@{telegramUser.username}</div>
                  )}
                  <div style={{ color: '#888', fontSize: '12px' }}>
                    ID: {user?.tgId || 'No ID'}
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>🪙 Tanga</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{user?.coins || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>🏆 XP</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{user?.rating || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888' }}>🎮 O'yin</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{user?.totalGames || 0}</div>
                </div>
              </div>
            </div>

            {/* Menu Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => setCurrentScreen('game')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ⚔️ Onlayn Duel
              </button>
              
              <button 
                onClick={() => setCurrentScreen('bot')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🤖 Bot bilan o'ynash
              </button>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '8px',
              borderRadius: '8px',
              background: socketConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
              textAlign: 'center',
              fontSize: '14px',
              color: socketConnected ? '#00ff88' : '#ff4444'
            }}>
              {socketConnected ? '🟢 Serverga ulangan' : '🔴 Serverga ulanish yo\'q'}
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
    </div>
  );
}

export default App;