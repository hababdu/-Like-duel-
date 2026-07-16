import React, { useEffect, useRef, useReducer, useCallback } from 'react';
import './BotGame.css';

// --- INITIAL STATE & REDUCER ---
const initialState = {
  playerChoice: null,
  botChoice: null,
  result: null, // 'win' | 'lose' | 'draw' | null
  timer: 30,
  isBotThinking: false,
  roundStatus: 'idle', // 'idle' | 'playing' | 'revealed'
  streak: 0, // Ketma-ket g'alaba (Win Streak)
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
        streak: action.payload.result === 'win' ? state.streak + 1 : action.payload.result === 'lose' ? 0 : state.streak,
      };
    case 'RESET_STREAK':
      return { ...state, streak: 0 };
    default:
      return state;
  }
}

// --- MAIN COMPONENT ---
function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { playerChoice, botChoice, result, timer, isBotThinking, roundStatus, streak } = state;

  const timers = useRef({ round: null, interval: null, bot: null });
  const playerHistory = useRef([]); 
  const canvasRef = useRef(null); 

  // Vibratsiya (Mobil qurilmalar va Telegram uchun)
  const triggerHaptic = (type = 'light') => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 80 : 35);
      }
    } catch (e) {
      // Audio/vibe API xavfsiz chetlab o'tish
    }
  };

  // --- BOT INTELLEKTI ---
  const predictPlayerChoice = useCallback(() => {
    const history = playerHistory.current;
    if (history.length < 2) return null;

    const counts = history.reduce((acc, choice) => {
      acc[choice] = (acc[choice] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }, []);

  const getSmartBotChoice = useCallback((playerCurrent) => {
    const options = Object.keys(CHOICES);
    
    if (difficulty === 'easy') {
      if (Math.random() < 0.6) {
        return playerCurrent === 'rock' ? 'scissors' : playerCurrent === 'paper' ? 'rock' : 'paper';
      }
    } else if (difficulty === 'hard') {
      const predicted = predictPlayerChoice() || playerCurrent;
      if (Math.random() < 0.7) {
        return predicted === 'rock' ? 'paper' : predicted === 'paper' ? 'scissors' : 'rock';
      }
    }
    
    return options[Math.floor(Math.random() * options.length)];
  }, [CHOICES, difficulty, predictPlayerChoice]);

  // --- TAYMERLARNI TOZALASH ---
  const stopAllTimers = useCallback(() => {
    if (timers.current.interval) clearInterval(timers.current.interval);
    if (timers.current.round) clearTimeout(timers.current.round);
    if (timers.current.bot) clearTimeout(timers.current.bot);
  }, []);

  // --- YANGI RAUND BOSHLASH ---
  const initRound = useCallback(() => {
    stopAllTimers();
    dispatch({ type: 'START_ROUND' });

    timers.current.bot = setTimeout(() => {
      dispatch({ type: 'BOT_READY' });
    }, 600 + Math.random() * 500);

    timers.current.interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
  }, [stopAllTimers]);

  // --- VAQT TUGASA ---
  useEffect(() => {
    if (timer <= 0 && roundStatus === 'playing') {
      stopAllTimers();
      triggerHaptic('heavy');
      showNotif("Vaqt tugadi! ⌛", "warning");
      dispatch({ type: 'RESET_STREAK' });
      timers.current.round = setTimeout(initRound, 2000);
    }
  }, [timer, roundStatus, initRound, stopAllTimers, showNotif]);

  // --- BIRINCHI MAROTABA YUKLANGANDA ---
  useEffect(() => {
    initRound();
    return () => {
      stopAllTimers();
      playerHistory.current = [];
    };
  }, [difficulty, initRound, stopAllTimers]);

  // --- SILLIQ CANVAS KONFETI ANIMATSIYASI ---
  useEffect(() => {
    if (result !== 'win' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    let confetti = Array.from({ length: 60 }).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight - window.innerHeight,
      r: Math.random() * 5 + 3,
      d: Math.random() * window.innerHeight,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.05 + 0.02,
      tiltAngle: 0
    }));

    let animationFrameId;
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      confetti.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.5;
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 12;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      confetti = confetti.filter(p => p.y < window.innerHeight);
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
    if (playerHistory.current.length > 10) playerHistory.current.shift();

    const botChoice = getSmartBotChoice(userChoice);
    let roundResult = 'draw';

    if (userChoice !== botChoice) {
      const isWin =
        (userChoice === 'rock' && botChoice === 'scissors') ||
        (userChoice === 'paper' && botChoice === 'rock') ||
        (userChoice === 'scissors' && botChoice === 'paper');
      roundResult = isWin ? 'win' : 'lose';
    }

    // Haptic tebranish
    triggerHaptic(roundResult === 'win' ? 'heavy' : 'light');

    dispatch({
      type: 'MAKE_CHOICE',
      payload: { player: userChoice, bot: botChoice, result: roundResult }
    });

    // Mukofotni hisoblash (Combo bonus qo'shildi!)
    const rewardTable = {
      win: difficulty === 'easy' ? 40 : difficulty === 'medium' ? 70 : 110,
      draw: 10,
      lose: -20
    };
    
    let change = rewardTable[roundResult];
    const comboBonus = roundResult === 'win' && streak >= 2 ? (streak - 1) * 10 : 0;
    const finalChange = change + comboBonus;

    setCoins(prev => Math.max(0, prev + finalChange));

    // Notifikatsiya
    const notifMsg = roundResult === 'win' 
      ? `G'alaba! +${finalChange} 🪙 ${comboBonus > 0 ? `(Combo x${streak} 🔥)` : ''}` 
      : roundResult === 'draw' 
        ? `Durang! +${finalChange} 🪙` 
        : `Mag'lubiyat! ${finalChange} 🪙`;

    showNotif(notifMsg, roundResult === 'win' ? 'success' : roundResult === 'draw' ? 'warning' : 'error');

    timers.current.round = setTimeout(initRound, 2500);
  };

  return (
    <div className="game-wrapper">
      {result === 'win' && <canvas ref={canvasRef} className="confetti-canvas" />}

      {/* Modern Tepadagi Panel */}
      <header className="game-header">
        <button className="back-arrow" onClick={onBackToMenu}>
          <span className="icon">←</span>
        </button>
        <div className="header-center">
          <span className={`badge diff-${difficulty}`}>{difficulty}</span>
          {streak >= 2 && (
            <span className="combo-indicator">🔥 x{streak}</span>
          )}
        </div>
        <div className="score-badge">
          <span className="coin-emoji">🪙</span>
          <span className="coin-count">{coins}</span>
        </div>
      </header>

      {/* Progress Bar (Taymer) */}
      <div className="progress-container">
        <div 
          className={`progress-bar ${timer <= 5 ? 'critical' : ''}`} 
          style={{ width: `${(timer / 30) * 100}%` }}
        />
      </div>

      {/* Markaziy Jang Maydoni (VS Arena) */}
      <main className="arena">
        <div className={`arena-glow ${result}`} />
        
        {/* SIZ Card */}
        <div className={`card player-card ${playerChoice ? 'active' : ''}`}>
          <div className="card-inner">
            <span className="card-label">SIZ</span>
            <div className="card-emoji-box">
              {playerChoice ? CHOICES[playerChoice].emoji : '👤'}
            </div>
            {playerChoice && <span className="selected-name">{playerChoice}</span>}
          </div>
        </div>

        {/* VS Markazi */}
        <div className="vs-center">
          <div className="vs-circle">
            <span>VS</span>
          </div>
          {roundStatus === 'playing' && (
            <div className="timer-number-box">
              <span className={`timer-text ${timer <= 5 ? 'pulse' : ''}`}>{timer}</span>
            </div>
          )}
        </div>

        {/* BOT Card */}
        <div className={`card bot-card ${botChoice ? 'active' : ''}`}>
          <div className="card-inner">
            <span className="card-label">BOT</span>
            <div className="card-emoji-box">
              {botChoice ? (
                CHOICES[botChoice].emoji
              ) : isBotThinking ? (
                <div className="thinking-bubble">🤖💭</div>
              ) : (
                '🤖'
              )}
            </div>
            {botChoice && <span className="selected-name">{botChoice}</span>}
          </div>
        </div>
      </main>

      {/* Natija Banneri */}
      <div className="result-banner-container">
        {result && (
          <div className={`status-banner banner-${result}`}>
            {result === 'win' ? 'G‘ALABA! 🎉' : result === 'lose' ? 'YUTQAZDINGIZ! 😢' : 'DURANG 🤝'}
          </div>
        )}
      </div>

      {/* Mobil Tugmalar Grid */}
<footer className="action-area">
  <div className={`choices-grid ${playerChoice ? 'has-selection' : ''}`}>
  {Object.entries(CHOICES || {}).map(([key, item]) => {
      const isSelected = playerChoice === key;
      return (
        <button
          key={key}
          onClick={() => onPlay(key)}
          disabled={roundStatus !== 'playing'}
          className={`action-btn ${isSelected ? 'chosen' : ''}`}
          style={{ 
            backgroundColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.05)',
            boxShadow: isSelected ? `0 0 20px ${item.color}80` : 'none',
            borderColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.08)'
          }}
        >
          {isSelected && <span className="selection-indicator">✓ SIZ</span>}
          <span className="action-emoji">{item.emoji}</span>
          <span className="action-label">{key.toUpperCase()}</span>
        </button>
      );
    })}
  </div>
</footer>
    </div>
  );
}

export default BotGame;