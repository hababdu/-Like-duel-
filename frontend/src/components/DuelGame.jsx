import React, { useEffect, useState, useRef, useCallback } from 'react';
import './DuelGame.css'; // O'yin stillari fayli

function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif }) {
  // O'yin va Xona holatlari
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState('searching'); // 'searching' | 'ready' | 'playing' | 'revealed' | 'gameover'
  const [opponent, setOpponent] = useState(null);
  
  // O'yin mantiqi
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null); // 'win' | 'lose' | 'draw'
  const [timer, setTimer] = useState(30);
  
  // Chat mantiqi
  const [chatMessages, setChatMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const chatEndRef = useRef(null);

  // YANGILANGAN IQTISODIYOT SOZLAMALARI 🪙
  const MIN_PLAY_COINS = 1; // O'yinga kirish uchun kamida 1 tanga bo'lishi kerak
  const STAKE_COINS = 1;    // Har bir o'yinda tikiladigan standart stavka: 1 tanga

  // --- TELEGRAMDAN FOYDALANUVCHI MA'LUMOTLARINI OLISH ---
  const getTgUser = useCallback(() => {
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
  }, [currentRating, playerCoins]);

  // --- REYTING VA TANGA NAZORATI ---
  useEffect(() => {
    if (playerCoins < MIN_PLAY_COINS && gameState === 'searching') {
      showNotif("Mablag'ingiz yetarli emas! Iltimos, tanga to'plang.", "error");
      onBackToMenu(); 
    }
  }, [playerCoins, gameState, onBackToMenu, showNotif]);

  // --- SOCKET.IO INTEGRATSIYA ---
  useEffect(() => {
    if (!socket) return;

    // 1. Matchmakingni faqat bir marta chaqirish (Sikl hosil qilmaydi)
    const localPlayer = getTgUser();
    socket.emit('find_match', { player: localPlayer, stake: STAKE_COINS });

    // 2. Raqib topilganda
    socket.on('match_found', (data) => {
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

    // 4. Serverdan taymer sekundlari kelishi
    socket.on('timer_tick', (timeLeft) => {
      setTimer(timeLeft);
    });

    // 5. Raund yakunlanib, natijalar e'lon qilinganda
    socket.on('round_result', (data) => {
      setMyChoice(data.myChoice);
      setOpponentChoice(data.opponentChoice);
      setRoundResult(data.result);
      setGameState('revealed');

      // Balansni dinamik yangilash (Stavka endi 1 tanga)
      setCoins(prev => Math.max(0, prev + data.rewardCoins));
      setRating(prev => Math.max(0, prev + data.rewardXP));

      if (data.result === 'win') {
        showNotif(`G'alaba! +${STAKE_COINS} 🪙 va +15 XP 🏆`, "success");
      } else if (data.result === 'lose') {
        showNotif(`Mag'lubiyat! -${STAKE_COINS} 🪙 va -10 XP 😢`, "error");
      } else {
        showNotif("Durang! 🤝", "warning");
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

    // Tozalash funksiyasi (Aloqani xavfsiz yopish)
    return () => {
      setRoomId((currentRoomId) => {
        if (currentRoomId) {
          socket.emit('leave_room', { roomId: currentRoomId });
        }
        return currentRoomId;
      });
      socket.off('match_found');
      socket.off('start_round');
      socket.off('timer_tick');
      socket.off('round_result');
      socket.off('opponent_left');
      socket.off('receive_message');
    };
  }, [socket, getTgUser, onBackToMenu, showNotif]);

  // Chat scrollini avtomatik pastga tushirish
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- HARAKAT TANLASH ---
  const makeChoice = (choice) => {
    if (gameState !== 'playing' || myChoice) return;
    setMyChoice(choice);
    socket.emit('player_choice', { roomId, choice });
  };

  // --- CHAT XABARI YUBORISH ---
  const sendMessage = (textToSend = null) => {
    const finalMsg = textToSend || messageText;
    if (!finalMsg.trim()) return;

    const localPlayer = getTgUser();
    const msgData = {
      roomId,
      sender: localPlayer.name,
      text: finalMsg
    };

    socket.emit('send_message', msgData);
    setChatMessages(prev => [...prev, { ...msgData, isMe: true }]);
    if (!textToSend) setMessageText('');
  };

  const QUICK_CHAT = ["Omad! 👍", "Yaxshi o'yin! 🤝", "Ups... 🫣", "Shoshilma! ⏳", "🔥", "😎"];
  const currentLocalPlayer = getTgUser();

  return (
    <div className="game-wrapper duel-mode">
      
      {/* 1. KUTISH EKRANI (MATCHMAKING) */}
      {gameState === 'searching' && (
        <div className="lobby-overlay">
          <div className="spinner"></div>
          <h2>Munosib raqib qidirilmoqda...</h2>
          <p>Tikilgan summa: <strong style={{color: '#ffd700'}}>{STAKE_COINS} 🪙</strong></p>
          <div className="player-preview">
            <div className="avatar">{currentLocalPlayer.avatar === '👤' ? '👤' : <img src={currentLocalPlayer.avatar} alt="avatar" />}</div>
            <span>{currentLocalPlayer.name} (🏆 {currentLocalPlayer.rating} XP)</span>
          </div>
          <button className="cancel-btn" onClick={onBackToMenu}>Bekor qilish</button>
        </div>
      )}

      {/* 2. JONLI DUEL INTERFEYSI */}
      {gameState !== 'searching' && (
        <>
          {/* Tepadagi Panel: Foydalanuvchilar ma'lumotlari */}
          <header className="duel-header">
            {/* SIZ */}
            <div className="profile-card me">
              <div className="profile-info">
                <span className="profile-name">{currentLocalPlayer.name}</span>
                <span className="profile-stats">🏆 {currentLocalPlayer.rating} XP | 🪙 {playerCoins}</span>
              </div>
              <div className="profile-avatar">{currentLocalPlayer.avatar === '👤' ? '👤' : <img src={currentLocalPlayer.avatar} alt="Me" />}</div>
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

          {/* O'yin maydoni */}
          <main className="arena">
            <div className={`card player-card ${myChoice ? 'active' : ''}`}>
              <div className="card-inner">
                <span className="card-label">SIZ</span>
                <div className="card-emoji-box">
                  {myChoice ? (gameState === 'revealed' ? (myChoice === 'rock' ? '🪨' : myChoice === 'paper' ? '📄' : '✂️') : '✅') : '❓'}
                </div>
              </div>
            </div>

            <div className="vs-center">
              <div className="timer-number-box">
                <span className={`timer-text ${timer <= 5 ? 'pulse' : ''}`}>{timer}s</span>
              </div>
            </div>

            <div className={`card bot-card ${opponentChoice ? 'active' : ''}`}>
              <div className="card-inner">
                <span className="card-label">RAQIB</span>
                <div className="card-emoji-box">
                  {opponentChoice ? (gameState === 'revealed' ? (opponentChoice === 'rock' ? '🪨' : opponentChoice === 'paper' ? '📄' : '✂️') : '✅') : '❓'}
                </div>
              </div>
            </div>
          </main>

          {/* Natija oynasi */}
          <div className="result-banner-container">
            {roundResult && (
              <div className={`status-banner banner-${roundResult}`}>
                {roundResult === 'win' ? 'YUTDINGIZ! 🎉' : roundResult === 'lose' ? 'YUTQAZDINGIZ! 😢' : 'DURANG 🤝'}
              </div>
            )}
          </div>

          {/* REAL TIME CHAT */}
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
            
            <div className="quick-chat-grid">
              {QUICK_CHAT.map((phrase, idx) => (
                <button key={idx} onClick={() => sendMessage(phrase)} className="quick-chat-btn">
                  {phrase}
                </button>
              ))}
            </div>

            <div className="chat-input-bar">
              <input 
                type="text" 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                placeholder="Xabar yozing..."
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={() => sendMessage()}>Send</button>
            </div>
          </section>

          {/* Harakat Tanlash Tugmalari */}
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