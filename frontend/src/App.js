import React, { useEffect, useState, useRef } from 'react';
import './App.css';

// Tanlovlar uchun ma'lumotlar
const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
};

// ✅ CHOICES uchun global himoya
const SAFE_CHOICES = {
  rock: CHOICES.rock,
  paper: CHOICES.paper,
  scissors: CHOICES.scissors
};

class RPSBot {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.history = [];
    this.stats = { rock: 0, paper: 0, scissors: 0 };
  }
  
  choose(last = null) {
    const opts = ['rock', 'paper', 'scissors'];
    
    if (this.difficulty === 'easy') {
      return opts[Math.floor(Math.random() * 3)];
    }
    
    if (!last && this.history.length > 0) {
      last = this.history[this.history.length - 1];
    }
    
    if (this.difficulty === 'medium') {
      if (last && Math.random() < 0.68) {
        return this.beats(last);
      }
      return opts[Math.floor(Math.random() * 3)];
    }
    
    // hard
    const most = this.getMostFrequent();
    if (most && Math.random() < 0.82) {
      return this.beats(most);
    }
    if (last) {
      return this.beats(last);
    }
    return opts[Math.floor(Math.random() * 3)];
  }
  
  beats(choice) {
    if (choice === 'rock') return 'paper';
    if (choice === 'paper') return 'scissors';
    return 'rock';
  }
  
  getMostFrequent() {
    const values = Object.values(this.stats);
    if (values.length === 0) return null;
    const max = Math.max(...values);
    for (const [key, count] of Object.entries(this.stats)) {
      if (count === max) {
        return key;
      }
    }
    return null;
  }
  
  remember(choice) {
    if (!choice || !SAFE_CHOICES[choice]) return;
    this.history.push(choice);
    this.stats[choice] = (this.stats[choice] || 0) + 1;
    if (this.history.length > 25) this.history.shift();
  }
  
  reset() {
    this.history = [];
    this.stats = { rock: 0, paper: 0, scissors: 0 };
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(100);
  const [mode, setMode] = useState('menu');
  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  
  // Multiplayer state
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [multiResult, setMultiResult] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  
  // Bot state
  const [bot, setBot] = useState(null);
  const [botChoice, setBotChoice] = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botResult, setBotResult] = useState(null);
  
  // General state
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const [notification, setNotification] = useState(null);
  const notifTimeout = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('🟢 Yaxshilash...');
  
  // WebSocket connection
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // ✅ Server URL'ini aniqlash
  const getServerUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Agar localhost bo'lsa
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:10000/ws';
    }
    
    // Agar production bo'lsa (sizning server manzilingiz)
    return 'wss://telegram-bot-server-2-matj.onrender.com/ws';
  };

  // ✅ API URL'ini aniqlash
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    
    return 'https://telegram-bot-server-2-matj.onrender.com';
  };

  // Telegram Web App
  useEffect(() => {
    const initUser = async () => {
      let userData;
      
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        const tgUser = tg.initDataUnsafe.user;
        userData = {
          id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name
        };
        
        // MainButton ni sozlash
        tg.MainButton.setText("O'ynash").show();
        tg.MainButton.onClick(() => {
          setMode('menu');
          setGameMode(null);
          setMyChoice(null);
          setOpponentChoice(null);
          setMultiResult(null);
          setWaitingForOpponent(false);
        });
        
      } else {
        // Test user
        userData = {
          id: Math.floor(Math.random() * 1000000),
          username: 'player_' + Math.random().toString(36).substr(2, 5),
          first_name: 'Test',
          last_name: 'Player'
        };
      }
      
      setUser(userData);
      
      // Ko'pchilikni serverdan olish
      try {
        const apiUrl = getApiUrl();
        const coinsResponse = await fetch(`${apiUrl}/api/coins/${userData.id}`);
        if (coinsResponse.ok) {
          const coinsData = await coinsResponse.json();
          if (coinsData.success) {
            setCoins(coinsData.balance || 100);
          }
        }
      } catch (error) {
        console.log('Koinlarni olishda xato:', error);
        setCoins(100); // Default qiymat
      }
      
      // WebSocket ga ulanish
      connectWebSocket(userData);
    };
    
    initUser();
    
    // Cleanup
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // ✅ WebSocket ulanishi
  const connectWebSocket = (userData) => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket allaqachon ochiq');
        return;
      }
      
      const wsUrl = getServerUrl();
      console.log('WebSocket ga ulanish:', wsUrl);
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('✅ WebSocket serverga ulandi');
        setConnectionStatus('🟢 Serverga ulandi');
        reconnectAttempts.current = 0;
        
        // Foydalanuvchini registratsiya qilish
        socket.send(JSON.stringify({
          type: 'register',
          userId: userData.id,
          username: userData.username,
          firstName: userData.first_name
        }));
        
        showNotif('Serverga muvaffaqiyatli ulandik!', 'success');
      };
      
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📩 WebSocket xabar:', data);
          handleWsMessage(data);
        } catch (error) {
          console.error('❌ Xabarni oqishda xato:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('❌ WebSocket xatosi:', error);
        setConnectionStatus('🔴 Ulanishda xato');
        
        // Qayta ulanish
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`🔄 Qayta ulanmoqda... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connectWebSocket(userData);
          }, 3000 * reconnectAttempts.current);
        } else {
          showNotif('Serverga ulanib bo\'lmadi. Lokal rejimga o\'tildi.', 'warning');
          setConnectionStatus('⚠️ Lokal rejim');
        }
      };
      
      socket.onclose = (event) => {
        console.log('🔌 WebSocket yopildi:', event.code, event.reason);
        
        // Normal yopish emas bo'lsa qayta ulan
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`🔄 Qayta ulanmoqda... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connectWebSocket(userData);
          }, 5000);
        }
      };
      
      ws.current = socket;
      
    } catch (error) {
      console.error('❌ WebSocket ulanish xatosi:', error);
      setConnectionStatus('🔴 Ulanishda xato');
    }
  };

  // ✅ WebSocket message handler
  const handleWsMessage = (data) => {
    switch (data.type) {
      case 'registered':
        console.log('✅ Foydalanuvchi registratsiyadan o\'tdi');
        showNotif('Tizimga kirdingiz', 'success');
        break;
        
      case 'game_created':
        setGameId(data.gameId);
        setMode('multiplayer');
        setGameMode('multiplayer');
        setWaitingForOpponent(true);
        setNotification({ 
          text: `O'yin yaratildi. ID: ${data.gameId.slice(0, 8)}`, 
          type: 'info' 
        });
        
        // Avtomatik raqib qidirish
        setTimeout(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'find_opponent',
              userId: user?.id,
              gameId: data.gameId
            }));
          }
        }, 1000);
        break;
        
      case 'opponent_found':
        setOpponent(data.opponent);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setWaitingForOpponent(false);
        setTimer(60);
        startTimer();
        showNotif(`Raqib topildi: ${data.opponent.firstName || data.opponent.username}`, 'success');
        break;
        
      case 'opponent_choice_made':
        if (!opponentChoice) {
          showNotif('Raqib tanlov qildi!', 'info');
        }
        break;
        
      case 'game_result': {
        clearInterval(timerRef.current);

        const myId = user?.id;
        const p1 = data?.players?.player1;
        const p2 = data?.players?.player2;
        const myIsP1 = p1?.id === myId;

        const myChoiceSafe = myIsP1 ? data?.choices?.player1 : data?.choices?.player2;
        const oppChoiceSafe = myIsP1 ? data?.choices?.player2 : data?.choices?.player1;

        setMyChoice(SAFE_CHOICES[myChoiceSafe] ? myChoiceSafe : null);
        setOpponentChoice(SAFE_CHOICES[oppChoiceSafe] ? oppChoiceSafe : null);

        setMultiResult(data?.result || 'draw');

        let msg = data.result === 'draw'
          ? 'Durang'
          : data.winnerId === myId
          ? 'G‘alaba!'
          : 'Mag‘lubiyat';

        let type =
          data.result === 'draw'
            ? 'warning'
            : data.winnerId === myId
            ? 'success'
            : 'error';

        // Ko'pchilikni yangilash
        if (data.result === 'win') {
          const coinsChange = data.winnerId === myId ? 50 : -20;
          setCoins(prev => Math.max(0, prev + coinsChange));
          msg += ` (${coinsChange > 0 ? '+' : ''}${coinsChange})`;
        }

        setNotification({ text: msg, type });
        break;
      }
        
      case 'game_timeout':
        clearInterval(timerRef.current);
        setMultiResult('timeout');
        showNotif('Vaqt tugadi', 'warning');
        break;
        
      case 'choice_accepted':
        showNotif('Tanlovingiz qabul qilindi', 'success');
        break;
        
      case 'waiting_for_opponent':
        showNotif('Raqib qidirlmoqda...', 'info');
        break;
        
      case 'error':
        showNotif(data.message || 'Server xatosi', 'error');
        if (data.message?.includes('topilmadi')) {
          setWaitingForOpponent(false);
        }
        break;
        
      case 'pong':
        // Keep-alive
        break;
        
      default:
        console.log('Noma\'lum WebSocket xabar:', data);
    }
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (gameMode === 'multiplayer' && !multiResult) {
            setMultiResult('timeout');
            showNotif('Vaqt tugadi', 'warning');
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const showNotif = (text, type = 'info') => {
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    setNotification({ text, type });
    notifTimeout.current = setTimeout(() => setNotification(null), 3200);
  };

  // ✅ Do'stlar bilan o'ynash (Server bilan)
  const startMultiplayer = () => {
    if (!user) {
      showNotif("Foydalanuvchi ma'lumotlari yo'q", 'error');
      return;
    }
    
    // WebSocket ochiqligini tekshirish
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif("Serverga ulanmoqda...", 'info');
      
      // Qayta ulanishni urinish
      connectWebSocket(user);
      
      setTimeout(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          createGame();
        } else {
          showNotif("Serverga ulanib bo'lmadi", 'error');
        }
      }, 2000);
      return;
    }
    
    createGame();
  };

  const createGame = () => {
    showNotif("O'yin yaratilmoqda...", 'info');
    
    ws.current.send(JSON.stringify({
      type: 'create_game',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player'
    }));
  };

  // ✅ Bot o'yinini boshlash
  const startBotGame = (diff) => {
    setGameMode('bot');
    setDifficulty(diff);
    setMode('playing-bot');
    const newBot = new RPSBot(diff);
    
    setBot(newBot);
    setPlayerChoice(null);
    setBotChoice(null);
    setBotResult(null);
    setTimer(60);
    
    const initialBotChoice = newBot.choose();
    setBotChoice(initialBotChoice);
    startTimer();
    
    showNotif(`${diff === 'easy' ? '👶 Oson' : diff === 'medium' ? '😐 O\'rta' : '🔥 Qiyin'} bot bilan o'yin!`, 'success');
  };

  // ✅ Botga qarshi harakat
  const handleBotMove = (choice) => {
    if (playerChoice || botResult || !bot) return;
    
    setPlayerChoice(choice);
    clearInterval(timerRef.current);
    
    // Bot tanlovini yangilash
    const newBotChoice = bot.choose(choice);
    setBotChoice(newBotChoice);
    bot.remember(choice);
    
    // Natijani hisoblash
    let res;
    if (choice === newBotChoice) {
      res = 'draw';
    } else if (
      (choice === 'rock' && newBotChoice === 'scissors') ||
      (choice === 'paper' && newBotChoice === 'rock') ||
      (choice === 'scissors' && newBotChoice === 'paper')
    ) {
      res = 'win';
    } else {
      res = 'lose';
    }
    
    setBotResult(res);
    
    // Coins o'zgartirish
    let change = 0;
    if (res === 'win') {
      change = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 50 : 80;
    } else if (res === 'draw') {
      change = 10;
    } else {
      change = -5;
    }
    
    setCoins(c => Math.max(0, c + change));
    
    // Notification
    const resultMessages = {
      win: `🎉 G'alaba! +${change}`,
      lose: `😞 Mag'lubiyat ${change}`,
      draw: `🤝 Durrang +${change}`
    };
    
    showNotif(resultMessages[res], res === 'win' ? 'success' : res === 'lose' ? 'error' : 'warning');
  };

  // ✅ Multiplayer uchun tanlov qilish
  const handleMultiChoice = (choice) => {
    if (myChoice || multiResult) return;
    
    setMyChoice(choice);
    
    // WebSocket orqali serverga yuborish
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'make_choice',
        userId: user.id,
        gameId: gameId,
        choice: choice
      }));
    } else {
      showNotif("Serverga ulanib bo'lmadi", 'error');
    }
  };

  // ✅ O'yinni qayta boshlash
  const restartMultiplayer = () => {
    setMyChoice(null);
    setOpponentChoice(null);
    setMultiResult(null);
    setOpponent(null);
    setGameId(null);
    setWaitingForOpponent(false);
    startMultiplayer();
  };

  // ✅ Daily bonus olish
  const claimDailyBonus = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/daily-bonus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCoins(prev => prev + data.amount);
        showNotif(`Daily bonus: +${data.amount} coins! (${data.streak} kun ketma-ket)`, 'success');
      } else {
        showNotif(data.message || 'Daily bonus olishda xato', 'warning');
      }
    } catch (error) {
      console.error('Daily bonus xatosi:', error);
      showNotif('Serverga ulanib bo\'lmadi', 'error');
    }
  };

  // ✅ Koinlarni yangilash funksiyasi
  const updateCoins = async () => {
    if (!user) return;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/coins/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCoins(data.balance || 100);
        }
      }
    } catch (error) {
      console.log('Koinlarni yangilashda xato:', error);
    }
  };

  return (
    <div className="app-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.text}
        </div>
      )}
      
      <header>
        <div className="logo">
          <span className="logo-emoji">✊</span>
          <span className="logo-text">Tosh-Qog'oz-Qaychi</span>
          <span className="logo-emoji">✌️</span>
        </div>
        <div className="header-right">
          <div className="coins-display">
            <span className="coin-emoji">🪙</span>
            <span className="coin-amount">{coins}</span>
          </div>
          <div className="connection-status" onClick={updateCoins} title="Koinlarni yangilash">
            {connectionStatus}
          </div>
        </div>
      </header>
      
      <main>
        {mode === 'menu' && (
          <div className="menu-screen">
            <div className="welcome-section">
              <h1>Salom{user ? `, ${user.first_name}` : ''}! 👋</h1>
              <p className="subtitle">Multiplayer o'yinlar!</p>
              
              <div className="quick-stats">
                <div className="stat-card">
                  <div className="stat-icon">🪙</div>
                  <div className="stat-content">
                    <div className="stat-value">{coins}</div>
                    <div className="stat-label">Koinlar</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⚡</div>
                  <div className="stat-content">
                    <div className="stat-value">Online</div>
                    <div className="stat-label">Holat</div>
                  </div>
                </div>
              </div>
              
              <button className="daily-bonus-btn" onClick={claimDailyBonus}>
                🎁 Daily Bonus Olish
              </button>
            </div>
            
            <div className="mode-selection">
              <div className="mode-card" onClick={startMultiplayer}>
                <div className="mode-icon multiplayer">👥</div>
                <div className="mode-content">
                  <h3>Do'stlar bilan o'ynash</h3>
                  <p>Haqiqiy odamlar bilan raqobat</p>
                  <small>+50/-20 koin • 60s</small>
                </div>
                <div className="mode-arrow">→</div>
              </div>
              
              <div className="mode-card" onClick={() => setMode('bot-select')}>
                <div className="mode-icon bot">🤖</div>
                <div className="mode-content">
                  <h3>Bot bilan o'ynash</h3>
                  <p>Mashq qilish uchun</p>
                  <small>3 daraja • Ko'proq koin</small>
                </div>
                <div className="mode-arrow">→</div>
              </div>
            </div>
            
            <div className="server-info">
              <div className="server-status">
                <span className="status-indicator"></span>
                <span>Server: {ws.current?.readyState === WebSocket.OPEN ? '🟢 Online' : '🔴 Offline'}</span>
              </div>
              <button className="reconnect-btn" onClick={() => connectWebSocket(user)}>
                🔄 Qayta ulanmoq
              </button>
            </div>
          </div>
        )}
        
        {mode === 'bot-select' && (
          <div className="difficulty-screen">
            <div className="screen-header">
              <button className="back-button" onClick={() => setMode('menu')}>
                ← Orqaga
              </button>
              <h2>Bot darajasini tanlang</h2>
            </div>
            
            <div className="difficulty-cards">
              <div className="difficulty-card easy" onClick={() => startBotGame('easy')}>
                <div className="difficulty-emoji">👶</div>
                <h3>Oson</h3>
                <p>Yangi boshlovchilar uchun</p>
                <div className="reward">+30 💰 g'alaba</div>
                <div className="difficulty-stats">
                  <span>• Random tanlov</span>
                  <span>• Yuqori g'alaba imkoniyati</span>
                </div>
              </div>
              
              <div className="difficulty-card medium" onClick={() => startBotGame('medium')}>
                <div className="difficulty-emoji">😐</div>
                <h3>Oʻrta</h3>
                <p>Standart o'yinchi uchun</p>
                <div className="reward">+50 💰 g'alaba</div>
                <div className="difficulty-stats">
                  <span>• Aqlli algoritm</span>
                  <span>• 68% g'alaba strategiyasi</span>
                </div>
              </div>
              
              <div className="difficulty-card hard" onClick={() => startBotGame('hard')}>
                <div className="difficulty-emoji">🔥</div>
                <h3>Qiyin</h3>
                <p>Professional uchun</p>
                <div className="reward">+80 💰 g'alaba</div>
                <div className="difficulty-stats">
                  <span>• AI analiz</span>
                  <span>• 82% g'alaba strategiyasi</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {mode === 'playing-bot' && (
          <div className="game-screen">
            <div className="game-header">
              <div className="game-info">
                <span className="game-mode">🤖 Bot o'yini</span>
                <span className="game-difficulty">• {difficulty === 'easy' ? 'Oson' : difficulty === 'medium' ? 'Oʻrta' : 'Qiyin'}</span>
              </div>
              <div className="timer-display">
                ⏰ {timer}s
              </div>
            </div>
            
            <div className="timer-bar">
              <div 
                className="timer-progress" 
                style={{ width: `${(timer / 60) * 100}%` }}
              />
            </div>
            
            <div className="versus-container">
              <div className="player-card you">
                <div className="player-label">
                  <span className="player-emoji">👤</span>
                  <span>SIZ</span>
                </div>
                <div className={`choice-display ${playerChoice ? 'selected' : ''}`}>
                  {playerChoice ? (
                    <>
                      <div className="choice-emoji">{SAFE_CHOICES[playerChoice].emoji}</div>
                      <div className="choice-name">{SAFE_CHOICES[playerChoice].name}</div>
                    </>
                  ) : (
                    <div className="choice-placeholder">❓</div>
                  )}
                </div>
              </div>
              
              <div className="vs-circle">VS</div>
              
              <div className="player-card opponent">
                <div className="player-label">
                  <span className="player-emoji">🤖</span>
                  <span>BOT</span>
                </div>
                <div className={`choice-display ${botChoice ? 'selected' : ''}`}>
                  {botChoice ? (
                    <>
                      <div className="choice-emoji">{SAFE_CHOICES[botChoice].emoji}</div>
                      <div className="choice-name">{SAFE_CHOICES[botChoice].name}</div>
                    </>
                  ) : (
                    <div className="choice-placeholder">🤔</div>
                  )}
                </div>
              </div>
            </div>
            
            {!playerChoice && !botResult && (
              <div className="choices-section">
                <h3>Tanlang:</h3>
                <div className="choice-buttons">
                  {Object.entries(SAFE_CHOICES).map(([key, val]) => (
                    <button
                      key={key}
                      className="choice-button"
                      style={{ backgroundColor: val.color }}
                      onClick={() => handleBotMove(key)}
                    >
                      <span className="choice-button-emoji">{val.emoji}</span>
                      <span className="choice-button-name">{val.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {botResult && (
              <div className={`result-overlay ${botResult}`}>
                <div className="result-header">
                  <div className={`result-icon ${botResult}`}>
                    {botResult === 'win' ? '🎉' : botResult === 'lose' ? '😞' : '🤝'}
                  </div>
                  <h2>
                    {botResult === 'win' ? 'GʻALABA!' :
                     botResult === 'lose' ? 'MAGʻLUBIYAT' :
                     'DURRANG'}
                  </h2>
                </div>
                
                <div className="result-choices-show">
                  <div className="result-choice">
                    <div className="result-emoji">{SAFE_CHOICES[playerChoice]?.emoji || '❓'}</div>
                    <div className="result-label">Siz</div>
                  </div>
                  <div className="vs-small">VS</div>
                  <div className="result-choice">
                    <div className="result-emoji">{SAFE_CHOICES[botChoice]?.emoji || '❓'}</div>
                    <div className="result-label">Bot</div>
                  </div>
                </div>
                
                <div className="result-actions">
                  <button 
                    className="action-button primary"
                    onClick={() => startBotGame(difficulty)}
                  >
                    🔄 Yana o'ynash
                  </button>
                  <button 
                    className="action-button secondary"
                    onClick={() => setMode('menu')}
                  >
                    🏠 Menyuga qaytish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {mode === 'multiplayer' && (
          <div className="game-screen">
            <div className="game-header">
              <div className="game-info">
                <span className="game-mode">👥 Multiplayer</span>
                <span className="game-status">
                  {waitingForOpponent ? 'Raqib qidirilmoqda...' : 
                   opponent ? 'Oʻyin davom etmoqda' : 'Oʻyin tayyor'}
                </span>
              </div>
              <div className="timer-display">
                ⏰ {timer}s
              </div>
            </div>
            
            <div className="timer-bar">
              <div 
                className="timer-progress" 
                style={{ width: `${(timer / 60) * 100}%` }}
              />
            </div>
            
            {waitingForOpponent ? (
              <div className="waiting-section">
                <div className="waiting-spinner"></div>
                <h3>Raqib qidirilmoqda...</h3>
                <p>Server orqali haqiqiy raqib topilmoqda</p>
                {gameId && (
                  <div className="game-id-display">
                    <small>Oʻyin ID: </small>
                    <code>{gameId.slice(0, 12)}</code>
                  </div>
                )}
                <button 
                  className="cancel-button"
                  onClick={() => setMode('menu')}
                >
                  ❌ Bekor qilish
                </button>
              </div>
            ) : opponent ? (
              <>
                <div className="opponent-info-card">
                  <div className="opponent-avatar">
                    {opponent.firstName?.charAt(0) || opponent.username?.charAt(0) || 'R'}
                  </div>
                  <div className="opponent-details">
                    <h4>{opponent.firstName || opponent.username || 'Raqib'}</h4>
                    <p>Real Player</p>
                  </div>
                </div>
                
                <div className="versus-container">
                  <div className="player-card you">
                    <div className="player-label">
                      <span className="player-emoji">👤</span>
                      <span>SIZ</span>
                    </div>
                    <div className={`choice-display big ${myChoice ? 'selected' : ''}`}>
                      {myChoice ? (
                        <>
                          <div className="choice-emoji-large">{SAFE_CHOICES[myChoice].emoji}</div>
                          <div className="choice-name">{SAFE_CHOICES[myChoice].name}</div>
                        </>
                      ) : (
                        <div className="choice-placeholder-large">❓</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="vs-circle">VS</div>
                  
                  <div className="player-card opponent">
                    <div className="player-label">
                      <span className="player-emoji">👥</span>
                      <span>RAQIB</span>
                    </div>
                    <div className={`choice-display big ${opponentChoice ? 'selected' : ''}`}>
                      {opponentChoice ? (
                        <>
                          <div className="choice-emoji-large">{SAFE_CHOICES[opponentChoice].emoji}</div>
                          <div className="choice-name">{SAFE_CHOICES[opponentChoice].name}</div>
                        </>
                      ) : (
                        <div className="choice-placeholder-large">❓</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {!myChoice && !multiResult && (
                  <div className="choices-section">
                    <h3>Sizning tanlovingiz:</h3>
                    <div className="choice-buttons">
                      {Object.entries(SAFE_CHOICES).map(([key, val]) => (
                        <button
                          key={key}
                          className="choice-button"
                          style={{ backgroundColor: val.color }}
                          onClick={() => handleMultiChoice(key)}
                        >
                          <span className="choice-button-emoji">{val.emoji}</span>
                          <span className="choice-button-name">{val.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {myChoice && !opponentChoice && !multiResult && (
                  <div className="waiting-for-opponent">
                    <div className="small-spinner"></div>
                    <p>Raqib tanlov qilishni kutmoqda...</p>
                    <small>Server orqali raqib javobini kutish</small>
                  </div>
                )}
                
                {multiResult && (
                  <div className={`result-overlay ${multiResult}`}>
                    <div className="result-header">
                      <div className={`result-icon ${multiResult}`}>
                        {multiResult === 'win' ? '🎉' : 
                         multiResult === 'lose' ? '😞' : 
                         multiResult === 'draw' ? '🤝' : '⏰'}
                      </div>
                      <h2>
                        {multiResult === 'win' ? 'GʻALABA!' :
                         multiResult === 'lose' ? 'MAGʻLUBIYAT' :
                         multiResult === 'draw' ? 'DURRANG' :
                         'VAQT TUGADI'}
                      </h2>
                    </div>
                    
                    <div className="result-choices-show">
                      <div className="result-choice">
                        <div className="result-emoji">{SAFE_CHOICES[myChoice]?.emoji || '❓'}</div>
                        <div className="result-label">Siz</div>
                      </div>
                      <div className="vs-small">VS</div>
                      <div className="result-choice">
                        <div className="result-emoji">{SAFE_CHOICES[opponentChoice]?.emoji || '❓'}</div>
                        <div className="result-label">Raqib</div>
                      </div>
                    </div>
                    
                    <div className="result-actions">
                      <button 
                        className="action-button primary"
                        onClick={restartMultiplayer}
                      >
                        🔄 Yangi o'yin
                      </button>
                      <button 
                        className="action-button secondary"
                        onClick={() => setMode('menu')}
                      >
                        🏠 Menyuga qaytish
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="start-multiplayer">
                <div className="start-icon">👥</div>
                <h3>Multiplayer O'yin</h3>
                <p>Server orqali haqiqiy raqiblar bilan o'ynang</p>
                <button 
                  className="start-button"
                  onClick={startMultiplayer}
                >
                  🎮 O'yinni Boshlash
                </button>
                <button 
                  className="back-button"
                  onClick={() => setMode('menu')}
                >
                  ← Menyuga qaytish
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer>
        <p>© {new Date().getFullYear()} Tosh-Qog'oz-Qaychi • Real Multiplayer</p>
        <small>Server: wss://telegram-bot-server-2-matj.onrender.com</small>
      </footer>
    </div>
  );
}

export default App;