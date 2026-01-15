import React, { useEffect, useState, useRef } from 'react';
import './App.css';

// Tanlovlar uchun ma'lumotlar
const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
};

// ✅ 1️⃣ CHOICES uchun global himoya
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
    // Himoya: agar stats yoki history buzilgan bo'lsa
    if (!this.stats || !this.history) {
      return opts[Math.floor(Math.random() * 3)];
    }
    
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
    if (!this.stats || typeof this.stats !== 'object') {
      return null;
    }
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
  const [user, setUser]                 = useState(null);
  const [coins, setCoins]               = useState(1500);
  const [mode, setMode]                 = useState('menu');
  const [gameMode, setGameMode]         = useState(null);
  const [difficulty, setDifficulty]     = useState('medium');
  
  // Multiplayer
  const ws = useRef(null);
  const [gameId, setGameId]             = useState(null);
  const [opponent, setOpponent]         = useState(null);
  const [myChoice, setMyChoice]         = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [multiResult, setMultiResult]   = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  
  // Bot rejimi
  const [bot, setBot]                   = useState(null);
  const [botChoice, setBotChoice]       = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botResult, setBotResult]       = useState(null);
  
  // Umumiy
  const [timer, setTimer]               = useState(60);
  const timerRef                        = useRef(null);
  const [notification, setNotification] = useState(null);
  const notifTimeout                    = useRef(null);

  // Telegram Web App
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // ✅ O'ynash tugmasi yangilash
      tg.MainButton.setText("Menyu").show();
      tg.MainButton.onClick(() => {
        setMode('menu');
        setGameMode(null);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setWaitingForOpponent(false);
      });
      
      const initData = tg.initDataUnsafe;
      if (initData?.user) {
        const userData = {
          id: initData.user.id,
          username: initData.user.username,
          first_name: initData.user.first_name,
          last_name: initData.user.last_name
        };
        setUser(userData);
        setCoins(1500 + (initData.user.id % 500));
        connectWebSocket(userData);
      } else {
        // Telegram bo'lmasa ham test uchun
        const testUser = {
          id: Math.floor(Math.random() * 1000000),
          username: 'test_user',
          first_name: 'Test',
          last_name: 'User'
        };
        setUser(testUser);
        setCoins(1500);
      }
    } else {
      // Telegram Web App bo'lmasa
      const testUser = {
        id: Math.floor(Math.random() * 1000000),
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User'
      };
      setUser(testUser);
      setCoins(1500);
    }
  }, []);

  // ✅ WebSocket ulanishini yaxshilash
  const connectWebSocket = (tgUser) => {
    try {
      // Agar backend yo'q bo'lsa, test rejimiga o'tkazish
      if (!window.location.host || window.location.host.includes('localhost')) {
        console.log("Test rejimi: WebSocket server yo'q");
        showNotif("Test rejimi. Offline ishlaydi", 'info');
        return;
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log("WebSocket ga ulanish:", wsUrl);
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket ulandi");
        showNotif("Serverga ulandi", 'success');
        
        // Registratsiya xabarini yuborish
        socket.send(JSON.stringify({
          type: 'register',
          userId: tgUser.id,
          username: tgUser.username || `user_${tgUser.id}`,
          firstName: tgUser.first_name || 'Player'
        }));
      };
      
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("WS kelgan xabar:", data);
          handleWsMessage(data);
        } catch (err) {
          console.error("WS parse xatosi", err);
          showNotif("Server javobi xato", 'error');
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket xatosi:", error);
        showNotif("Serverga ulanishda xato", 'error');
      };
      
      socket.onclose = (event) => {
        console.log("WebSocket yopildi:", event.code, event.reason);
        if (event.code !== 1000) {
          setTimeout(() => {
            if (tgUser) connectWebSocket(tgUser);
          }, 5000);
        }
      };
      
      ws.current = socket;
    } catch (error) {
      console.error("WebSocket ulanish xatosi:", error);
      showNotif("Serverga ulana olmadi. Bot bilan o'ynang", 'error');
    }
  };

  const handleWsMessage = (data) => {
    switch (data.type) {
      case 'game_created':
        setGameId(data.gameId);
        setMode('multiplayer');
        setGameMode('multiplayer');
        setWaitingForOpponent(true);
        setNotification({ 
          text: 'Raqib qidirlmoqda... Oʻyin ID: ' + data.gameId.slice(0, 8), 
          type: 'info' 
        });
        break;
        
      case 'opponent_found':
        setOpponent(data.opponent);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setWaitingForOpponent(false);
        setTimer(60);
        startTimer();
        setNotification({ 
          text: `Raqib topildi: ${data.opponent.firstName || data.opponent.username || 'Nomalum'}`,
          type: 'success' 
        });
        break;
        
      case 'opponent_choice_made':
        if (!opponentChoice) {
          setNotification({ text: 'Raqib tanlov qildi!', type: 'info' });
        }
        break;
        
      // ✅ Multiplayer result kelganda crashni to'xtatish
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

        // Coins ni yangilash
        if (data.result !== 'draw') {
          const coinsChange = data.winnerId === myId ? 100 : -50;
          setCoins(prev => Math.max(0, prev + coinsChange));
        } else {
          setCoins(prev => prev + 25);
        }

        setNotification({ text: msg + (data.result !== 'draw' ? ` (${data.winnerId === myId ? '+100' : '-50'})` : ' (+25)'), type });
        break;
      }
        
      case 'game_timeout':
        clearInterval(timerRef.current);
        setMultiResult('timeout');
        setNotification({ text: 'Vaqt tugadi', type: 'warning' });
        break;
        
      case 'error':
        setNotification({ text: data.message || 'Server xatosi', type: 'error' });
        if (data.message?.includes('topilmadi')) {
          setWaitingForOpponent(false);
        }
        break;
        
      default:
        console.log('Noma\'lum WS xabar:', data);
    }
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (gameMode === 'multiplayer') {
            ws.current?.send(JSON.stringify({
              type: 'timeout',
              gameId,
              userId: user?.id
            }));
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

  // ✅ Do'stlar bilan o'ynash tugmasi ishlashi uchun
  const startMultiplayer = () => {
    console.log("Multiplayer boshlash", user);
    
    if (!user) {
      showNotif("Foydalanuvchi ma'lumotlari yuklanmadi", 'error');
      return;
    }
    
    // WebSocket ochiqligini tekshirish
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      showNotif("Serverga ulanmoqda...", 'info');
      
      // Qayta ulanishni urinish
      connectWebSocket(user);
      
      // Kichik kutish va keyin qayta urinish
      setTimeout(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          sendCreateGame();
        } else {
          // Agar server yo'q bo'lsa, lokal multiplayer rejimiga o'tkazish
          showNotif("Serverga ulanib bo'lmadi. Test rejimiga o'tildi", 'warning');
          startLocalMultiplayer();
        }
      }, 1500);
      return;
    }
    
    sendCreateGame();
  };

  const sendCreateGame = () => {
    showNotif("O'yin yaratilmoqda...", 'info');
    
    ws.current.send(JSON.stringify({
      type: 'create_game',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player',
      coins: coins
    }));
  };

  // ✅ Lokal multiplayer rejimi (agar server yo'q bo'lsa)
  const startLocalMultiplayer = () => {
    const testOpponent = {
      id: Math.floor(Math.random() * 1000000),
      username: 'local_player',
      firstName: 'Local',
      coins: 1500
    };
    
    setGameMode('multiplayer');
    setMode('multiplayer');
    setOpponent(testOpponent);
    setMyChoice(null);
    setOpponentChoice(null);
    setMultiResult(null);
    setWaitingForOpponent(false);
    setTimer(60);
    startTimer();
    
    showNotif("Lokal test rejimi. Raqib: " + testOpponent.firstName, 'success');
  };

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
    
    // Birinchi bot tanlovi (o'yin boshida ko'rinmaydi)
    const initialBotChoice = newBot.choose();
    setBotChoice(initialBotChoice);
    startTimer();
    showNotif(`${diff.toUpperCase()} darajadagi bot bilan o'yin boshlandi!`, 'success');
  };

  const handleBotMove = (choice) => {
    if (playerChoice || botResult || !bot) return;
    setPlayerChoice(choice);
    clearInterval(timerRef.current);
    bot.remember(choice);
    const currentBot = botChoice;
    let res;
    if (choice === currentBot) res = 'draw';
    else if (
      (choice === 'rock'     && currentBot === 'scissors') ||
      (choice === 'paper'    && currentBot === 'rock')     ||
      (choice === 'scissors' && currentBot === 'paper')
    ) res = 'win';
    else res = 'lose';
    
    setBotResult(res);
    let change = res === 'win' ? (difficulty === 'easy' ? 50 : difficulty === 'medium' ? 75 : 110) :
                 res === 'draw' ? 20 : -10;
    setCoins(c => Math.max(0, c + change));
    
    showNotif(
      res === 'win' ? `G‘alaba! +${change}` :
      res === 'draw' ? `Durang +${change}` :
      `Mag‘lubiyat ${change < 0 ? change : ''}`,
      res === 'win' ? 'success' : res === 'draw' ? 'warning' : 'error'
    );
  };

  // ✅ Multiplayer uchun tanlov qilish (test rejimi bilan)
  const handleMultiChoice = (choice) => {
    if (myChoice || multiResult) return;
    setMyChoice(choice);
    
    // Agar WebSocket ochiq bo'lsa, serverga yuborish
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'make_choice',
        userId: user?.id,
        gameId,
        choice
      }));
    } else {
      // Test rejimi: raqibni random tanlov qilish
      showNotif("Test rejimi: raqib tanlov qilmoqda...", 'info');
      
      setTimeout(() => {
        const oppChoices = ['rock', 'paper', 'scissors'];
        const randomChoice = oppChoices[Math.floor(Math.random() * 3)];
        setOpponentChoice(randomChoice);
        
        // Natijani aniqlash
        let result;
        if (choice === randomChoice) {
          result = 'draw';
        } else if (
          (choice === 'rock' && randomChoice === 'scissors') ||
          (choice === 'paper' && randomChoice === 'rock') ||
          (choice === 'scissors' && randomChoice === 'paper')
        ) {
          result = 'win';
        } else {
          result = 'lose';
        }
        
        // Coins ni yangilash
        let coinsChange;
        if (result === 'win') {
          coinsChange = 100;
          setCoins(prev => prev + coinsChange);
        } else if (result === 'lose') {
          coinsChange = -50;
          setCoins(prev => Math.max(0, prev + coinsChange));
        } else {
          coinsChange = 25;
          setCoins(prev => prev + coinsChange);
        }
        
        setMultiResult(result);
        
        const msg = result === 'win' ? 'G‘alaba!' :
                   result === 'lose' ? 'Mag‘lubiyat' : 'Durang';
        
        showNotif(`${msg} (${coinsChange > 0 ? '+' : ''}${coinsChange})`, 
                 result === 'win' ? 'success' : result === 'lose' ? 'error' : 'warning');
      }, 1500);
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
    
    // Yangi o'yin boshlash
    startMultiplayer();
  };

  return (
    <div className="app-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.text}
        </div>
      )}
      
      <header>
        <div className="logo">✊ Qaychi Qog'oz ✌️</div>
        <div className="coins-display">
          <span>🪙 {coins.toLocaleString()}</span>
        </div>
      </header>
      
      {mode === 'menu' && (
        <main className="menu-screen">
          <h1>Salom{user ? `, ${user.first_name}` : ''}!</h1>
          <div className="mode-selection">
            <button className="mode-btn multiplayer" onClick={startMultiplayer}>
              <div className="icon">👥</div>
              <div>Do'stlar bilan o'ynash</div>
              <small>Multiplayer</small>
            </button>
            <button className="mode-btn bot" onClick={() => setMode('bot-select')}>
              <div className="icon">🤖</div>
              <div>Bot bilan o'ynash</div>
              <small>Offline</small>
            </button>
          </div>
          
          <div className="user-info">
            <p>👤 {user?.first_name || user?.username || 'Mehmon'}</p>
            <p>ID: {user?.id?.toString().slice(0, 8)}...</p>
          </div>
        </main>
      )}
      
      {mode === 'bot-select' && (
        <main className="difficulty-screen">
          <h2>Bot darajasini tanlang</h2>
          <div className="difficulty-buttons">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                className={`diff-btn ${lvl}`}
                onClick={() => startBotGame(lvl)}
              >
                {lvl === 'easy' ? '👶 Oson' : lvl === 'medium' ? '😐 Oʻrta' : '🔥 Qiyin'}
                <small>
                  {lvl === 'easy' ? '+50/-10' : lvl === 'medium' ? '+75/-10' : '+110/-10'}
                </small>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setMode('menu')}>
            ← Menyuga qaytish
          </button>
        </main>
      )}
      
      {mode === 'playing-bot' && (
        <main className="game-screen">
          <div className="timer-bar">
            <div className="timer-progress" style={{ width: `${(timer / 60) * 100}%` }} />
            <span>{timer}s</span>
          </div>
          
          <div className="versus-container">
            <div className="player-side">
              <div className="label">SIZ</div>
              <div className="choice-display">
                {SAFE_CHOICES?.[playerChoice]?.emoji || '❓'}
              </div>
            </div>
            <div className="vs">VS</div>
            <div className="player-side">
              <div className="label">BOT ({difficulty})</div>
              <div className="choice-display">
                {SAFE_CHOICES?.[botChoice]?.emoji || '🤔'}
              </div>
            </div>
          </div>
          
          {!playerChoice && botResult === null && (
            <div className="choice-buttons">
              {Object.entries(SAFE_CHOICES).map(([key, val]) => (
                <button
                  key={key}
                  className="choice-btn"
                  style={{ '--choice-color': val.color }}
                  onClick={() => handleBotMove(key)}
                >
                  {val.emoji}
                  <span>{val.name}</span>
                </button>
              ))}
            </div>
          )}
          
          {botResult && (
            <div className={`result-overlay ${botResult}`}>
              <h2>
                {botResult === 'win' ? '🎉 G‘ALABA!' :
                 botResult === 'lose' ? '😞 MAG‘LUBIYAT' :
                 '🤝 DURRANG'}
              </h2>
              <div className="result-choices">
                <div>{SAFE_CHOICES?.[playerChoice]?.emoji || '❓'}</div>
                <div>VS</div>
                <div>{SAFE_CHOICES?.[botChoice]?.emoji || '❓'}</div>
              </div>
              <div className="result-actions">
                <button className="play-again-btn" onClick={() => startBotGame(difficulty)}>
                  ♻️ Yana o'ynash
                </button>
                <button className="menu-btn" onClick={() => setMode('menu')}>
                  🏠 Menyuga qaytish
                </button>
              </div>
            </div>
          )}
        </main>
      )}
      
      {mode === 'multiplayer' && (
        <main className="game-screen">
          <div className="timer-bar">
            <div className="timer-progress" style={{ width: `${(timer / 60) * 100}%` }} />
            <span>{timer}s</span>
          </div>
          
          {waitingForOpponent ? (
            <div className="waiting-screen">
              <div className="spinner" />
              <h3>Raqib qidirlmoqda...</h3>
              {gameId && (
                <>
                  <p>O'yin ID: <code>{gameId.slice(0, 8)}...</code></p>
                  <p>Do'stingizga ushbu ID ni yuboring</p>
                </>
              )}
              <button 
                className="cancel-btn" 
                onClick={() => {
                  setMode('menu');
                  setWaitingForOpponent(false);
                }}
              >
                ❌ Bekor qilish
              </button>
            </div>
          ) : !opponent ? (
            <div className="waiting-screen">
              <h3>Multiplayer</h3>
              <p>O'yinni boshlash uchun pastdagi tugmani bosing</p>
              <button className="start-multiplayer-btn" onClick={startMultiplayer}>
                🎮 O'yinni boshlash
              </button>
              <button 
                className="back-btn" 
                onClick={() => setMode('menu')}
              >
                ← Menyuga qaytish
              </button>
            </div>
          ) : (
            <>
              <div className="opponent-info">
                <span className="opponent-name">
                  👤 Raqib: {opponent.firstName || opponent.username || 'Noma\'lum'}
                </span>
                {opponent.coins && (
                  <span className="opponent-coins">🪙 {opponent.coins}</span>
                )}
              </div>
              
              <div className="versus-container">
                <div className="player-side">
                  <div className="label">SIZ</div>
                  <div className={`choice-display big ${myChoice ? 'selected' : ''}`}>
                    {SAFE_CHOICES?.[myChoice]?.emoji || '❓'}
                    {myChoice && <small>{SAFE_CHOICES[myChoice]?.name}</small>}
                  </div>
                </div>
                <div className="vs">VS</div>
                <div className="player-side">
                  <div className="label">RAQIB</div>
                  <div className={`choice-display big ${opponentChoice ? 'selected' : ''}`}>
                    {SAFE_CHOICES?.[opponentChoice]?.emoji || '❓'}
                    {opponentChoice && <small>{SAFE_CHOICES[opponentChoice]?.name}</small>}
                  </div>
                </div>
              </div>
              
              {!myChoice && !multiResult && (
                <div className="choice-buttons">
                  {Object.entries(SAFE_CHOICES).map(([key, val]) => (
                    <button
                      key={key}
                      className="choice-btn"
                      style={{ '--choice-color': val.color }}
                      onClick={() => handleMultiChoice(key)}
                    >
                      {val.emoji}
                      <span>{val.name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {multiResult && (
                <div className={`result-overlay ${multiResult}`}>
                  <h2>
                    {multiResult === 'draw' ? '🤝 DURRANG' :
                     multiResult === 'timeout' ? '⏰ VAQT TUGADI' :
                     multiResult === 'win' ? '🎉 G‘ALABA!' : '😞 MAG‘LUBIYAT'}
                  </h2>
                  <div className="result-choices">
                    <div>{SAFE_CHOICES?.[myChoice]?.emoji || '❓'}</div>
                    <div>VS</div>
                    <div>{SAFE_CHOICES?.[opponentChoice]?.emoji || '❓'}</div>
                  </div>
                  <div className="result-actions">
                    <button className="play-again-btn" onClick={restartMultiplayer}>
                      🔄 Yangi o'yin
                    </button>
                    <button className="menu-btn" onClick={() => setMode('menu')}>
                      🏠 Menyuga qaytish
                    </button>
                  </div>
                </div>
              )}
              
              {myChoice && !opponentChoice && !multiResult && (
                <div className="waiting-for-opponent">
                  <div className="small-spinner"></div>
                  <p>Raqib tanlov qilishni kutmoqda...</p>
                </div>
              )}
            </>
          )}
        </main>
      )}
      
      <footer>
        <p>Telegram o'yini • {new Date().getFullYear()}</p>
        <small>
          {ws.current && ws.current.readyState === WebSocket.OPEN 
            ? '🟢 Onlayn' 
            : ws.current 
            ? '🔴 Offline' 
            : '⚪ Test rejimi'}
        </small>
      </footer>
    </div>
  );
}

export default App;