import React, { useEffect, useState } from 'react';
import './App.css'; // Umumiy stillar uchun
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame'; // Sizda deyarli tayyor bo'lgan Bot rejimi

function App() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [rating, setRating] = useState(0);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'bot_game' | 'duel_game' | 'shop'

  useEffect(() => {
    // 1. Telegram WebApp muhitini tekshirish
    const tg = window.Telegram?.WebApp;

    // if (tg && tg.initData && tg.initDataUnsafe?.user) {
    //   tg.expand(); // O'yinni to'liq ekranga ochish
    //   setIsTelegram(true);
      
    //   const user = tg.initDataUnsafe.user;
    //   setTgUser(user);

    //   // Backendga foydalanuvchi ma'lumotlarini va referal kodini yuborish
    //   const startParam = tg.initDataUnsafe.start_param; // ref_123456 ko'rinishida keladi
    //   registerOrFetchUser(user, startParam);
    // } else {
    //   setIsTelegram(false); // Oddiy brauzerlardan kirish bloklanadi
    // }
  }, []);

  // Backend bilan bog'lanib akkauntni yaratish yoki yuklash
  const registerOrFetchUser = async (user, startParam) => {
    try {
      const response = await fetch('https://sening-servering.uz/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          photoUrl: user.photo_url,
          refParent: startParam && startParam.startsWith('ref_') ? startParam.replace('ref_', '') : null
        })
      });
      const data = await response.json();
      if (data.success) {
        setCoins(data.user.coins);
        setRating(data.user.rating);
      }
    } catch (error) {
      console.error("Akkaunt yuklashda xatolik:", error);
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

  return (
    <div className="app-container">
      {activeTab === 'menu' && (
        <div className="main-menu">
          <header className="menu-header">
            <div className="user-profile">
              <span className="user-avatar">{tgUser?.photo_url ? <img src={tgUser.photo_url} alt="avatar" /> : '👤'}</span>
              <div className="user-text">
                <h3>{tgUser?.first_name}</h3>
                <p>🏆 {rating} XP</p>
              </div>
            </div>
            <div className="menu-coins">🪙 {coins}</div>
          </header>

          <main className="menu-buttons">
            {/* 1. Bot bilan o'ynash tugmasi */}
<button className="menu-btn mode-bot" onClick={() => {
  alert("Bot tugmasi bosildi!"); // Test uchun alert
  setActiveTab('bot_game');
}}>
  🤖 Bot bilan mashg'ulot
  <span>(Reytingga ta'sir qilmaydi)</span>
</button>

{/* 2. Duel tugmasi */}
<button className="menu-btn mode-pvp" onClick={() => {
  alert("Duel tugmasi bosildi!"); // Test uchun alert
  setActiveTab('duel_game');
}}>
  ⚔️ Do'stlar bilan Duel
  <span>(Reyting va Tangalar tikiladi!)</span>
</button>
            <div className="game-modes-card">
              <h2>O'YIN REJIMINI TANLANG</h2>
              
              {/* 1. Bot bilan o'ynash (Sizda deyarli tayyor bo'lgan bo'lim) */}
              <button className="menu-btn mode-bot" onClick={() => setActiveTab('bot_game')}>
                🤖 Bot bilan mashg'ulot
                <span>(Reytingga ta'sir qilmaydi)</span>
              </button>

              {/* 2. Do'stlar / Real odamlar bilan duel */}
              <button className="menu-btn mode-pvp" onClick={() => setActiveTab('duel_game')}>
                ⚔️ Do'stlar bilan Duel
                <span>(Reyting va Tangalar tikiladi!)</span>
              </button>
            </div>

            {/* Referal ulashish bo'limi */}
            <div className="referral-box">
              <h3>Do'stlarni taklif qiling!</h3>
              <p>Har bir taklif uchun: do'stingizga <strong>+100 🪙</strong>, sizga <strong>+150 🪙</strong></p>
              <button 
                className="share-btn" 
                onClick={() => {
                  const inviteLink = `https://t.me/SeningOyinBot/app?startapp=ref_${tgUser?.id}`;
                  window.Telegram.WebApp.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("Men bilan tosh-qog'oz-qaychi duelida kuch sinash! 🎮 Kelganing uchun senga sovg'a tangalar bor!")}`
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
        <BotGame coins={coins} setCoins={setCoins} onBackToMenu={() => setActiveTab('menu')} />
      )}

      {activeTab === 'duel_game' && (
        <DuelGame playerCoins={coins} setCoins={setCoins} currentRating={rating} setRating={setRating} onBackToMenu={() => setActiveTab('menu')} />
      )}
    </div>
  );
}

export default App;