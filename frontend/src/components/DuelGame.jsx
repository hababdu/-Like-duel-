import React, { useEffect, useState, useRef, useCallback } from 'react';
import './DuelGame.css'; // Ushbu fayl multiplayer stillarini ham o'z ichiga oladi

// Faraz qilamiz, socket obyekti yuqoridan prop sifatida uzatiladi
function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif  }) {
  // O'yin va Xona holatlari
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState('searching'); // 'searching' | 'ready' | 'playing' | 'revealed' | 'gameover'
  const [opponent, setOpponent] = useState(null); // { name, avatar, rating, coins }
  
  // O'yin mantiqi
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null); // 'win' | 'lose' | 'draw'
  const [timer, setTimer] = useState(30);
  
  // Chat mantiqi
  const [chatMessages, setChatMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const chatEndRef = useRef(null);

  const MIN_PLAY_COINS = 50; // O'yinga kirish uchun minimal tanga summasi
  const STAKE_COINS = 100;   // Har bir o'yindagi tikiladigan standart tanga (stavka)

  // --- TELEGRAMDAN FOYDALANUVCHI MA'LUMOTLARINI OLISH ---
  const getTgUser = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      return {
        name: `${user.first_name} ${user.last_name || ''}`.trim(),
        avatar: user.photo_url || '👤',
        rating: currentRating,
        coins: playerCoins
      };
    }
    return { name: "O'yinchi", avatar: '👤', rating: currentRating, coins: playerCoins };
  };

  const localPlayer = getTgUser();

  // --- REYTING VA TANGA NAZORATI ---
  useEffect(() => {
    // Agar o'yinchida yetarli tanga bo'lmasa, uni o'yinga kiritmaymiz
    if (playerCoins < MIN_PLAY_COINS && gameState === 'searching') {
      showNotif("Mablag'ingiz yetarli emas! Iltimos, do'kondan tanga oling.", "error");
      onBackToMenu(); // Do'konga yo'naltirish bu yerdan boshqariladi
    }
  }, [playerCoins, gameState, onBackToMenu, showNotif]);

  // --- SOCKET.IO REAL-TIME INTEGRATSIYA ---
  useEffect(() => {
    if (!socket) return;

    // 1. Raqib qidirishni boshlash (Matchmaking navbatiga qo'shilish)
    socket.emit('find_match', { player: localPlayer, stake: STAKE_COINS });

    // 2. O'yin topilganda server javobi
    socket.on('match_found', (data) => {
      // data: { roomId, opponent: { name, avatar, rating, coins } }
      setRoomId(data.roomId);
      setOpponent(data.opponent);
      setGameState('ready');
      showNotif(`Raqib topildi: ${data.opponent.name}! 🚀`, "success");
    });

    // 3. Raund boshlanishi
    socket.on('start_round', () => {
      setGameState('playing');
      setMyChoice(null);
      setOpponentChoice(null);
      setRoundResult(null);
      setTimer(30);
    });

    // 4. Taymer yangilanishi (Server tomonidan boshqariladi)
    socket.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    // 5. Raund natijasi e'lon qilinganda
    socket.on('round_result', (data) => {
      // data: { myChoice, opponentChoice, result, rewardCoins, rewardXP }
      setMyChoice(data.myChoice);
      setOpponentChoice(data.opponentChoice);
      setRoundResult(data.result);
      setGameState('revealed');

      // Moliyaviy va reyting o'zgarishlarini saqlash
      setCoins(prev => Math.max(0, prev + data.rewardCoins));
      setRating(prev => Math.max(0, prev + data.rewardXP));

      if (data.result === 'win') {
        showNotif(`G'alaba! +${STAKE_COINS} 🪙 va +15 XP 🏆`, "success");
      } else if (data.result === 'lose') {
        showNotif(`Mag'lubiyat! -${STAKE_COINS} 🪙 va -10 XP 😢`, "error");
      } else {
        showNotif("Durang! 🤝 Tangalar qaytarildi.", "warning");
      }
    });

    // 6. Raqib o'yindan chiqib ketganda
    socket.on('opponent_left', () => {
      showNotif("Raqib o'yinni tark etdi! Texnik g'alaba. 🏆", "success");
      setCoins(prev => prev + STAKE_COINS);
      onBackToMenu();
    });

    // 7. Chat xabari kelganda
    socket.on('receive_message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('match_found');
      socket.off('start_round');
      socket.off('timer_tick');
      socket.off('round_result');
      socket.off('opponent_left');
      socket.off('receive_message');
    };
  }, [socket, currentRating, playerCoins, setCoins, setRating, showNotif, onBackToMenu]);

  // Chat scroll animatsiyasi
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- HARAKAT CHIQARISH ---
  const makeChoice = (choice) => {
    if (gameState !== 'playing' || myChoice) return;
    setMyChoice(choice);
    // Serverga tanlovni yuboramiz (haqqoniylik uchun server ikkala tanlov kelguncha yashiradi)
    socket.emit('player_choice', { roomId, choice });
  };

  // --- CHAT XABARI YUBORISH ---
  const sendMessage = (textToSend = null) => {
    const finalMsg = textToSend || messageText;
    if (!finalMsg.trim()) return;

    const msgData = {
      roomId,
      sender: localPlayer.name,
      text: finalMsg
    };

    socket.emit('send_message', msgData);
    setChatMessages(prev => [...prev, { ...msgData, isMe: true }]);
    if (!textToSend) setMessageText('');
  };

  // Tayyor chat emojilari va so'zlari (Tezkor chat)
  const QUICK_CHAT = ["Omad! 👍", "Yaxshi o'yin! 🤝", "Ups... 🫣", "Shoshilma! ⏳", "🔥", "😎"];

  return (
    <div className="game-wrapper duel-mode">
      
      {/* 1. MATCHMAKING (RAQIB QIDIRISH EKRONI) */}
      {gameState === 'searching' && (
        <div className="lobby-overlay">
          <div className="spinner"></div>
          <h2>Munosib raqib qidirilmoqda...</h2>
          <p>Tikilgan summa: <strong style={{color: '#ffd700'}}>{STAKE_COINS} 🪙</strong></p>
          <div className="player-preview">
            <div className="avatar">{localPlayer.avatar === '👤' ? '👤' : <img src={localPlayer.avatar} alt="avatar" />}</div>
            <span>{localPlayer.name} (🏆 {localPlayer.rating} XP)</span>
          </div>
          <button className="cancel-btn" onClick={onBackToMenu}>Bekor qilish</button>
        </div>
      )}

      {/* 2. ASOSIY DUEL INTERFEYSI */}
      {gameState !== 'searching' && (
        <>
          {/* Tepadagi Panel: Ikkala o'yinchi profili */}
          <header className="duel-header">
            {/* SIZ */}
            <div className="profile-card me">
              <div className="profile-info">
                <span className="profile-name">{localPlayer.name}</span>
                <span className="profile-stats">🏆 {localPlayer.rating} XP | 🪙 {playerCoins}</span>
              </div>
              <div className="profile-avatar">{localPlayer.avatar === '👤' ? '👤' : <img src={localPlayer.avatar} alt="Me" />}</div>
            </div>

            <div className="versus-divider">VS</div>

            {/* RAQIB */}
            <div className="profile-card opponent">
              <div className="profile-avatar">{opponent?.avatar === '👤' ? '👤' : <img src={opponent?.avatar} alt="Opponent" />}</div>
              <div className="profile-info">
                <span className="profile-name">{opponent?.name || "Raqib"}</span>
                <span className="profile-stats">🏆 {opponent?.rating || 0} XP | 🪙 {opponent?.coins || 0}</span>
              </div>
            </div>
          </header>

          {/* O'yin Arenasi */}
          <main className="arena">
            {/* SIZ ning tanlovingiz */}
            <div className={`card player-card ${myChoice ? 'active' : ''}`}>
              <div className="card-inner">
                <span className="card-label">SIZ</span>
                <div className="card-emoji-box">
                  {myChoice ? (gameState === 'revealed' ? myChoice.toUpperCase() : '✅') : '❓'}
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="vs-center">
              <div className="timer-number-box">
                <span className={`timer-text ${timer <= 5 ? 'pulse' : ''}`}>{timer}s</span>
              </div>
            </div>

            {/* Raqib tanlovi */}
            <div className={`card bot-card ${opponentChoice ? 'active' : ''}`}>
              <div className="card-inner">
                <span className="card-label">RAQIB</span>
                <div className="card-emoji-box">
                  {opponentChoice ? (gameState === 'revealed' ? opponentChoice.toUpperCase() : '✅') : '❓'}
                </div>
              </div>
            </div>
          </main>

          {/* Natija Banneri */}
          <div className="result-banner-container">
            {roundResult && (
              <div className={`status-banner banner-${roundResult}`}>
                {roundResult === 'win' ? 'YUTDINGIZ! 🎉' : roundResult === 'lose' ? 'YUTQAZDINGIZ! 😢' : 'DURANG 🤝'}
              </div>
            )}
          </div>

          {/* CHAT TIZIMI (Duel xonasi uchun) */}
          <section className="duel-chat-section">
            <div className="chat-messages-container">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble ${msg.isMe ? 'my-msg' : 'opp-msg'}`}>
                  <span className="sender-name">{msg.sender}:</span>
                  <span className="msg-text">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {/* Tezkor chat tugmalari */}
            <div className="quick-chat-grid">
              {QUICK_CHAT.map((phrase, idx) => (
                <button key={idx} onClick={() => sendMessage(phrase)} className="quick-chat-btn">
                  {phrase}
                </button>
              ))}
            </div>

            {/* Matnli yozish joyi */}
            <div className="chat-input-bar">
              <input 
                type="text" 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                placeholder="Xabar yozing..."
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={() => sendMessage()}>Yuborish</button>
            </div>
          </section>

          {/* Tanlash Tugmalari */}
          <footer className="action-area">
            <div className={`choices-grid ${myChoice ? 'has-selection' : ''}`}>
              {['rock', 'paper', 'scissors'].map((key) => {
                const isSelected = myChoice === key;
                return (
                  <button
                    key={key}
                    onClick={() => makeChoice(key)}
                    disabled={gameState !== 'playing' || myChoice !== null}
                    className={`action-btn ${isSelected ? 'chosen' : ''}`}
                  >
                    <span className="action-emoji">
                      {key === 'rock' ? '🪨' : key === 'paper' ? '📄' : '✂️'}
                    </span>
                    <span className="action-label">{key.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default DuelGame;