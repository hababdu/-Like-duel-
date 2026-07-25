// ============================================================
// BotGame.js - TO'LIQ TUZATILGAN VERSION
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './BotGame.css';

const CHOICES = {
  rock: { emoji: '🪨', color: '#ff6b6b', label: 'Tosh' },
  paper: { emoji: '📄', color: '#4ecdc4', label: 'Qog\'oz' },
  scissors: { emoji: '✂️', color: '#ffe66d', label: 'Qaychi' }
};

function BotGame({ 
  user, 
  setUser, 
  difficulty = 'medium', 
  onBackToMenu, 
  showNotif, 
  triggerHaptic,
  API_URL 
}) {
  // ======================
  // STATE
  // ======================
  const [gameState, setGameState] = useState('idle');
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botChoice, setBotChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(30);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState(user?.coins || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const roundRef = useRef(null);
  const playerHistory = useRef([]);

  // ======================
  // UPDATE COINS FROM USER
  // ======================
  useEffect(() => {
    if (user?.coins !== undefined) {
      setCoins(user.coins);
    }
  }, [user]);

  // ======================
  // UPDATE COINS TO SERVER
  // ======================
  const updateCoinsOnServer = useCallback(async (newCoins) => {
    if (!user?.tgId) return;

    try {
      const response = await fetch(`${API_URL}/api/user/update-coins`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tgId: String(user.tgId),
          amount: newCoins - coins
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Coins updated on server:', data.coins);
        setCoins(data.coins);
        if (setUser) {
          setUser(prev => ({ ...prev, coins: data.coins }));
        }
        return true;
      } else {
        console.error('❌ Failed to update coins:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Update coins error:', error);
      return false;
    }
  }, [user, coins, API_URL, setUser]);

  // ======================
  // BOT INTELLIGENCE
  // ======================
  const predictPlayerChoice = useCallback(() => {
    const history = playerHistory.current;
    if (history.length < 2) return null;

    const counts = history.reduce((acc, choice) => {
      acc[choice] = (acc[choice] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }, []);

  const getBotChoice = useCallback(() => {
    const options = Object.keys(CHOICES);
    
    // Easy: 60% counter, 40% random
    if (difficulty === 'easy') {
      if (Math.random() < 0.6 && playerChoice) {
        const counter = {
          rock: 'paper',
          paper: 'scissors',
          scissors: 'rock'
        };
        return counter[playerChoice];
      }
    }
    
    // Hard: 70% prediction-based, 30% random
    if (difficulty === 'hard') {
      const predicted = predictPlayerChoice() || (playerChoice || 'rock');
      if (Math.random() < 0.7) {
        const counter = {
          rock: 'paper',
          paper: 'scissors',
          scissors: 'rock'
        };
        return counter[predicted];
      }
    }
    
    // Medium or default: 50% counter, 50% random
    if (difficulty === 'medium' && Math.random() < 0.5 && playerChoice) {
      const counter = {
        rock: 'paper',
        paper: 'scissors',
        scissors: 'rock'
      };
      return counter[playerChoice];
    }
    
    return options[Math.floor(Math.random() * options.length)];
  }, [difficulty, playerChoice, predictPlayerChoice]);

  // ======================
  // GAME LOGIC
  // ======================
  const determineWinner = useCallback((player, bot) => {
    if (player === bot) return 'draw';
    const winConditions = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper'
    };
    return winConditions[player] === bot ? 'win' : 'lose';
  }, []);

  // ======================
  // START ROUND
  // ======================
  const startRound = useCallback(() => {
    // Clear old timers
    if (roundRef.current) clearTimeout(roundRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // Check if user has enough coins
    if (coins < 10) {
      showNotif('⚠️ Yetarli tanga yo\'q! 10 tanga kerak', 'error');
      setGameState('idle');
      return;
    }

    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
    setTimer(30);
    setIsBotThinking(true);
    setGameState('playing');
    setError(null);

    // Bot "thinking" delay
    const thinkDelay = 600 + Math.random() * 500;
    roundRef.current = setTimeout(() => {
      setIsBotThinking(false);
    }, thinkDelay);

    // Timer
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Timeout - player loses
          setGameState('result');
          setResult('lose');
          setStreak(0);
          
          // Loss penalty
          const lossAmount = 10;
          const newCoins = Math.max(0, coins - lossAmount);
          
          // Update coins locally and on server
          setCoins(newCoins);
          if (setUser) {
            setUser(prev => ({ ...prev, coins: newCoins }));
          }
          updateCoinsOnServer(newCoins);
          
          showNotif('⏰ Vaqt tugadi! -10 🪙', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [coins, setUser, showNotif, updateCoinsOnServer]);

  // ======================
  // PLAYER MAKES CHOICE
  // ======================
  const handlePlay = useCallback(async (choice) => {
    if (gameState !== 'playing' || playerChoice) return;
    if (coins < 10) {
      showNotif('⚠️ Yetarli tanga yo\'q! 10 tanga kerak', 'error');
      setGameState('idle');
      return;
    }

    // Record player history
    playerHistory.current.push(choice);
    if (playerHistory.current.length > 10) {
      playerHistory.current.shift();
    }

    setPlayerChoice(choice);
    triggerHaptic?.('light');

    // Bot makes choice
    const botChoice = getBotChoice();
    setBotChoice(botChoice);
    
    // Determine winner
    const roundResult = determineWinner(choice, botChoice);
    
    // Calculate rewards
    const rewardTable = {
      win: difficulty === 'easy' ? 40 : difficulty === 'medium' ? 70 : 110,
      draw: 10,
      lose: -20
    };
    
    let change = rewardTable[roundResult] || 0;
    const comboBonus = roundResult === 'win' && streak >= 2 ? (streak - 1) * 10 : 0;
    const finalChange = change + comboBonus;

    // Calculate new coins
    const newCoins = Math.max(0, coins + finalChange);

    // Update coins locally
    setCoins(newCoins);
    if (setUser) {
      setUser(prev => ({ ...prev, coins: newCoins }));
    }

    // Update coins on server
    await updateCoinsOnServer(newCoins);

    // Update streak
    if (roundResult === 'win') {
      setStreak(prev => prev + 1);
    } else if (roundResult === 'lose') {
      setStreak(0);
    }

    // Show result
    setResult(roundResult);
    setGameState('result');

    // Haptic feedback
    if (roundResult === 'win') {
      triggerHaptic?.('heavy');
      showNotif(`🎉 G'alaba! +${finalChange} 🪙 ${comboBonus > 0 ? `(Combo x${streak + 1} 🔥)` : ''}`, 'success');
    } else if (roundResult === 'lose') {
      triggerHaptic?.('medium');
      showNotif(`😢 Mag'lubiyat! ${finalChange} 🪙`, 'error');
    } else {
      triggerHaptic?.('light');
      showNotif(`🤝 Durang! +${finalChange} 🪙`, 'info');
    }

    // Clear timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (roundRef.current) clearTimeout(roundRef.current);

    // Next round after delay
    roundRef.current = setTimeout(() => {
      startRound();
    }, 2500);
  }, [
    gameState, 
    playerChoice, 
    coins, 
    getBotChoice, 
    determineWinner, 
    difficulty, 
    streak, 
    setUser, 
    showNotif, 
    triggerHaptic, 
    startRound,
    updateCoinsOnServer
  ]);

  // ======================
  // INITIALIZATION
  // ======================
  useEffect(() => {
    // Check if user has enough coins
    if (coins < 10) {
      showNotif('⚠️ Bot o\'ynash uchun 10 tanga kerak!', 'warning');
      setGameState('idle');
      return;
    }
    
    startRound();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (roundRef.current) clearTimeout(roundRef.current);
      playerHistory.current = [];
    };
  }, [difficulty, startRound, coins, showNotif]);

  // ======================
  // REFRESH COINS FROM SERVER
  // ======================
  const refreshCoins = useCallback(async () => {
    if (!user?.tgId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${user.tgId}`);
      const data = await response.json();
      
      if (data.success && data.user) {
        const newCoins = data.user.coins || 0;
        setCoins(newCoins);
        if (setUser) {
          setUser(prev => ({ ...prev, coins: newCoins }));
        }
        showNotif('✅ Tangalar yangilandi!', 'success');
      }
    } catch (error) {
      console.error('❌ Refresh coins error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, API_URL, setUser, showNotif]);

  // ======================
  // FORMAT FUNCTIONS
  // ======================
  const formatChoice = (key) => {
    return CHOICES[key]?.label || key;
  };

  const getChoiceEmoji = (key) => {
    return CHOICES[key]?.emoji || '❓';
  };

  // ======================
  // RENDER
  // ======================
  return (
    <div className="game-wrapper">
      {/* Header */}
      <header className="game-header">
        <button className="back-arrow" onClick={onBackToMenu}>
          <span className="icon">←</span>
        </button>
        <div className="header-center">
          <span className={`badge diff-${difficulty}`}>
            {difficulty === 'easy' ? '🟢 Oson' : 
             difficulty === 'medium' ? '🟡 O\'rta' : '🔴 Qiyin'}
          </span>
          {streak >= 2 && (
            <span className="combo-indicator">🔥 x{streak}</span>
          )}
        </div>
        <div className="score-badge" onClick={refreshCoins} style={{ cursor: 'pointer' }}>
          <span className="coin-emoji">🪙</span>
          <span className="coin-count">{coins}</span>
          {isLoading && <span className="loading-spinner">⏳</span>}
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Insufficient Coins Warning */}
      {coins < 10 && gameState !== 'idle' && (
        <div className="warning-message">
          ⚠️ Tanga yetarli emas! O'yin uchun 10 tanga kerak.
          <button onClick={refreshCoins}>🔄 Yangilash</button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-container">
        <div 
          className={`progress-bar ${timer <= 5 ? 'critical' : ''}`} 
          style={{ width: `${(timer / 30) * 100}%` }}
        />
      </div>

      {/* Arena */}
      <main className="arena">
        <div className={`arena-glow ${result}`} />
        
        {/* Player Card */}
        <div className={`card player-card ${playerChoice ? 'active' : ''}`}>
          <div className="card-inner">
            <span className="card-label">SIZ</span>
            <div className="card-emoji-box">
              {playerChoice ? getChoiceEmoji(playerChoice) : '👤'}
            </div>
            {playerChoice && <span className="selected-name">{formatChoice(playerChoice)}</span>}
          </div>
        </div>

        {/* VS Center */}
        <div className="vs-center">
          <div className="vs-circle">
            <span>VS</span>
          </div>
          {gameState === 'playing' && (
            <div className="timer-number-box">
              <span className={`timer-text ${timer <= 5 ? 'pulse' : ''}`}>{timer}</span>
            </div>
          )}
        </div>

        {/* Bot Card */}
        <div className={`card bot-card ${botChoice ? 'active' : ''}`}>
          <div className="card-inner">
            <span className="card-label">BOT</span>
            <div className="card-emoji-box">
              {botChoice ? (
                getChoiceEmoji(botChoice)
              ) : isBotThinking ? (
                <div className="thinking-bubble">🤖💭</div>
              ) : (
                '🤖'
              )}
            </div>
            {botChoice && <span className="selected-name">{formatChoice(botChoice)}</span>}
          </div>
        </div>
      </main>

      {/* Result Banner */}
      <div className="result-banner-container">
        {result && (
          <div className={`status-banner banner-${result}`}>
            {result === 'win' ? '🎉 G‘ALABA!' : 
             result === 'lose' ? '😢 YUTQAZDINGIZ!' : 
             '🤝 DURANG'}
            {result === 'win' && coins > 0 && (
              <span className="reward-amount">+{coins - (user?.coins || 0)} 🪙</span>
            )}
          </div>
        )}
      </div>

      {/* Choices */}
      <footer className="action-area">
        <div className={`choices-grid ${playerChoice ? 'has-selection' : ''}`}>
          {Object.entries(CHOICES).map(([key, item]) => {
            const isSelected = playerChoice === key;
            return (
              <button
                key={key}
                onClick={() => handlePlay(key)}
                disabled={gameState !== 'playing' || !!playerChoice || coins < 10}
                className={`action-btn ${isSelected ? 'chosen' : ''}`}
                style={{ 
                  backgroundColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.05)',
                  boxShadow: isSelected ? `0 0 20px ${item.color}80` : 'none',
                  borderColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {isSelected && <span className="selection-indicator">✓ SIZ</span>}
                <span className="action-emoji">{item.emoji}</span>
                <span className="action-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </footer>

      <style>{`
        .error-message {
          background: rgba(255,68,68,0.15);
          border: 1px solid #ff4444;
          color: #ff4444;
          padding: 10px 16px;
          border-radius: 12px;
          margin: 8px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }
        .error-message button {
          background: none;
          border: none;
          color: #ff4444;
          font-size: 18px;
          cursor: pointer;
        }
        .warning-message {
          background: rgba(255,170,0,0.15);
          border: 1px solid #ffaa00;
          color: #ffaa00;
          padding: 10px 16px;
          border-radius: 12px;
          margin: 8px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }
        .warning-message button {
          background: rgba(255,170,0,0.2);
          border: 1px solid #ffaa00;
          color: #ffaa00;
          padding: 4px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }
        .loading-spinner {
          font-size: 14px;
          margin-left: 4px;
          animation: spin 1s linear infinite;
        }
        .reward-amount {
          font-size: 16px;
          margin-left: 10px;
          color: #00ff88;
        }
        .score-badge {
          cursor: pointer;
          transition: all 0.3s;
        }
        .score-badge:hover {
          transform: scale(1.05);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default BotGame;