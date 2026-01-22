// src/components/MultiplayerGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

function MultiplayerGame({ user, onBackToMenu, showNotif, coins, setCoins, CHOICES }) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  // WebSocket connection
  useEffect(() => {
    if (!user?.id) {
      console.log('❌ User ID yoʻq');
      showNotif('User ID topilmadi', 'error');
      return;
    }

    console.log('🚀 WebSocket ulanmoqda, User ID:', user.id);
    setDebugInfo('WebSocket yaratilmoqda...');

    // WebSocket URL
    const WS_URL = 'wss://telegram-bot-server-2-matj.onrender.com';
    console.log('📡 URL:', WS_URL);

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    // Event handlers
    socket.onopen = () => {
      console.log('✅✅✅ WebSocket OCHILDI!');
      setConnected(true);
      setConnectionError(null);
      setDebugInfo('WebSocket ochildi, auth yuborilmoqda...');
      showNotif('Serverga ulandi!', 'success');

      // Authentication yuborish
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          const authData = {
            type: 'authenticate',
            userId: user.id,
            username: user.username || `user_${user.id}`,
            firstName: user.first_name || 'Player',
            languageCode: user.language_code || 'uz'
          };
          
          console.log('📤 Auth yuborilmoqda:', authData);
          socket.send(JSON.stringify(authData));
          
          // Navbatga avtomatik qo'shilish
          setTimeout(() => {
            joinQueue();
          }, 2000);
        }
      }, 1000);
    };

    socket.onmessage = (event) => {
      console.log('📩 Server:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        console.log('📊 Parsed:', data.type, data);
        
        // Handle different message types
        switch(data.type) {
          case 'authenticated':
            console.log('🎉 Authentication muvaffaqiyatli!');
            setDebugInfo('Authentication OK');
            showNotif('Tizimga kirildi!', 'success');
            break;
            
          case 'joined_queue':
            console.log('⏳ Navbatda...');
            setInQueue(true);
            setDebugInfo('Navbatda, raqib qidirilmoqda...');
            showNotif('Raqib qidirilmoqda...', 'info');
            break;
            
          case 'match_found':
            console.log('🎮🎮🎮 MATCH TOPILDI!', data);
            setGameId(data.gameId);
            setOpponent(data.opponent);
            setInQueue(false);
            setDebugInfo(`Match: vs ${data.opponent?.firstName || 'Raqib'}`);
            showNotif(`Raqib topildi: ${data.opponent?.firstName || data.opponent?.username || 'Raqib'}`, 'success');
            break;
            
          case 'opponent_choice_made':
            console.log('⚠️ Raqib tanlov qildi');
            showNotif('Raqib tanlov qildi!', 'info');
            break;
            
          case 'round_result':
            console.log('📊 Round natijasi:', data);
            setOpponentChoice(
              data.choices?.player1?.id === user.id ? 
              data.choices?.player2 : 
              data.choices?.player1
            );
            setScores(data.scores || { player1: 0, player2: 0 });
            
            const roundMsg = data.result === 'draw' ? 'Raund durang!' : 'Raund tugadi!';
            showNotif(roundMsg, data.result === 'draw' ? 'warning' : 'info');
            break;
            
          case 'game_result':
            console.log('🏁 Game tugadi:', data);
            setResult(data.result);
            setScores(data.scores || { player1: 0, player2: 0 });
            
            let finalMsg = 'Oʻyin tugadi!';
            if (data.result === 'draw') {
              finalMsg = 'Durang!';
              setCoins(prev => prev + 25);
            } else if (data.winnerId === user.id) {
              finalMsg = 'Gʻalaba! 🎉';
              setCoins(prev => prev + 50);
            } else {
              finalMsg = 'Magʻlubiyat';
            }
            
            showNotif(finalMsg, data.result === 'draw' ? 'warning' : data.winnerId === user.id ? 'success' : 'error');
            break;
            
          case 'chat_message':
            console.log('💬 Chat:', data);
            const msg = data.message || data;
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: String(msg.senderId) === String(user.id) ? 'me' : 'opponent',
              text: msg.text || msg.content?.text || '...',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: msg.senderName || (msg.senderId === user.id ? 'Siz' : 'Raqib')
            }]);
            break;
            
          case 'error':
            console.error('❌ Server xatosi:', data);
            setDebugInfo(`Server xatosi: ${data.code || 'unknown'}`);
            showNotif(data.message || 'Server xatosi', 'error');
            break;
            
          default:
            console.log('🔍 Nomaʼlum xabar:', data.type);
        }
      } catch (error) {
        console.log('📝 Text xabar:', event.data);
        if (event.data.includes('connected') || event.data.includes('welcome')) {
          console.log('✅ Server salom berdi');
          setDebugInfo('Server salom berdi');
        }
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket xatosi:', error);
      setConnectionError('WebSocket connection failed');
      showNotif('Ulanish xatosi', 'error');
    };

    socket.onclose = (event) => {
      console.log(`🔌 WebSocket yopildi: ${event.code} - ${event.reason}`);
      setConnected(false);
      setDebugInfo(`WebSocket yopildi (${event.code})`);
      
      // Avtomatik qayta ulanish
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('🔄 Qayta ulanmoqda...');
          window.location.reload();
        }, 5000);
      }
    };

    // Cleanup
    return () => {
      console.log('🧹 MultiplayerGame unmount');
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Component unmount');
      }
    };
  }, [user?.id]);

  // Navbatga qo'shilish
  const joinQueue = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif('Serverga ulanmagan', 'error');
      return;
    }
    
    const queueData = {
      type: 'join_queue',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      mode: 'casual'
    };
    
    console.log('🎮 Navbatga qoʻshilmoqda:', queueData);
    ws.current.send(JSON.stringify(queueData));
    setDebugInfo('Navbat soʻrovi yuborildi...');
  };

  // Tanlov qilish
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

  // Chat yuborish
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

  // Yangi o'yin
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

  // Render
  if (!connected) {
    return (
      <div className="multiplayer-container">
        <div className="connection-screen">
          <div className="spinner"></div>
          <h3>Serverga ulanmoqda...</h3>
          <p>URL: telegram-bot-server-2-matj.onrender.com</p>
          {connectionError && (
            <div className="error-message">
              <p>❌ {connectionError}</p>
              <button onClick={() => window.location.reload()}>Qayta urinish</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (inQueue) {
    return (
      <div className="multiplayer-container">
        <button className="back-button" onClick={onBackToMenu}>← Menyuga</button>
        
        <div className="queue-screen">
          <div className="spinner large"></div>
          <h2>Raqib qidirilmoqda...</h2>
          <div className="queue-info">
            <p>👤 User ID: {user.id}</p>
            <p>📡 Status: {debugInfo}</p>
          </div>
          <button className="cancel-button" onClick={() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'leave_queue',
                userId: user.id
              }));
            }
            setInQueue(false);
            onBackToMenu();
          }}>
            Bekor qilish
          </button>
        </div>
      </div>
    );
  }

  if (gameId) {
    return (
      <div className="multiplayer-container">
        <div className="game-header">
          <button className="back-button" onClick={onBackToMenu}>← Menyuga</button>
          <div className="game-info">
            <span className="game-id">O'yin #{gameId.substring(0, 6)}</span>
            <span className="coins-display">🪙 {coins}</span>
          </div>
        </div>

        <div className="game-area">
          {/* Player display */}
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
            <div className="choices-container">
              <h3>Tanlang:</h3>
              <div className="choices">
                {Object.entries(CHOICES).map(([key, value]) => (
                  <button
                    key={key}
                    className="choice-button"
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

          {/* Waiting for opponent */}
          {myChoice && !opponentChoice && !result && (
            <div className="waiting-section">
              <div className="waiting-spinner"></div>
              <p>Siz tanladingiz: <strong>{CHOICES[myChoice].name}</strong></p>
              <p>Raqib tanlovini kuting...</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="result-section">
              <h2 className={result === 'draw' ? 'draw' : 'win'}>
                {result === 'draw' ? 'Durang!' : 
                 result === 'player1_win' && scores.player1 > scores.player2 ? 'Gʻalaba! 🎉' : 
                 result === 'player2_win' && scores.player2 > scores.player1 ? 'Magʻlubiyat' : 'Oʻyin tugadi!'}
              </h2>
              
              <div className="final-score">
                <span>{scores.player1}</span>
                <span>:</span>
                <span>{scores.player2}</span>
              </div>
              
              <div className="result-buttons">
                <button className="menu-button" onClick={onBackToMenu}>
                  Menyuga
                </button>
                <button className="new-game-button" onClick={startNewGame}>
                  Yangi o'yin
                </button>
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="chat-container">
            <div className="chat-header">
              <span>💬 Chat</span>
              <span className="message-count">{messages.length}</span>
            </div>
            
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>Xabar yoʻq</p>
                  <p>Birinchi xabaringizni yozing!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.sender}`}>
                    <div className="message-sender">{msg.senderName}</div>
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{msg.time}</div>
                  </div>
                ))
              )}
            </div>
            
            <form className="chat-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Xabar yozing..."
                maxLength={200}
                disabled={result}
              />
              <button type="submit" disabled={!chatInput.trim() || result}>
                Yuborish
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Start screen
  return (
    <div className="multiplayer-container">
      <button className="back-button" onClick={onBackToMenu}>← Menyuga</button>
      
      <div className="start-screen">
        <h2>🎮 Ko'p O'yinchili O'yin</h2>
        <p>Butun dunyo bo'ylab o'yinchilar bilan bellashing!</p>
        
        <div className="user-card">
          <div className="user-avatar-small">
            {user.first_name?.charAt(0) || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{user.first_name}</div>
            <div className="user-id">ID: {user.id}</div>
          </div>
        </div>
        
        <div className="status-card">
          <div className="status-item">
            <span>Server:</span>
            <span className="status-online">🟢 Online</span>
          </div>
          <div className="status-item">
            <span>O'yinchilar:</span>
            <span>0 online</span>
          </div>
          <div className="status-item">
            <span>Coins:</span>
            <span>🪙 {coins}</span>
          </div>
        </div>
        
        <button className="start-button" onClick={joinQueue}>
          🎮 O'YINNI BOSHLASH
        </button>
        
        <div className="instructions">
          <h4>📋 Qoidalar:</h4>
          <ul>
            <li>Tosh ✊ Qaychini yutadi</li>
            <li>Qog'oz ✋ Toshni yutadi</li>
            <li>Qaychi ✌️ Qog'ozni yutadi</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MultiplayerGame;