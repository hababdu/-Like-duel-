// MultiplayerGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css';

const CHOICES = {
  rock:     { name: "Tosh",    emoji: "✊",   color: "#e74c3c" },
  paper:    { name: "Qog'oz",  emoji: "✋",   color: "#3498db" },
  scissors: { name: "Qaychi",  emoji: "✌️",   color: "#2ecc71" },
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

  // Chat bilan bog'liq holatlar
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef(null);

  // WebSocket ulanish
  useEffect(() => {
    if (!user?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`wss://telegram-bot-server-2-matj.onrender.com/ws`);

    socket.onopen = () => {
      setConnected(true);
      showNotif("Serverga ulanildi", "success");

      // 1. Register
      socket.send(JSON.stringify({
        type: 'register',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player'
      }));

      // 2. Navbatga qo'shilish
      socket.send(JSON.stringify({
        type: 'join_queue',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player'
      }));
      setInQueue(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error("Xato parse qilishda:", e);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      showNotif("Server bilan aloqa uzildi...", "error");
      setInQueue(false);
    };

    socket.onerror = (err) => {
      console.error("WebSocket xatosi:", err);
      showNotif("Ulanishda xato", "error");
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, [user, showNotif]);

  const handleMessage = (data) => {
    switch (data.type) {
      case 'joined_queue':
        showNotif("Navbatga qo'shildingiz...", "info");
        break;

      case 'match_found':
        setGameId(data.gameId);
        setOpponent(data.opponent);
        setInQueue(false);
        setMyChoice(null);
        setOpponentChoice(null);
        setResult(null);
        setTimer(60);
        setMessages([]); // chatni tozalash
        showNotif(`Raqib topildi: ${data.opponent.firstName || data.opponent.username}`, "success");
        break;

      case 'opponent_choice_made':
        showNotif("Raqib tanlov qildi!", "info");
        break;

      case 'game_result':
        setOpponentChoice(
          data.choices.player1?.id === user.id 
            ? data.choices.player2 
            : data.choices.player1
        );
        setResult(data.result);
        const isWin = data.winnerId === user.id;
        const msg = data.result === 'draw' ? 'Durang' : isWin ? 'G‘alaba!' : 'Mag‘lubiyat';
        showNotif(msg, data.result === 'draw' ? 'warning' : isWin ? 'success' : 'error');
        break;

      case 'game_timeout':
        setResult('timeout');
        showNotif("Vaqt tugadi", "warning");
        break;

      case 'opponent_disconnected':
        setResult('disconnected');
        showNotif("Raqib uzildi. O‘yin yakunlandi.", "warning");
        break;

      // Chat xabarlari
      case 'chat_message':
        setMessages(prev => [...prev, {
          sender: data.senderId === user.id ? 'me' : 'opponent',
          text: data.text,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }]);
        break;

      case 'error':
        showNotif(data.message || "Xato yuz berdi", "error");
        break;

      default:
        console.log("Noma'lum xabar:", data);
    }
  };

  // Tanlov qilish
  const makeChoice = (choice) => {
    if (myChoice || result || !gameId) return;

    setMyChoice(choice);
    ws.current?.send(JSON.stringify({
      type: 'make_choice',
      userId: user.id,
      gameId,
      choice
    }));
  };

  // Chat xabar yuborish
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId || !ws.current) return;

    ws.current.send(JSON.stringify({
      type: 'chat_message',
      gameId,
      userId: user.id,
      text: chatInput.trim()
    }));

    setChatInput("");
  };

  // Chat avtoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Natija matni
  const getResultText = () => {
    if (result === 'timeout') return "Vaqt tugadi";
    if (result === 'disconnected') return "Raqib uzildi";
    if (result === 'draw') return "Durang!";
    
    const iWon = 
      (result === 'player1_win' && opponent?.id !== user?.id) ||
      (result === 'player2_win' && opponent?.id === user?.id);
    
    return iWon ? "G‘alaba!" : "Mag‘lubiyat!";
  };

  return (
    <div className="multiplayer-game-container">
      <header className="game-header">
        <button className="back-btn" onClick={onBackToMenu}>← Menyu</button>
        <h1>Tosh-Qaychi-Qog'oz • Multiplayer</h1>
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
          <button 
            className="cancel-btn"
            onClick={() => {
              ws.current?.send(JSON.stringify({ type: 'leave_queue', userId: user.id }));
              setInQueue(false);
              onBackToMenu();
            }}
          >
            Bekor qilish
          </button>
        </div>
      ) : gameId ? (
        <div className="game-area">
          {/* O'yin maydoni */}
          <div className="players-container">
            <div className="player you">
              <div className="player-label">SIZ</div>
              <div className="choice-display">
                {myChoice ? CHOICES[myChoice].emoji : "?"}
              </div>
            </div>

            <div className="vs">VS</div>

            <div className="player opponent">
              <div className="player-label">
                {opponent?.firstName || opponent?.username || "Raqib"}
              </div>
              <div className="choice-display">
                {opponentChoice ? CHOICES[opponentChoice].emoji : "❓"}
              </div>
            </div>
          </div>

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

          {/* Natija */}
          {result && (
            <div className={`result ${result}`}>
              <h2>{getResultText()}</h2>
              <div className="result-choices">
                <span>{myChoice ? CHOICES[myChoice].emoji : "?"}</span>
                <span>vs</span>
                <span>{opponentChoice ? CHOICES[opponentChoice].emoji : "?"}</span>
              </div>
              <div className="result-buttons">
                <button onClick={onBackToMenu}>Menyuga qaytish</button>
                <button 
                  onClick={() => {
                    ws.current?.send(JSON.stringify({
                      type: 'join_queue',
                      userId: user.id,
                      username: user.username || `user_${user.id}`,
                      firstName: user.first_name || 'Player'
                    }));
                    setGameId(null);
                    setOpponent(null);
                    setMyChoice(null);
                    setOpponentChoice(null);
                    setResult(null);
                    setMessages([]);
                    setInQueue(true);
                  }}
                >
                  Yangi o'yin
                </button>
              </div>
            </div>
          )}

          {/* Chat qismi — faqat o'yin boshlanganda ko'rinadi */}
          {gameId && (
            <div className="chat-section">
              <div className="chat-header">Chat (raqib bilan)</div>
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`chat-message ${msg.sender === 'me' ? 'sent' : 'received'}`}
                  >
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{msg.time}</div>
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
                />
                <button type="submit" disabled={!chatInput.trim() || !opponent}>
                  Yuborish
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="start-screen">
          <h2>O'yinni boshlash uchun navbatga turing</h2>
          <button 
            className="start-btn"
            onClick={() => {
              ws.current?.send(JSON.stringify({
                type: 'join_queue',
                userId: user.id,
                username: user.username || `user_${user.id}`,
                firstName: user.first_name || 'Player'
              }));
              setInQueue(true);
            }}
          >
            O'yinni boshlash
          </button>
        </div>
      )}
    </div>
  );
}

export default MultiplayerGame;