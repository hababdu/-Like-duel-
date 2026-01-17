// components/BotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import RPSBot from '../RPSBot';
import './BotGame.css';

function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [bot] = useState(() => new RPSBot(difficulty));
  const [botChoice, setBotChoice] = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [result, setResult] = useState(null); // 'win' | 'lose' | 'draw' | null
  const [timer, setTimer] = useState(60);
  const [isThinking, setIsThinking] = useState(true);

  const timerRef = useRef(null);
  const revealTimeoutRef = useRef(null);

  useEffect(() => {
    startNewRound();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(revealTimeoutRef.current);
    };
  }, [difficulty]);

  const startNewRound = () => {
    bot.reset?.(); // agar reset metodi bo'lsa
    const newBotChoice = bot.choose();
    setBotChoice(newBotChoice);

    setPlayerChoice(null);
    setResult(null);
    setIsThinking(true);
    setTimer(60);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          showNotif("Vaqt tugadi!", "warning");
          setTimeout(startNewRound, 1200);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // "o'ylash" animatsiyasi
    revealTimeoutRef.current = setTimeout(() => {
      setIsThinking(false);
    }, 700);
  };

  const handlePlayerChoice = (choice) => {
    if (playerChoice || result || timer <= 0) return;

    setPlayerChoice(choice);
    clearInterval(timerRef.current);
    bot.remember?.(choice); // agar eslab qolish logikasi bo'lsa

    // Natijani hisoblash
    let res = 'draw';
    if (choice !== botChoice) {
      if (
        (choice === 'rock' && botChoice === 'scissors') ||
        (choice === 'paper' && botChoice === 'rock') ||
        (choice === 'scissors' && botChoice === 'paper')
      ) {
        res = 'win';
      } else {
        res = 'lose';
      }
    }

    setResult(res);

    const change =
      res === 'win'
        ? difficulty === 'easy'
          ? 50
          : difficulty === 'medium'
          ? 75
          : 110
        : res === 'draw'
        ? 20
        : -10;

    setCoins((c) => Math.max(0, c + change));

    showNotif(
      res === 'win' ? `G‘alaba! +${change} 🪙` :
      res === 'draw' ? `Durang +${change} 🪙` :
      `Mag‘lubiyat ${change} 🪙`,
      res === 'win' ? 'success' : res === 'draw' ? 'warning' : 'error'
    );

    // Keyingi raund ~2.2 soniyadan keyin boshlanadi
    setTimeout(startNewRound, 2200);
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

  const getResultText = () => {
    if (!result) return '';
    if (result === 'win') return 'G‘ALABA!';
    if (result === 'lose') return 'MAG‘LUBIYAT';
    return 'DURRANG';
  };

  return (
    <main className="game-screen bot-game">
      <div className="header">
        <div className="difficulty-badge">{difficulty.toUpperCase()}</div>
        <div className="timer-container">
          <div className="timer-bar">
            <div className="timer-progress" style={{ width: `${(timer / 60) * 100}%` }} />
          </div>
          <span className="timer-text">{timer}s</span>
        </div>
        <div className="coins-display">🪙 {coins}</div>
      </div>

      <div className="versus-container">
        <div className="player-side you">
          <div className="label">SIZ</div>
          <div className={`choice-display ${playerChoice ? 'revealed' : 'hidden'}`}>
            {playerChoice ? CHOICES[playerChoice].emoji : '?'}
          </div>
        </div>

        <div className="vs">VS</div>

        <div className="player-side bot">
          <div className="label">BOT</div>
          <div className={`choice-display ${!isThinking && botChoice ? 'revealed' : 'thinking'}`}>
            {isThinking ? '🤔' : CHOICES[botChoice]?.emoji || '?'}
          </div>
        </div>
      </div>

      {result && (
        <div className={`result-text ${result}`}>
          {getResultText()}
        </div>
      )}

      <div className="choices-row">
        {Object.entries(CHOICES).map(([key, val]) => (
          <ChoiceButton key={key} choiceKey={key} data={val} />
        ))}
      </div>

      <button className="back-to-menu-btn" onClick={onBackToMenu}>
        Menyuga qaytish
      </button>
    </main>
  );
}

export default BotGame;