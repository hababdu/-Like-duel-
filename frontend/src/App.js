import React, { useState, useEffect } from 'react';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotification, setShowNotification] = useState(false);

  // Environment variables
  const API_URL = process.env.REACT_APP_API_URL || 'https://telegram-bot-server-2-matj.onrender.com';
  const WS_URL = process.env.REACT_APP_WS_URL || 'wss://telegram-bot-server-2-matj.onrender.com';
  const BOT_USERNAME = process.env.REACT_APP_BOT_USERNAME || 'like_duel_bot';

  // Telegram WebApp event'lari
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      // 1. Telegram WebApp ready
      tg.ready();
      tg.expand();

      // 2. Main button (Telegram pastki tugmasi)
      tg.MainButton?.hide();

      // 3. Back button (Telegram orqa tugmasi)
      tg.BackButton?.hide();

      // 4. Theme o'zgarishi event'i
      tg.onEvent('themeChanged', () => {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.textColor);
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.hintColor);
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.linkColor);
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.buttonColor);
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.buttonTextColor);
      });

      // 5. Viewport o'zgarishi
      tg.onEvent('viewportChanged', (event) => {
        console.log('Viewport changed:', event);
      });

      // 6. Main button click event'i
      tg.onEvent('mainButtonClicked', () => {
        handleMainButtonClick();
      });

      // 7. Back button click event'i
      tg.onEvent('backButtonClicked', () => {
        handleBackButton();
      });

      // 8. Closing event'i
      tg.onEvent('close', () => {
        console.log('App closing...');
        // O'yin holatini saqlash
        if (user) {
          localStorage.setItem('lastUser', JSON.stringify(user));
        }
      });
    }

    return () => {
      if (tg) {
        tg.offEvent('themeChanged');
        tg.offEvent('viewportChanged');
        tg.offEvent('mainButtonClicked');
        tg.offEvent('backButtonClicked');
        tg.offEvent('close');
      }
    };
  }, []);

  // User auth va referral
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
          const tgUser = tg.initDataUnsafe?.user;
          const startParam = tg.initDataUnsafe?.start_param;

          if (tgUser) {
            // Show loading state in Telegram
            tg.showProgress?.(true);

            const response = await fetch(`${API_URL}/api/user/auth`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData || ''
              },
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
              
              // Telegram WebApp data update
              if (tg) {
                tg.showProgress?.(false);
                
                // Main button ni ko'rsatish (agar kerak bo'lsa)
                if (currentScreen === 'menu') {
                  tg.MainButton?.setText('🎮 O\'ynash');
                  tg.MainButton?.show();
                }
              }
              
              // Referral bonus notification
              if (data.user.isRefRewarded) {
                addNotification('🎉 Sizga 100 tanga bonus berildi! Do\'stingizni taklif qilganingiz uchun!');
              }
            }
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Serverga ulanish xatosi:", err);
        setLoading(false);
        
        // Offline rejim
        const savedUser = localStorage.getItem('lastUser');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          setLocalTestData();
        }
        
        // Xatolik notification
        addNotification('⚠️ Serverga ulanishda xatolik. Oflayn rejimda ishlayapsiz.');
      }
    };

    initializeApp();
  }, [API_URL]);

  const setLocalTestData = () => {
    setUser({
      tgId: "1234567",
      firstName: "Habibullo (Dev)",
      username: "habibullo_dev",
      coins: 300,
      rating: 150,
      totalGames: 0,
      wins: 0,
      losses: 0
    });
    setLoading(false);
  };

  // Notification system
  const addNotification = (message) => {
    setNotifications(prev => [...prev, { id: Date.now(), message }]);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  // Main button handler
  const handleMainButtonClick = () => {
    if (currentScreen === 'menu') {
      setCurrentScreen('duel_game');
    } else if (currentScreen === 'duel_game' || currentScreen === 'bot_game') {
      // O'yinni davom ettirish
      window.Telegram?.WebApp?.showAlert('O\'yin davom etmoqda...');
    }
  };

  // Back button handler
  const handleBackButton = () => {
    if (currentScreen !== 'menu') {
      setCurrentScreen('menu');
      const tg = window.Telegram?.WebApp;
      tg?.BackButton?.hide();
    }
  };

  const refreshUserData = async (tgId) => {
    try {
      const response = await fetch(`${API_URL}/api/user/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: String(tgId),
          firstName: user?.firstName || "O'yinchi",
          username: user?.username || ""
        })
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Balansni yangilashda xatolik:", err);
    }
  };

  const copyInviteLink = () => {
    if (!user) return;
    const inviteLink = `https://t.me/${BOT_USERNAME}/app?startapp=${user.tgId}`;
    
    // Telegram WebApp share
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.showAlert('🔗 Taklif havolasi nusxalandi! Do\'stlaringizga yuboring va 100 tanga bonus oling! 🎉');
      tg.MainButton?.setText('📋 Nusxalandi!');
      setTimeout(() => {
        tg.MainButton?.setText('🎮 O\'ynash');
      }, 2000);
    }
    
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        addNotification('🔗 Taklif havolasi nusxalandi!');
      })
      .catch(() => {
        // Fallback: havolani ko'rsatish
        alert(`Taklif havolasi:\n${inviteLink}`);
      });
  };

  // Haptic feedback (telegramda tebranish)
  const triggerHaptic = (style = 'medium') => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(style);
    }
  };

  // Screen o'zgarishi
  const changeScreen = (screen) => {
    setCurrentScreen(screen);
    const tg = window.Telegram?.WebApp;
    
    // Back button
    if (screen === 'menu') {
      tg?.BackButton?.hide();
      tg?.MainButton?.setText('🎮 O\'ynash');
      tg?.MainButton?.show();
    } else {
      tg?.BackButton?.show();
      tg?.MainButton?.hide();
    }
    
    triggerHaptic('light');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Like-Duel yuklanmoqda...</p>
        <p className="loading-subtitle">Telegram ilovasi tayyorlanmoqda</p>
      </div>
    );
  }

  return (
    <div className="game-app" style={{
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)'
    }}>
      {/* Notification */}
      {showNotification && notifications.length > 0 && (
        <div className="notification-popup">
          {notifications[notifications.length - 1]?.message}
        </div>
      )}

      {currentScreen === 'menu' && (
        <div className="main-menu">
          <div className="game-logo">
            <h1>💥 LIKE-DUEL 💥</h1>
            <p className="subtitle">⚡ Tosh, Qog'oz, Qaychi</p>
          </div>

          <div className="profile-badge" style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)'
          }}>
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
              <span>📊 {user?.totalGames ? Math.round((user.wins / user.totalGames) * 100) : 0}% g'alaba</span>
            </div>
          </div>

          <div className="menu-buttons">
            <button 
              className="btn-menu btn-play-online" 
              onClick={() => changeScreen('duel_game')}
            >
              ⚔️ Onlayn Duel
              <span className="btn-badge">Jonli</span>
            </button>
            
            <button 
              className="btn-menu btn-play-bot" 
              onClick={() => changeScreen('bot_game')}
            >
              🤖 Bot bilan O'ynash
              <span className="btn-badge">Practice</span>
            </button>

            <button 
              className="btn-menu btn-leader" 
              onClick={() => changeScreen('leaderboard')}
            >
              🏆 Peshqadamlar
              <span className="btn-badge">TOP 50</span>
            </button>
            
            <button 
              className="btn-menu btn-invite" 
              onClick={copyInviteLink}
            >
              👥 Do'stlarni Taklif Qilish
              <span className="btn-badge">+100 🪙</span>
            </button>
          </div>

          {/* Tez statistika */}
          <div className="quick-stats">
            <button 
              className="stat-btn"
              onClick={() => {
                triggerHaptic('medium');
                const tg = window.Telegram?.WebApp;
                tg?.showAlert(`
                  📊 Statistika:
                  🎮 O'yinlar: ${user?.totalGames || 0}
                  🏅 G'alabalar: ${user?.wins || 0}
                  😢 Mag'lubiyatlar: ${user?.losses || 0}
                  🪙 Tangalar: ${user?.coins || 0}
                  🏆 Reyting: ${user?.rating || 0}
                `);
              }}
            >
              📊 Statistika
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'duel_game' && (
        <DuelGame 
          user={user} 
          setUser={setUser} 
          backendUrl={API_URL}
          wsUrl={WS_URL}
          onBack={() => changeScreen('menu')}
          onNotification={addNotification}
          triggerHaptic={triggerHaptic}
        /> 
      )}

      {currentScreen === 'bot_game' && (
        <BotGame 
          user={user} 
          setUser={setUser} 
          backendUrl={API_URL}
          onBack={() => changeScreen('menu')}
          onNotification={addNotification}
          triggerHaptic={triggerHaptic}
        /> 
      )}

      {currentScreen === 'leaderboard' && (
        <Leaderboard 
          backendUrl={API_URL} 
          onBack={() => changeScreen('menu')}
          onNotification={addNotification}
        /> 
      )}
    </div>
  );
}

export default App;