import React, { useState, useEffect } from 'react';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  // Rejimlar: 'menu', 'duel_game', 'bot_game', 'leaderboard'
  const [currentScreen, setCurrentScreen] = useState('menu'); 
  const [loading, setLoading] = useState(true);

  // 🎯 Markaziy backend server manzili
  const BACKEND_URL = "https://telegram-bot-server-2-matj.onrender.com";

  // O'yinlardan keyin yoki menuga qaytganda foydalanuvchi ma'lumotlarini serverdan yangilab olish
  const refreshUserData = (tgId) => {
    fetch(`${BACKEND_URL}/api/user/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tgId: String(tgId),
        firstName: user?.firstName || "O'yinchi",
        username: user?.username || ""
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.user) {
        setUser(data.user);
      }
    })
    .catch(err => console.error("Balansni yangilashda xatolik:", err));
  };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();

      const tgUser = tg.initDataUnsafe?.user;
      const startParam = tg.initDataUnsafe?.start_param; // Taklif qilgan do'stning tgId'si

      if (tgUser) {
        // Backend API bilan avtorizatsiya va referal integratsiyasi
        fetch(`${BACKEND_URL}/api/user/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tgId: String(tgUser.id),
            username: tgUser.username || '',
            firstName: tgUser.first_name || "O'yinchi",
            startParam: startParam ? String(startParam) : null // Backend aynan startParam kutmoqda
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
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
      .then(() => alert("🔗 Taklif havolasi nusxalandi! Do'stlaringizga yuboring va 100 tanga bonus oling! 🎉"))
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
            {/* Rejim 1: Onlayn odamlar bilan (Real-time Socket.io ulanishi uchun) */}
            <button className="btn-menu btn-play-online" onClick={() => setCurrentScreen('duel_game')}>
              ⚔️ Onlayn Duel (Real Players)
            </button>
            
            {/* Rejim 2: Bot (Kompyuter) bilan */}
            <button className="btn-menu btn-play-bot" onClick={() => setCurrentScreen('bot_game')}>
              🤖 Bot bilan O'ynash (Practice)
            </button>

            {/* Rejim 3: Peshqadamlar Ro'yxati */}
            <button className="btn-menu btn-leader" onClick={() => setCurrentScreen('leaderboard')}>
              🏆 Peshqadamlar Ro'yxati
            </button>
            
            {/* Rejim 4: Do'stlarni taklif qilish */}
            <button className="btn-menu btn-invite" onClick={copyInviteLink}>
              👥 Do'stlarni Taklif Qilish
            </button>
          </div>
        </div>
      )}

      {/* ⚔️ Onlayn Duel Ekraniga WebSocket va URL integratsiyasi */}
      {currentScreen === 'duel_game' && (
        <DuelGame 
          user={user} 
          setUser={setUser} 
          backendUrl={BACKEND_URL} 
          onBack={() => {
            setCurrentScreen('menu');
            if (user) refreshUserData(user.tgId); // Menuga qaytganda ochko va tangalarni yangilash
          }} 
        />
      )}

      {/* 🤖 Oflayn Bot Ekraniga yo'naltirish */}
      {currentScreen === 'bot_game' && (
        <BotGame 
          user={user} 
          setUser={setUser} 
          backendUrl={BACKEND_URL}
          onBack={() => {
            setCurrentScreen('menu');
            if (user) refreshUserData(user.tgId); // Bot o'yinidan keyin balansni yangilash
          }} 
        />
      )}

      {/* 🏆 Peshqadamlar Ekraniga yo'naltirish */}
      {currentScreen === 'leaderboard' && (
        <Leaderboard 
          backendUrl={BACKEND_URL} 
          onBack={() => setCurrentScreen('menu')} 
        />
      )}
    </div>
  );
}

export default App;