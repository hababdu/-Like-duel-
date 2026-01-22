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
  const [debugInfo, setDebugInfo] = useState('Dastur yuklanmoqda...');
  const messagesEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // ==================== AUTENTIFIKATSIYA ====================
  const sendAuthentication = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket ochiq emas');
      return false;
    }

    if (!user?.id) {
      console.log('User ID yo‘q');
      return false;
    }

    let initData = window.Telegram?.WebApp?.initData || '';

    const authData = {
      type: 'authenticate',
      userId: String(user.id),
      firstName: user.first_name || 'Player',
      username: user.username || `user_${user.id}`,
      languageCode: user.language_code || 'uz',
      isPremium: !!user.is_premium,
      timestamp: Date.now(),
      initData: initData,
    };

    console.log('📤 AUTH YUBORILMOQDA:', {
      ...authData,
      initData: initData ? initData.substring(0, 80) + '...' : '(bo‘sh)'
    });

    setDebugInfo(`Auth yuborildi (${authAttempts + 1})...`);

    try {
      ws.current.send(JSON.stringify(authData));
      setAuthAttempts(prev => prev + 1);
      return true;
    } catch (err) {
      console.error('Auth yuborish xatosi:', err);
      return false;
    }
  };

  // ==================== WEBSOCKET ULASH ====================
  const connectWebSocket = () => {
    if (ws.current) {
      ws.current.close(1000, 'Reconnecting');
    }

    const WS_URL = 'wss://telegram-bot-server-2-matj.onrender.com';
    console.log('WebSocket ulanmoqda:', WS_URL);

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      console.log('✅ WebSocket ochildi!');
      setConnected(true);
      setDebugInfo('Serverga ulandi');
      showNotif('Serverga ulandi!', 'success');
      sendAuthentication();
    };

    socket.onmessage = (event) => {
      console.log('📩 Serverdan:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        console.log('Parsed data:', data);
    
        if (data.type === 'authenticated') {
          console.log('🎉 AUTHENTICATED KELDI!', data.user);
          setAuthenticated(true);
          setAuthAttempts(0);
          setDebugInfo(`Muvaffaqiyatli kirildi: ${data.user?.firstName || 'Foydalanuvchi'}`);
          showNotif(`Xush kelibsiz, ${data.user?.firstName}!`, 'success');
        } else {
          console.log('Boshqa xabar turi:', data.type, data);
        }
        switch (data.type) {
          case 'authenticated':
            setAuthenticated(true);
            setAuthAttempts(0);
            setDebugInfo(`Kirildi: ${data.user?.firstName || 'Foydalanuvchi'}`);
            showNotif(`Xush kelibsiz!`, 'success');
            break;

          case 'error':
            console.error('Server xatosi:', data);
            setDebugInfo(`Xato: ${data.message || 'Noma’lum'}`);
            showNotif(data.message || 'Xatolik yuz berdi', 'error');

            if (data.code?.includes('AUTH') || data.code?.includes('INIT_DATA')) {
              setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN) {
                  sendAuthentication();
                }
              }, 2000);
            }
            break;

          case 'joined_queue':
            setInQueue(true);
            setDebugInfo('Navbatda...');
            showNotif('Raqib qidirilmoqda...', 'info');
            break;

          case 'match_found':
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setInQueue(false);
            setDebugInfo(`O‘yin boshlandi: vs ${data.opponent?.firstName}`);
            showNotif(`Raqib topildi!`, 'success');
            break;

          case 'round_result':
            setScores(data.scores || { player1: 0, player2: 0 });
            setResult(data.result);
            if (data.choices) {
              const oppChoice = user.id === data.choices.player1?.id 
                ? data.choices.player2?.choice 
                : data.choices.player1?.choice;
              setOpponentChoice(oppChoice);
            }
            break;

          case 'game_result':
            setResult(data.result);
            setScores(data.scores || { player1: 0, player2: 0 });
            if (data.result === 'draw') {
              showNotif('Durang! +25 coins', 'info');
              setCoins(c => c + 25);
            } else if (data.winnerId === user.id) {
              showNotif('G‘alaba! +50 coins 🎉', 'success');
              setCoins(c => c + 50);
            } else {
              showNotif('Mag‘lubiyat 😔', 'error');
            }
            break;

          case 'chat_message':
            const msg = data.message || data;
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
              text: msg.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: msg.senderName || (msg.senderId === user.id ? 'Siz' : 'Raqib')
            }]);
            break;

          default:
            console.log('Boshqa xabar turi:', data.type);
        }
      } catch (err) {
        console.error('Xabar parse xatosi:', err);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket yopildi: ${event.code} - ${event.reason}`);
      setConnected(false);

      if (event.code !== 1000) { // normal yopilish emas
        setDebugInfo('Qayta ulanmoqda...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket xatosi:', err);
      setDebugInfo('Ulanish xatosi');
    };
  };

  // ==================== ASOSIY useEffect ====================
  useEffect(() => {
    if (!user?.id) {
      setDebugInfo('User ma‘lumotlari yo‘q');
      return;
    }

    // Telegram WebApp diagnostikasi
    console.log('=== TELEGRAM TEKSHIRUVI ===');
    console.log('Telegram.WebApp mavjudmi?', !!window.Telegram?.WebApp);
    console.log('initData mavjudmi?', !!window.Telegram?.WebApp?.initData);

    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      console.log('Telegram ready() va expand() chaqirildi');
    }

    // initData ni kutish
    let attempts = 0;
    const maxAttempts = 20; // 10 soniya

    const waitForInitData = () => {
      attempts++;
      const initData = window.Telegram?.WebApp?.initData || '';

      console.log(`Kutish ${attempts}/${maxAttempts}: initData uzunligi = ${initData.length}`);

      if (initData.length > 50 || attempts >= maxAttempts) {
        setDebugInfo(initData.length > 50 
          ? 'Telegram ma‘lumotlari yuklandi' 
          : 'initData topilmadi → demo rejim');
        
        connectWebSocket();
      } else {
        setTimeout(waitForInitData, 500);
      }
    };

    waitForInitData();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (ws.current) ws.current.close(1000, 'Komponent yopildi');
    };
  }, [user?.id]);

  // ==================== CHAT AUTOSCROLL ====================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==================== FUNKSIYALAR ====================
  const joinQueue = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif('Serverga ulanmagan', 'error');
      return;
    }

    const data = { type: 'join_queue', mode: 'casual' };
    ws.current.send(JSON.stringify(data));
    setInQueue(true);
    setDebugInfo('Navbatga qo‘shildingiz');
  };

  const makeChoice = (choice) => {
    if (!gameId || myChoice || result) return;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    setMyChoice(choice);
    const data = { type: 'make_choice', gameId, choice };
    ws.current.send(JSON.stringify(data));
    showNotif(`Siz ${CHOICES[choice].name} tanladingiz`, 'info');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId) return;

    const data = { type: 'chat_message', roomId: gameId, text: chatInput.trim() };
    ws.current.send(JSON.stringify(data));

    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'me',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'Siz'
    }]);

    setChatInput('');
  };

  const startNewGame = () => {
    setGameId(null);
    setOpponent(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setScores({ player1: 0, player2: 0 });
    setMessages([]);
    setInQueue(false);

    setTimeout(joinQueue, 800);
  };

  // ==================== RENDER ====================
  if (!connected) {
    return (
      <div className="multiplayer-container loading-screen">
        <div className="spinner large"></div>
        <h3>{debugInfo}</h3>
        <p>User ID: {user?.id || 'topilmadi'}</p>
        <button className="retry-btn" onClick={() => window.location.reload()}>
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="multiplayer-container auth-screen">
        <button className="back-btn" onClick={onBackToMenu}>← Menyuga</button>
        <div className="auth-content">
          <div className="spinner"></div>
          <h3>Autentifikatsiya qilinmoqda...</h3>
          <div className="auth-info">
            <p>User: {user?.first_name || 'Noma‘lum'}</p>
            <p>ID: {user?.id}</p>
            <p>Urinishlar: {authAttempts}</p>
            <p className="debug-text">{debugInfo}</p>
          </div>
          <button 
            className="demo-btn" 
            onClick={() => {
              setAuthenticated(true);
              setDebugInfo('Demo rejim faollashtirildi');
              showNotif('Demo rejimda davom etilmoqda', 'info');
            }}
          >
            Demo rejimda davom etish
          </button>
        </div>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="multiplayer-container queue-screen">
        <button className="back-btn" onClick={onBackToMenu}>← Menyuga</button>
        <div className="queue-content">
          <div className="spinner large"></div>
          <h2>Raqib qidirilmoqda...</h2>
          <p className="debug-text">{debugInfo}</p>
          <button 
            className="cancel-btn" 
            onClick={() => {
              if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'leave_queue' }));
              }
              setInQueue(false);
            }}
          >
            Navbatdan chiqish
          </button>
        </div>
      </div>
    );
  }

  // O'yin ekrani
  return (
    <div className="multiplayer-container game-screen">
      <button className="back-btn" onClick={onBackToMenu}>← Menyuga</button>

      <div className="game-header">
        <div className="game-info">
          O'yin #{gameId ? gameId.substring(0, 8) : '---'}
          <span className="coins-display">🪙 {coins}</span>
        </div>
      </div>

      <div className="players-area">
        <div className="player you">
          <div className="player-label">SIZ</div>
          <div className="choice-display">{myChoice ? CHOICES[myChoice].emoji : '?'}</div>
          <div className="score">{scores.player1}</div>
        </div>

        <div className="vs">VS</div>

        <div className="player opponent">
          <div className="player-label">{opponent?.firstName || 'Raqib'}</div>
          <div className="choice-display">{opponentChoice ? CHOICES[opponentChoice]?.emoji || '❓' : '❓'}</div>
          <div className="score">{scores.player2}</div>
        </div>
      </div>

      {!myChoice && !result && (
        <div className="choices-area">
          <h3>Tanlov qiling:</h3>
          <div className="choices-grid">
            {Object.entries(CHOICES).map(([key, val]) => (
              <button
                key={key}
                className="choice-button"
                style={{ borderColor: val.color }}
                onClick={() => makeChoice(key)}
              >
                <span className="emoji">{val.emoji}</span>
                <span>{val.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {myChoice && !opponentChoice && !result && (
        <div className="waiting-area">
          <div className="spinner medium"></div>
          <p>Siz tanladingiz: <strong>{CHOICES[myChoice].name}</strong></p>
          <p>Raqib tanlovini kuting...</p>
        </div>
      )}

      {result && (
        <div className="result-area">
          <h2 className={result === 'draw' ? 'draw' : scores.player1 > scores.player2 ? 'win' : 'lose'}>
            {result === 'draw' ? 'Durang 🤝' : 
             scores.player1 > scores.player2 ? 'G‘alaba! 🎉' : 'Mag‘lubiyat 😔'}
          </h2>

          <div className="result-choices">
            <span>{myChoice ? CHOICES[myChoice].emoji : '?'}</span>
            <span>vs</span>
            <span>{opponentChoice ? CHOICES[opponentChoice]?.emoji || '?' : '?'}</span>
          </div>

          <div className="result-buttons">
            <button className="menu-btn" onClick={onBackToMenu}>Menyuga</button>
            <button className="new-game-btn" onClick={startNewGame}>Yangi o‘yin</button>
          </div>
        </div>
      )}

      {/* Chat qismi */}
      <div className="chat-container">
        <div className="chat-header">
          <span>💬 Suhbat</span>
          <span className="message-count">{messages.length}</span>
        </div>

        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
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
            disabled={!gameId || result}
          />
          <button type="submit" disabled={!chatInput.trim() || !gameId || result}>
            Yuborish
          </button>
        </form>
      </div>

      {/* Debug ma'lumotlari (test uchun) */}
      <div className="debug-panel">
        <small>{debugInfo} | Auth urinishlar: {authAttempts}</small>
      </div>
    </div>
  );
}

export default MultiplayerGame;