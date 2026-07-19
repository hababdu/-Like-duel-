import React, { useEffect, useState } from 'react';
import './App.css'; // Umumiy stillar uchun
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame'; 
import socket from './socket'; // Socket obyektimiz

function App() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [rating, setRating] = useState(0);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'bot_game' | 'duel_game'
  const [isLoading, setIsLoading] = useState(true); // Yuklanish indikatori

  useEffect(() => {
    // 1. Telegram WebApp muhitini tekshirish
    const tg = window.Telegram?.WebApp;

    if (tg && tg.initData && tg.initDataUnsafe?.user) {
      tg.expand(); // O'yinni to'liq ekranga ochish
      setIsTelegram(true);
      
      const user = tg.initDataUnsafe.user;
      setTgUser(user);

      // Backendga foydalanuvchi ma'lumotlarini yuklash uchun yuboramiz
      const startParam = tg.initDataUnsafe.start_param; 
      registerOrFetchUser(user, startParam);
    } else {
      // BRAUZERDA TEST QILISH REJIMI:
      setIsTelegram(true); 
      const mockUser = { id: '99887766', first_name: 'Habibullo Dev', username: 'habibullo_dev' };
      setTgUser(mockUser);
      registerOrFetchUser(mockUser, null);
    }
  }, []);

  // Backend bilan bog'lanib akkauntni yaratish yoki yuklash
  const registerOrFetchUser = async (user, startParam) => {
    setIsLoading(true);
    try {
      const response = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: user.id.toString(),
          username: user.username || '',
          firstName: user.first_name || "O'yinchi",
          lastName: user.last_name || '',
          photoUrl: user.photo_url || '',
          refParent: startParam && startParam.startsWith('ref_') ? startParam.replace('ref_', '') : null
        })
      });
      
      const data = await response.json();
      console.log("Serverdan kelgan to'liq ma'lumot:", data);
      
      // 🎯 BAZADAN KELGAN REAL TANGALARNI TEKSHIRISH
      if (data && data.success && data.user) {
        // Agar foydalanuvchi allaqachon bazada bo'lsa, uning saqlangan tangalarini oladi
        setCoins(data.user.coins);
        setRating(data.user.rating);
        console.log("Bazadan yuklangan real tangalar:", data.user.coins);
      } else if (data && data.coins !== undefined) {
        setCoins(data.coins);
        setRating(data.rating || 100);
      }
    } catch (error) {
      console.error("Akkaunt yuklashda xatolik yuz berdi:", error);
      // Xatolik bo'lsa majburiy 100 qilmaymiz, localstorage yoki eski holatda qoldiramiz
      showNotif("Tarmoq xatosi! Ma'lumotlar oxirgi seansdan yuklanadi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- DUEL REJIMIGA KIRISH VA CHIQISH ---
  const enterDuelMode = () => {
    socket.connect(); 
    setActiveTab('duel_game');
  };

  const leaveDuelMode = () => {
    socket.disconnect(); 
    setActiveTab('menu');
  };

  const showNotif = (msg, type) => {
    console.log(`[${type.toUpperCase()}]: ${msg}`);
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert(msg);
    }
  };

  // --- BRAUZERLAR UCHUN BLOKLASH EKRANI ---
  if (!isTelegram) {
    return (
      <div className="block-screen">
        <div className="block-card">
          <div className="block-icon">🚫</div>
          <h2>Kirish taqiqlangan!</h2>
          <p>Ushbu o'yin faqat <strong>Telegram Mini App</strong> ichida ishlashga mo'ljallangan.</p>
          <p>O'yinni boshlash uchun quyidagi botga o'ting:</p>
          <a href="https://t.me/SeningOyinBot" className="tg-btn">
            Botga o'tish 🚀
          </a>
        </div>
      </div>
    );
  }

  // O'yin yuklanayotgan paytda ekranda "Yuklanmoqda..." yozuvi turadi
  if (isLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="radar-spinner" style={{margin: 0}}>
          <div className="circle-1"></div>
          <div className="circle-2"></div>
          <div className="circle-3"></div>
        </div>
        <p style={{ marginTop: '20px', color: '#b9bbbe', fontWeight: 'bold' }}>Ma'lumotlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {activeTab === 'menu' && (
        <div className="main-menu">
          <header className="menu-header">
            <div className="user-profile">
              <span className="user-avatar">{tgUser?.photo_url ? <img src={tgUser.photo_url} alt="avatar" /> : '👤'}</span>
              <div className="user-text">
                <h3>{tgUser?.first_name || "O'yinchi"}</h3>
                <p>🏆 {rating} XP</p>
              </div>
            </div>
            <div className="menu-coins">🪙 {coins}</div>
          </header>

          <main className="menu-buttons">
            <div className="game-modes-card">
              <h2>O'YIN REJIMINI TANLANG</h2>
              
              {/* 1. Bot bilan o'ynash */}
              <button className="menu-btn mode-bot" onClick={() => setActiveTab('bot_game')}>
                🤖 Bot bilan mashg'ulot
                <span>(Reytingga ta'sir qilmaydi)</span>
              </button>

              {/* 2. Real odamlar bilan duel */}
              <button className="menu-btn mode-pvp" onClick={enterDuelMode}>
                ⚔️ Do'stlar bilan Duel
                <span>(Reyting va Tangalar tikiladi!)</span>
              </button>
            </div>

            {/* Referal ulashish bo'limi */}
            <div className="referral-box">
              <h3>Do'stlarni taklif qiling!</h3>
              <p>Har bir taklif uchun: do'stingizga <strong>+100 🪙</strong>, sizga <strong>+100 🪙</strong></p>
              <button 
                className="share-btn" 
                onClick={() => {
                  const inviteLink = `https://t.me/SeningOyinBot/app?startapp=ref_${tgUser?.id || '123'}`;
                  window.Telegram.WebApp.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("Men bilan tosh-qog'oz-qaychi duelida kuch simash! 🎮 Kelganing uchun senga sovg'a tangalar bor!")}`
                  );
                }}
              >
                🔗 Taklifnoma yuborish
              </button>
            </div>
          </main>
        </div>
      )}

      {activeTab === 'bot_game' && (
        <BotGame 
          coins={coins} 
          setCoins={setCoins} 
          onBackToMenu={() => setActiveTab('menu')}
          difficulty="medium"
          showNotif={showNotif}
        />
      )}

      {activeTab === 'duel_game' && (
        <DuelGame 
          socket={socket} 
          playerCoins={coins} 
          setCoins={setCoins} 
          currentRating={rating} 
          setRating={setRating} 
          onBackToMenu={leaveDuelMode} 
          showNotif={showNotif}
        />
      )}
    </div>
  );
}

export default App;