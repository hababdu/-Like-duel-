// MultiplayerGame.jsx - TO'LIQ ISHLAYDI
import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

const CHOICES = {
  rock: { name: "Tosh", emoji: "✊", color: "#e74c3c" },
  paper: { name: "Qog'oz", emoji: "✋", color: "#3498db" },
  scissors: { name: "Qaychi", emoji: "✌️", color: "#2ecc71" },
};

function MultiplayerGame({ user, onBackToMenu, showNotif }) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [debugInfo, setDebugInfo] = useState('');
  const messagesEndRef = useRef(null);
  
  // DEBUG: Console ga barcha ma'lumotlarni chiqarish
  useEffect(() => {
    console.log('=== DEBUG INFO ===');
    console.log('User ID:', user?.id);
    console.log('User data:', user);
    console.log('WebSocket readyState:', ws.current?.readyState);
    console.log('Connected:', connected);
    console.log('Authenticated:', authenticated);
    console.log('=================');
  }, [user, connected, authenticated]);

  // 1. WebSocket ulanishi (MUHIM O'ZGARISH)
  useEffect(() => {
    if (!user?.id) {
      console.log("❌ Foydalanuvchi ma'lumotlari yo'q");
      showNotif("Iltimos, avval tizimga kiring", "error");
      return;
    }

    console.log('🚀 WebSocket ulanishi boshlanmoqda...');
    console.log('📡 Server URL: wss://telegram-bot-server-2-matj.onrender.com');
    setConnectionStatus('connecting');
    setDebugInfo('WebSocket yaratilmoqda...');

    // WebSocket yaratish
    const socket = new WebSocket('https://telegram-bot-server-2-matj.onrender.com');
    ws.current = socket;

    // 1. ONOPEN - WebSocket ochilganda
    socket.onopen = () => {
      console.log('✅✅✅ WebSocket SERVERGA ULANDI!');
      console.log('📊 WebSocket holati:', socket.readyState);
      setConnected(true);
      setConnectionStatus('connected');
      setDebugInfo('WebSocket ochildi, authentication yuborilmoqda...');
      showNotif("Serverga ulandi!", "success");

      // 2. AUTHENTICATION yuborish (DARHOL)
      const authData = {
        type: 'authenticate',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player',
        telegramId: user.id
      };
      
      console.log('📤 AUTHENTICATION yuborilmoqda:', authData);
      
      // 3 soniya kutish (server tayyor bo'lishi uchun)
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(authData));
          console.log('✅ Authentication yuborildi');
          setDebugInfo('Authentication yuborildi, kutilyapti...');
        } else {
          console.error('❌ WebSocket ochiq emas, auth yuborilmadi');
          setDebugInfo('WebSocket ochiq emas');
        }
      }, 1000);
    };

    // 2. ONMESSAGE - Serverdan xabar kelganda
    socket.onmessage = (event) => {
      console.log('📩 SERVERDAN XABAR KELDI:', event.data);
      setDebugInfo(`Xabar keldi: ${event.data.substring(0, 50)}...`);
      
      try {
        const data = JSON.parse(event.data);
        console.log('📊 Parsed data:', data);
        handleServerMessage(data);
      } catch (error) {
        console.error('❌ Xabarni parse qilishda xato:', error);
        console.log('📨 Original xabar:', event.data);
        
        // Agar xabar JSON bo'lmasa, bu oddiy text xabar
        if (typeof event.data === 'string') {
          console.log('📝 Text xabar:', event.data);
          if (event.data.includes('connected') || event.data.includes('welcome')) {
            showNotif("Serverga ulandi!", "success");
          }
        }
      }
    };

    // 3. ONERROR - Xatolik yuz bersa
    socket.onerror = (error) => {
      console.error('❌❌❌ WEB SOCKET XATOSI:', error);
      console.error('❌ Error event:', error);
      setConnectionStatus('error');
      setDebugInfo(`WebSocket xatosi: ${error.type || 'unknown'}`);
      showNotif("WebSocket xatosi", "error");
    };

    // 4. ONCLOSE - WebSocket yopilganda
    socket.onclose = (event) => {
      console.log(`🔌🔌🔌 WebSocket YOPILDI. Code: ${event.code}, Reason: ${event.reason}`);
      console.log(`📊 Clean: ${event.wasClean ? 'Ha' : 'Yo\'q'}`);
      setConnected(false);
      setAuthenticated(false);
      setConnectionStatus('disconnected');
      setDebugInfo(`WebSocket yopildi: ${event.code}`);
      
      // Agar normal emas yopilgan bo'lsa, qayta ulanish
      if (event.code !== 1000 && event.code !== 1001) {
        console.log('🔄 3 soniyadan keyin qayta ulanmoqda...');
        setTimeout(() => {
          console.log('🔄 Qayta ulanish boshlanmoqda...');
          setConnectionStatus('connecting');
        }, 3000);
      }
    };

    // Cleanup
    return () => {
      console.log('🧹 Komponent tozalanmoqda, WebSocket yopilmoqda...');
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Komponent unmount bo'ldi");
      }
    };
  }, [user?.id]); // Faqat user.id o'zgarganda

  // Server xabarlarini qayta ishlash
  const handleServerMessage = (data) => {
    console.log('🎯 XABAR TURI:', data.type, data);
    
    switch (data.type) {
      case 'authenticated':
        console.log('🎉🎉🎉 AUTHENTICATION MUVAFFAQIYATLI!');
        console.log('👤 User:', data.user);
        setAuthenticated(true);
        setDebugInfo('Authentication muvaffaqiyatli!');
        showNotif(`Xush kelibsiz, ${data.user?.firstName || 'Player'}!`, "success");
        break;
        
      case 'joined_queue':
        console.log('⏳ Navbatga qo\'shildi');
        setInQueue(true);
        setDebugInfo('Navbatda, raqib qidirilmoqda...');
        showNotif("Navbatga qo'shildingiz. Raqib qidirilmoqda...", "info");
        break;
        
      case 'match_found':
        console.log('🎮🎮🎮 MATCH TOPILDI!', data);
        setGameId(data.gameId);
        setOpponent(data.opponent);
        setInQueue(false);
        setDebugInfo(`Match: vs ${data.opponent?.firstName}`);
        showNotif(`Raqib topildi: ${data.opponent?.firstName || data.opponent?.username || 'Raqib'}`, "success");
        break;
        
      case 'error':
        console.error('❌ SERVER XATOSI:', data.message, data.code);
        setDebugInfo(`Server xatosi: ${data.code || 'unknown'}`);
        showNotif(data.message || "Server xatosi", "error");
        
        // Agar authentication xatosi bo'lsa
        if (data.code === 'AUTH_FAILED' || data.code === 'INVALID_USER_DATA') {
          console.log('🔄 Authentication qayta urinilmoqda...');
          // Authentication ni qayta yuborish
          setTimeout(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              const authData = {
                type: 'authenticate',
                userId: user.id,
                username: user.username || `user_${user.id}`,
                firstName: user.first_name || 'Player',
                telegramId: user.id
              };
              ws.current.send(JSON.stringify(authData));
              console.log('🔄 Authentication qayta yuborildi');
            }
          }, 2000);
        }
        break;
        
      case 'chat_message':
        console.log('💬 Chat xabari:', data);
        const msg = data.message || data;
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
          text: msg.text || msg.content?.text || "[xabar]",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: msg.senderName || (msg.senderId === user.id ? 'Siz' : 'Raqib')
        }]);
        break;
        
      default:
        console.log('🔍 Nomaʼlum xabar turi:', data.type, data);
        setDebugInfo(`Unknown: ${data.type}`);
    }
  };

  // Navbatga qo'shilish
  const joinQueue = () => {
    console.log('🎮 Navbatga qo\'shilish boshlanmoqda...');
    console.log('📊 Holatlar:', {
      ws: ws.current?.readyState,
      connected,
      authenticated,
      inQueue
    });
    
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket ochiq emas!');
      showNotif("Serverga ulanmagan", "error");
      return;
    }
    
    if (!authenticated) {
      console.error('❌ Authentication qilinmagan!');
      showNotif("Avval tizimga kirishingiz kerak", "error");
      return;
    }
    
    const queueData = {
      type: 'join_queue',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      mode: 'casual'
    };
    
    console.log('📤 Queue yuborilmoqda:', queueData);
    ws.current.send(JSON.stringify(queueData));
    setDebugInfo('Navbat so\'rovi yuborildi...');
  };

  // Tanlov qilish
  const makeChoice = (choice) => {
    if (!gameId || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif("Serverga ulanmagan", "error");
      return;
    }
    
    if (myChoice || result) return;
    
    setMyChoice(choice);
    
    const choiceData = {
      type: 'make_choice',
      gameId: gameId,
      choice: choice,
      userId: user.id
    };
    
    console.log('✊ Tanlov:', choiceData);
    ws.current.send(JSON.stringify(choiceData));
  };

  // Test funktsiyasi
  const testConnection = () => {
    console.log('=== TEST CONNECTION ===');
    console.log('1. WebSocket readyState:', ws.current?.readyState);
    console.log('2. Connected:', connected);
    console.log('3. Authenticated:', authenticated);
    console.log('4. Game ID:', gameId);
    console.log('5. In Queue:', inQueue);
    console.log('6. User ID:', user?.id);
    
    // WebSocket holatini tekshirish
    if (ws.current) {
      const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
      console.log('📊 WebSocket holati:', states[ws.current.readyState]);
    }
    
    showNotif(`WS: ${ws.current?.readyState || 'yoq'}, Auth: ${authenticated}`, 'info');
  };

  // Yangi o'yin
  const startNewGame = () => {
    setGameId(null);
    setOpponent(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setMessages([]);
    
    setTimeout(() => {
      joinQueue();
    }, 500);
  };

  // Chat scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="multiplayer-game-container">
      <header className="game-header">
        <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
        <div className="connection-info">
          <span className={`status-dot ${connectionStatus}`}></span>
          <span className="status-text">
            {connectionStatus === 'connected' && '🟢 Online'}
            {connectionStatus === 'connecting' && '🟡 Ulanyapdi...'}
            {connectionStatus === 'error' && '🔴 Xato'}
            {connectionStatus === 'disconnected' && '⚪ Offline'}
          </span>
          {authenticated && <span className="auth-badge">✓ Auth</span>}
        </div>
        <button className="test-btn" onClick={testConnection}>Test</button>
      </header>

      {/* DEBUG PANEL (faqat development uchun) */}
      <div className="debug-panel">
        <div className="debug-item">
          <span>WebSocket:</span>
          <span className={ws.current?.readyState === 1 ? 'success' : 'error'}>
            {ws.current?.readyState === 0 ? 'CONNECTING' : 
             ws.current?.readyState === 1 ? 'OPEN ✅' : 
             ws.current?.readyState === 2 ? 'CLOSING' : 'CLOSED'}
          </span>
        </div>
        <div className="debug-item">
          <span>Auth:</span>
          <span className={authenticated ? 'success' : 'error'}>
            {authenticated ? '✅' : '❌'}
          </span>
        </div>
        <div className="debug-item">
          <span>User ID:</span>
          <span>{user?.id || 'Yo\'q'}</span>
        </div>
        <div className="debug-info">{debugInfo}</div>
      </div>

      {connectionStatus === 'connecting' ? (
        <div className="connecting-screen">
          <div className="spinner"></div>
          <h3>Serverga ulanmoqda...</h3>
          <p>Bu 5-10 soniya vaqt olishi mumkin</p>
          <p className="server-info">Server: telegram-bot-server-2-matj.onrender.com</p>
        </div>
      ) : !connected ? (
        <div className="error-screen">
          <div className="error-icon">❌</div>
          <h3>Serverga ulanib bo'lmadi</h3>
          <p>Iltimos, quyidagilarni tekshiring:</p>
          <ul className="checklist">
            <li>Internet aloqasi borligini tekshiring</li>
            <li>Brauzer yangilang (F5)</li>
            <li>Server ishlayotganini tekshiring</li>
          </ul>
          <button className="retry-btn" onClick={() => window.location.reload()}>
            Yangilash (F5)
          </button>
        </div>
      ) : !authenticated ? (
        <div className="auth-screen">
          <div className="spinner"></div>
          <h3>Tizimga kirilmoqda...</h3>
          <p>Authentication jarayoni davom etmoqda</p>
          <p className="user-id">User ID: {user?.id}</p>
          <button className="retry-auth-btn" onClick={() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              const authData = {
                type: 'authenticate',
                userId: user.id,
                username: user.username || `user_${user.id}`,
                firstName: user.first_name || 'Player',
                telegramId: user.id
              };
              ws.current.send(JSON.stringify(authData));
              showNotif("Authentication qayta yuborildi", "info");
            }
          }}>
            Authentication qayta yuborish
          </button>
        </div>
      ) : !gameId && inQueue ? (
        <div className="waiting-screen">
          <div className="spinner large"></div>
          <h2>Raqib qidirilmoqda...</h2>
          <p>Bu bir necha daqiqa vaqt olishi mumkin</p>
          <div className="queue-stats">
            <div className="stat">
              <span className="stat-label">Navbatdagilar:</span>
              <span className="stat-value">0</span>
            </div>
            <div className="stat">
              <span className="stat-label">Kutilish vaqti:</span>
              <span className="stat-value">~30 soniya</span>
            </div>
          </div>
          <button className="cancel-btn" onClick={() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'leave_queue',
                userId: user.id
              }));
            }
            setInQueue(false);
          }}>
            Navbatdan chiqish
          </button>
        </div>
      ) : gameId ? (
        <div className="game-area">
          <div className="game-header-info">
            <div className="game-id">O'yin #{gameId.substring(0, 6)}</div>
            <div className="opponent-info">
              Raqib: <strong>{opponent?.firstName || opponent?.username || 'Raqib'}</strong>
            </div>
          </div>

          <div className="players-container">
            <div className="player you">
              <div className="player-label">SIZ</div>
              <div className="choice-display">
                {myChoice ? CHOICES[myChoice].emoji : "?"}
              </div>
              <div className="choice-name">
                {myChoice ? CHOICES[myChoice].name : "Tanlanmagan"}
              </div>
            </div>
            
            <div className="vs">VS</div>
            
            <div className="player opponent">
              <div className="player-label">RAQIB</div>
              <div className="choice-display">
                {opponentChoice ? CHOICES[opponentChoice].emoji : "❓"}
              </div>
              <div className="choice-name">
                {opponentChoice ? CHOICES[opponentChoice].name : "Kutilmoqda..."}
              </div>
            </div>
          </div>

          {!myChoice && !result && (
            <div className="choices-section">
              <h3>Tanlang:</h3>
              <div className="choices">
                {Object.entries(CHOICES).map(([key, val]) => (
                  <button
                    key={key}
                    className="choice-btn"
                    style={{ '--choice-color': val.color }}
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
              <div className="waiting-emoji">⏳</div>
              <p>Siz tanladingiz: <strong>{CHOICES[myChoice].name}</strong></p>
              <p>Raqib tanlovini kuting...</p>
            </div>
          )}

          {result && (
            <div className="result-section">
              <h2>{result === 'draw' ? 'Durang!' : 'Oʻyin tugadi!'}</h2>
              <button className="new-game-btn" onClick={startNewGame}>
                Yangi o'yin
              </button>
            </div>
          )}

          <div className="chat-section">
            <div className="chat-header">
              <span>💬 Chat</span>
              <span className="message-count">{messages.length} xabar</span>
            </div>
            
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-message ${msg.sender}`}>
                  <div className="message-sender">{msg.senderName}</div>
                  <div className="message-content">{msg.text}</div>
                  <div className="message-time">{msg.time}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <form className="chat-input-form" onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim() && ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                  type: 'chat_message',
                  text: chatInput.trim(),
                  gameId: gameId
                }));
                setChatInput('');
              }
            }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Xabar yozing..."
                disabled={!gameId}
              />
              <button type="submit" disabled={!chatInput.trim() || !gameId}>
                Yuborish
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="start-screen">
          <div className="welcome-card">
            <h2>🎮 Ko'p o'yinchili o'yin</h2>
            <p>Butun dunyo bo'ylab o'yinchilar bilan bellashing!</p>
          </div>
          
          <div className="status-card">
            <div className="status-row">
              <span>Server:</span>
              <span className="status-indicator success">🟢 Ishlamoqda</span>
            </div>
            <div className="status-row">
              <span>Autentifikatsiya:</span>
              <span className={`status-indicator ${authenticated ? 'success' : 'warning'}`}>
                {authenticated ? '✅ Kirildi' : '🔄 Jarayonda'}
              </span>
            </div>
            <div className="status-row">
              <span>O'yinchilar:</span>
              <span className="status-indicator">0 online</span>
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="primary-btn" 
              onClick={joinQueue}
              disabled={!authenticated || inQueue}
            >
              {inQueue ? 'Navbatda...' : '🎮 Oʻyinni boshlash'}
            </button>
            
            <button 
              className="secondary-btn"
              onClick={() => {
                console.log('=== DEBUG LOG ===');
                console.log('WebSocket:', ws.current);
                console.log('ReadyState:', ws.current?.readyState);
                console.log('User:', user);
                console.log('Authenticated:', authenticated);
              }}
            >
              Console log
            </button>
          </div>
          
          {!authenticated && (
            <div className="warning-box">
              <p>⚠️ Authentication jarayoni davom etmoqda...</p>
              <p>Serverga kirish uchun 10-15 soniya kuting.</p>
              <p>Agar uzoq vaqt kutayotgan bo'lsa, brauzerni yangilang.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiplayerGame;