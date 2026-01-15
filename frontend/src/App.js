import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // ────────────────────────────────────────────────
  // STATE'LAR
  // ────────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rps_user');
    return saved ? JSON.parse(saved) : {
      id: Date.now(),
      first_name: 'Habibullo',
      username: `user_${Date.now().toString().slice(-6)}`,
      photo_url: null
    };
  });

  const [coins, setCoins] = useState(() => {
    const saved = localStorage.getItem('rps_coins');
    return saved ? Number(saved) : 1500;
  });

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('rps_stats');
    return saved ? JSON.parse(saved) : {
      wins: 0, losses: 0, draws: 0,
      totalGames: 0, maxStreak: 0,
      totalCoinsEarned: 1500,
      botGamesPlayed: 0, botGamesWon: 0
    };
  });

  const [mode, setMode] = useState('menu'); // menu | playing
  const [difficulty, setDifficulty] = useState('medium');
  const [bot, setBot] = useState(null);

  const [game, setGame] = useState({
    status: 'waiting',
    playerChoice: null,
    botChoice: null,
    result: null,
    secondsLeft: 60
  });

  const [currentStreak, setCurrentStreak] = useState(0);
  const [animateReveal, setAnimateReveal] = useState(false);

  const timerRef = useRef(null);
  const [notification, setNotification] = useState(null);
  const notifRef = useRef(null);

  // LocalStorage saqlash
  useEffect(() => {
    localStorage.setItem('rps_user', JSON.stringify(user));
    localStorage.setItem('rps_coins', coins);
    localStorage.setItem('rps_stats', JSON.stringify(stats));
  }, [user, coins, stats]);

  // Telegram WebApp integratsiyasi va user rasm olish
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      const u = tg.initDataUnsafe?.user;
      if (u?.id) {
        setUser(prev => ({
          ...prev,
          id: u.id,
          first_name: u.first_name || 'Habibullo',
          username: u.username || `user_${u.id}`,
          photo_url: u.photo_url || null // Telegramdan rasm olish
        }));
      }
    }

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(notifRef.current);
    };
  }, []);

  const notify = (msg, type = 'info') => {
    setNotification({ text: msg, type });
    clearTimeout(notifRef.current);
    notifRef.current = setTimeout(() => setNotification(null), 2800);
  };

  // ────────────────────────────────────────────────
  // O'YIN BOSHLASH
  // ────────────────────────────────────────────────
  const startGame = (diff) => {
    const botNames = {
      easy: ['Oson Bot', 'Yoshchi', 'Boshlang‘ich'],
      medium: ['O‘rta Pro', 'Strateg Bot', 'Tajribali'],
      hard: ['Master Bot', 'Qiyinchi', 'AI Lord']
    };
    const nameList = botNames[diff] || botNames.medium;
    const botName = nameList[Math.floor(Math.random() * nameList.length)];

    setDifficulty(diff);
    setBot({ name: botName, diff });
    setMode('playing');
    resetGameState();

    notify(`🤖 ${botName} bilan o‘yin boshlandi!`, 'success');
  };

  const resetGameState = () => {
    setGame({
      status: 'choosing',
      playerChoice: null,
      botChoice: null,
      result: null,
      secondsLeft: 60
    });
    setAnimateReveal(false);

    setTimeout(() => {
      const botPick = getBotChoice(difficulty);
      setGame(prev => ({ ...prev, botChoice: botPick, status: 'player-turn' }));
      notify('Bot tanladi! Endi siz tanlang!', 'info');
      startTimer();
    }, 1500);
  };

  const getBotChoice = (diff) => {
    const opts = ['rock', 'paper', 'scissors'];
    if (diff === 'easy') return opts[Math.floor(Math.random() * 3)];
    if (diff === 'medium') return Math.random() < 0.6 ? opts[Math.floor(Math.random() * 3)] : getCounter(game.playerChoice || opts[0]);
    return getCounter(game.playerChoice || opts[0]);
  };

  const getCounter = (choice) => ({ rock: 'paper', paper: 'scissors', scissors: 'rock' }[choice]);

  // ────────────────────────────────────────────────
  // TIMER
  // ────────────────────────────────────────────────
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGame(prev => {
        if (prev.secondsLeft <= 0) {
          clearInterval(timerRef.current);
          handleTimeout();
          return { ...prev, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  };

  const handleTimeout = () => {
    setGame(prev => ({ ...prev, result: 'timeout', status: 'finished' }));
    setCoins(c => c + 5);
    setAnimateReveal(true);
    notify('⏰ Vaqt tugadi! +5 coin', 'warning');

    setTimeout(resetGameState, 3000); // Avtomatik yangi o'yin
  };

  // ────────────────────────────────────────────────
  // O'YINCHI TANLOVI
  // ────────────────────────────────────────────────
  const makeMove = (choice) => {
    if (game.playerChoice || game.status !== 'player-turn') return;
    setGame(prev => ({ ...prev, playerChoice: choice }));
    clearInterval(timerRef.current);

    setTimeout(() => {
      setAnimateReveal(true);
      calculateResult(choice, game.botChoice);
    }, 700);
  };

  const calculateResult = (p, b) => {
    let outcome, reward;
    const mult = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2;

    if (p === b) {
      outcome = 'draw';
      reward = Math.floor(25 * mult);
      setCurrentStreak(0);
    } else if (
      (p === 'rock' && b === 'scissors') ||
      (p === 'paper' && b === 'rock') ||
      (p === 'scissors' && b === 'paper')
    ) {
      outcome = 'win';
      reward = Math.floor(60 * mult) + (currentStreak * 15);
      setCurrentStreak(prev => prev + 1);
    } else {
      outcome = 'lose';
      reward = Math.floor(12 * mult);
      setCurrentStreak(0);
    }

    setGame(prev => ({ ...prev, result: outcome, status: 'finished' }));
    setCoins(c => c + reward);

    updateStats(outcome, reward);
    notify(getResultMessage(outcome, reward), outcome === 'win' ? 'success' : 'neutral');

    setTimeout(resetGameState, 3500); // Animatsiya tugagach avtomatik yangi o'yin
  };

  const updateStats = (outcome, reward) => {
    setStats(prev => {
      const next = {
        ...prev,
        totalGames: prev.totalGames + 1,
        totalCoinsEarned: prev.totalCoinsEarned + reward,
        botGamesPlayed: prev.botGamesPlayed + 1
      };
      if (outcome === 'win') { next.wins += 1; next.botGamesWon += 1; }
      if (outcome === 'lose') { next.losses += 1; }
      if (outcome === 'draw') { next.draws += 1; }
      next.winRate = Math.round((next.wins / next.totalGames) * 100) || 0;
      if (currentStreak > prev.maxStreak) next.maxStreak = currentStreak;
      return next;
    });
  };

  const getResultMessage = (res, coins) => {
    return {
      win: `🏆 G‘alaba! +${coins} coin`,
      lose: `😔 Mag‘lubiyat! +${coins} coin`,
      draw: `🤝 Durang! +${coins} coin`,
      timeout: `⏰ Vaqt tugadi! +5 coin`
    }[res];
  };

  // ────────────────────────────────────────────────
  // MENYUGA QAYTISH
  // ────────────────────────────────────────────────
  const backToMenu = () => {
    clearInterval(timerRef.current);
    setMode('menu');
    setBot(null);
    setAnimateReveal(false);
  };

  const emoji = (ch) => ({ rock: '✊', paper: '✋', scissors: '✌️' }[ch] || '❓');

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────
  return (
    <div className="app">

      {/* Notification */}
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.text}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="emoji">✊✌️✋</span>
          <h1>Tosh-Qaychi-Qog‘oz</h1>
        </div>
        <div className="user-info">
          <div className="coins">
            <span>🪙</span> {coins.toLocaleString()}
          </div>
          <div className="avatar-btn" style={{ backgroundImage: user.photo_url ? `url(${user.photo_url})` : 'none' }}>
            {!user.photo_url && user.first_name[0]}
          </div>
        </div>
      </header>

      <main className="content">

        {mode === 'menu' && (
          <div className="menu-screen">
            <div className="welcome">
              <div className="big-avatar" style={{ backgroundImage: user.photo_url ? `url(${user.photo_url})` : 'none' }}>
                {!user.photo_url && user.first_name[0]}
              </div>
              <h2>Salom, {user.first_name}!</h2>
            </div>

            <h3 className="section-title">Bot darajasini tanlang</h3>
            <div className="difficulty-grid">
              {[
                { key: 'easy',   title: 'Oson',   mult: 1,   color: '#86efac' },
                { key: 'medium', title: 'O‘rta',  mult: 1.5, color: '#fbbf24' },
                { key: 'hard',   title: 'Qiyin',  mult: 2,   color: '#f87171' }
              ].map(d => (
                <button
                  key={d.key}
                  className="difficulty-card"
                  style={{ '--accent': d.color }}
                  onClick={() => startGame(d.key)}
                >
                  <div className="diff-title">{d.title}</div>
                  <div className="diff-mult">×{d.mult}</div>
                  <div className="diff-reward">G‘alaba ≈ +{Math.round(60 * d.mult)} coin</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'playing' && (
          <div className="game-screen">

            <div className="timer-bar">
              <div className="timer-progress" style={{ width: `${(game.secondsLeft / 60) * 100}%` }} />
              <span className="timer-text">{game.secondsLeft}s</span>
            </div>

            <div className="versus">
              <div className="player you">
                <div className="label">SIZ</div>
                <div className={`choice-big ${game.playerChoice ? 'revealed' : ''}`}>
                  {game.playerChoice ? emoji(game.playerChoice) : '?'}
                </div>
              </div>

              <div className="vs-circle">VS</div>

              <div className="player bot">
                <div className="label">{bot?.name}</div>
                <div className={`choice-big ${animateReveal ? 'revealed' : ''}`}>
                  {animateReveal ? emoji(game.botChoice) : (game.botChoice ? '❓' : '🤔')}
                </div>
              </div>
            </div>

            {game.status === 'player-turn' && !game.playerChoice && (
              <div className="choices">
                <button className="choice rock"    onClick={() => makeMove('rock')}>✊</button>
                <button className="choice paper"   onClick={() => makeMove('paper')}>✋</button>
                <button className="choice scissors" onClick={() => makeMove('scissors')}>✌️</button>
              </div>
            )}

            {game.status === 'choosing' && (
              <div className="status-text">Bot tanlov qilmoqda...</div>
            )}

            {game.status === 'finished' && (
              <div className={`result-display ${game.result}`}>
                <div className="result-icon">
                  {game.result === 'win' ? '🏆' : game.result === 'lose' ? '😔' : game.result === 'draw' ? '🤝' : '⏰'}
                </div>
                <h2 className={`result-title ${game.result}`}>
                  {game.result === 'win' ? 'G‘ALABA!' :
                   game.result === 'lose' ? 'MAG‘LUBIYAT' :
                   game.result === 'draw' ? 'DURRANG' : 'VAQT TUGADI'}
                </h2>
                <p className="result-coins">
                  +{game.result === 'timeout' ? 5 : (game.result === 'win' ? 60 : game.result === 'draw' ? 25 : 12) * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2)} coin
                </p>
              </div>
            )}

            <div className="game-actions">
              <button className="btn secondary" onClick={backToMenu}>
                Menyuga qaytish
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>AI bilan halol o‘yin • Bot sizning tanlovingizni ko‘rmaydi</p>
      </footer>
    </div>
  );
}

export default App;