// MultiplayerGame.jsx
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
  const [inQueue, setInQueue] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(60);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [roundResults, setRoundResults] = useState([]);

  // WebSocket ulanishini o'rnatish va boshqarish
  useEffect(() => {
    if (!user?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket('wss://telegram-bot-server-2-matj.onrender.com/ws');

    socket.onopen = () => {
      setConnected(true);
      showNotif("Serverga ulanildi", "success");
      console.log("WebSocket connected");

      // Authentication
      const initData = window.Telegram?.WebApp?.initData || '';
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      };

      socket.send(JSON.stringify({
        type: 'authenticate',
        initData,
        deviceInfo
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);
        handleMessage(data);
      } catch (e) {
        console.error("Xato parse qilishda:", e);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      showNotif("Server bilan aloqa uzildi...", "error");
      setInQueue(false);
      setGameId(null);
    };

    socket.onerror = (err) => {
      console.error("WebSocket xatosi:", err);
      showNotif("Ulanishda xato", "error");
    };

    ws.current = socket;

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [user, showNotif]);

  // Serverdan kelgan xabarlarni qayta ishlash
  const handleMessage = (data) => {
    switch (data.type) {
      case 'authenticated':
        setSessionId(data.sessionId);
        showNotif(`Xush kelibsiz, ${data.user.firstName}!`, "success");
        break;
        
      case 'joined_queue':
        showNotif("Navbatga qo'shildingiz...", "info");
        setInQueue(true);
        break;
        
      case 'match_found':
        setGameId(data.gameId);
        setOpponent(data.opponent);
        setInQueue(false);
        setMyChoice(null);
        setOpponentChoice(null);
        setResult(null);
        setTimer(60);
        setMessages([]);
        setRoundNumber(1);
        setScores({ player1: 0, player2: 0 });
        setRoundResults([]);
        console.log("O'yin boshlandi, gameId =", data.gameId);
        showNotif(`Raqib topildi: ${data.opponent.firstName || data.opponent.username}`, "success");
        break;
        
      case 'opponent_choice_made':
        showNotif("Raqib tanlov qildi!", "info");
        break;
        
      case 'round_result':
        setOpponentChoice(
          data.choices.player1?.id === user.id ? 
          data.choices.player2 : 
          data.choices.player1
        );
        setScores(data.scores);
        setRoundNumber(data.round + 1);
        setRoundResults(prev => [...prev, {
          round: data.round,
          result: data.result,
          choices: data.choices
        }]);
        
        let roundResultText = '';
        const isPlayer1 = data.choices.player1?.id === user.id;
        
        if (data.result === 'draw') {
          roundResultText = 'Raund durang!';
        } else if ((isPlayer1 && data.result === 'player1_win') || 
                   (!isPlayer1 && data.result === 'player2_win')) {
          roundResultText = 'Raundda gʻalaba!';
        } else {
          roundResultText = 'Raundda magʻlubiyat!';
        }
        
        showNotif(roundResultText, data.result === 'draw' ? 'warning' : 'success');
        break;
        
      case 'next_round':
        setRoundNumber(data.round);
        setScores(data.scores);
        setMyChoice(null);
        setOpponentChoice(null);
        showNotif(`Round ${data.round} boshlandi!`, "info");
        break;
        
      case 'game_result':
        setResult(data.result);
        setScores(data.scores);
        
        const isWin = data.winnerId === user.id;
        let msg = '';
        if (data.result === 'draw') {
          msg = 'Oʻyin durang!';
        } else if (data.result === 'timeout') {
          msg = 'Vaqt tugadi';
        } else if (data.result === 'abandoned') {
          msg = 'Raqib o\'yinni tark etdi';
        } else {
          msg = isWin ? 'G‘alaba!' : 'Mag‘lubiyat!';
        }
        
        showNotif(msg, 
          data.result === 'draw' ? 'warning' : 
          data.result === 'timeout' ? 'warning' :
          data.result === 'abandoned' ? 'warning' :
          isWin ? 'success' : 'error'
        );
        break;
        
      case 'game_timeout':
        setResult('timeout');
        showNotif("Vaqt tugadi", "warning");
        break;
        
      case 'opponent_disconnected':
        setResult('disconnected');
        showNotif("Raqib uzildi. 30 soniya ichida qaytmasa, siz gʻalaba qozonasiz.", "warning");
        break;
        
      case 'chat_message':
        console.log("Chat xabari keldi:", data);
        const messageData = data.message || data;
        setMessages(prev => [...prev, {
          sender: String(messageData.senderId) === String(user.id) ? 'me' : 'opponent',
          text: messageData.text || "[xato xabar]",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: messageData.senderName
        }]);
        break;
        
      case 'choice_accepted':
        showNotif("Tanlovingiz qabul qilindi. Raqib tanlovini kuting...", "info");
        break;
        
      case 'error':
        console.log("Server xatosi:", data.message);
        showNotif(data.message || "Xato yuz berdi", "error");
        if (data.code === 'ALREADY_IN_QUEUE') {
          setInQueue(true);
        }
        break;
        
      case 'left_queue':
        setInQueue(false);
        showNotif("Navbatdan chiqdingiz", "info");
        break;
        
      case 'reconnect_to_game':
        setGameId(data.gameId);
        setRoundNumber(data.gameState.currentRound || 1);
        setScores(data.gameState.player1?.score || 0, data.gameState.player2?.score || 0);
        showNotif("Oldingi o'yinga qayta ulandingiz", "info");
        break;
        
      default:
        console.log("Noma'lum xabar:", data);
    }
  };

  // Tanlov qilish funksiyasi
  const makeChoice = (choice) => {
    if (myChoice || result || !gameId || !ws.current) {
      console.log("Tanlov qilish shartlari:", { myChoice, result, gameId, ws: ws.current });
      return;
    }
    
    setMyChoice(choice);
    
    // Agar o'yin ko'p raundli bo'lsa, round numberni ham yuborish
    const choiceData = {
      type: 'make_choice',
      userId: user.id,
      gameId,
      choice,
      round: roundNumber
    };
    
    console.log("Tanlov yuborilmoqda:", choiceData);
    ws.current.send(JSON.stringify(choiceData));
  };

  // Chat xabar yuborish
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId || !ws.current) {
      console.warn("Chat yuborish shartlari bajarilmadi", { chatInput, gameId, wsConnected: !!ws.current });
      return;
    }

    const message = {
      type: 'chat_message',
      roomId: gameId,
      text: chatInput.trim()
    };

    console.log("→ Chat yuborilyapti:", message);
    ws.current.send(JSON.stringify(message));
    setChatInput("");
  };

  // Chat avtomatik scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Navbatga qo'shilish
  const joinQueue = () => {
    if (!ws.current || !sessionId) {
      showNotif("Avval serverga ulaning", "error");
      return;
    }
    
    ws.current.send(JSON.stringify({
      type: 'join_queue',
      mode: 'casual',
      gameType: 'single'
    }));
  };

  // Navbatdan chiqish
  const leaveQueue = () => {
    if (ws.current && inQueue) {
      ws.current.send(JSON.stringify({
        type: 'leave_queue',
        userId: user.id
      }));
      setInQueue(false);
    }
  };

  // Natija matnini olish
  const getResultText = () => {
    if (!result) return "";
    
    if (result === 'timeout') return "Vaqt tugadi";
    if (result === 'disconnected') return "Raqib uzildi";
    if (result === 'draw') return "Durang!";
    if (result === 'abandoned') return "Raqib o'yinni tark etdi";

    const isPlayer1 = opponent?.id !== user?.id;
    const iWon = (result === 'player1_win' && isPlayer1) || 
                 (result === 'player2_win' && !isPlayer1);

    return iWon ? "G‘alaba!" : "Mag‘lubiyat!";
  };

  // Yangi o'yin boshlash
  const startNewGame = () => {
    setGameId(null);
    setOpponent(null);
    setMyChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setMessages([]);
    setRoundNumber(1);
    setScores({ player1: 0, player2: 0 });
    setRoundResults([]);
    
    // Avtomatik ravishda navbatga qo'shilish
    setTimeout(() => {
      if (ws.current && sessionId) {
        joinQueue();
      }
    }, 100);
  };

  return (
    <div className="multiplayer-game-container">
      <header className="game-header">
        <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
        <div className="connection-status">
          {connected ? '🟢 Online' : '🔴 Offline'}
        </div>
      </header>
      
      {!connected ? (
        <div className="connecting-screen">
          <div className="spinner"></div>
          <p>Serverga ulanmoqda...</p>
        </div>
      ) : !gameId && inQueue ? (
        <div className="waiting-screen">
          <div className="spinner large"></div>
          <h2>Raqib qidirlmoqda...</h2>
          <div className="queue-stats">
            <p>Navbatdagilar: {messages.length || '?'}</p>
            <p>Kutish vaqti: ~30 soniya</p>
          </div>
          <button className="cancel-btn" onClick={leaveQueue}>
            Bekor qilish
          </button>
        </div>
      ) : gameId ? (
        <div className="game-area">
          {/* O'yin maydoni */}
          <div className="game-info">
            <div className="game-id">O'yin ID: {gameId.slice(0, 8)}...</div>
            <div className="round-info">Round {roundNumber}</div>
          </div>
          
          <div className="players-container">
            <div className="player you">
              <div className="player-label">
                <span className="player-name">SIZ</span>
                <span className="player-score">{scores.player1 || 0}</span>
              </div>
              <div className="choice-display">
                {myChoice ? CHOICES[myChoice].emoji : "?"}
              </div>
            </div>
            <div className="vs">VS</div>
            <div className="player opponent">
              <div className="player-label">
                <span className="player-name">
                  {opponent?.firstName || opponent?.username || "Raqib"}
                </span>
                <span className="player-score">{scores.player2 || 0}</span>
              </div>
              <div className="choice-display">
                {opponentChoice ? CHOICES[opponentChoice].emoji : "❓"}
              </div>
            </div>
          </div>
          
          {/* Round natijalari */}
          {roundResults.length > 0 && (
            <div className="round-history">
              <h4>Round natijalari:</h4>
              <div className="round-list">
                {roundResults.map((round, index) => (
                  <div key={index} className="round-item">
                    <span>Round {round.round}: </span>
                    <span className={`round-result ${round.result}`}>
                      {round.result === 'draw' ? 'Durang' : 
                       (round.choices.player1?.id === user.id && round.result === 'player1_win') ||
                       (round.choices.player2?.id === user.id && round.result === 'player2_win') 
                       ? 'Gʻalaba' : 'Magʻlubiyat'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Tanlov tugmalari */}
          {!myChoice && !result && (
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
          )}
          
          {/* Tanlov qilish yoki kutilmoqda */}
          {myChoice && !opponentChoice && !result && (
            <div className="waiting-opponent">
              <p>Tanlovingiz: <strong>{CHOICES[myChoice].name}</strong></p>
              <p>Raqib tanlovini kuting...</p>
            </div>
          )}
          
          {/* Natija */}
          {result && (
            <div className={`result ${result}`}>
              <h2>{getResultText()}</h2>
              
              <div className="final-scores">
                <div className="final-score-item">
                  <span>Siz:</span>
                  <span className="score-number">{scores.player1 || 0}</span>
                </div>
                <div className="final-score-divider">-</div>
                <div className="final-score-item">
                  <span>Raqib:</span>
                  <span className="score-number">{scores.player2 || 0}</span>
                </div>
              </div>
              
              <div className="result-choices">
                <span>{myChoice ? CHOICES[myChoice].emoji : "?"}</span>
                <span>vs</span>
                <span>{opponentChoice ? CHOICES[opponentChoice].emoji : "?"}</span>
              </div>
              
              <div className="result-buttons">
                <button className="menu-btn" onClick={onBackToMenu}>
                  Menyuga qaytish
                </button>
                <button className="new-game-btn" onClick={startNewGame}>
                  Yangi o'yin
                </button>
              </div>
            </div>
          )}
          
          {/* Chat qismi */}
          {gameId && !result && (
            <div className="chat-section">
              <div className="chat-header">
                <span>Chat (raqib bilan)</span>
                <span className="chat-status">
                  {messages.length > 0 ? `${messages.length} xabar` : 'Xabar yoʻq'}
                </span>
              </div>
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`chat-message ${msg.sender === 'me' ? 'sent' : 'received'}`}
                  >
                    <div className="message-header">
                      <span className="sender-name">
                        {msg.sender === 'me' ? 'Siz' : (msg.senderName || 'Raqib')}
                      </span>
                      <span className="message-time">{msg.time}</span>
                    </div>
                    <div className="message-text">{msg.text}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-input-form" onSubmit={sendChatMessage}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Xabar yozing..."
                  disabled={!opponent}
                  maxLength={200}
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || !opponent}
                  className="send-btn"
                >
                  Yuborish
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="start-screen">
          <h2>Ko'p o'yinchili rejim</h2>
          <p className="description">
            Butun dunyo bo'ylab o'yinchilar bilan tosh-qog'oz-qaychi o'ynang!
          </p>
          
          <div className="stats-card">
            <h3>Sizning statistikangiz:</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">ELO reyting</span>
                <span className="stat-value">1000</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Daraja</span>
                <span className="stat-value">Bronza</span>
              </div>
            </div>
          </div>
          
          <button className="start-btn" onClick={joinQueue}>
            🎮 O'yinni boshlash
          </button>
          
          <button className="how-to-play-btn" onClick={() => showNotif("Tanlang: Tosh ✊, Qog'oz ✋ yoki Qaychi ✌️", "info")}>
            O'yin qoidalari
          </button>
        </div>
      )}
    </div>
  );
}

export default MultiplayerGame;