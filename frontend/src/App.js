// src/App.jsx
import React, { useEffect, useState } from 'react';
import BotGame from './components/BotGame';
import MultiplayerGame from './components/MultiplayerGame';
import MenuScreen from './components/MenuScreen';
import DifficultySelect from './components/DifficultySelect';

export const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
};

function App() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(1500);
  const [mode, setMode] = useState('menu');
  const [difficulty, setDifficulty] = useState('medium');
  const [isLoading, setIsLoading] = useState(true); // Yangi: loading holati
  const [telegramData, setTelegramData] = useState(null); // Yangi: Telegram ma'lumotlari

  // 1. Telegram Mini App yuklanishi va user olish
  useEffect(() => {
    console.log('🚀 App component yuklanmoqda...');
    
    // Telegram WebApp mavjudligini tekshirish
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      console.log('✅ Telegram WebApp mavjud:', tg);
      
      // Telegram ilovasini ishga tushirish
      tg.ready();
      tg.expand(); // To'liq ekran
      
      // Telegramdan foydalanuvchi ma'lumotlarini olish
      const initData = tg.initDataUnsafe;
      console.log('📱 Telegram initData:', initData);
      
      if (initData && initData.user) {
        // Telegram user ma'lumotlarini o'z formatimizga o'tkazish
        const tgUser = {
          id: initData.user.id,
          first_name: initData.user.first_name || '',
          last_name: initData.user.last_name || '',
          username: initData.user.username || `user_${initData.user.id}`,
          language_code: initData.user.language_code || 'uz',
          is_premium: initData.user.is_premium || false,
          is_bot: initData.user.is_bot || false
        };
        
        console.log('👤 Telegram user olingan:', tgUser);
        setUser(tgUser);
        setTelegramData(initData);
        
        // Agar coinlar yo'qsa, Telegram user ID ga asoslangan boshlang'ich coinlar
        if (coins === 1500) {
          const userCoins = 1500 + (initData.user.id % 1000); // Har bir user uchun bir oz farqli
          setCoins(userCoins);
        }
      } else {
        console.log('⚠️ Telegram user ma\'lumotlari topilmadi. Demo rejimda ishlaymiz.');
        // Demo foydalanuvchi yaratish
        setUser({
          id: Date.now(),
          first_name: 'Demo',
          last_name: 'Player',
          username: 'demo_player',
          language_code: 'uz',
          is_premium: false,
          is_bot: false
        });
      }
    } else {
      console.log('🌐 Telegram muhiti topilmadi. Brauzer rejimida ishlaymiz.');
      // Brauzer uchun demo foydalanuvchi
      setUser({
        id: Math.floor(Math.random() * 10000) + 1000,
        first_name: 'Browser',
        last_name: 'User',
        username: 'browser_user',
        language_code: navigator.language || 'uz',
        is_premium: false,
        is_bot: false
      });
    }
    
    // Loading ni tugatish
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
  }, []); // Faqat birinchi renderda ishlaydi

  const showNotif = (text, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${text}`);
    
    // Telegramda notification ko'rsatish
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      
      if (type === 'error') {
        tg.showAlert(text);
      } else if (type === 'success') {
        tg.showPopup({
          title: 'Muvaffaqiyat!',
          message: text,
          buttons: [{ type: 'ok' }]
        });
      } else {
        tg.showPopup({
          title: 'Xabar',
          message: text,
          buttons: [{ type: 'ok' }]
        });
      }
    }
  };

  // Loading holatida
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <h2>Telegram o'yini yuklanmoqda...</h2>
        <p>Iltimos, kuting</p>
      </div>
    );
  }

  // Agar user hali ham null bo'lsa (xatolik holati)
  if (!user) {
    return (
      <div className="app-error">
        <h2>❌ Xatolik yuz berdi</h2>
        <p>Foydalanuvchi ma'lumotlarini olish mumkin emas</p>
        <button 
          className="retry-btn" 
          onClick={() => window.location.reload()}
        >
          Qayta yuklash
        </button>
        <button 
          className="demo-btn" 
          onClick={() => {
            setUser({
              id: 9999,
              first_name: 'Demo',
              username: 'demo_mode'
            });
            setIsLoading(false);
          }}
        >
          Demo rejimda davom etish
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* App header - foydalanuvchi ma'lumotlari va coins */}
      <div className="app-header">
        <div className="user-info">
          <div className="user-avatar">
            {user.first_name?.charAt(0) || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">
              {user.first_name} {user.last_name || ''}
            </div>
            <div className="user-username">@{user.username}</div>
          </div>
        </div>
        <div className="coins-display">
          <span className="coins-icon">🪙</span>
          <span className="coins-amount">{coins}</span>
        </div>
      </div>

      {/* Asosiy kontent */}
      {mode === 'menu' && (
        <MenuScreen
          user={user}
          onMultiplayer={() => setMode('multiplayer')}
          onBotGame={() => setMode('bot-select')}
          coins={coins}
        />
      )}

      {mode === 'bot-select' && (
        <DifficultySelect
          onSelect={diff => {
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
          user={user} // User ma'lumotlarini BotGame ga ham yuborish
        />
      )}

      {mode === 'multiplayer' && (
        <MultiplayerGame
          user={user} // ✅ Endi user to'g'ri keladi!
          coins={coins}
          setCoins={setCoins}
          CHOICES={CHOICES}
          onBackToMenu={() => setMode('menu')}
          showNotif={showNotif}
          telegramData={telegramData} // Qo'shimcha Telegram ma'lumotlari
        />
      )}

      {/* App footer */}
      <div className="app-footer">
        <div className="mode-indicator">
          {window.Telegram ? 'Telegram App' : 'Web Browser'}
        </div>
        <div className="user-id">ID: {user.id}</div>
      </div>
    </div>
  );
}

export default App;