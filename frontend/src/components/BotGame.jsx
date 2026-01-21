// components/BotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './BotGame.css';

function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [botChoice, setBotChoice] = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(60);
  const [isBotThinking, setIsBotThinking] = useState(true);

  const timerRef = useRef(null);
  const nextRoundTimeout = useRef(null);

  useEffect(() => {
    startNewRound();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(nextRoundTimeout.current);
    };
  }, [difficulty]);

  const getBotChoice = () => {
    // Keyinchalik bu yerni qiyinlik darajasiga moslashtirishingiz mumkin
    // Hozircha oddiy random
    const options = Object.keys(CHOICES);
    return options[Math.floor(Math.random() * options.length)];
  };
// BotGame.jsx ichida — result o‘zgarganda ishlaydigan qism

useEffect(() => {
  if (result === 'win') {
    createConfetti(18); // 18 dona konfeti
  }
}, [result]);

const createConfetti = (count) => {
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'win-confetti';
    
    // Tasodifiy rang va joylashuv
    const colors = ['#00ff9d', '#7c3aed', '#ff4d94', '#ffd700', '#00d4ff'];
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '30%';
    confetti.style.setProperty('--choice-color', confetti.style.background);
    
    // Tasodifiy kechikish va hajm
    confetti.style.animationDelay = Math.random() * 0.6 + 's';
    confetti.style.width = (8 + Math.random() * 10) + 'px';
    confetti.style.height = confetti.style.width;
    
    document.body.appendChild(confetti);
    
    // 3 soniyadan keyin o‘chirish
    setTimeout(() => confetti.remove(), 5000);
  }
};
  const startNewRound = () => {
    setBotChoice(null);
    setPlayerChoice(null);
    setResult(null);
    setTimer(60);
    setIsBotThinking(true); // yangi raund boshida "o‘ylayapti" holati

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          showNotif("Vaqt tugadi! Tezroq tanlang 😅", "warning");
          setTimeout(startNewRound, 1800);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Bot tanlovini biroz kech ochish uchun (vizual effekt)
    setTimeout(() => {
      setIsBotThinking(false);
    }, 800 + Math.random() * 600); // 800–1400 ms oralig‘ida
  };

  const handlePlayerChoice = (choice) => {
    if (playerChoice || timer <= 0) return;

    setPlayerChoice(choice);
    clearInterval(timerRef.current);

    // Bot shu yerda tanlaydi — eng halol joy!
    const bot = getBotChoice();
    setBotChoice(bot);
    setIsBotThinking(false);

    let res = 'draw';
    if (choice !== bot) {
      if (
        (choice === 'rock' && bot === 'scissors') ||
        (choice === 'paper' && bot === 'rock') ||
        (choice === 'scissors' && bot === 'paper')
      ) {
        res = 'win';
      } else {
        res = 'lose';
      }
    }

    setResult(res);

    // Mukofot / jarima miqdori qiyinlikka qarab
    const change =
      res === 'win'
        ? difficulty === 'easy'
          ? 50
          : difficulty === 'medium'
          ? 80
          : 120
        : res === 'draw'
        ? 15
        : -15;

    setCoins((c) => Math.max(0, c + change));

    showNotif(
      res === 'win'
        ? `Zo‘r! +${change} 🪙🔥`
        : res === 'draw'
        ? `Durang +${change} 🪙`
        : `Yo‘qotdingiz ${change} 🪙💔`,
      res === 'win' ? 'success' : res === 'draw' ? 'warning' : 'error'
    );

    nextRoundTimeout.current = setTimeout(startNewRound, 2600);
  };

  const ChoiceButton = ({ choiceKey, data }) => (
    <button
      className={`choice-btn ${playerChoice === choiceKey ? 'selected' : ''}`}
      style={{ '--choice-color': data.color }}
      onClick={() => handlePlayerChoice(choiceKey)}
      disabled={!!playerChoice || timer <= 0}
    >
      <span className="emoji">{data.emoji}</span>
    </button>
  );

  return (
    <div className="bot-game-screen">
      <div className="top-bar">
        <div className="difficulty">{difficulty.toUpperCase()}</div>

        <div className="timer">
          <div className="progress" style={{ width: `${(timer / 60) * 100}%` }} />
          <span className={timer <= 10 ? 'urgent' : ''}>{timer}</span>
        </div>

        <div className="coins">🪙 {coins}</div>
      </div>

      <div className="versus">
        <div className="player you">
          <div className="label">SIZ</div>
          <div className={`choice-display big ${playerChoice ? 'has-choice' : ''}`}>
            {playerChoice ? CHOICES[playerChoice].emoji : '?'}
          </div>
        </div>

        <div className="vs-text">VS</div>

        <div className="player bot">
          <div className="label">BOT</div>
          <div
            className={`choice-display big ${
              botChoice ? 'has-choice reveal' : isBotThinking ? 'thinking' : 'waiting'
            }`}
          >
            {botChoice
              ? CHOICES[botChoice].emoji
              : isBotThinking
              ? '🤔'
              : '❓'}
          </div>
        </div>
      </div>

      {result && (
        <div className={`result-banner ${result}`}>
          {result === 'win' ? 'G‘ALABA!' : result === 'lose' ? 'MAG‘LUBIYAT!' : 'DURRANG'}
        </div>
      )}

      <div className="choices-container">
        {Object.entries(CHOICES).map(([key, val]) => (
          <ChoiceButton key={key} choiceKey={key} data={val} />
        ))}
      </div>

      <button className="back-btn" onClick={onBackToMenu}>
        Menyuga qaytish
      </button>
    </div>
  );
}

export default BotGame;