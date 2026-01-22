import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

const CHOICES = {
  rock: { name: 'Tosh', emoji: '✊', color: '#e74c3c' },
  paper: { name: 'Qog‘oz', emoji: '✋', color: '#3498db' },
  scissors: { name: 'Qaychi', emoji: '✌️', color: '#2ecc71' }
};

function MultiplayerGame({ user, onBackToMenu, showNotif, coins, setCoins }) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

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
  const [debugInfo, setDebugInfo] = useState('Yuklanmoqda...');

  const messagesEndRef = useRef(null);

  // ==================== TELEGRAM INITDATA + WS ULASH ====================
  useEffect(() => {
    if (!user?.id) {
      setDebugInfo('Foydalanuvchi ma‘lumotlari topilmadi');
      return;
    }

    const tryConnect = () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log('Telegram WebApp ready() chaqirildi');
      }

      const initData = window.Telegram?.WebApp?.initData || '';
      console.log('initData uzunligi:', initData.length);

      connectWebSocket();

      // 10 soniyadan keyin demo rejimga o'tish
      const demoTimer = setTimeout(() => {
        if (!authenticated) {
          setAuthenticated(true);
          setDebugInfo('Demo rejimda davom etilmoqda (Telegram initData topilmadi)');
          showNotif('Demo rejimda o‘ynaysiz', 'warning');
        }
      }, 10000);

      return () => clearTimeout(demoTimer);
    };

    tryConnect();

    return () => {
      if (ws.current) ws.current.close(1000, 'Komponent yopildi');
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [user?.id, authenticated, showNotif]);

  // ==================== WEBSOCKET LOGIKASI ====================
  const connectWebSocket = () => {
    if (ws.current) {
      ws.current.close();
    }

    const socket = new WebSocket('wss://telegram-bot-server-2-matj.onrender.com');
    ws.current = socket;

    socket.onopen = () => {
      console.log('✅ WebSocket ulandi');
      setConnected(true);
      setDebugInfo('Serverga ulandi');
      sendAuthentication();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Serverdan:', data.type, data);

        switch (data.type) {
          case 'authenticated':
            setAuthenticated(true);
            setDebugInfo(`Kirildi: ${data.user?.firstName || 'Foydalanuvchi'}`);
            showNotif('Muvaffaqiyatli kirdingiz!', 'success');
            break;

          case 'joined_queue':
            setInQueue(true);
            setDebugInfo('Navbatda... Raqib qidirilmoqda');
            showNotif('Navbatga qo‘shildingiz', 'info');
            break;

          case 'match_found':
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setInQueue(false);
            setDebugInfo(`O‘yin topildi! vs ${data.opponent?.firstName}`);
            showNotif(`Raqib topildi: ${data.opponent?.firstName}`, 'success');
            break;

          case 'round_result':
            setScores(data.scores || { player1: 0, player2: 0 });
            setResult(data.result);
            if (data.choices) {
              const oppChoice = data.choices.player1?.id === user.id 
                ? data.choices.player2?.choice 
                : data.choices.player1?.choice;
              setOpponentChoice(oppChoice);
            }
            break;

          case 'game_result':
            setResult(data.result);
            setScores(data.scores || { player1: 0, player2: 0 });

            if (data.result === 'draw') {
              showNotif('🤝 Durang! +25 coins', 'info');
              setCoins(c => c + 25);
            } else if (data.winnerId === user.id) {
              showNotif('🎉 G‘alaba! +50 coins', 'success');
              setCoins(c => c + 50);
            } else {
              showNotif('😔 Mag‘lubiyat', 'error');
            }
            break;

          case 'chat_message':
            const msg = data.message || data;
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
              text: msg.text || msg.content?.text || '...',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: msg.senderName || (String(msg.senderId) === String(user.id) ? 'Siz' : 'Raqib')
            }]);
            break;

          case 'error':
            showNotif(data.message || 'Xatolik yuz berdi', 'error');
            setDebugInfo(`Xato: ${data.message}`);
            break;

          default:
            console.log('Noma‘lum xabar turi:', data.type);
        }
      } catch (err) {
        console.error('Xabar parse xatosi:', err, event.data);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket yopildi: ${event.code} - ${event.reason}`);
      setConnected(false);
      setDebugInfo('Ulanish uzildi. Qayta ulanmoqda...');

      if (event.code !== 1000) { // normal yopilish emas
        reconnectTimer.current = setTimeout(() => {
          setDebugInfo('Qayta ulanish urinish...');
          connectWebSocket();
        }, 4000);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket xatosi:', err);
      setDebugInfo('Ulanish xatosi');
    };
  };

  const sendAuthentication = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    const initData = window.Telegram?.WebApp?.initData || '';
    const payload = {
      type: 'authenticate',
      userId: String(user.id),
      firstName: user.first_name || 'Player',
      username: user.username || `user_${user.id}`,
      languageCode: user.language_code || 'uz',
      isPremium: !!user.is_premium,
      initData: initData,
      timestamp: Date.now()
    };

    console.log('Auth yuborilmoqda:', payload);
    ws.current.send(JSON.stringify(payload));
  };

  const joinQueue = () => {
    if (!authenticated || !ws.current?.OPEN) {
      showNotif('Serverga ulanmagan yoki autentifikatsiya yo‘q', 'error');
      return;
    }
    ws.current.send(JSON.stringify({ type: 'join_queue', mode: 'casual' }));
    setInQueue(true);
    setDebugInfo('Navbatga qo‘shildingiz');
  };

  const makeChoice = (choice) => {
    if (!gameId || myChoice || result) return;
    if (!ws.current?.OPEN) return;

    setMyChoice(choice);
    ws.current.send(JSON.stringify({ type: 'make_choice', gameId, choice }));
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId || !ws.current?.OPEN) return;

    ws.current.send(JSON.stringify({
      type: 'chat_message',
      roomId: gameId,
      text: chatInput.trim()
    }));

    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'me',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'Siz'
    }]);

    setChatInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==================== RENDER QISMI ====================
  if (!connected) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <h3>{debugInfo}</h3>
        <button onClick={() => window.location.reload()}>Qayta yuklash</button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="auth-screen">
        <h2>Autentifikatsiya...</h2>
        <p>{debugInfo}</p>
        <button
          onClick={() => {
            setAuthenticated(true);
            showNotif('Demo rejimda davom etilmoqda', 'info');
          }}
        >
          Demo rejimda o‘ynash
        </button>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="queue-screen">
        <h2>Raqib qidirilmoqda...</h2>
        <div className="spinner"></div>
        <p>{debugInfo}</p>
        <button
          onClick={() => {
            if (ws.current?.OPEN) {
              ws.current.send(JSON.stringify({ type: 'leave_queue' }));
            }
            setInQueue(false);
          }}
        >
          Navbatdan chiqish
        </button>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <button className="back-btn" onClick={onBackToMenu}>← Menyuga</button>

      <div className="game-header">
        <span>O'yin #{gameId ? gameId.slice(0, 8) : '---'}</span>
        <span className="coins">🪙 {coins}</span>
      </div>

      <div className="players">
        <div className="player you">
          <div className="name">SIZ</div>
          <div className="choice-display">{myChoice ? CHOICES[myChoice].emoji : '?'}</div>
          <div className="score">{scores.player1}</div>
        </div>

        <div className="vs">VS</div>

        <div className="player opponent">
          <div className="name">{opponent?.firstName || 'Raqib'}</div>
          <div className="choice-display">
            {opponentChoice ? CHOICES[opponentChoice]?.emoji || '❓' : '❓'}
          </div>
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
                <span>{val.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {myChoice && !opponentChoice && !result && (
        <div className="waiting">
          <div className="spinner"></div>
          <p>Siz tanladingiz: {CHOICES[myChoice].name}</p>
          <p>Raqib tanlovini kuting...</p>
        </div>
      )}

      {result && (
        <div className="result-section">
          <h2 className={result === 'draw' ? 'draw' : scores.player1 > scores.player2 ? 'win' : 'lose'}>
            {result === 'draw' ? 'Durang 🤝' : scores.player1 > scores.player2 ? 'G‘alaba! 🎉' : 'Mag‘lubiyat 😔'}
          </h2>

          <div className="result-choices">
            <span>{myChoice ? CHOICES[myChoice].emoji : '?'}</span>
            <span>vs</span>
            <span>{opponentChoice ? CHOICES[opponentChoice]?.emoji : '?'}</span>
          </div>

          <div className="result-buttons">
            <button onClick={onBackToMenu}>Menyuga</button>
            <button
              onClick={() => {
                setGameId(null);
                setMyChoice(null);
                setOpponentChoice(null);
                setResult(null);
                setScores({ player1: 0, player2: 0 });
                joinQueue();
              }}
            >
              Yangi o‘yin
            </button>
          </div>
        </div>
      )}

      <div className="chat-section">
        <div className="chat-header">
          <span>💬 Suhbat</span>
        </div>

        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="sender">{msg.senderName}</div>
              <div className="text">{msg.text}</div>
              <div className="time">{msg.time}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-form" onSubmit={sendChatMessage}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Xabar yozing..."
            disabled={!gameId || !!result}
          />
          <button type="submit" disabled={!chatInput.trim() || !gameId || !!result}>
            ▶
          </button>
        </form>
      </div>

      <div className="debug-info">{debugInfo}</div>
    </div>
  );
}

export default MultiplayerGame;