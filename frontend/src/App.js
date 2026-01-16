
import React, { useEffect, useState, useRef } from 'react';
import './App.css';
// Tanlovlar uchun ma'lumotlar
const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
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
    if (!choice || !CHOICES[choice]) return;
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
  const [coins, setCoins] = useState(1500);
  const [mode, setMode] = useState('menu');
  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  // Multiplayer
  const [ws, setWs] = useRef(null);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [multiResult, setMultiResult] = useState(null);
  // Bot rejimi
  const [bot, setBot] = useState(null);
  const [botChoice, setBotChoice] = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botResult, setBotResult] = useState(null);
  // Umumiy
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const [notification, setNotification] = useState(null);
  const notifTimeout = useRef(null);
  // Telegram Web App
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.MainButton.setText("O'ynash").show();
      const initData = tg.initDataUnsafe;
      if (initData?.user) {
        setUser(initData.user);
        setCoins(prev => prev + (initData.user.id % 500));
        connectWebSocket(initData.user);
      }
    }
  }, []);
  const connectWebSocket = (tgUser) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'register',
        userId: tgUser.id,
        username: tgUser.username,
        firstName: tgUser.first_name
      }));
    };
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleWsMessage(data);
      } catch (err) {
        console.error("WS parse xatosi", err);
      }
    };
    socket.onclose = () => {
      setTimeout(() => connectWebSocket(tgUser), 4000);
    };
    ws.current = socket;
  };
  const handleWsMessage = (data) => {



    
    switch (data.type) {

      // handleWsMessage ichida qo'shimcha case'lar
case 'left_queue':
  setNotification({ text: 'Qidiruv to‘xtatildi', type: 'info' });
  setMode('menu');
  break;

case 'opponent_disconnected':
  setMultiResult('abandoned');
  setNotification({ 
    text: data.message || 'Raqib uzildi. O‘yin yakunlandi.', 
    type: 'warning' 
  });
  clearInterval(timerRef.current);
  break;
      case 'game_created':
        setGameId(data.gameId);
        setMode('multiplayer');
        setNotification({ text: 'Raqib qidirlmoqda...', type: 'info' });
        break;
      case 'opponent_found':
        setOpponent(data.opponent);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setTimer(60);
        startTimer();
        setNotification({ text: `${data.opponent.firstName || data.opponent.username} topildi!`, type: 'success' });
        break;
      case 'opponent_choice_made':
        setNotification({ text: 'Raqib tanlov qildi!', type: 'info' });
        break;
      case 'game_result':
        clearInterval(timerRef.current);
        setOpponentChoice(
          data.players.player1.id === user?.id
            ? data.choices.player2
            : data.choices.player1
        );
        setMultiResult(data.result);
        let msg = data.result === 'draw' ? 'Durang' :
                  (data.winnerId === user?.id) ? 'G‘alaba!' : 'Mag‘lubiyat';
        let type = data.result === 'draw' ? 'warning' :
                   (data.winnerId === user?.id) ? 'success' : 'error';
        setNotification({ text: msg, type });
        break;
      case 'game_timeout':
        clearInterval(timerRef.current);
        setMultiResult('timeout');
        setNotification({ text: 'Vaqt tugadi', type: 'warning' });
        break;
      case 'error':
        setNotification({ text: data.message, type: 'error' });
        break;
      default:
        console.log('Noma‘lum WS xabar:', data);
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
  const startMultiplayer = () => {
    if (!user) return showNotif("Telegram ma'lumotlari yuklanmadi", 'error');
  
    setMode('multiplayer');
    setNotification({ text: 'Raqib qidirlmoqda...', type: 'info' });
  
    ws.current?.send(JSON.stringify({
      type: 'join_queue',
      userId: user.id,
      username: user.username || `user_${user.id}`,
      firstName: user.first_name || 'Player'
    }));
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
      (choice === 'rock' && currentBot === 'scissors') ||
      (choice === 'paper' && currentBot === 'rock') ||
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
  const handleMultiChoice = (choice) => {
    if (myChoice || multiResult) return;
    setMyChoice(choice);
    ws.current?.send(JSON.stringify({
      type: 'make_choice',
      userId: user?.id,
      gameId,
      choice
    }));
  };
  return (
    <div className="app-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.text}
        </div>
      )}
      <header>
        <div className="logo">✊ Qaychi Qog‘oz ✌️</div>
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
              <div>Do'st bilan o'ynash</div>
            </button>
            <button className="mode-btn bot" onClick={() => setMode('bot-select')}>
              <div className="icon">🤖</div>
              <div>Bot bilan o'ynash</div>
            </button>
          </div>
        </main>
      )}
      {mode === 'bot-select' && (
        <main className="difficulty-screen">
          <h2>Darajani tanlang</h2>
          <div className="difficulty-buttons">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                className={`diff-btn ${lvl}`}
                onClick={() => startBotGame(lvl)}
              >
                {lvl === 'easy' ? 'Oson' : lvl === 'medium' ? 'O‘rta' : 'Qiyin'}
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setMode('menu')}>
            ← Orqaga
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
                {playerChoice ? CHOICES[playerChoice]?.emoji : '?'}
              </div>
            </div>
            <div className="vs">VS</div>
            <div className="player-side">
              <div className="label">BOT</div>
              <div className="choice-display">
                {botChoice ? CHOICES[botChoice]?.emoji : '🤔'}
              </div>
            </div>
          </div>
          {!playerChoice && botResult === null && (
            <div className="choice-buttons">
              {Object.entries(CHOICES).map(([key, val]) => (
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
                {botResult === 'win' ? 'G‘ALABA!' :
                 botResult === 'lose' ? 'MAG‘LUBIYAT' :
                 'DURRANG'}
              </h2>
              <div className="result-choices">
                <div>{CHOICES[playerChoice]?.emoji || '?'}</div>
                <div>VS</div>
                <div>{CHOICES[botChoice]?.emoji || '?'}</div>
              </div>
              <div className="result-actions">
                <button onClick={() => startBotGame(difficulty)}>
                  Yana o'ynash
                </button>
                <button onClick={() => setMode('menu')}>
                  Menyuga qaytish
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
          {!opponent ? (
            <div className="waiting-screen">
              <div className="spinner" />
              <h3>Raqib qidirlmoqda...</h3>
              {gameId && <p>O'yin ID: {gameId.slice(0, 8)}...</p>}
            </div>
          ) : (
            <>
              <div className="opponent-info">
                Raqib: {opponent.firstName || opponent.username || '???'}
              </div>
              <div className="versus-container">
                <div className="player-side">
                  <div className="label">SIZ</div>
                  <div className="choice-display big">
                    {myChoice ? CHOICES[myChoice]?.emoji : '?'}
                  </div>
                </div>
                <div className="vs">VS</div>
                <div className="player-side">
                  <div className="label">RAQIB</div>
                  <div className="choice-display big">
                    {opponentChoice ? CHOICES[opponentChoice]?.emoji : '❓'}
                  </div>
                </div>
              </div>
              {!myChoice && multiResult === null && (
                <div className="choice-buttons">
                  {Object.entries(CHOICES).map(([key, val]) => (
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
                    {multiResult === 'draw' ? 'DURRANG' :
                     multiResult === 'timeout' ? 'VAQT TUGADI' :
                     (multiResult === 'player1_win' && opponent?.id !== user?.id) ||
                     (multiResult === 'player2_win' && opponent?.id === user?.id) ? 'G‘ALABA!' : 'MAG‘LUBIYAT'}
                  </h2>
                  <div className="result-actions">
                    <button onClick={() => setMode('menu')}>
                      Menyuga qaytish
                    </button>
                    <button onClick={startMultiplayer}>
                      Yangi o'yin
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}
      <footer>
        <p>Telegram o‘yini • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
export default App;