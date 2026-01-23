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
      console.log('Serverdan keldi:', event.data);
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'authenticated':
            setAuthenticated(true);
            setAuthAttempts(0);
            setDebugInfo('Kirish muvaffaqiyatli!');
            showNotif(`Xush kelibsiz, ${data.user?.firstName || user.first_name}!`, 'success');
            if (data.user?.profilePhoto) setProfilePhoto(data.user.profilePhoto);
            break;

          case 'error':
            console.error('Server xatosi:', data.code, data.message);
            showNotif(`${data.code || 'Xato'}: ${data.message || 'Noma‘lum xato'}`, 'error');

            if (['UNAUTHENTICATED', 'INVALID_INIT_DATA', 'INIT_DATA_REQUIRED', 'AUTH_FAILED'].includes(data.code)) {
              setTimeout(sendAuthentication, 1500);
            }
            break;

          case 'joined_queue':
            setInQueue(true);
            setDebugInfo('Navbatda... raqib qidirilmoqda');
            showNotif('Raqib qidirilmoqda...', 'info');
            break;

          case 'match_found':
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setInQueue(false);
            setDebugInfo(`O‘yin boshlandi: vs ${data.opponent?.firstName || 'Raqib'}`);
            showNotif(`Raqib topildi: ${data.opponent?.firstName || data.opponent?.username || 'Raqib'}`, 'success');
            break;

          case 'round_result':
            setOpponentChoice(
              data.choices?.player1?.id === user.id ? data.choices?.player2 : data.choices?.player1
            );
            setScores(data.scores || { player1: 0, player2: 0 });
            showNotif('Raund yakunlandi', 'info');
            break;

          case 'game_result':
            setResult(data.result);
            setScores(data.scores || { player1: 0, player2: 0 });

            if (data.result === 'draw') {
              showNotif('Durang!', 'warning');
              setCoins(p => p + 25);
            } else if (data.winnerId === user.id) {
              showNotif('G‘alaba! 🎉 +50 coin', 'success');
              setCoins(p => p + 50);
            } else {
              showNotif('Mag‘lubiyat 😔', 'error');
            }
            break;

          case 'chat_message':
            const msg = data.message || data;
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
              text: msg.text || '',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: msg.senderName || (String(msg.senderId) === String(user.id) ? 'Siz' : 'Raqib')
            }]);
            break;

          default:
            console.log('Noma‘lum xabar turi:', data.type);
        }
      } catch (err) {
        console.error('Xabar parse qilishda xato:', err, event.data);
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

  const sendMessage = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !gameId || !ws.current) return;

    ws.current.send(JSON.stringify({
      type: 'chat_message',
      roomId: gameId,
      text
    }));

    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'Siz'
    }]);

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
          <button className="retry-btn" onClick={() => window.location.reload()}>
            Qayta urinish
          </button>
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
            <div className="player you">
              <div className="player-name">SIZ</div>
              <div className="choice-display">{myChoice ? CHOICES[myChoice].emoji : '?'}</div>
              <div className="score">{scores.player1}</div>
            </div>

            <div className="vs">VS</div>

            <div className="player opponent">
              <div className="player-name">{opponent?.firstName || opponent?.username || 'Raqib'}</div>
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