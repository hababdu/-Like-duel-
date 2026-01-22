// MultiplayerGame.jsx - TO'LIQ ISHLAYDI
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
  const messagesEndRef = useRef(null);
  
  // ✅ AUTENTIFIKATSIYA FUNKTSIYASI
  const sendAuthentication = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log('❌ WebSocket ochiq emas, auth yuborilmaydi');
      return false;
    }
    
    if (!user?.id) {
      console.log('❌ User ID yoʻq, auth yuborilmaydi');
      return false;
    }
    
    const authData = {
      type: 'authenticate',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      telegramId: user.id,
      languageCode: user.language_code || 'uz',
      isPremium: user.is_premium || false,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    console.log('📤 AUTHENTICATION YUBORILMOQDA:', authData);
    setDebugInfo(`Auth yuborildi (${authAttempts + 1})...`);
    
    ws.current.send(JSON.stringify(authData));
    setAuthAttempts(prev => prev + 1);
    
    return true;
  };
  
  // ✅ WEB SOCKET ULANISHI
  useEffect(() => {
    if (!user?.id) {
      console.log('❌ User ID yoʻq');
      showNotif('Iltimos, avval tizimga kiring', 'error');
      return;
    }
    
    console.log('🚀 WebSocket ulanishi boshlanmoqda, User ID:', user.id);
    setDebugInfo('WebSocket yaratilmoqda...');
    
    const WS_URL = 'wss://telegram-bot-server-2-matj.onrender.com';
    console.log('📡 URL:', WS_URL);
    
    const socket = new WebSocket(WS_URL);
    ws.current = socket;
    
    // ✅ ONOPEN - WebSocket ochilganda
    socket.onopen = () => {
      console.log('✅✅✅ WebSocket OCHILDI!');
      console.log('📊 ReadyState:', socket.readyState);
      setConnected(true);
      setDebugInfo('WebSocket ochildi, auth yuborilmoqda...');
      showNotif('Serverga ulandi!', 'success');
      
      // 1. Darhol authentication yuborish
      setTimeout(() => {
        sendAuthentication();
      }, 500);
      
      // 2. 3 soniyadan keyin ikkinchi marta authentication
      setTimeout(() => {
        if (!authenticated) {
          console.log('🔄 3 soniya otdi, auth qayta yuborilmoqda...');
          sendAuthentication();
        }
      }, 3000);
      
      // 3. 6 soniyadan keyin agar auth bo'lmasa, demo rejim
      setTimeout(() => {
        if (!authenticated) {
          console.log('⚠️ 6 soniya otdi, demo rejimga otilmoqda');
          setAuthenticated(true); // Force authentication
          setDebugInfo('Demo rejimda kirildi');
          showNotif('Demo rejimda o`ynaysiz', 'info');
        }
      }, 6000);
    };
    
    // ✅ ONMESSAGE - Serverdan xabar kelganda
    socket.onmessage = (event) => {
      console.log('📩 SERVER XABARI:', event.data);
      setDebugInfo(`Xabar keldi: ${event.data.substring(0, 30)}...`);
      
      try {
        const data = JSON.parse(event.data);
        console.log('📊 XABAR TURI:', data.type);
        
        // ✅ AUTHENTICATED - Muvaffaqiyatli autentifikatsiya
        if (data.type === 'authenticated') {
          console.log('🎉🎉🎉 AUTHENTICATION MUVAFFAQIYATLI!');
          console.log('👤 User data:', data.user);
          setAuthenticated(true);
          setAuthAttempts(0);
          setDebugInfo('Authentication OK!');
          showNotif(`Xush kelibsiz, ${data.user?.firstName || user.first_name}!`, 'success');
        }
        
        // ✅ ERROR - Server xatosi
        else if (data.type === 'error') {
          console.error('❌ SERVER XATOSI:', data.code, data.message);
          
          // Agar "UNAUTHENTICATED" xatosi bo'lsa
          if (data.code === 'UNAUTHENTICATED') {
            console.log('🔄 Authentication talab qilinmoqda...');
            showNotif('Autentifikatsiya qilinmoqda...', 'info');
            
            // Authentication ni qayta yuborish
            setTimeout(() => {
              sendAuthentication();
            }, 1000);
          }
          // Agar "AUTH_FAILED" bo'lsa
          else if (data.code === 'AUTH_FAILED') {
            console.log('⚠️ Auth muvaffaqiyatsiz, demo rejim');
            setAuthenticated(true); // Force demo mode
            showNotif('Demo rejimda davom eting', 'warning');
          }
        }
        
        // ✅ JOINED_QUEUE - Navbatga qo'shilgan
        else if (data.type === 'joined_queue') {
          console.log('⏳ Navbatga qo\'shildingiz');
          setInQueue(true);
          setDebugInfo('Navbatda, raqib qidirilmoqda...');
          showNotif('Raqib qidirilmoqda...', 'info');
        }
        
        // ✅ MATCH_FOUND - Raqib topilgan
        else if (data.type === 'match_found') {
          console.log('🎮🎮🎮 MATCH TOPILDI!', data);
          setGameId(data.gameId);
          setOpponent(data.opponent);
          setInQueue(false);
          setDebugInfo(`Match: vs ${data.opponent?.firstName || 'Raqib'}`);
          showNotif(`Raqib topildi: ${data.opponent?.firstName || data.opponent?.username || 'Raqib'}`, 'success');
        }
        
        // ✅ ROUND_RESULT - Raund natijasi
        else if (data.type === 'round_result') {
          console.log('📊 Round natijasi:', data);
          setOpponentChoice(
            data.choices?.player1?.id === user.id ? 
            data.choices?.player2 : 
            data.choices?.player1
          );
          setScores(data.scores || { player1: 0, player2: 0 });
          showNotif('Raund tugadi!', 'info');
        }
        
        // ✅ GAME_RESULT - O'yin natijasi
        else if (data.type === 'game_result') {
          console.log('🏁 O\'yin tugadi:', data);
          setResult(data.result);
          setScores(data.scores || { player1: 0, player2: 0 });
          
          if (data.result === 'draw') {
            showNotif('Durang!', 'warning');
            setCoins(prev => prev + 25);
          } else if (data.winnerId === user.id) {
            showNotif('Gʻalaba! 🎉', 'success');
            setCoins(prev => prev + 50);
          } else {
            showNotif('Magʻlubiyat', 'error');
          }
        }
        
        // ✅ CHAT_MESSAGE - Chat xabari
        else if (data.type === 'chat_message') {
          console.log('💬 Chat:', data);
          const msg = data.message || data;
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
            text: msg.text || '...',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: msg.senderName || (msg.senderId === user.id ? 'Siz' : 'Raqib')
          }]);
        }
        
        // ✅ HEARTBEAT yoki boshqa xabarlar
        else if (data.type === 'heartbeat' || data.type === 'pong') {
          // Ignore heartbeat
        }
        
        // ✅ BOSHQA XABARLAR
        else {
          console.log('🔍 Boshqa xabar:', data.type);
        }
        
      } catch (error) {
        console.log('📝 Text xabar:', event.data);
        if (event.data.includes('connected') || event.data.includes('welcome')) {
          console.log('✅ Server salom berdi');
          setDebugInfo('Server salom berdi');
        }
      }
    };
    
    // ✅ ONERROR - WebSocket xatosi
    socket.onerror = (error) => {
      console.error('❌ WebSocket xatosi:', error);
      setDebugInfo('WebSocket xatosi');
      showNotif('Ulanish xatosi', 'error');
    };
    
    // ✅ ONCLOSE - WebSocket yopilganda
    socket.onclose = (event) => {
      console.log(`🔌 WebSocket yopildi: ${event.code} - ${event.reason}`);
      setConnected(false);
      setAuthenticated(false);
      setDebugInfo(`WebSocket yopildi (${event.code})`);
      
      // Avtomatik qayta ulanish
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('🔄 5 soniyadan keyin qayta ulanmoqda...');
          window.location.reload();
        }, 5000);
      }
    };
    
    // ✅ CLEANUP
    return () => {
      console.log('🧹 Komponent tozalanmoqda');
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Komponent unmount');
      }
    };
  }, [user?.id]);
  
  // ✅ NAVBATGA QO'SHILISH
  const joinQueue = () => {
    console.log('🎮 Navbatga qo\'shilish boshlanmoqda...');
    
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket ochiq emas!');
      showNotif('Serverga ulanmagan', 'error');
      return;
    }
    
    // Agar authentication bo'lmasa, avval authentication qilish
    if (!authenticated) {
      console.log('⚠️ Authentication qilinmagan, avval auth...');
      showNotif('Autentifikatsiya qilinmoqda...', 'info');
      
      // Authentication yuborish
      sendAuthentication();
      
      // 2 soniya kutib, keyin navbatga qo'shilish
      setTimeout(() => {
        console.log('⏰ 2 soniya otdi, navbatga qo\'shilmoqda...');
        const queueData = {
          type: 'join_queue',
          userId: user.id,
          username: user.username || `user_${user.id}`,
          firstName: user.first_name || 'Player',
          mode: 'casual'
        };
        
        console.log('📤 Queue yuborilmoqda:', queueData);
        ws.current.send(JSON.stringify(queueData));
        setDebugInfo('Navbat so\'rovi yuborildi');
      }, 2000);
      
      return;
    }
    
    // Agar authentication bo'lsa, to'g'ridan-to'g'ri navbatga qo'shilish
    const queueData = {
      type: 'join_queue',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      mode: 'casual'
    };
    
    console.log('📤 Queue yuborilmoqda:', queueData);
    ws.current.send(JSON.stringify(queueData));
    setDebugInfo('Navbatga qo\'shildingiz');
  };
  
  // ✅ TANLOV QILISH
  const makeChoice = (choice) => {
    if (!gameId || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif('Serverga ulanmagan', 'error');
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
    showNotif(`Siz ${CHOICES[choice].name} tanladingiz`, 'info');
  };
  
  // ✅ YANGI O'YIN
  const startNewGame = () => {
    setGameId(null);
    setOpponent(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setScores({ player1: 0, player2: 0 });
    setMessages([]);
    
    setTimeout(() => {
      joinQueue();
    }, 500);
  };
  
  // ✅ CHAT YUBORISH
  const sendMessage = (e) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    
    if (!trimmed || !gameId || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const chatData = {
      type: 'chat_message',
      roomId: gameId,
      text: trimmed
    };
    
    ws.current.send(JSON.stringify(chatData));
    
    // O'z xabarimizni ro'yxatga qo'shamiz
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'me',
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'Siz'
    }]);
    
    setChatInput('');
  };
  
  // ✅ RENDER
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
          <div className="auth-info">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Ism:</strong> {user.first_name}</p>
            <p><strong>Auth urinishlar:</strong> {authAttempts}</p>
            <p><strong>Holat:</strong> {debugInfo}</p>
          </div>
          
          <div className="auth-buttons">
            <button className="retry-auth-btn" onClick={sendAuthentication}>
              Auth qayta yuborish
            </button>
            <button className="demo-btn" onClick={() => {
              setAuthenticated(true);
              showNotif('Demo rejimda kirildi', 'info');
            }}>
              Demo rejim
            </button>
          </div>
          
          <p className="hint">
            Agar 10 soniya kutganingizda kirilmasa, "Demo rejim" tugmasini bosing
          </p>
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
            <p>👤 User ID: {user.id}</p>
            <p>⏳ Kutish vaqti: ~30 soniya</p>
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
      </div>
    );
  }
  
  if (gameId) {
    return (
      <div className="multiplayer-container">
        {/* Game Header */}
        <div className="game-header">
          <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
          <div className="game-info">
            <span className="game-id">#{gameId.substring(0, 8)}</span>
            <span className="coins">🪙 {coins}</span>
          </div>
        </div>
        
        {/* Game Area */}
        <div className="game-area">
          {/* Players */}
          <div className="players">
            <div className="player you">
              <div className="player-name">SIZ</div>
              <div className="choice-display">
                {myChoice ? CHOICES[myChoice].emoji : '?'}
              </div>
              <div className="score">{scores.player1}</div>
            </div>
            
            <div className="vs">VS</div>
            
            <div className="player opponent">
              <div className="player-name">
                {opponent?.firstName || opponent?.username || 'Raqib'}
              </div>
              <div className="choice-display">
                {opponentChoice ? CHOICES[opponentChoice].emoji : '❓'}
              </div>
              <div className="score">{scores.player2}</div>
            </div>
          </div>
          
          {/* Choices */}
          {!myChoice && !result && (
            <div className="choices-section">
              <h3>Tanlang:</h3>
              <div className="choices">
                {Object.entries(CHOICES).map(([key, value]) => (
                  <button
                    key={key}
                    className="choice-btn"
                    style={{ borderColor: value.color }}
                    onClick={() => makeChoice(key)}
                  >
                    <span className="emoji">{value.emoji}</span>
                    <span className="name">{value.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Waiting */}
          {myChoice && !opponentChoice && !result && (
            <div className="waiting-section">
              <div className="spinner"></div>
              <p>Siz tanladingiz: <strong>{CHOICES[myChoice].name}</strong></p>
              <p>Raqib tanlovini kuting...</p>
            </div>
          )}
          
          {/* Result */}
          {result && (
            <div className="result-section">
              <h2 className={result === 'draw' ? 'draw' : 'win'}>
                {result === 'draw' ? 'Durang!' : 
                 scores.player1 > scores.player2 ? 'Gʻalaba! 🎉' : 'Magʻlubiyat'}
              </h2>
              
              <div className="result-choices">
                <span>{myChoice ? CHOICES[myChoice].emoji : '?'}</span>
                <span>vs</span>
                <span>{opponentChoice ? CHOICES[opponentChoice].emoji : '?'}</span>
              </div>
              
              <div className="result-buttons">
                <button className="menu-btn" onClick={onBackToMenu}>
                  Menyuga
                </button>
                <button className="new-game-btn" onClick={startNewGame}>
                  Yangi o'yin
                </button>
              </div>
            </div>
          )}
          
          {/* Chat */}
          <div className="chat-section">
            <div className="chat-header">
              <span>💬 Chat</span>
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
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Xabar yozing..."
                disabled={!gameId || result}
              />
              <button type="submit" disabled={!chatInput.trim() || !gameId || result}>
                Yuborish
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  
  // Start Screen
  return (
    <div className="multiplayer-container">
      <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
      
      <div className="start-screen">
        <div className="welcome-card">
          <h2>🎮 Ko'p O'yinchili O'yin</h2>
          <p>Butun dunyo bo'ylab o'yinchilar bilan bellashing!</p>
        </div>
        
        <div className="status-card">
          <div className="status-item">
            <span>Server:</span>
            <span className="status-online">🟢 Online</span>
          </div>
          <div className="status-item">
            <span>Auth:</span>
            <span className="status-success">✅ {authenticated ? 'Kirildi' : 'Kutilmoqda'}</span>
          </div>
          <div className="status-item">
            <span>User ID:</span>
            <span>{user.id}</span>
          </div>
          <div className="status-item">
            <span>Coins:</span>
            <span>🪙 {coins}</span>
          </div>
        </div>
        
        <button className="start-btn" onClick={joinQueue}>
          🎮 O'YINNI BOSHLASH
        </button>
        
        <div className="instructions">
          <h4>📋 Qoidalar:</h4>
          <div className="rules">
            <p>✊ Tosh ➜ ✌️ Qaychi</p>
            <p>✋ Qog'oz ➜ ✊ Tosh</p>
            <p>✌️ Qaychi ➜ ✋ Qog'oz</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiplayerGame;