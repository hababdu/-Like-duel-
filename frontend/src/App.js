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
  const [isFindingOpponent, setIsFindingOpponent] = useState(false);
  
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
  const [connectionStatus, setConnectionStatus] = useState('⏳ Ulanish...');
  const [wsStatus, setWsStatus] = useState('disconnected'); // connected, disconnected, connecting
  
  // WebSocket connection
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const heartbeatInterval = useRef(null);

  // ✅ Server URL'ini aniqlash
  const getServerUrl = () => {
    // Har doim Render serveriga ulanamiz
    return 'wss://telegram-bot-server-2-matj.onrender.com/ws';
  };

  // ✅ API URL'ini aniqlash
  const getApiUrl = () => {
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
      
      // Ko'pchilikni olish
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
        setCoins(100);
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
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);

  // ✅ Yaxshilangan WebSocket ulanishi
  const connectWebSocket = (userData) => {
    try {
      // Avvalgi ulanishni yopish
      if (ws.current) {
        ws.current.close();
      }
      
      const wsUrl = getServerUrl();
      console.log('🔗 WebSocket ga ulanish:', wsUrl);
      setConnectionStatus('⏳ Ulanmoqda...');
      setWsStatus('connecting');
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('✅ WebSocket serverga ulandi');
        setConnectionStatus('🟢 Serverga ulandi');
        setWsStatus('connected');
        reconnectAttempts.current = 0;
        
        // Registratsiya xabarini yuborish
        socket.send(JSON.stringify({
          type: 'register',
          userId: userData.id,
          username: userData.username,
          firstName: userData.first_name,
          timestamp: new Date().toISOString()
        }));
        
        showNotif('Serverga muvaffaqiyatli ulandik!', 'success');
        
        // Heartbeat boshlash
        startHeartbeat(socket);
      };
      
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📩 WebSocket xabar:', data);
          handleWsMessage(data);
        } catch (error) {
          console.error('❌ Xabarni parse qilishda xato:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('❌ WebSocket xatosi:', error);
        setConnectionStatus('🔴 Ulanishda xato');
        setWsStatus('disconnected');
      };
      
      socket.onclose = (event) => {
        console.log('🔌 WebSocket yopildi:', event.code, event.reason);
        setWsStatus('disconnected');
        
        // Heartbeat to'xtatish
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        
        // Normal yopish emas bo'lsa qayta ulan
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`🔄 Qayta ulanmoqda... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            setConnectionStatus(`🔄 Qayta ulanmoqda (${reconnectAttempts.current})`);
            connectWebSocket(userData);
          }, 3000);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          showNotif('Serverga ulanib bo\'lmadi. Lokal rejimga o\'tildi.', 'warning');
          setConnectionStatus('⚠️ Lokal rejim');
        }
      };
      
      ws.current = socket;
      
    } catch (error) {
      console.error('❌ WebSocket ulanish xatosi:', error);
      setConnectionStatus('🔴 Ulanishda xato');
      setWsStatus('disconnected');
    }
  };

  // ✅ Heartbeat funksiyasi
  const startHeartbeat = (socket) => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    
    heartbeatInterval.current = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000); // Har 20 soniyada
  };

  // ✅ WebSocket message handler
  const handleWsMessage = (data) => {
    switch (data.type) {
      case 'connected':
        console.log('✅ Server ulanishni tasdiqladi');
        break;
        
      case 'registered':
        console.log('✅ Foydalanuvchi registratsiyadan o\'tdi');
        showNotif('Tizimga kirdingiz', 'success');
        break;
        
      case 'game_created':
        setGameId(data.gameId);
        setMode('multiplayer');
        setGameMode('multiplayer');
        setWaitingForOpponent(true);
        setIsFindingOpponent(true);
        
        showNotif(`O'yin yaratildi. Raqib qidirilmoqda...`, 'info');
        
        // Avtomatik raqib qidirish
        setTimeout(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'find_opponent',
              userId: user?.id,
              gameId: data.gameId
            }));
            showNotif('Raqib qidirilmoqda...', 'info');
          }
        }, 1500);
        break;
        
      case 'opponent_found':
        setOpponent(data.opponent);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setWaitingForOpponent(false);
        setIsFindingOpponent(false);
        setTimer(60);
        startTimer();
        
        showNotif(`Raqib topildi: ${data.opponent.firstName || data.opponent.username || 'Raqib'}`, 'success');
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

        let msg = '';
        let type = 'info';
        let coinsChange = 0;

        if (data.result === 'draw') {
          msg = 'Durang';
          type = 'warning';
          coinsChange = 25;
        } else if (data.winnerId === myId) {
          msg = 'G‘alaba!';
          type = 'success';
          coinsChange = 50;
        } else {
          msg = 'Mag‘lubiyat';
          type = 'error';
          coinsChange = -20;
        }

        // Ko'pchilikni yangilash
        setCoins(prev => Math.max(0, prev + coinsChange));
        msg += ` (${coinsChange > 0 ? '+' : ''}${coinsChange})`;

        showNotif(msg, type);
        break;
      }
        
      case 'game_timeout':
        clearInterval(timerRef.current);
        setMultiResult('timeout');
        setIsFindingOpponent(false);
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
          setIsFindingOpponent(false);
        }
        break;
        
      case 'pong':
        // Heartbeat javobi
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

  // ✅ Do'stlar bilan o'ynash
  const startMultiplayer = () => {
    if (!user) {
      showNotif("Foydalanuvchi ma'lumotlari yo'q", 'error');
      return;
    }
    
    // WebSocket holatini tekshirish
    if (wsStatus !== 'connected') {
      showNotif("Serverga ulanilmagan. Qayta ulanmoqda...", 'warning');
      connectWebSocket(user);
      
      setTimeout(() => {
        if (wsStatus === 'connected') {
          createGame();
        } else {
          showNotif("Serverga ulanib bo'lmadi. Iltimos keyinroq urinib ko'ring.", 'error');
        }
      }, 2000);
      return;
    }
    
    createGame();
  };

  const createGame = () => {
    showNotif("O'yin yaratilmoqda...", 'info');
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'create_game',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player',
        timestamp: new Date().toISOString()
      }));
    } else {
      showNotif("WebSocket ulanishi ochiq emas", 'error');
      setConnectionStatus('🔴 Ulanish yo\'q');
    }
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
      showNotif('Tanlovingiz yuborildi', 'success');
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
    setIsFindingOpponent(false);
    
    // Agar WebSocket ochiq bo'lsa, yangi o'yin boshlash
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      startMultiplayer();
    } else {
      setMode('menu');
    }
  };

  // ✅ O'yinni bekor qilish
  const cancelMultiplayer = () => {
    setWaitingForOpponent(false);
    setIsFindingOpponent(false);
    setMode('menu');
    showNotif('O\'yin bekor qilindi', 'warning');
  };

  // ✅ Qayta ulanish funksiyasi
  const reconnect = () => {
    if (user) {
      showNotif('Qayta ulanmoqda...', 'info');
      connectWebSocket(user);
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
          <div className="coins-display" onClick={() => setCoins(c => c + 10)} title="Koinlarni yangilash">
            <span className="coin-emoji">🪙</span>
            <span className="coin-amount">{coins}</span>
          </div>
          <div 
            className={`connection-status ${wsStatus}`} 
            onClick={reconnect}
            title={wsStatus === 'connected' ? 'Serverga ulangan' : 'Qayta ulanish uchun bosing'}
          >
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
                  <div className="stat-icon">
                    {wsStatus === 'connected' ? '🟢' : wsStatus === 'connecting' ? '🟡' : '🔴'}
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {wsStatus === 'connected' ? 'Online' : wsStatus === 'connecting' ? 'Ulanmoqda' : 'Offline'}
                    </div>
                    <div className="stat-label">Holat</div>
                  </div>
                </div>
              </div>
              
              <div className="server-info">
                <p>Server: telegram-bot-server-2-matj.onrender.com</p>
                <button className="reconnect-btn" onClick={reconnect}>
                  {wsStatus === 'connected' ? '✅ Ulangan' : '🔄 Qayta ulanmoq'}
                </button>
              </div>
            </div>
            
            <div className="mode-selection">
              <div className="mode-card" onClick={startMultiplayer}>
                <div className="mode-icon multiplayer">👥</div>
                <div className="mode-content">
                  <h3>Do'stlar bilan o'ynash</h3>
                  <p>Haqiqiy odamlar bilan raqobat</p>
                  <small>+50/-20 koin • 60s</small>
                  <div className={`server-status-indicator ${wsStatus}`}>
                    {wsStatus === 'connected' ? '🟢 Tayyor' : wsStatus === 'connecting' ? '🟡 Ulanmoqda' : '🔴 Offline'}
                  </div>
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
            
            <div className="user-info-card">
              <div className="user-avatar">
                {user?.first_name?.charAt(0) || 'P'}
              </div>
              <div className="user-details">
                <h4>{user?.first_name || 'Player'}</h4>
                <p>ID: {user?.id?.toString().slice(0, 8)}</p>
                <p>@{user?.username || 'username'}</p>
              </div>
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
                
                {isFindingOpponent && (
                  <div className="finding-info">
                    <p>⏳ Server bilan aloqa: {wsStatus === 'connected' ? '🟢 Faol' : '🔴 Uzilgan'}</p>
                    <p>📡 Oʻyin ID: <code>{gameId?.slice(0, 10) || 'Kutilmoqda...'}</code></p>
                  </div>
                )}
                
                <div className="waiting-actions">
                  <button 
                    className="cancel-button"
                    onClick={cancelMultiplayer}
                  >
                    ❌ Bekor qilish
                  </button>
                  <button 
                    className="reconnect-btn"
                    onClick={reconnect}
                  >
                    🔄 Qayta ulanmoq
                  </button>
                </div>
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
                    <small>Server ID: {opponent.id?.toString().slice(0, 6)}</small>
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
                    <div className="connection-hint">
                      Holat: {wsStatus === 'connected' ? '🟢 Ulangan' : '🔴 Uzilgan'}
                    </div>
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
                
                <div className="connection-check">
                  <p>Server holati: 
                    <span className={`status-indicator ${wsStatus}`}>
                      {wsStatus === 'connected' ? ' 🟢 Ulangan' : 
                       wsStatus === 'connecting' ? ' 🟡 Ulanmoqda' : 
                       ' 🔴 Uzilgan'}
                    </span>
                  </p>
                </div>
                
                <button 
                  className={`start-button ${wsStatus !== 'connected' ? 'disabled' : ''}`}
                  onClick={startMultiplayer}
                  disabled={wsStatus !== 'connected'}
                >
                  {wsStatus === 'connected' ? '🎮 O\'yinni Boshlash' : '⏳ Serverga ulanmoqda...'}
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
        <div className="footer-links">
          <span>WebSocket: {wsStatus}</span>
          <span>•</span>
          <span>Koinlar: {coins}</span>
          <span>•</span>
          <button className="footer-btn" onClick={reconnect}>Qayta ulanmoq</button>
        </div>
      </footer>
    </div>
  );
}

export default App;