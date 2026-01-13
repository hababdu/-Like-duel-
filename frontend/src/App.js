import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const userData = tg.initDataUnsafe?.user;
      setUser(userData);
      
      // Backend'ga foydalanuvchi ma'lumotlarini yuborish
      if (userData) {
        saveUserToBackend(userData);
      }
      
      // Main Button
      tg.MainButton.setText("Saqlangan ✓");
      tg.MainButton.color = "#31b545";
      tg.MainButton.show();
    }
  }, []);
  
  // Backend'ga foydalanuvchi ma'lumotlarini yuborish
  const saveUserToBackend = async (userData) => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const result = await response.json();
      console.log('Backend javobi:', result);
    } catch (error) {
      console.error('Foydalanuvchini saqlashda xato:', error);
    }
  };
  
  return (
    <div className="app">
      <h1>📊 Foydalanuvchi Ma'lumotlari</h1>
      {user ? (
        <div className="user-card">
          <div className="avatar">{user.first_name?.[0]}</div>
          <h2>{user.first_name} {user.last_name || ''}</h2>
          <p>👤 ID: {user.id}</p>
          <p>📱 Username: @{user.username || 'yo\'q'}</p>
          <p>🌐 Til: {user.language_code || 'en'}</p>
          <p className="status">✅ Ma'lumotlaringiz saqlandi</p>
        </div>
      ) : (
        <p>Foydalanuvchi ma'lumotlari yuklanmoqda...</p>
      )}
    </div>
  );
}