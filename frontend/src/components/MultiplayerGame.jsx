// MultiplayerGame.jsx - TO‘LIQ ISHLAYDI, SERVER BILAN MOS
import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

const CHOICES = {
  rock: { name: "Tosh", emoji: "✊", color: "#e74c3c" },
  paper: { name: "Qog'oz", emoji: "✋", color: "#3498db" },
  scissors: { name: "Qaychi", emoji: "✌️", color: "#2ecc71" },
};

function MultiplayerGame({ user, onBackToMenu, showNotif, coins, setCoins }) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [opponentPhoto, setOpponentPhoto] = useState(null);   // ← yangi state
  const [inQueue, setInQueue] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [authAttempts, setAuthAttempts] = useState(0);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const messagesEndRef = useRef(null);

  // AUTENTIFIKATSIYA YUBORISH
  const sendAuthentication = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket hali ochiq emas');
      return false;
    }

    const initData = window.Telegram?.WebApp?.initData || '';
    console.log('initData uzunligi:', initData.length, 'boshlanishi:', initData.substring(0, 80) + '...');

    if (!initData || initData.length < 50) {
      showNotif('Telegram WebApp ma‘lumotlari topilmadi. Mini App ichida oching.', 'error');
      return false;
    }

    const authData = {
      type: 'authenticate',
      initData,
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      telegramId: user.id,
      languageCode: user.language_code || 'uz',
      isPremium: user.is_premium || false,
      timestamp: Date.now(),
      version: '1.0'
    };

    console.log('Auth so‘rovi yuborilmoqda →', authData);
    ws.current.send(JSON.stringify(authData));
    setAuthAttempts(prev => prev + 1);
    setDebugInfo(`Auth urinish ${authAttempts + 1}`);

    return true;
  };

  // WEBSOCKET ULANISHI
  useEffect(() => {
    if (!user?.id) {
      showNotif('Foydalanuvchi ma‘lumotlari yo‘q', 'error');
      return;
    }

    const WS_URL = 'wss://telegram-bot-server-2-matj.onrender.com';
    console.log('WebSocket ulanishi boshlanmoqda →', WS_URL);

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('✅ WebSocket muvaffaqiyatli ochildi');
      setConnected(true);
      setDebugInfo('Ulandi → autentifikatsiya...');
      showNotif('Serverga ulandi!', 'success');

      // Birinchi urinish
      setTimeout(sendAuthentication, 700);

      // Agar 4 soniyada authenticated bo‘lmasa → ikkinchi urinish
      setTimeout(() => {
        if (!authenticated) {
          console.log('Birinchi auth muvaffaqiyatsiz → qayta urinish');
          sendAuthentication();
        }
      }, 4000);
    };

    ws.current.onmessage = (event) => {
      console.log('Serverdan keldi:', event.data); // debug uchun saqlab qo‘ying
    
      try {
        const data = JSON.parse(event.data);
    
        switch (data.type) {
          // ───────────────────────────────────────────────
          // Autentifikatsiya muvaffaqiyatli bo‘ldi
          // ───────────────────────────────────────────────
          case 'authenticated':
            setAuthenticated(true);
            setAuthAttempts(0);
            setDebugInfo('Kirish muvaffaqiyatli!');
            showNotif(`Xush kelibsiz, ${data.user?.firstName || user.first_name}!`, 'success');
            if (data.user?.profilePhoto) setProfilePhoto(data.user.profilePhoto);
            break;
    
          // ───────────────────────────────────────────────
          case 'error':
            console.error('Server xatosi:', data.code, data.message);
            showNotif(`${data.code || 'Xato'}: ${data.message || 'Noma‘lum xato'}`, 'error');
    
            if (['UNAUTHENTICATED', 'INVALID_INIT_DATA', 'INIT_DATA_REQUIRED', 'AUTH_FAILED'].includes(data.code)) {
              setTimeout(sendAuthentication, 1500);
            }
            break;
    
          // ───────────────────────────────────────────────
          case 'joined_queue':
            setInQueue(true);
            setDebugInfo('Navbatda... raqib qidirilmoqda');
            showNotif('Raqib qidirilmoqda...', 'info');
            break;
    
          // ───────────────────────────────────────────────
          case 'match_found':
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setOpponentPhoto(data.opponent?.photoUrl || null);
            setInQueue(false);
            setMyChoice(null);
            setOpponentChoice(null);
            setResult(null);
            setScores({ player1: 0, player2: 0 });
            setMessages([]);
            setDebugInfo(`O‘yin boshlandi: vs ${data.opponent?.firstName || 'Raqib'}`);
            showNotif(`Raqib topildi: ${data.opponent?.firstName || data.opponent?.username || 'Raqib'}`, 'success');
            break;
    
          // ───────────────────────────────────────────────
          // Eng muhim qism — har bir raund natijasi
          // ───────────────────────────────────────────────
          case 'round_result':
            const { choices, scores, result: roundResult, round } = data;
    
            // Serverdan kelgan ma'lumotga to‘liq ishonamiz
            let myChoiceFromServer, opponentChoiceFromServer;
    
            // player1 / player2 qaysi taraf ekanligini aniqlaymiz
            if (String(choices.player1) === String(user.id) || choices.player1?.id === user.id) {
              myChoiceFromServer       = choices.player1Choice || choices.player1;
              opponentChoiceFromServer = choices.player2Choice || choices.player2;
            } else {
              myChoiceFromServer       = choices.player2Choice || choices.player2;
              opponentChoiceFromServer = choices.player1Choice || choices.player1;
            }
    
            setMyChoice(myChoiceFromServer);
            setOpponentChoice(opponentChoiceFromServer);
            setScores(scores);
    
            // Agar bu oxirgi raund bo‘lsa — umumiy natijani ham belgilaymiz
            if (round >= 3) {   // rounds soni odatda 3 bo‘ladi, agar o‘zgartirsangiz moslashtiring
              let finalResult;
              if (scores.player1 > scores.player2) {
                finalResult = 'win';
              } else if (scores.player2 > scores.player1) {
                finalResult = 'lose';
              } else {
                finalResult = 'draw';
              }
              setResult(finalResult);
            }
    
            showNotif(`Raund ${round} yakunlandi → ${roundResult === 'draw' ? 'Durang' : roundResult === 'player1_win' ? 'P1 yutdi' : 'P2 yutdi'}`, 'info');
            break;
    
          // ───────────────────────────────────────────────
          // O‘yin to‘liq tugadi (3 raunddan keyin yoki force finish)
          // ───────────────────────────────────────────────
          case 'game_result':
            console.log("GAME_RESULT keldi:", data); // debug uchun juda foydali
          
            setResult(data.result);
            setScores(data.scores || { player1: 0, player2: 0 });
          
            const myId = String(user.id);           // string ga aylantiramiz
            const winnerIdStr = data.winnerId ? String(data.winnerId) : null;
          
            if (data.result === 'draw') {
              showNotif('Durang! +25 coin', 'warning');
              setCoins(p => p + 25);
            }
            else if (winnerIdStr === myId) {
              showNotif('G‘alaba! +50 coin 🎉', 'success');
              setCoins(p => p + 50);
            }
            else {
              showNotif('Mag‘lubiyat 😔', 'error');
              // mag'lubiyatda coin qo'shilmaydi
            }
            break;
    
          // ───────────────────────────────────────────────
          case 'next_round':
            // Yangi raund boshlandi — tanlovlarni tozalash
            setMyChoice(null);
            setOpponentChoice(null);
            setDebugInfo(`Yangi raund: ${data.round}`);
            showNotif(`Raund ${data.round} boshlandi!`, 'info');
            break;
    
          // ───────────────────────────────────────────────
          case 'opponent_made_choice':
          case 'opponent_choice_made':
            showNotif('Raqib tanlov qildi, natijani kuting...', 'info');
            break;
    
          // ───────────────────────────────────────────────
          case 'choice_accepted':
            showNotif(`Siz tanladingiz: ${CHOICES[data.choice]?.name || data.choice}`, 'success');
            break;
    
// 3. onmessage ichida 'chat_message' case ni yangilash
case 'chat_message':
  const msg = data.message || data;

  const msgId = msg.tempId || Date.now();   // agar tempId kelsa undan foydalanamiz

  // Agar bu mening o'zim yuborgan xabar bo'lsa va allaqachon optimistic qo'shilgan bo'lsa
  if (String(msg.senderId) === String(user.id) && pendingMessageIds.has(msg.tempId)) {
    // Faqat pending ni olib tashlaymiz, lekin qayta qo'shmaymiz
    pendingMessageIds.delete(msg.tempId);

    // Agar xohlasangiz: optimistic xabarni "sent" holatiga o'tkazish mumkin
    setMessages(prev => prev.map(m =>
      m.id === msg.tempId
        ? { ...m, isPending: false, id: msg.id || m.id }  // serverdan kelgan ID ni qo'yish mumkin
        : m
    ));
    return;   // ← eng muhimi: qayta qo'shmaymiz!
  }

  // Boshqa holatlarda (raqibniki yoki boshqa) → yangi xabar qo'shamiz
  setMessages(prev => [...prev, {
    id: msgId,
    sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
    text: msg.text || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    senderName: msg.senderName || (String(msg.senderId) === String(user.id) ? 'Siz' : opponent?.firstName || 'Raqib')
  }]);
  break;
          // ───────────────────────────────────────────────
          case 'opponent_disconnected':
            showNotif('Raqib uzildi. 30 soniya ichida qaytmasa g‘alaba sizniki!', 'warning');
            break;
    
          // ───────────────────────────────────────────────
          default:
            console.log('Noma‘lum xabar turi:', data.type, data);
            break;
        }
      } catch (err) {
        console.error('WebSocket xabar parse qilishda xato:', err, event.data);
        showNotif('Xabar o‘qishda xato yuz berdi', 'error');
      }
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket xatosi:', err);
      setDebugInfo('Ulanish xatosi');
      showNotif('Server bilan aloqa uzildi', 'error');
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket yopildi →', { code: event.code, reason: event.reason });
      setConnected(false);
      setAuthenticated(false);
      setDebugInfo(`Ulanish uzildi (${event.code})`);

      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('Qayta ulanish urinish...');
          window.location.reload(); // yoki yangi komponent yaratish mumkin
        }, 5000);
      }
    };

    return () => {
      console.log('Komponent tozalanmoqda → WS yopilmoqda');
      if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
        ws.current.close(1000, 'Komponent yopildi');
      }
    };
  }, [user?.id]);

  // Chat pastga avto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinQueue = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif('Serverga ulanmagan', 'error');
      return;
    }

    if (!authenticated) {
      showNotif('Autentifikatsiya qilinmoqda...', 'info');
      sendAuthentication();
      setTimeout(() => authenticated && joinQueue(), 1800);
      return;
    }

    const queueData = {
      type: 'join_queue',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      mode: 'casual'
    };

    console.log('Navbatga qo‘shilmoqda →', queueData);
    ws.current.send(JSON.stringify(queueData));
    setDebugInfo('Navbat so‘rovi yuborildi');
  };

  const makeChoice = (choice) => {
    if (!gameId || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif('O‘yin holati noto‘g‘ri', 'error');
      return;
    }
    if (myChoice || result) return;

    setMyChoice(choice);

    ws.current.send(JSON.stringify({
      type: 'make_choice',
      gameId,
      choice,
      userId: user.id
    }));

    showNotif(`Siz ${CHOICES[choice].name} tanladingiz`, 'info');
  };

  const startNewGame = () => {
    setGameId(null);
    setOpponent(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setScores({ player1: 0, player2: 0 });
    setMessages([]);
    setTimeout(joinQueue, 700);
  };

  const [pendingMessageIds] = useState(new Set());

// 2. sendMessage funksiyasida (optimistic UI)
const sendMessage = (e) => {
  e.preventDefault();
  const text = chatInput.trim();
  if (!text || !gameId || !ws.current) return;

  const tempId = Date.now() + Math.random();   // yoki uuid ishlatish mumkin

  const payload = {
    type: 'chat_message',
    roomId: gameId,
    text,
    senderId: user.id,
    senderName: user.first_name || "Siz",
    tempId,   // ← serverga ham yuboramiz (identifikatsiya uchun)
  };

  // Optimistic: darhol qo'shamiz
  setMessages(prev => [...prev, {
    id: tempId,
    sender: 'me',
    text,
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
    senderName: 'Siz',
    isPending: true   // vaqtincha belgi
  }]);

  pendingMessageIds.add(tempId);

  ws.current.send(JSON.stringify(payload));
  setChatInput('');
};

  // RENDER =====================================================================

  if (!connected) {
    return (
      <div className="multiplayer-container">
        <div className="connection-screen">
          <div className="spinner"></div>
          <h3>Serverga ulanmoqda...</h3>
          <p>{debugInfo}</p>

        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="multiplayer-container">
        <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>

        <div className="auth-screen">
          <div className="spinner"></div>
          <h3>Autentifikatsiya qilinmoqda...</h3>

          {profilePhoto && (
            <img
              src={profilePhoto}
              alt="Profil rasmi"
              style={{ width: '90px', height: '90px', borderRadius: '50%', margin: '15px 0', objectFit: 'cover' }}
            />
          )}

          <div className="auth-info">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Ism:</strong> {user.first_name || 'Foydalanuvchi'}</p>
            <p><strong>Urinishlar:</strong> {authAttempts}</p>
            <p><strong>Holat:</strong> {debugInfo}</p>
          </div>

          <button className="retry-auth-btn" onClick={sendAuthentication}>
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="multiplayer-container">
        <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>

        <div className="queue-screen">
          <div className="spinner large"></div>
          <h2>Raqib qidirilmoqda...</h2>
          <div className="queue-stats">
            <p>✅ Autentifikatsiya muvaffaqiyatli</p>
            <p>👤 ID: {user.id}</p>
            <p>⏳ Taxminiy kutish: 20–60 soniya</p>
          </div>
          <button
            className="cancel-btn"
            onClick={() => {
              ws.current?.send(JSON.stringify({ type: 'leave_queue', userId: user.id }));
              setInQueue(false);
            }}
          >
            Navbatdan chiqish
          </button>
        </div>
      </div>
    );
  }

  if (gameId) {
    return (
      <div className="multiplayer-container">
        <div className="game-header">
          <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
          <div className="game-info">
            <span className="game-id">#{gameId.substring(0, 8)}</span>
            <span className="coins">🪙 {coins}</span>
          </div>
        </div>

        <div className="game-area">
        <div className="players">
  {/* Siz (o'zingiz) */}
  <div className="player you">
    <div className="avatar-wrapper">
      {user.photo_url ? (
        <img
          src={user.photo_url}
          alt="Siz"
          className="player-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div className="avatar-fallback">
          {user.first_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
    </div>

    <div className="player-name">SIZ</div>
    <div className="choice-display">{myChoice ? CHOICES[myChoice].emoji : '?'}</div>
    <div className="score">{scores.player1}</div>
  </div>

  <div className="vs">VS</div>

  {/* Raqib */}
  <div className="player opponent">
    <div className="avatar-wrapper">
      {opponentPhoto ? (
        <img
          src={opponentPhoto}
          alt={opponent?.firstName || 'Raqib'}
          className="player-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div className="avatar-fallback">
          {opponent?.firstName?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
    </div>

    <div className="player-name">{opponent?.firstName || 'Raqib'}</div>
    <div className="choice-display">{opponentChoice ? CHOICES[opponentChoice].emoji : '❓'}</div>
    <div className="score">{scores.player2}</div>
  </div>
</div>

          {!myChoice && !result && (
            <div className="choices-section">
              <h3>Tanlov qiling:</h3>
              <div className="choices">
                {Object.entries(CHOICES).map(([key, val]) => (
                  <button
                    key={key}
                    className="choice-btn"
                    style={{ borderColor: val.color }}
                    onClick={() => makeChoice(key)}
                  >
                    <span className="emoji">{val.emoji}</span>
                    <span className="name">{val.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {myChoice && !opponentChoice && !result && (
            <div className="waiting-section">
              <div className="spinner"></div>
              <p>Siz tanladingiz: <strong>{CHOICES[myChoice].name}</strong></p>
              <p>Raqib tanlovini kuting...</p>
            </div>
          )}

          {result && (
            <div className="result-section">
              <h2 className={result === 'draw' ? 'draw' : scores.player1 > scores.player2 ? 'win' : 'lose'}>
                {result === 'draw' ? 'Durang!' : scores.player1 > scores.player2 ? 'G‘alaba! 🎉' : 'Mag‘lubiyat 😔'}
              </h2>

              <div className="result-choices">
                <span>{myChoice ? CHOICES[myChoice].emoji : '?'}</span>
                <span>vs</span>
                <span>{opponentChoice ? CHOICES[opponentChoice].emoji : '?'}</span>
              </div>

              <div className="result-buttons">
                <button className="menu-btn" onClick={onBackToMenu}>
                  Menyuga qaytish
                </button>
                <button className="new-game-btn" onClick={startNewGame}>
                  Yangi o‘yin
                </button>
              </div>
            </div>
          )}

          <div className="chat-section">
            <div className="chat-header">
              <span>💬 Suhbat</span>
              <span className="message-count">{messages.length}</span>
            </div>

            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.sender}`}>
                  <div className="message-sender">{msg.senderName}</div>
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.time}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Xabar yozing..."
                disabled={!gameId || !!result}
              />
              <button type="submit" disabled={!chatInput.trim() || !gameId || !!result}>
                ↗
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Boshlang‘ich ekran
  return (
    <div className="multiplayer-container">
      <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>

      <div className="start-screen">
        <div className="welcome-card">
          <h2>🎮 Ko‘p o‘yinchili o‘yin</h2>
          <p>Dunyo bo‘ylab raqiblar bilan tosh-qaychi-qog‘oz o‘ynang!</p>
        </div>

        <div className="status-card">
          <div className="status-item">
            <span>Server:</span>
            <span className="status-online">🟢 Online</span>
          </div>
          <div className="status-item">
            <span>Holati:</span>
            <span className="status-success">Tayyor</span>
          </div>
          <div className="status-item">
            <span>Coinlaringiz:</span>
            <span>🪙 {coins}</span>
          </div>
        </div>

        <button className="start-btn large" onClick={joinQueue}>
          🎮 O‘yinni boshlash
        </button>

        <div className="instructions">
          <h4>Qoidalar:</h4>
          <div className="rules">
            <p>✊ Tosh → ✌️ Qaychi yutadi</p>
            <p>✋ Qog‘oz → ✊ Tosh yutadi</p>
            <p>✌️ Qaychi → ✋ Qog‘oz yutadi</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiplayerGame;