// components/BotGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import RPSBot from '../RPSBot'; // agar alohida faylda bo'lsa
import './BotGame.css';           // quyida CSS ni ham beraman

function BotGame({ difficulty, coins, setCoins, CHOICES, onBackToMenu, showNotif }) {
  const [bot] = useState(() => new RPSBot(difficulty));
  const [botChoice, setBotChoice] = useState(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botResult, setBotResult] = useState(null);
  const [timer, setTimer] = useState(60);
  const [isThinking, setIsThinking] = useState(true);
  const timerRef = useRef(null);
  const choiceTimeoutRef = useRef(null);

  useEffect(() => {
    resetRound();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(choiceTimeoutRef.current);
    };
  }, [difficulty]);

  const resetRound = () => {
    bot.reset(); // agar har bir o'yinda yangi bot xohlasangiz
    const initialBotChoice = bot.choose();
    setBotChoice(initialBotChoice);
    setPlayerChoice(null);
    setBotResult(null);
    setIsThinking(true);
    setTimer(60);
    startTimer();

    // Bot "o'ylayotgandek" qilish uchun kichik kechikish
    choiceTimeoutRef.current = setTimeout(() => {
      setIsThinking(false);
    }, 800);
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          showNotif("Vaqt tugadi!", "warning");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleBotMove = (choice) => {
    if (playerChoice || botResult || timer <= 0) return;

    setPlayerChoice(choice);
    clearInterval(timerRef.current);
    bot.remember(choice);

    // Natijani hisoblash
    const currentBot = botChoice;
    let res = 'draw';
    if (choice !== currentBot) {
      if (
        (choice === 'rock' && currentBot === 'scissors') ||
        (choice === 'paper' && currentBot === 'rock') ||
        (choice === 'scissors' && currentBot === 'paper')
      ) {
        res = 'win';
      } else {
        res = 'lose';
      }
    }

    setBotResult(res);

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
      res === 'win'
        ? `G‘alaba! +${change} 🪙`
        : res === 'draw'
        ? `Durang +${change} 🪙`
        : `Mag‘lubiyat ${change} 🪙`,
      res === 'win' ? 'success' : res === 'draw' ? 'warning' : 'error'
    );
  };

  const ChoiceButton = ({ choiceKey, data }) => {
    const isSelected = playerChoice === choiceKey;
    const isWinner = botResult === 'win' && isSelected;
    const isLoser = botResult === 'lose' && isSelected;

    return (
      <button
        className={`choice-btn ${isSelected ? 'selected' : ''} ${isWinner ? 'winner' : ''} ${
          isLoser ? 'loser' : ''
        }`}
        style={{ '--choice-color': data.color }}
        onClick={() => handleBotMove(choiceKey)}
        disabled={!!playerChoice || !!botResult || timer <= 0}
      >
        <div className="emoji">{data.emoji}</div>
        <span className="label">{data.name}</span>
      </button>
    );
  };

  return (
    <main className="game-screen bot-game">
      <div className="header-info">
        <div className="difficulty-badge">{difficulty.toUpperCase()}</div>
        <div className="timer-container">
          <div className="timer-bar">
            <div className="timer-progress" style={{ width: `${(timer / 60) * 100}%` }} />
          </div>
          <span className="timer-text">{timer}s</span>
        </div>
      </div>

      <div className="versus-container">
        <div className="player-side you">
          <div className="label">SIZ</div>
          <div className={`choice-display ${playerChoice ? 'revealed' : ''}`}>
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

      {!playerChoice && botResult === null && timer > 0 && (
        <div className="choices-container">
          {Object.entries(CHOICES).map(([key, val]) => (
            <ChoiceButton key={key} choiceKey={key} data={val} />
          ))}
        </div>
      )}

      {botResult && (
        <div className={`result-overlay ${botResult}`}>
          <div className="result-content">
            <h2 className={botResult}>
              {botResult === 'win' ? 'G‘ALABA!' : botResult === 'lose' ? 'MAG‘LUBIYAT' : 'DURRANG'}
            </h2>

            <div className="final-choices">
              <div className="choice-result">{CHOICES[playerChoice]?.emoji}</div>
              <div className="vs-small">VS</div>
              <div className="choice-result">{CHOICES[botChoice]?.emoji}</div>
            </div>

            <div className="result-actions">
              <button className="play-again-btn" onClick={resetRound}>
                Yana o'ynash
              </button>
              <button className="menu-btn" onClick={onBackToMenu}>
                Menyuga qaytish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default BotGame;