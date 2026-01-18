// components/BotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './BotGame.css';

function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [botChoice, setBotChoice] = useState(null);          // ekranda ko‘rinadigan
  const [hiddenBotChoice, setHiddenBotChoice] = useState(null); // oldindan tanlangan
  const [playerChoice, setPlayerChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(60);
  const [isThinking, setIsThinking] = useState(true);

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
    // Keyinchalik bu yerni haqiqiy qiyinlikka mos bot logikasiga almashtirishingiz mumkin
    const options = Object.keys(CHOICES);
    return options[Math.floor(Math.random() * options.length)];
  };

  const startNewRound = () => {
    const newBotChoice = getBotChoice();
    setHiddenBotChoice(newBotChoice);
    setBotChoice(null);
    setIsThinking(true);

    setPlayerChoice(null);
    setResult(null);
    setTimer(60);

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

    // Bot "o‘ylayotgandek" ko‘rinishi uchun kechikish
    setTimeout(() => {
      setIsThinking(false);
      setBotChoice(newBotChoice);
    }, 600 + Math.random() * 400); // 600–1000 ms oralig‘ida ochiladi
  };

  const handlePlayerChoice = (choice) => {
    if (playerChoice || timer <= 0) return;

    setPlayerChoice(choice);
    clearInterval(timerRef.current);

    const bot = hiddenBotChoice;
    setBotChoice(bot); // agar hali ochilmagan bo‘lsa, majburan ochamiz
    setIsThinking(false);

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
              botChoice ? 'has-choice reveal' : isThinking ? 'thinking' : ''
            }`}
          >
            {botChoice
              ? CHOICES[botChoice].emoji
              : isThinking
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