import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // ────────────────────────────────────────────────
  // USER & PERSISTENT DATA
  // ────────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rps_user');
    return saved ? JSON.parse(saved) : {
      id: Date.now(),
      first_name: 'Habibullo',
      username: `user_${Date.now().toString().slice(-6)}`
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

  const [daily, setDaily] = useState(() => {
    const saved = localStorage.getItem('rps_daily');
    const def = { streak: 1, lastClaim: null, available: true };
    return saved ? JSON.parse(saved) : def;
  });

  // ────────────────────────────────────────────────
  // GAME STATE
  // ────────────────────────────────────────────────
  const [mode, setMode] = useState('menu'); // menu | playing | finished
  const [difficulty, setDifficulty] = useState('medium'); // easy | medium | hard
  const [bot, setBot] = useState(null);

  const [game, setGame] = useState({
    status: 'waiting',
    playerChoice: null,
    botChoice: null,
    result: null,
    secondsLeft: 60
  });

  const [currentStreak, setCurrentStreak] = useState(0);
  const [botStreak, setBotStreak] = useState(0);

  const [showResult, setShowResult] = useState(false);
  const [notification, setNotification] = useState(null);

  const timerRef = useRef(null);
  const notifRef = useRef(null);

  // ────────────────────────────────────────────────
  // PERSISTENCE
  // ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('rps_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('rps_coins', coins);
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('rps_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('rps_daily', JSON.stringify(daily));
  }, [daily]);

  // ────────────────────────────────────────────────
  // TELEGRAM WEB APP INIT (agar kerak bo‘lsa)
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      const u = tg.initDataUnsafe?.user;
      if (u?.id) {
        setUser({
          id: u.id,
          first_name: u.first_name || 'Foydalanuvchi',
          username: u.username || `user_${u.id}`
        });
      }
    }

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(notifRef.current);
    };
  }, []);

  // ────────────────────────────────────────────────
  // NOTIFICATION HELPER
  // ────────────────────────────────────────────────
  const notify = (msg, type = 'info', ms = 2600) => {
    setNotification({ text: msg, type });
    clearTimeout(notifRef.current);
    notifRef.current = setTimeout(() => setNotification(null), ms);
  };

  // ────────────────────────────────────────────────
  // BOT LOGIC
  // ────────────────────────────────────────────────
  const startGame = (diff) => {
    const names = {
      easy:   ['Yosh Bot', 'Boshlang‘ich', 'Osonchi'],
      medium: ['Tajribali Bot', 'O‘rta Pro', 'Strateg'],
      hard:   ['Master Bot', 'AI Lord', 'Qiyinchi']
    };

    const selectedNames = names[diff] || names.medium;
    const botName = selectedNames[Math.floor(Math.random() * selectedNames.length)];

    setDifficulty(diff);
    setBot({ name: botName, difficulty: diff });
    setMode('playing');
    setGame({
      status: 'choosing',
      playerChoice: null,
      botChoice: null,
      result: null,
      secondsLeft: 60
    });
    setShowResult(false);
    setCurrentStreak(0); // yangi o‘yin → streak reset (xohlasangiz saqlashingiz mumkin)

    notify(`🤖 ${botName} bilan o‘yin boshlandi!`, 'info');

    // Bot tanlov qiladi (foydalanuvchidan oldin)
    setTimeout(() => {
      const botPick = getBotChoice(diff);
      setGame(prev => ({ ...prev, botChoice: botPick, status: 'player-turn' }));
      notify('Bot tanladi! Endi siz tanlang!', 'success', 2200);
      startTimer();
    }, 1200);
  };

  const getBotChoice = (diff) => {
    const opts = ['rock', 'paper', 'scissors'];

    if (diff === 'easy') {
      return opts[Math.floor(Math.random() * 3)];
    }

    if (diff === 'medium') {
      // 60% random, 40% oldingi tanlovga qarshi
      return Math.random() < 0.6
        ? opts[Math.floor(Math.random() * 3)]
        : getCounterChoice(game.playerChoice || opts[Math.floor(Math.random() * 3)]);
    }

    // hard → yuqori ehtimollik bilan yengishga harakat
    if (game.playerChoice) {
      return getCounterChoice(game.playerChoice);
    }
    return opts[Math.floor(Math.random() * 3)];
  };

  const getCounterChoice = (choice) => {
    const map = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
    return map[choice];
  };

  // ────────────────────────────────────────────────
  // TIMER
  // ────────────────────────────────────────────────
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setGame(prev => {
        if (prev.secondsLeft <= 1) {
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
    notify('⏰ Vaqt tugadi! +5 coin', 'warning');
  };

  // ────────────────────────────────────────────────
  // PLAYER MOVE
  // ────────────────────────────────────────────────
  const makeMove = (choice) => {
    if (game.playerChoice || game.status !== 'player-turn') return;

    setGame(prev => ({ ...prev, playerChoice: choice }));

    setTimeout(() => {
      setShowResult(true);
      calculateResult(choice, game.botChoice);
    }, 600);
  };

  const calculateResult = (p, b) => {
    if (!p || !b) return;

    let outcome;
    let reward = 0;

    const mult = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2;

    if (p === b) {
      outcome = 'draw';
      reward = Math.floor(25 * mult);
      setCurrentStreak(0);
      setBotStreak(s => s + 1);
    } else if (
      (p === 'rock' && b === 'scissors') ||
      (p === 'paper' && b === 'rock') ||
      (p === 'scissors' && b === 'paper')
    ) {
      outcome = 'win';
      const base = Math.floor(60 * mult);
      const streakBonus = currentStreak * 12;
      reward = base + streakBonus;
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      setBotStreak(0);
      if (newStreak > stats.maxStreak) {
        setStats(s => ({ ...s, maxStreak: newStreak }));
      }
    } else {
      outcome = 'lose';
      reward = Math.floor(12 * mult);
      setCurrentStreak(0);
      setBotStreak(s => s + 1);
    }

    setGame(prev => ({ ...prev, result: outcome, status: 'finished' }));
    setCoins(c => c + reward);

    setStats(prev => {
      const next = {
        ...prev,
        totalGames: prev.totalGames + 1,
        botGamesPlayed: prev.botGamesPlayed + 1,
        totalCoinsEarned: prev.totalCoinsEarned + reward
      };

      if (outcome === 'win') {
        next.wins += 1;
        next.botGamesWon += 1;
      } else if (outcome === 'lose') {
        next.losses += 1;
      } else {
        next.draws += 1;
      }

      next.winRate = next.totalGames > 0
        ? Math.round((next.wins / next.totalGames) * 100)
        : 0;

      return next;
    });

    const msg = {
      win: `🏆 G‘alaba! +${reward} coin`,
      lose: `😔 Yutqazdingiz... +${reward} coin`,
      draw: `🤝 Durang! +${reward} coin`
    }[outcome];

    notify(msg, outcome === 'win' ? 'success' : 'neutral', 4000);

    if (outcome === 'win' && currentStreak + 1 > 1) {
      setTimeout(() => {
        notify(`🔥 ${currentStreak + 1} ketma-ket! +${(currentStreak + 1) * 12} bonus`, 'success');
      }, 1800);
    }
  };

  // ────────────────────────────────────────────────
  // DAILY BONUS
  // ────────────────────────────────────────────────
  const claimDaily = () => {
    if (!daily.available) {
      notify('Kunlik bonus hali ochilmagan', 'warning');
      return;
    }

    const base = 120;
    const streakBonus = daily.streak * 30;
    const total = base + streakBonus;

    setCoins(c => c + total);
    setStats(s => ({ ...s, totalCoinsEarned: s.totalCoinsEarned + total }));

    const nextStreak = daily.streak + 1;
    setDaily({
      streak: nextStreak,
      lastClaim: Date.now(),
      available: false
    });

    notify(`🎁 +${total} coin! (${nextStreak}-kun ketma-ket)`, 'success', 4200);
  };

  // ────────────────────────────────────────────────
  // RENDER HELPERS
  // ────────────────────────────────────────────────
  const emoji = (ch) => ({ rock: '✊', paper: '✋', scissors: '✌️' }[ch] || '❓');
  const name  = (ch) => ({ rock: 'Tosh', paper: 'Qog‘oz', scissors: 'Qaychi' }[ch] || '—');

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────
  return (
    <div className="app">

      {/* NOTIFICATION */}
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.text}
        </div>
      )}

      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <span className="emoji">✊✌️✋</span>
          <h1>Tosh-Qaychi-Qog‘oz</h1>
        </div>
        <div className="user-info">
          <div className="coins">
            <span>🪙</span> {coins.toLocaleString()}
          </div>
          <button className="avatar-btn" onClick={() => { /* profil modal */ }}>
            {user.first_name[0].toUpperCase()}
          </button>
        </div>
      </header>

      <main className="content">

        {mode === 'menu' && (
          <div className="menu-screen">
            <div className="welcome">
              <div className="big-avatar">{user.first_name[0].toUpperCase()}</div>
              <h2>Salom, {user.first_name}!</h2>
            </div>

            <div className="daily-area">
              <button
                className={`daily-btn ${daily.available ? 'active' : 'disabled'}`}
                onClick={claimDaily}
              >
                {daily.available ? `Kunlik bonus olish (+${120 + daily.streak * 30})` : `${daily.streak} kunlik streak`}
              </button>
            </div>

            <h3 className="section-title">Bot bilan o‘ynash</h3>
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
              <div
                className="timer-progress"
                style={{ width: `${(game.secondsLeft / 60) * 100}%` }}
              />
              <span className="timer-text">{game.secondsLeft}s</span>
            </div>

            <div className="versus">
              <div className="player you">
                <div className="label">SIZ</div>
                <div className="choice-big">
                  {game.playerChoice ? emoji(game.playerChoice) : '?'}
                </div>
              </div>

              <div className="vs-circle">VS</div>

              <div className="player bot">
                <div className="label">{bot?.name || 'Bot'}</div>
                <div className="choice-big">
                  {game.botChoice ? '❓' : '🤔'}
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

            {showResult && game.result && (
              <div className={`result-overlay ${game.result}`}>
                <div className="result-content">
                  {game.result === 'win'    && <h2 className="win">G‘ALABA!</h2>}
                  {game.result === 'lose'   && <h2 className="lose">MAG‘LUBIYAT</h2>}
                  {game.result === 'draw'   && <h2 className="draw">DURRANG</h2>}
                  {game.result === 'timeout'&& <h2 className="timeout">VAQT TUGADI</h2>}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="footer">
        <p>AI bilan halol o‘yin • Bot tanlovingizni ko‘rmaydi</p>
      </footer>

    </div>
  );
}

export default App;