// src/App.jsx
import React, { useEffect, useState } from 'react';
import BotGame from './components/BotGame';
import MultiplayerGame from './components/MultiplayerGame';
import MenuScreen from './components/MenuScreen';
import DifficultySelect from './components/DifficultySelect';
import './App.css';

const CHOICES = {
  rock: { emoji: '✊', color: '#ff4d94' },
  paper: { emoji: '✋', color: '#00ff9d' },
  scissors: { emoji: '✌️', color: '#ffd700' }
};

function App() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(1500);
  const [mode, setMode] = useState('menu');
  const [difficulty, setDifficulty] = useState('medium');
  const [isLoading, setIsLoading] = useState(true);

  // Telegram Mini App ni ishga tushirish
// Telegram Mini App ni ishga tushirish
useEffect(() => {
  console.log('🚀 App yuklanmoqda...');
  
  // 1. Telegram muhitini tekshirish
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    console.log('✅ Telegram WebApp mavjud');
    
    // Telegram WebApp ni to'liq ishga tushirish
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Back button ni yoqish
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
      tg.close();
    });
    
    // Telegramdan foydalanuvchi ma'lumotlarini olish
    const initData = tg.initDataUnsafe;
    console.log('📋 Telegram initData:', initData);
    
    if (initData?.user) {
      // Telegram user ma'lumotlarini olish
      // src/App.jsx ichida useEffect ichida tgUser ob'ektini yaratish joyi

const tgUser = {
  id: initData.user.id,
  first_name: initData.user.first_name || 'User',
  last_name: initData.user.last_name || '',
  username: initData.user.username || `user_${initData.user.id}`,
  language_code: initData.user.language_code || 'uz',
  is_premium: initData.user.is_premium || false,
  photo_url: initData.user.photo_url || null,          // ← qo'shildi yoki mavjud bo'lsa saqlanadi
  initData: tg.initData
};
      console.log('👤 Telegram user:', tgUser);
      setUser(tgUser);
      
      // Telegramda haptic feedback
      tg.HapticFeedback.impactOccurred('light');
    } else {
      // Demo user yaratish
      console.log('⚠️ Telegram user yoʻq, demo yaratilmoqda');
      setUser({
        id: Date.now(),
        first_name: 'Demo',
        last_name: 'Player',
        username: 'demo_player',
        language_code: 'uz',
        is_premium: false,
        photo_url: null,
        initData: '' // Empty initData
      });
    }
  } else {
    // Oddiy brauzer uchun
    console.log('🌐 Oddiy brauzer rejimi');
    setUser({
      id: Math.floor(Math.random() * 1000000) + 1000,
      first_name: 'Browser',
      last_name: 'User',
      username: 'browser_user',
      language_code: navigator.language.split('-')[0] || 'en',
      is_premium: false,
      photo_url: null,
      initData: '' // Empty initData
    });
  }
  
  // Loading ni tugatish
  setTimeout(() => {
    setIsLoading(false);
    console.log('✅ App yuklandi');
  }, 1000);
  
}, []);

  // Notification funksiyasi
  const showNotif = (text, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${text}`);
    
    // Telegram uchun vibration
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      switch(type) {
        case 'error':
          tg.HapticFeedback.notificationOccurred('error');
          break;
        case 'success':
          tg.HapticFeedback.notificationOccurred('success');
          break;
        case 'warning':
          tg.HapticFeedback.impactOccurred('medium');
          break;
      }
    }
    
    // Keyinchalik UI notification qo'shishingiz mumkin
    const notificationEl = document.getElementById('notification');
    if (notificationEl) {
      notificationEl.textContent = text;
      notificationEl.className = `notification ${type}`;
      notificationEl.style.display = 'block';
      
      setTimeout(() => {
        notificationEl.style.display = 'none';
      }, 3000);
    }
  };

  // Loading holati
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <h2>Telegram O'yini</h2>
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  // Agar user bo'lmasa
  if (!user) {
    return (
      <div className="app-error">
        <h2>❌ Xatolik</h2>
        <p>Foydalanuvchi ma'lumotlari olinmadi</p>
        <button onClick={() => window.location.reload()}>Qayta yuklash</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Notification area */}
      <div id="notification" className="notification"></div>
      
      {/* App Header */}
      <div className="app-header">
        <div className="user-section">
        <div className="user-avatar">
  {user.photo_url ? (
    <img src={user.photo_url} alt="" />
  ) : (
    user.first_name?.charAt(0).toUpperCase() || '?'
  )}
</div>
          <div className="user-info">
            <div className="user-name">
              {user.first_name} {user.last_name}
            </div>
            <div className="user-id">ID: {user.id}</div>
          </div>
        </div>
        
        <div className="coins-section">
          <div className="coins-icon">🪙</div>
          <div className="coins-amount">{coins}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        {mode === 'menu' && (
          <MenuScreen
            user={user}
            coins={coins}
            onMultiplayer={() => {
              console.log('🎮 Multiplayer tanlandi');
              setMode('multiplayer');
            }}
            onBotGame={() => {
              console.log('🤖 Bot game tanlandi');
              setMode('bot-select');
            }}
          />
        )}

        {mode === 'bot-select' && (
          <DifficultySelect
            onSelect={(diff) => {
              console.log('📊 Difficulty:', diff);
              setDifficulty(diff);
              setMode('playing-bot');
            }}
            onBack={() => setMode('menu')}
          />
        )}

        {mode === 'playing-bot' && (
          <BotGame
            difficulty={difficulty}
            coins={coins}
            setCoins={setCoins}
            CHOICES={CHOICES}
            onBackToMenu={() => setMode('menu')}
            showNotif={showNotif}
            user={user}
          />
        )}

        {mode === 'multiplayer' && (
          <MultiplayerGame
            user={user}
            coins={coins}
            setCoins={setCoins}
            CHOICES={CHOICES}
            onBackToMenu={() => setMode('menu')}
            showNotif={showNotif}
          />
        )}
      </div>

      {/* App Footer */}
      <div className="app-footer">
        <div className="mode-info">
          {window.Telegram ? 'Telegram App' : 'Web Browser'}
        </div>
        <div className="version">v1.0.0</div>
      </div>
    </div>
  );
}

export default App;