import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Telegram Web App ob'ektini tekshirish
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // App tayyor ekanligini bildirish
      tg.ready();
      
      // Foydalanuvchi ma'lumotlarini olish
      const userData = tg.initDataUnsafe?.user;
      setUser(userData);
      
      // App'ni kengaytirish (to'liq ekran)
      tg.expand();
      
      // Tema parametrlarini olish
      console.log('Tema:', tg.themeParams);
      console.log('Platforma:', tg.platform);
      
      setLoading(false);
    } else {
      console.error('Telegram SDK topilmadi!');
      setLoading(false);
    }
  }, []);

  // Telegram MainButton ni boshqarish
  const setupMainButton = () => {
    const tg = window.Telegram.WebApp;
    
    tg.MainButton.setText("Boshlash");
    tg.MainButton.color = "#3390ec";
    tg.MainButton.textColor = "#ffffff";
    tg.MainButton.show();
    
    tg.MainButton.onClick(() => {
      tg.showAlert("Tugma bosildi!");
      // Ma'lumot yuborish
      tg.sendData(JSON.stringify({ action: 'start' }));
    });
  };

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Mening Telegram App'im</h1>
      </header>
      
      <main className="main-content">
        {user ? (
          <div className="user-info">
            <div className="avatar-placeholder">
              {user.first_name?.[0] || 'U'}
            </div>
            <h2>Assalomu alaykum, {user.first_name || 'Foydalanuvchi'}!</h2>
            <p className="user-id">ID: {user.id}</p>
            <p className="username">@{user.username || 'username yo\'q'}</p>
          </div>
        ) : (
          <div className="guest-info">
            <h2>Mehmon sifatida kiryapsiz</h2>
            <p>Bot orqali kirish tavsiya etiladi</p>
          </div>
        )}
        
        <div className="features">
          <h3>Mavjud funksiyalar:</h3>
          <ul>
            <li>📱 Telegram Web App SDK</li>
            <li>👤 Foydalanuvchi ma'lumotlari</li>
            <li>🎨 Tema moslashuvi</li>
            <li>📦 Ma'lumot yuborish</li>
          </ul>
        </div>
        
        <button 
          className="test-button"
          onClick={setupMainButton}
        >
          Tugmani Faollashtirish
        </button>
      </main>
      
      <footer className="footer">
        <p>Telegram Mini App - React</p>
      </footer>
    </div>
  );
}

export default App;