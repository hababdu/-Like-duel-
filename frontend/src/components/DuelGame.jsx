import React, { useEffect, useState, useRef } from 'react';
import './DuelGame.css';

function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif }) {
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'searching' | 'playing' | 'result'
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [timer, setTimer] = useState(30);
  
  // 💬 Chat Statelari
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState(""); // Klaviaturadan yoziladigan matn
  const [hasBoughtLink, setHasBoughtLink] = useState(false); // 10 tangaga profil ochilganlik holati
  const chatEndRef = useRef(null);

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user || {
    id: '99887766',
    first_name: 'Habibullo Dev',
    username: 'habibullo_dev'
  };

  // 📝 Tezkor iboralar ro'yxati
  const quickMessages = [
    "Salom! 👋", 
    "Omad yor bo'lsin! 🍀", 
    "Yaxshi harakat! 👍", 
    "Qoyil! 😮", 
    "Raxmat o'yin uchun! 🤝"
  ];

  // Chat xabari kelganda avtomatik eng pastga silliq tushirish
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!socket) return;

    // 🔍 Raqib topilganda serverdan ma'lumotlarni qabul qilish
    socket.on('match_found', ({ roomId, opponent }) => {
      setRoomId(roomId);
      setOpponent(opponent); // Ichida tgId, name, username, rating bor
      setGameState('playing');
      setChatMessages([]); // Chatni tozalash
      setMyChoice(null);
      setOpponentChoice(null);
      setRoundResult(null);
      setHasBoughtLink(false); // Yangi o'yinda shaxsiy chat linkini yopiq holatga qaytarish
    });

    socket.on('start_round', () => {
      setMyChoice(null);
      setOpponentChoice(null);
      setRoundResult(null);
      setTimer(30);
    });

    socket.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    // 🏁 Raund yakunlanganda natijalarni qabul qilish va bazani yangilash
    socket.on('round_result', ({ myChoice: serverMyChoice, opponentChoice: serverOppChoice, result, rewardCoins, rewardXP }) => {
      setMyChoice(serverMyChoice);
      setOpponentChoice(serverOppChoice);
      setRoundResult(result);
      setGameState('result');

      // Yangi balans va reytingni hisoblash (manfiyga tushib ketmaslik kafolati)
      const newCoins = Math.max(0, playerCoins + rewardCoins);
      const newRating = Math.max(0, currentRating + rewardXP);

      // App.jsx statelarini yangilash
      setCoins(newCoins);
      setRating(newRating);

      // 💾 MongoDB bilan sinxronlash (server.js dagi /api/user/auth yo'lagiga)
      saveBalanceToDatabase(user.id, newCoins, newRating);
    });

    // 💬 Raqibdan kelgan har qanday chat xabarini qabul qilish
    socket.on('chat_message', ({ senderId, text }) => {
      setChatMessages(prev => [...prev, { senderId, text }]);
    });

    // 🔌 Raqib o'yindan chiqib ketganda
    socket.on('opponent_left', () => {
      showNotif("Raqib o'yinni tark etdi! Texnik g'alaba 🏆", "success");
      const newCoins = playerCoins + 1;
      const newRating = currentRating + 15;
      
      setCoins(newCoins);
      setRating(newRating);
      saveBalanceToDatabase(user.id, newCoins, newRating);
      resetGame();
    });

    return () => {
      socket.off('match_found');
      socket.off('start_round');
      socket.off('timer_tick');
      socket.off('round_result');
      socket.off('chat_message');
      socket.off('opponent_left');
    };
  }, [socket, playerCoins, currentRating]);

  // 🛰️ Tangalar va Reytingni server orqali MongoDB ga saqlash funksiyasi
  const saveBalanceToDatabase = async (tgId, finalCoins, finalRating) => {
    try {
      const response = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: tgId.toString(),
          coins: finalCoins,
          rating: finalRating
        })
      });
      const data = await response.json();
      if (data.success) {
        console.log("💾 Balans bazada sinxronlandi. Yangi tangalar:", data.user.coins);
      }
    } catch (err) {
      console.error("Bazaga yozishda tarmoq xatoligi:", err);
    }
  };

  // 🔓 Raqib shaxsiy chat havolasini 10 tangaga sotib olish funksiyasi
  const buyOpponentChatLink = async () => {
    if (playerCoins < 10) {
      showNotif("Mablag' yetarli emas! Profil linkini ochish uchun 10 🪙 kerak.", "error");
      return;
    }
    try {
      const response = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/buy-chat-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.id.toString() })
      });
      const data = await response.json();
      
      if (data.success) {
        setCoins(data.coins); // Yangi balansni o'rnatish (App.jsx dagi tanga 10 taga kamayadi)
        setHasBoughtLink(true); // Havolani ochish
        showNotif("Raqibning shaxsiy profili muvaffaqiyatli ochildi! 🔓", "success");
      } else {
        showNotif(data.message || "Xarid amalga oshmadi.", "error");
      }
    } catch (err) {
      console.error("Xarid qilishda xatolik:", err);
      showNotif("Server bilan aloqa uzildi.", "error");
    }
  };

  const startSearching = () => {
    if (playerCoins < 1) {
      showNotif("Balansingizda yetarli tanga yo'q! Kamida 1 🪙 kerak.", "error");
      return;
    }
    
    setGameState('searching');
    if (!socket.connected) socket.connect();

    socket.emit('find_match', {
      player: {
        tgId: user.id.toString(),
        name: user.first_name,
        username: user.username || '', // Serverga username yuboriladi, raqib sotib olishi uchun
        rating: currentRating,
        coins: playerCoins
      },
      stake: 1
    });
  };

  const cancelSearching = () => {
    socket.emit('cancel_search', { tgId: user.id.toString() });
    resetGame();
  };

  const makeChoice = (choice) => {
    if (myChoice) return;
    setMyChoice(choice);
    socket.emit('player_choice', { roomId, choice });
  };

  // 💬 Chatga xabar yuborish (Erkin yozish va taymer tugmalari uchun umumiy funksiya)
  const sendChatMessage = (text) => {
    if (!text || !text.trim()) return;
    
    socket.emit('send_chat_message', { roomId, senderId: user.id.toString(), text: text.trim() });
    setChatMessages(prev => [...prev, { senderId: user.id.toString(), text: text.trim() }]);
    setTypedMessage(""); // Input oynasini tozalash
  };

  const resetGame = () => {
    setGameState('menu');
    setOpponent(null);
    setRoomId(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setRoundResult(null);
  };

  const getChoiceEmoji = (choice) => {
    if (choice === 'rock') return '🪨 Tosh';
    if (choice === 'paper') return '📄 Qog\'oz';
    if (choice === 'scissors') return '✂️ Qaychi';
    return '⏳ Ulgurmadi';
  };

  return (
    <div className="duel-game-page">
      {gameState === 'menu' && (
        <div className="duel-card animate-fade-in">
          <div className="duel-icon-wrapper">⚔️</div>
          <h2 className="duel-title">Onlayn Arena</h2>
          <p className="duel-description">Har bir o'yin stavkasi: <span className="highlight-text">1 🪙</span></p>
          <div className="stats-preview-row">
            <div className="stat-preview-box"><span>Balans</span><strong>🪙 {playerCoins}</strong></div>
            <div className="stat-preview-box"><span>Reyting</span><strong>🏆 {currentRating} XP</strong></div>
          </div>
          <button className="duel-action-btn start-btn" onClick={startSearching}>Raqib Qidirish 🔍</button>
          <button className="duel-action-btn cancel-btn" onClick={onBackToMenu}>Asosiy Menyu 🚪</button>
        </div>
      )}

      {gameState === 'searching' && (
        <div className="duel-card searching-card animate-pulse">
          <div className="radar-spinner">
            <div className="circle-1"></div>
            <div className="circle-2"></div>
          </div>
          <h2 className="searching-title">Raqib qidirilmoqda...</h2>
          <p className="searching-subtitle">Munosib raqib tayyorlanmoqda</p>
          <button className="duel-action-btn cancel-btn" onClick={cancelSearching}>To'xtatish ❌</button>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'result') && (
        <div className="arena-wrapper animate-fade-in">
          
          {/* 👥 O'yinchilar Yuqori Paneli */}
          <div className="arena-players-bar">
            <div className="arena-player style-me">
              <span className="arena-avatar">👤</span>
              <div className="arena-meta">
                <h4>{user.first_name}</h4>
                <p>Siz</p>
              </div>
            </div>
            
            <div className="arena-timer-circle">
              <span className="timer-number">{gameState === 'playing' ? timer : '⚡'}</span>
              <span className="timer-label">{gameState === 'playing' ? 'soniya' : 'Tayyor'}</span>
            </div>

            <div className="arena-player style-opponent" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
              <span className="arena-avatar">🎯</span>
              <div className="arena-meta">
                <h4>{opponent?.name || 'Raqib'}</h4>
                <p>🏆 {opponent?.rating || 100} XP</p>
                
                {/* 🔓 10 Tangalik Shaxsiy Chat sotib olish tizimi */}
                {opponent?.username ? (
                  hasBoughtLink ? (
                    <a href={`https://t.me/${opponent.username}`} target="_blank" rel="noreferrer" className="pm-link-btn opened">
                      💬 Shaxsiyga o'tish
                    </a>
                  ) : (
                    <button onClick={buyOpponentChatLink} className="pm-link-btn buy-btn">
                      🔓 Lichka linki (10 🪙)
                    </button>
                  )
                ) : (
                  <span style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>Username o'rnatilmagan</span>
                )}
              </div>
            </div>
          </div>

          {/* 🎮 Markaziy O'yin Maydoni */}
          {gameState === 'playing' ? (
            <div className="arena-main-card">
              <h3>Harakatingizni tanlang:</h3>
              
              {/* Oldingi turnizda so'ralgan ixchamlashtirilgan Dizayn (Gorizontal) */}
              <div className="arena-buttons-grid">
                <button className={`arena-choice-card rock-card ${myChoice === 'rock' ? 'active-choice' : ''}`} onClick={() => makeChoice('rock')} disabled={!!myChoice}>
                  <span className="choice-emoji">🪨</span>
                  <span className="choice-text">Tosh</span>
                </button>
                <button className={`arena-choice-card paper-card ${myChoice === 'paper' ? 'active-choice' : ''}`} onClick={() => makeChoice('paper')} disabled={!!myChoice}>
                  <span className="choice-emoji">📄</span>
                  <span className="choice-text">Qog'oz</span>
                </button>
                <button className={`arena-choice-card scissors-card ${myChoice === 'scissors' ? 'active-choice' : ''}`} onClick={() => makeChoice('scissors')} disabled={!!myChoice}>
                  <span className="choice-emoji">✂️</span>
                  <span className="choice-text">Qaychi</span>
                </button>
              </div>
              
              {myChoice && (
                <div className="waiting-status animate-flash">
                  <p>Siz tanladingiz. Raqib harakati kutilmoqda...</p>
                </div>
              )}
            </div>
          ) : (
            /* 🏆 Natija Oynasi */
            <div className={`duel-card result-card result-${roundResult} animate-bounce-in`} style={{ marginTop: 0, width: '100%' }}>
              <h2 className="result-main-heading">
                {roundResult === 'win' && "G'alaba! 🏆"}
                {roundResult === 'lose' && "Mag'lubiyat 💔"}
                {roundResult === 'draw' && "Durang! 🤝"}
              </h2>
              <p className="rewards-notice">
                {roundResult === 'win' && <span className="green-text">+1 🪙 | +15 XP</span>}
                {roundResult === 'lose' && <span className="red-text">-1 🪙 | -10 XP</span>}
              </p>
              
              <div className="versus-summary-box">
                <div className="summary-col">
                  <span>Siz</span>
                  <strong>{getChoiceEmoji(myChoice)}</strong>
                </div>
                <div className="summary-vs">VS</div>
                <div className="summary-col">
                  <span>Raqib</span>
                  <strong>{getChoiceEmoji(opponentChoice)}</strong>
                </div>
              </div>

              <div className="result-actions">
                <button className="duel-action-btn start-btn" onClick={() => socket.emit('request_rematch', { roomId })}>
                  Yana o'ynash 🔄
                </button>
                <button className="duel-action-btn cancel-btn" onClick={resetGame}>Chiqish 🚪</button>
              </div>
            </div>
          )}

          {/* 💬 JONLI REAL-TIME CHAT TIZIMI (ERKIN + TEZKOR INPUT) */}
          <div className="chat-container">
            
            {/* Xabarlar oynasi */}
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.senderId === user.id.toString() ? 'me' : 'opponent'}`}>
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {/* 1. Tezkor iboralar tugmalari */}
            <div className="quick-chat-grid">
              {quickMessages.map((msg, idx) => (
                <button key={idx} className="quick-chat-btn" onClick={() => sendChatMessage(msg)}>
                  {msg}
                </button>
              ))}
            </div>

            {/* 2. Erkin matnli klaviatura inputi */}
            <div className="chat-input-row">
              <input 
                type="text" 
                placeholder="Xabaringizni yozing..." 
                value={typedMessage} 
                onChange={(e) => setTypedMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(typedMessage)}
              />
              <button className="chat-send-submit" onClick={() => sendChatMessage(typedMessage)}>
                🚀
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

export default DuelGame;