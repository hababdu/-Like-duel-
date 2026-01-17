// components/BotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './BotGame.css';

function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [botChoice, setBotChoice] = useState(null);       // faqat keyin ochiladi
  const [hiddenBotChoice, setHiddenBotChoice] = useState(null); // ichki saqlash
  const [playerChoice, setPlayerChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(60);

  const timerRef = useRef(null);
  const nextRoundTimeout = useRef(null);

  useEffect(() => {
    startNewRound();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(nextRoundTimeout.current);
    };
  }, [difficulty]);

  const startNewRound = () => {
    // Yangi bot tanlovi (lekin ko‘rsatmaymiz hali)
    const newBotChoice = getBotChoice(); // bu yerni o‘zingizning bot logikangizga moslashtiring
    setHiddenBotChoice(newBotChoice);
    setBotChoice(null);           // ekranda ko‘rinmaydi

    setPlayerChoice(null);
    setResult(null);
    setTimer(60);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          showNotif("Vaqt tugadi!", "warning");
          setTimeout(startNewRound, 1400);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  // Bu funksiyani o‘zingizning RPSBot logikangizga almashtiring
  const getBotChoice = () => {
    const options = ['rock', 'paper', 'scissors'];
    return options[Math.floor(Math.random() * 3)]; // oddiy misol
  };

  const handlePlayerChoice = (choice) => {
    if (playerChoice || timer <= 0) return;

    setPlayerChoice(choice);
    clearInterval(timerRef.current);

    const bot = hiddenBotChoice;
    setBotChoice(bot); // endi ko‘rinadi

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

    const change =
      res === 'win' ? (difficulty === 'easy' ? 50 : difficulty === 'medium' ? 75 : 110) :
      res === 'draw' ? 20 : -10;

    setCoins((c) => Math.max(0, c + change));

    showNotif(
      res === 'win' ? `G‘alaba! +${change} 🪙` :
      res === 'draw' ? `Durang +${change} 🪙` :
      `Yo‘qotdingiz ${change} 🪙`,
      res === 'win' ? 'success' : res === 'draw' ? 'warning' : 'error'
    );

    nextRoundTimeout.current = setTimeout(startNewRound, 2400);
  };

  const ChoiceButton = ({ choiceKey, data }) => (
    <button
      className={`choice-btn ${playerChoice === choiceKey ? 'selected' : ''}`}
      style={{ '--choice-color': data.color }}
      onClick={() => handlePlayerChoice(choiceKey)}
      disabled={!!playerChoice || timer <= 0}
    >
      {data.emoji}
    </button>
  );

  return (
    <div className="bot-game-screen">
      <div className="top-bar">
        <div className="difficulty">{difficulty.toUpperCase()}</div>
        <div className="timer">
          <div className="progress" style={{ width: `${(timer / 60) * 100}%` }} />
          <span>{timer}</span>
        </div>
        <div className="coins">🪙 {coins}</div>
      </div>

      <div className="versus">
        <div className="player you">
          <div className="label">SIZ</div>
          <div className="choice-display big">
            {playerChoice ? CHOICES[playerChoice].emoji : '?'}
          </div>
        </div>

        <div className="vs-text">VS</div>

        <div className="player bot">
          <div className="label">BOT</div>
          <div className="choice-display big">
            {botChoice ? CHOICES[botChoice].emoji : '🤔'}
          </div>
        </div>
      </div>

      {result && (
        <div className={`result-banner ${result}`}>
          {result === 'win' ? 'G‘ALABA!' : result === 'lose' ? 'MAG‘LUBIYAT' : 'DURRANG'}
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