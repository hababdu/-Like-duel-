import React, { useState, useEffect } from 'react';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame'; // Sizda tayyor bo'lgan komponent
import Leaderboard from './components/Leaderboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  // Rejimlar: 'menu', 'duel_game', 'bot_game', 'leaderboard'
  const [currentScreen, setCurrentScreen] = useState('menu'); 
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = "https://telegram-bot-server-2-matj.onrender.com";

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();

      const tgUser = tg.initDataUnsafe?.user;
      const startParam = tg.initDataUnsafe?.start_param; 

      if (tgUser) {
        fetch(`${BACKEND_URL}/api/user/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tgId: String(tgUser.id),
            username: tgUser.username || '',
            firstName: tgUser.first_name || "O'yinchi",
            lastName: tgUser.last_name || '',
            photoUrl: tgUser.photo_url || '',
            refParent: startParam ? String(startParam) : null
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUser(data.user);
          } else {
            setLocalTestData();
          }
        })
        .catch(err => {
          console.error("Serverga ulanish xatosi:", err);
          setLocalTestData();
        })
        .finally(() => setLoading(false));
      } else {
        setLocalTestData();
      }
    } else {
      setLocalTestData();
    }
  }, []);

  const setLocalTestData = () => {
    setUser({
      tgId: "1234567",
      firstName: "Habibullo (Dev)",
      username: "habibullo_dev",
      coins: 300,
      rating: 150
    });
    setLoading(false);
  };

  const copyInviteLink = () => {
    if (!user) return;
    const botUsername = "like_duel_bot";
    const inviteLink = `https://t.me/${botUsername}/app?startapp=${user.tgId}`;
    
    navigator.clipboard.writeText(inviteLink)
      .then(() => alert("🔗 Taklif havolasi nusxalandi! Do'stlaringizga yuboring va 100 tanga oling! 🎉"))
      .catch(() => alert("Nusxalashda xatolik yuz berdi."));
  };

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
      {currentScreen === 'menu' && (
        <div className="main-menu">
          <div className="game-logo">
            <h1>💥 LIKE-DUEL 💥</h1>
          </div>

          <div className="profile-badge">
            <div className="profile-info">
              <h3>👋 {user?.firstName}</h3>
            </div>
            <div className="balances-row">
              <div className="balance-item">🪙 <span>{user?.coins}</span> Tanga</div>
              <div className="balance-item">🏆 <span>{user?.rating}</span> XP</div>
            </div>
          </div>

          <div className="menu-buttons">
            {/* Rejim 1: Onlayn odamlar bilan */}
            <button className="btn-menu btn-play-online" onClick={() => setCurrentScreen('duel_game')}>
              ⚔️ Onlayn Duel (Real Players)
            </button>
            
            {/* Rejim 2: Bot (Kompyuter) bilan */}
            <button className="btn-menu btn-play-bot" onClick={() => setCurrentScreen('bot_game')}>
              🤖 Bot bilan O'ynash (Practice)
            </button>

            <button className="btn-menu btn-leader" onClick={() => setCurrentScreen('leaderboard')}>
              🏆 Peshqadamlar Ro'yxati
            </button>
            
            <button className="btn-menu btn-invite" onClick={copyInviteLink}>
              👥 Do'stlarni Taklif Qilish
            </button>
          </div>
        </div>
      )}

      {/* ⚔️ Onlayn Duel Ekraniga yo'naltirish */}
      {currentScreen === 'duel_game' && (
        <DuelGame user={user} setUser={setUser} onBack={() => setCurrentScreen('menu')} />
      )}

      {/* 🤖 Oflayn Bot Ekraniga yo'naltirish (Sizdagi tayyor komponent chaqiriladi) */}
      {currentScreen === 'bot_game' && (
        <BotGame user={user} setUser={setUser} onBack={() => setCurrentScreen('menu')} />
      )}

      {/* 🏆 Peshqadamlar Ekraniga yo'naltirish */}
      {currentScreen === 'leaderboard' && (
        <Leaderboard onBack={() => setCurrentScreen('menu')} />
      )}
    </div>
  );
}

export default App;