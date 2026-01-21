import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// Components
import GameBoard from '../components/game/GameBoard';
import BotDifficulty from '../components/bot/BotDifficulty';
import GameStats from '../components/game/GameStats';
import AchievementPopup from '../components/game/AchievementPopup';

// Icons
import {
  FaRobot,
  FaChartLine,
  FaUndo,
  FaHome,
  FaTrophy,
  FaBolt
} from 'react-icons/fa';

const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
};

const BOT_DIFFICULTIES = {
  easy: {
    name: 'Oson',
    description: 'Bot harakatlarni taxmin qilish qiyin',
    winRate: 0.3,
    reactionTime: 1500
  },
  medium: {
    name: 'O\'rta',
    description: 'Muvozanatli raqib',
    winRate: 0.5,
    reactionTime: 1000
  },
  hard: {
    name: 'Qiyin',
    description: 'Tajribali o\'yinchi',
    winRate: 0.7,
    reactionTime: 500
  },
  impossible: {
    name: 'Mumkin emas',
    description: 'Har doim oldindan biladi',
    winRate: 0.9,
    reactionTime: 250
  }
};

const BotGamePage = () => {
  const navigate = useNavigate();
  
  const [difficulty, setDifficulty] = useState('medium');
  const [playerChoice, setPlayerChoice] = useState(null);
  const [botChoice, setBotChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState({ player: 0, bot: 0, draws: 0 });
  const [gameHistory, setGameHistory] = useState([]);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [achievements, setAchievements] = useState([]);
  
  // Initialize game
  useEffect(() => {
    const savedStats = localStorage.getItem('botGameStats');
    if (savedStats) {
      setScore(JSON.parse(savedStats));
    }
    
    const savedHistory = localStorage.getItem('botGameHistory');
    if (savedHistory) {
      setGameHistory(JSON.parse(savedHistory).slice(0, 10));
    }
    
    const savedDifficulty = localStorage.getItem('botDifficulty') || 'medium';
    setDifficulty(savedDifficulty);
  }, []);
  
  // Save stats
  useEffect(() => {
    localStorage.setItem('botGameStats', JSON.stringify(score));
    localStorage.setItem('botGameHistory', JSON.stringify(gameHistory.slice(0, 50)));
    localStorage.setItem('botDifficulty', difficulty);
  }, [score, gameHistory, difficulty]);
  
  // Determine winner
  const determineWinner = (player, bot) => {
    if (player === bot) return 'draw';
    
    if (
      (player === 'rock' && bot === 'scissors') ||
      (player === 'paper' && bot === 'rock') ||
      (player === 'scissors' && bot === 'paper')
    ) {
      return 'player';
    }
    
    return 'bot';
  };
  
  // Bot makes choice
  const makeBotChoice = () => {
    const choices = Object.keys(CHOICES);
    
    // For impossible difficulty, counter player's choice
    if (difficulty === 'impossible' && playerChoice) {
      // Always choose winning move
      switch (playerChoice) {
        case 'rock': return 'paper';
        case 'paper': return 'scissors';
        case 'scissors': return 'rock';
      }
    }
    
    // For other difficulties, use weighted random
    const difficultyConfig = BOT_DIFFICULTIES[difficulty];
    const random = Math.random();
    
    if (random < difficultyConfig.winRate) {
      // Bot tries to win or draw
      if (playerChoice) {
        const randomChoice = Math.random();
        if (randomChoice < 0.7) {
          // 70% chance to counter
          switch (playerChoice) {
            case 'rock': return 'paper';
            case 'paper': return 'scissors';
            case 'scissors': return 'rock';
          }
        } else {
          // 30% chance to draw
          return playerChoice;
        }
      }
    }
    
    // Random choice
    return choices[Math.floor(Math.random() * choices.length)];
  };
  
  // Handle player choice
  const handlePlayerChoice = (choice) => {
    if (isBotThinking || result) return;
    
    setPlayerChoice(choice);
    setIsBotThinking(true);
    
    // Bot thinking delay
    setTimeout(() => {
      const botChoice = makeBotChoice();
      setBotChoice(botChoice);
      
      const winner = determineWinner(choice, botChoice);
      setResult(winner);
      
      // Update score
      setScore(prev => {
        const newScore = { ...prev };
        if (winner === 'player') newScore.player++;
        else if (winner === 'bot') newScore.bot++;
        else newScore.draws++;
        return newScore;
      });
      
      // Add to history
      const gameRecord = {
        id: Date.now(),
        playerChoice: choice,
        botChoice,
        result: winner,
        difficulty,
        timestamp: new Date().toISOString()
      };
      
      setGameHistory(prev => [gameRecord, ...prev]);
      
      // Check for achievements
      checkAchievements(winner);
      
      setIsBotThinking(false);
    }, BOT_DIFFICULTIES[difficulty].reactionTime);
  };
  
  // Check achievements
  const checkAchievements = (winner) => {
    const newAchievements = [];
    
    // First win
    if (score.player === 0 && winner === 'player') {
      newAchievements.push({
        id: 'first_win',
        title: 'Birinchi G‘alaba',
        description: 'Botga qarshi birinchi g‘alabangiz',
        icon: '🏆',
        coins: 100
      });
    }
    
    // Win streak
    if (gameHistory.length >= 3) {
      const lastThree = gameHistory.slice(0, 3);
      if (lastThree.every(game => game.result === 'player')) {
        newAchievements.push({
          id: 'win_streak_3',
          title: '3 G‘alaba Ketma-ket',
          description: 'Botga qarshi 3 marta ketma-ket g‘alaba',
          icon: '🔥',
          coins: 250
        });
      }
    }
    
    // Add achievements
    if (newAchievements.length > 0) {
      setAchievements(prev => [...newAchievements, ...prev]);
      
      // Update coins
      const totalCoins = newAchievements.reduce((sum, ach) => sum + ach.coins, 0);
      const currentCoins = parseInt(localStorage.getItem('coins') || '1500');
      localStorage.setItem('coins', (currentCoins + totalCoins).toString());
      
      // Show toast
      newAchievements.forEach(ach => {
        toast.success(
          <div>
            <div style={{ fontSize: '1.2em', marginBottom: '4px' }}>
              {ach.icon} {ach.title}
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.8 }}>
              {ach.description}
            </div>
          </div>,
          { duration: 5000 }
        );
      });
    }
  };
  
  // Next round
  const handleNextRound = () => {
    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
    setRound(prev => prev + 1);
  };
  
  // New game
  const handleNewGame = () => {
    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
    setRound(1);
  };
  
  // Change difficulty
  const handleChangeDifficulty = (newDifficulty) => {
    setDifficulty(newDifficulty);
    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
    setRound(1);
    toast.success(`Qiyinlik darajasi: ${BOT_DIFFICULTIES[newDifficulty].name}`);
  };
  
  // Render result message
  const renderResult = () => {
    if (!result) return null;
    
    const messages = {
      player: {
        title: '🎉 Tabriklaymiz!',
        message: 'Siz yutdingiz!',
        color: 'var(--success-color)'
      },
      bot: {
        title: '😔 Mag‘lubiyat',
        message: 'Bot yutdi',
        color: 'var(--danger-color)'
      },
      draw: {
        title: '🤝 Durang',
        message: 'Hech kim yutmadi',
        color: 'var(--warning-color)'
      }
    };
    
    const current = messages[result];
    
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="result-popup"
        style={{ borderColor: current.color }}
      >
        <h3 style={{ color: current.color }}>{current.title}</h3>
        <p>{current.message}</p>
        <div className="result-choices">
          <div className="choice-display">
            <span>Siz: {CHOICES[playerChoice]?.emoji}</span>
          </div>
          <div className="vs">VS</div>
          <div className="choice-display">
            <span>Bot: {CHOICES[botChoice]?.emoji}</span>
          </div>
        </div>
        
        <div className="result-actions">
          <button className="btn-primary" onClick={handleNextRound}>
            Keyingi raund
          </button>
          <button className="btn-secondary" onClick={handleNewGame}>
            Yangi o'yin
          </button>
        </div>
      </motion.div>
    );
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bot-game-page"
    >
      <div className="page-header">
        <button 
          className="btn-back"
          onClick={() => navigate('/')}
        >
          <FaHome /> Ortga
        </button>
        
        <div className="game-title">
          <FaRobot />
          <h1>Bot bilan o'ynash</h1>
        </div>
        
        <div className="game-info">
          <span className="round-counter">
            Raund: {round}
          </span>
        </div>
      </div>
      
      <div className="bot-game-container">
        <div className="left-panel">
          <GameStats
            playerScore={score.player}
            botScore={score.bot}
            draws={score.draws}
            totalGames={score.player + score.bot + score.draws}
            winRate={score.player + score.bot > 0 
              ? Math.round((score.player / (score.player + score.bot)) * 100) 
              : 0}
          />
          
          <BotDifficulty
            current={difficulty}
            difficulties={BOT_DIFFICULTIES}
            onChange={handleChangeDifficulty}
          />
          
          <div className="game-history">
            <h3><FaChartLine /> Oxirgi o'yinlar</h3>
            <div className="history-list">
              {gameHistory.slice(0, 5).map((game, index) => (
                <div key={game.id} className="history-item">
                  <div className="game-result">
                    <span className={`result-dot ${game.result}`} />
                    <span>{game.result === 'player' ? 'G' : game.result === 'bot' ? 'M' : 'D'}</span>
                  </div>
                  <div className="game-choices">
                    <span>{CHOICES[game.playerChoice]?.emoji}</span>
                    <span className="vs-small">vs</span>
                    <span>{CHOICES[game.botChoice]?.emoji}</span>
                  </div>
                  <div className="game-difficulty">
                    {BOT_DIFFICULTIES[game.difficulty]?.name.slice(0, 1)}
                  </div>
                </div>
              ))}
              
              {gameHistory.length === 0 && (
                <div className="empty-history">
                  <p>Hozircha o'yinlar yo'q</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="game-area">
          <div className="bot-info">
            <div className="bot-avatar">
              <FaRobot size={48} />
            </div>
            <div className="bot-details">
              <h2>Bot: {BOT_DIFFICULTIES[difficulty].name}</h2>
              <p>{BOT_DIFFICULTIES[difficulty].description}</p>
            </div>
          </div>
          
          <div className="game-board-section">
            {isBotThinking && (
              <div className="bot-thinking">
                <div className="thinking-text">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </div>
                <p>Bot o'ylayapti</p>
              </div>
            )}
            
            <GameBoard
              choices={CHOICES}
              selectedChoice={playerChoice}
              onSelect={handlePlayerChoice}
              disabled={isBotThinking || result !== null}
              opponentChoice={botChoice}
              showOpponentChoice={result !== null}
            />
            
            {result && renderResult()}
          </div>
        </div>
        
        <div className="right-panel">
          <div className="achievements-panel">
            <h3><FaTrophy /> Yutuqlar</h3>
            <div className="achievements-list">
              {achievements.slice(0, 5).map(ach => (
                <div key={ach.id} className="achievement-item">
                  <div className="achievement-icon">{ach.icon}</div>
                  <div className="achievement-details">
                    <div className="achievement-title">{ach.title}</div>
                    <div className="achievement-desc">{ach.description}</div>
                  </div>
                </div>
              ))}
              
              {achievements.length === 0 && (
                <div className="empty-achievements">
                  <p>Hozircha yutuqlar yo'q</p>
                  <small>Botni yengib yutuqlarni oching!</small>
                </div>
              )}
            </div>
          </div>
          
          <div className="quick-actions">
            <button 
              className="btn-secondary"
              onClick={handleNewGame}
              disabled={isBotThinking}
            >
              <FaUndo /> Yangi o'yin
            </button>
            
            <button 
              className="btn-outline"
              onClick={() => navigate('/play')}
            >
              <FaBolt /> Multiplayer
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BotGamePage;