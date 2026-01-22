import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

const CHOICES = {
  rock: { name: 'Tosh', emoji: '✊', color: '#e74c3c' },
  paper: { name: 'Qog‘oz', emoji: '✋', color: '#3498db' },
  scissors: { name: 'Qaychi', emoji: '✌️', color: '#2ecc71' }
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
  const [debugInfo, setDebugInfo] = useState('Yuklanmoqda...');

  const messagesEndRef = useRef(null);
  const reconnectTimeout = useRef(null);

  // ==================== TELEGRAM INITDATA KUTISH ====================
  useEffect(() => {
    if (!user?.id) return;

    const waitForTelegram = () => {
      if (window.Telegram?.WebApp?.initData) {
        console.log('Telegram initData topildi:', window.Telegram.WebApp.initData.length);
        connectWebSocket();
      } else {
        console.log('Telegram initData kutilmoqda...');
        setTimeout(waitForTelegram, 500);
      }
    };

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    waitForTelegram();

    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [user?.id]);

  // ==================== WEBSOCKET ====================
  const connectWebSocket = () => {
    const socket = new WebSocket('wss://telegram-bot-server-2-matj.onrender.com');
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setDebugInfo('Serverga ulandi');
      sendAuthentication();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Serverdan keldi:', data.type);

        switch (data.type) {
          case 'authenticated':
            setAuthenticated(true);
            setDebugInfo('Muvaffaqiyatli kirildi!');
            showNotif('Xush kelibsiz!', 'success');
            break;

          case 'joined_queue':
            setInQueue(true);
            setDebugInfo('Navbatda...');
            break;

          case 'match_found':
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setInQueue(false);
            setDebugInfo('O‘yin topildi!');
            break;

          case 'round_result':
            setScores(data.scores);
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
            if (data.result === 'draw') {
              setCoins(c => c + 25);
              showNotif('Durang! +25 coins');
            } else if (data.winnerId === user.id) {
              setCoins(c => c + 50);
              showNotif('G‘alaba! +50 coins 🎉');
            } else {
              showNotif('Mag‘lubiyat 😔');
            }
            break;

          case 'chat_message':
            const msg = data.message;
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: msg.senderId === user.id ? 'me' : 'opponent',
              text: msg.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: msg.senderName || (msg.senderId === user.id ? 'Siz' : 'Raqib')
            }]);
            break;

          case 'error':
            showNotif(data.message || 'Xatolik', 'error');
            break;

          default:
            console.log('Noma‘lum xabar:', data.type);
        }
      } catch (err) {
        console.error('Xabar parse xatosi:', err);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      setDebugInfo('Ulanish uzildi. Qayta ulanmoqda...');
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.error('WS xatosi:', err);
      setDebugInfo('Ulanish xatosi');
    };
  };

  const sendAuthentication = () => {
    const initData = window.Telegram?.WebApp?.initData || '';

    const authData = {
      type: 'authenticate',
      userId: user.id,
      firstName: user.first_name || 'Player',
      username: user.username || `user_${user.id}`,
      languageCode: user.language_code || 'uz',
      isPremium: user.is_premium || false,
      initData
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(authData));
      setDebugInfo('Autentifikatsiya yuborildi');
    }
  };

  const joinQueue = () => {
    if (!authenticated || !ws.current?.OPEN) {
      showNotif('Serverga ulanmagan', 'error');
      return;
    }

    ws.current.send(JSON.stringify({ type: 'join_queue', mode: 'casual' }));
    setInQueue(true);
  };

  const makeChoice = (choice) => {
    if (!gameId || myChoice || result) return;
    ws.current.send(JSON.stringify({ type: 'make_choice', gameId, choice }));
    setMyChoice(choice);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId) return;

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

  if (!connected) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>{debugInfo}</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="auth-screen">
        <h2>Kirish...</h2>
        <p>{debugInfo}</p>
        <button onClick={() => {
          setAuthenticated(true);
          showNotif('Demo rejimda davom etilmoqda', 'info');
        }}>
          Demo rejim
        </button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <button className="back-btn" onClick={onBackToMenu}>← Orqaga</button>

      {inQueue ? (
        <div className="queue">
          <div className="spinner"></div>
          <h2>Raqib qidirilmoqda...</h2>
          <button onClick={() => setInQueue(false)}>Chiqish</button>
        </div>
      ) : gameId ? (
        <div className="game">
          <div className="players">
            <div className="player">
              <h3>Siz</h3>
              <div className="choice">{myChoice ? CHOICES[myChoice].emoji : '?'}</div>
              <p>{scores.player1}</p>
            </div>
            <div className="vs">VS</div>
            <div className="player">
              <h3>{opponent?.firstName || 'Raqib'}</h3>
              <div className="choice">{opponentChoice ? CHOICES[opponentChoice].emoji : '?'}</div>
              <p>{scores.player2}</p>
            </div>
          </div>

          {!myChoice && !result && (
            <div className="choices">
              {Object.keys(CHOICES).map(key => (
                <button key={key} onClick={() => makeChoice(key)}>
                  {CHOICES[key].emoji} {CHOICES[key].name}
                </button>
              ))}
            </div>
          )}

          {result && (
            <div className="result">
              <h2>{result === 'draw' ? 'Durang!' : 'G‘alaba!'}</h2>
              <button onClick={() => setGameId(null)}>Yangi o‘yin</button>
            </div>
          )}

          <div className="chat">
            <div className="messages">
              {messages.map(m => (
                <div key={m.id} className={m.sender}>
                  <strong>{m.senderName}</strong>: {m.text}
                  <small>{m.time}</small>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Xabar yozing..."
              />
              <button type="submit">Yuborish</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="menu">
          <h2>O‘yin boshlash</h2>
          <button onClick={joinQueue}>O‘ynash</button>
        </div>
      )}

      <div className="debug">{debugInfo}</div>
    </div>
  );
}

export default MultiplayerGame;