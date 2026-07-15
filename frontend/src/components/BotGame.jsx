import React, { useEffect, useRef, useReducer } from 'react';
import './BotGame.css';

// --- INITIAL STATE & REDUCER ---
const initialState = {
  playerChoice: null,
  botChoice: null,
  result: null, // 'win' | 'lose' | 'draw' | null
  timer: 30, // 30 soniya o'yin dinamikasi uchun optimal
  isBotThinking: false,
  roundStatus: 'idle', // 'idle' | 'playing' | 'revealed'
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'START_ROUND':
      return {
        ...state,
        playerChoice: null,
        botChoice: null,
        result: null,
        timer: 30,
        isBotThinking: true,
        roundStatus: 'playing',
      };
    case 'BOT_READY':
      return { ...state, isBotThinking: false };
    case 'TICK':
      return { ...state, timer: state.timer - 1 };
    case 'MAKE_CHOICE':
      return {
        ...state,
        playerChoice: action.payload.player,
        botChoice: action.payload.bot,
        result: action.payload.result,
        roundStatus: 'revealed',
      };
    default:
      return state;
  }
}

// --- MAIN COMPONENT ---
function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { playerChoice, botChoice, result, timer, isBotThinking, roundStatus } = state;

  // Refs for timers and history tracking
  const timers = useRef({ round: null, interval: null, bot: null });
  const playerHistory = useRef([]); // Bot aqlli bashoratlari uchun tarix
  const canvasRef = useRef(null); // Konfeti uchun

  // --- BOT INTILEXT TIZIMI ---
  const predictPlayerChoice = () => {
    const history = playerHistory.current;
    if (history.length < 2) return null;

    // Eng ko'p tanlangan oxirgi yurishlar tahlili
    const counts = history.reduce((acc, choice) => {
      acc[choice] = (acc[choice] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  };

  const getSmartBotChoice = (playerCurrent) => {
    const options = Object.keys(CHOICES);
    
    if (difficulty === 'easy') {
      // Oson: 60% ehtimol bilan bot ataylab mag'lub bo'ladi
      if (Math.random() < 0.6) {
        return playerCurrent === 'rock' ? 'scissors' : playerCurrent === 'paper' ? 'rock' : 'paper';
      }
    } else if (difficulty === 'hard') {
      // Qiyin: Bot sizning tarixingizga qarab 70% ehtimollik bilan g'alaba modelini tanlaydi
      const predicted = predictPlayerChoice() || playerCurrent;
      if (Math.random() < 0.7) {
        return predicted === 'rock' ? 'paper' : predicted === 'paper' ? 'scissors' : 'rock';
      }
    }
    
    // O'rta (Medium) yoki random vaziyat
    return options[Math.floor(Math.random() * options.length)];
  };

  // --- TAYMERLARNI TOZALASH ---
  const stopAllTimers = () => {
    if (timers.current.interval) clearInterval(timers.current.interval);
    if (timers.current.round) clearTimeout(timers.current.round);
    if (timers.current.bot) clearTimeout(timers.current.bot);
  };

  // --- YANGI RAUND BOSHLASH ---
  const initRound = () => {
    stopAllTimers();
    dispatch({ type: 'START_ROUND' });

    // Bot o'ylash effekti (simulyatsiya)
    timers.current.bot = setTimeout(() => {
      dispatch({ type: 'BOT_READY' });
    }, 800 + Math.random() * 600);

    // Vaqt ortga hisoblash
    timers.current.interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
  };

  // --- VAQT TUGASA ---
  useEffect(() => {
    if (timer <= 0 && roundStatus === 'playing') {
      stopAllTimers();
      showNotif("Vaqt tugadi! ⌛", "warning");
      timers.current.round = setTimeout(initRound, 2000);
    }
  }, [timer, roundStatus]);

  // --- BOSHLANG'ICH YUKLANISH VA UNMOUNT ---
  useEffect(() => {
    initRound();
    return () => {
      stopAllTimers();
      playerHistory.current = [];
    };
  }, [difficulty]);

  // --- CANVAS KONFETI ANIMATSIYASI (HIGH PERFORMANCE) ---
  useEffect(() => {
    if (result !== 'win' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let confetti = Array.from({ length: 80 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * canvas.height,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    }));

    let animationFrameId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confetti.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      confetti = confetti.filter(p => p.y < canvas.height);
      if (confetti.length > 0) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [result]);

  // --- O'YINCHI TANLOVI ---
  const onPlay = (userChoice) => {
    if (roundStatus !== 'playing') return;
    stopAllTimers();

    playerHistory.current.push(userChoice);
    if (playerHistory.current.length > 10) playerHistory.current.shift(); // Oxirgi 10 tasini saqlaymiz

    const botChoice = getSmartBotChoice(userChoice);
    let roundResult = 'draw';

    if (userChoice !== botChoice) {
      const isWin =
        (userChoice === 'rock' && botChoice === 'scissors') ||
        (userChoice === 'paper' && botChoice === 'rock') ||
        (userChoice === 'scissors' && botChoice === 'paper');
      roundResult = isWin ? 'win' : 'lose';
    }

    dispatch({
      type: 'MAKE_CHOICE',
      payload: { player: userChoice, bot: botChoice, result: roundResult }
    });

    // Mukofotni hisoblash qoidasi (Yangi balans)
    const rewardTable = {
      win: difficulty === 'easy' ? 40 : difficulty === 'medium' ? 70 : 110,
      draw: 10,
      lose: -20
    };
    const change = rewardTable[roundResult];
    setCoins(prev => Math.max(0, prev + change));

    // Notifikatsiya chiqarish
    const notifMsg = roundResult === 'win' 
      ? `G'alaba! +${change} 🪙` 
      : roundResult === 'draw' 
        ? `Durang! +${change} 🪙` 
        : `Mag'lubiyat! ${change} 🪙`;
    showNotif(notifMsg, roundResult === 'win' ? 'success' : roundResult === 'draw' ? 'warning' : 'error');

    // Keyingi raundga o'tish
    timers.current.round = setTimeout(initRound, 2500);
  };

  return (
    <div className="game-wrapper">
      {/* Orqa fondagi konfeti canva'si */}
      {result === 'win' && <canvas ref={canvasRef} className="confetti-canvas" />}

      {/* Teparoq interfeys paneli */}
      <header className="game-header">
        <button className="back-arrow" onClick={onBackToMenu}>
          ✕
        </button>
        <div className={`badge diff-${difficulty}`}>{difficulty}</div>
        <div className="score-badge">🪙 {coins}</div>
      </header>

      {/* Taymer chizig'i */}
      <div className="progress-container">
        <div 
          className={`progress-bar ${timer <= 5 ? 'critical' : ''}`} 
          style={{ width: `${(timer / 30) * 100}%` }}
        />
      </div>

      {/* Jang maydoni (VS Arena) */}
      <main className="arena">
        <div className={`card player-card ${playerChoice ? 'active' : ''}`}>
          <span className="card-title">SIZ</span>
          <div className="card-view">
            {playerChoice ? CHOICES[playerChoice].emoji : '👤'}
          </div>
        </div>

        <div className="vs-badge">
          <span>VS</span>
        </div>

        <div className={`card bot-card ${botChoice ? 'active' : ''}`}>
          <span className="card-title">BOT</span>
          <div className="card-view">
            {botChoice ? (
              CHOICES[botChoice].emoji
            ) : isBotThinking ? (
              <span className="pulse-loader">🤖💭</span>
            ) : (
              '🤖'
            )}
          </div>
        </div>
      </main>

      {/* Natija ekrani */}
      {result && (
        <div className={`status-banner banner-${result}`}>
          {result === 'win' ? 'YUTDINGIZ! 🎉' : result === 'lose' ? 'YUTQAZDINGIZ! 😢' : 'DURANG 🤝'}
        </div>
      )}

      {/* Tanlash tugmalari */}
      <footer className="action-area">
        <div className="choices-grid">
          {Object.entries(CHOICES).map(([key, item]) => (
            <button
              key={key}
              onClick={() => onPlay(key)}
              disabled={roundStatus !== 'playing'}
              className={`action-btn ${playerChoice === key ? 'chosen' : ''}`}
              style={{ '--btn-theme': item.color }}
            >
              <span className="action-emoji">{item.emoji}</span>
              <span className="action-label">{key.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default BotGame;