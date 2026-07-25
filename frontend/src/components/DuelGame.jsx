// ============================================================
// BotGame.js - TO'LIQ TUZATILGAN VERSION
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import'./DuelGame.css'

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
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);
  const [totalCoinsWon, setTotalCoinsWon] = useState(0);
  const [totalCoinsLost, setTotalCoinsLost] = useState(0);

  const timerRef = useRef(null);
  const roundRef = useRef(null);
  const playerHistory = useRef([]);
  const isUpdatingRef = useRef(false);

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
    if (!user?.tgId) return false;
    if (isUpdatingRef.current) return false;

    isUpdatingRef.current = true;
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
    } finally {
      isUpdatingRef.current = false;
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
    
    if (difficulty === 'easy') {
      if (Math.random() < 0.6 && playerChoice) {
        const counter = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
        return counter[playerChoice];
      }
    }
    
    if (difficulty === 'hard') {
      const predicted = predictPlayerChoice() || (playerChoice || 'rock');
      if (Math.random() < 0.7) {
        const counter = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
        return counter[predicted];
      }
    }
    
    if (difficulty === 'medium' && Math.random() < 0.5 && playerChoice) {
      const counter = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
      return counter[playerChoice];
    }
    
    return options[Math.floor(Math.random() * options.length)];
  }, [difficulty, playerChoice, predictPlayerChoice]);

  // ======================
  // GAME LOGIC
  // ======================
  const determineWinner = useCallback((player, bot) => {
    if (player === bot) return 'draw';
    const winConditions = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    return winConditions[player] === bot ? 'win' : 'lose';
  }, []);

  // ======================
  // START ROUND
  // ======================
  const startRound = useCallback(() => {
    if (roundRef.current) clearTimeout(roundRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // Check coins
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

    const thinkDelay = 600 + Math.random() * 500;
    roundRef.current = setTimeout(() => {
      setIsBotThinking(false);
    }, thinkDelay);

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setGameState('result');
          setResult('lose');
          setStreak(0);
          
          // Loss penalty - 10 tanga
          const lossAmount = 10;
          const newCoins = Math.max(0, coins - lossAmount);
          setCoins(newCoins);
          setLosses(prev => prev + 1);
          setTotalCoinsLost(prev => prev + lossAmount);
          
          if (setUser) {
            setUser(prev => ({ ...prev, coins: newCoins }));
          }
          updateCoinsOnServer(newCoins);
          
          showNotif(`⏰ Vaqt tugadi! -${lossAmount} 🪙`, 'error');
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
    
    // Update stats
    setRoundsPlayed(prev => prev + 1);
    if (roundResult === 'win') {
      setStreak(prev => prev + 1);
      setWins(prev => prev + 1);
      setTotalCoinsWon(prev => prev + finalChange);
    } else if (roundResult === 'lose') {
      setStreak(0);
      setLosses(prev => prev + 1);
      setTotalCoinsLost(prev => prev + Math.abs(finalChange));
    } else {
      setDraws(prev => prev + 1);
      setStreak(0);
    }

    // Update coins on server
    await updateCoinsOnServer(newCoins);

    // Show result
    setResult(roundResult);
    setGameState('result');

    // Haptic feedback and notification
    if (roundResult === 'win') {
      triggerHaptic?.('heavy');
      showNotif(`🎉 G'alaba! +${finalChange} 🪙 ${comboBonus > 0 ? `🔥 x${streak + 1}` : ''}`, 'success');
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
    }, 2000);
  }, [
    gameState, playerChoice, coins, getBotChoice, determineWinner, 
    difficulty, streak, setUser, showNotif, triggerHaptic, 
    startRound, updateCoinsOnServer
  ]);

  // ======================
  // INITIALIZATION
  // ======================
  useEffect(() => {
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
  }, []);

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
        showNotif(`✅ Tangalar yangilandi: ${newCoins} 🪙`, 'success');
      }
    } catch (error) {
      console.error('❌ Refresh coins error:', error);
      showNotif('⚠️ Tangalarni yangilashda xatolik', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, API_URL, setUser, showNotif]);

  // ======================
  // FORMAT FUNCTIONS
  // ======================
  const formatChoice = (key) => CHOICES[key]?.label || key;
  const getChoiceEmoji = (key) => CHOICES[key]?.emoji || '❓';

  // ======================
  // RENDER
  // ======================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBackToMenu} style={styles.backBtn}>←</button>
        <div style={styles.headerCenter}>
          <span style={{
            ...styles.difficultyBadge,
            ...(difficulty === 'easy' ? styles.easy : difficulty === 'medium' ? styles.medium : styles.hard)
          }}>
            {difficulty === 'easy' ? '🟢 Oson' : difficulty === 'medium' ? '🟡 O\'rta' : '🔴 Qiyin'}
          </span>
          {streak >= 2 && <span style={styles.combo}>🔥 x{streak}</span>}
        </div>
        <div style={styles.coins} onClick={refreshCoins}>
          <span>🪙</span>
          <span style={styles.coinsCount}>{coins}</span>
          {isLoading && <span style={styles.loading}>⏳</span>}
        </div>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{roundsPlayed}</span>
          <span style={styles.statLabel}>O'yin</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#00ff88' }}>{wins}</span>
          <span style={styles.statLabel}>G'alaba</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#ff6b6b' }}>{losses}</span>
          <span style={styles.statLabel}>Mag'lubiyat</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#ffaa00' }}>{draws}</span>
          <span style={styles.statLabel}>Durang</span>
        </div>
      </div>

      {/* Coins Summary */}
      <div style={styles.coinsSummary}>
        <span style={styles.coinsSummaryWin}>+{totalCoinsWon} 🪙</span>
        <span style={styles.coinsSummaryLoss}>-{totalCoinsLost} 🪙</span>
        <span style={styles.coinsSummaryTotal}>
          Jami: {coins} 🪙
        </span>
      </div>

      {/* Warning */}
      {coins < 10 && gameState !== 'idle' && (
        <div style={styles.warning}>
          ⚠️ Tanga yetarli emas! 10 tanga kerak
          <button onClick={refreshCoins} style={styles.warningBtn}>Yangilash</button>
        </div>
      )}

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={{
          ...styles.progressBar,
          width: `${(timer / 30) * 100}%`,
          ...(timer <= 5 ? styles.progressCritical : {})
        }} />
      </div>

      {/* Arena */}
      <div style={styles.arena}>
        <div style={{
          ...styles.arenaGlow,
          ...(result === 'win' ? styles.glowWin : result === 'lose' ? styles.glowLose : result === 'draw' ? styles.glowDraw : {})
        }} />
        
        {/* Player */}
        <div style={{
          ...styles.card,
          ...(playerChoice ? styles.cardActive : {})
        }}>
          <div style={styles.cardInner}>
            <span style={styles.cardLabel}>SIZ</span>
            <div style={styles.cardEmoji}>
              {playerChoice ? getChoiceEmoji(playerChoice) : '👤'}
            </div>
            {playerChoice && <span style={styles.cardName}>{formatChoice(playerChoice)}</span>}
          </div>
        </div>

        {/* VS */}
        <div style={styles.vsCenter}>
          <div style={styles.vsCircle}>VS</div>
          {gameState === 'playing' && (
            <div style={styles.timerBox}>
              <span style={{
                ...styles.timerText,
                ...(timer <= 5 ? styles.timerCritical : {})
              }}>{timer}</span>
            </div>
          )}
        </div>

        {/* Bot */}
        <div style={{
          ...styles.card,
          ...(botChoice ? styles.cardActive : {})
        }}>
          <div style={styles.cardInner}>
            <span style={styles.cardLabel}>BOT</span>
            <div style={styles.cardEmoji}>
              {botChoice ? (
                getChoiceEmoji(botChoice)
              ) : isBotThinking ? (
                <span style={styles.thinking}>🤖💭</span>
              ) : (
                '🤖'
              )}
            </div>
            {botChoice && <span style={styles.cardName}>{formatChoice(botChoice)}</span>}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          ...styles.resultBanner,
          ...(result === 'win' ? styles.resultWin : result === 'lose' ? styles.resultLose : styles.resultDraw)
        }}>
          {result === 'win' ? '🎉 G\'ALABA!' : result === 'lose' ? '😢 YUTQAZDINGIZ!' : '🤝 DURANG'}
        </div>
      )}

      {/* Choices */}
      <div style={styles.choicesContainer}>
        <div style={{
          ...styles.choicesGrid,
          ...(playerChoice ? styles.choicesDisabled : {})
        }}>
          {Object.entries(CHOICES).map(([key, item]) => {
            const isSelected = playerChoice === key;
            return (
              <button
                key={key}
                onClick={() => handlePlay(key)}
                disabled={gameState !== 'playing' || !!playerChoice || coins < 10}
                style={{
                  ...styles.choiceBtn,
                  ...(isSelected ? {
                    ...styles.choiceSelected,
                    backgroundColor: item.color + '33',
                    borderColor: item.color,
                    boxShadow: `0 0 20px ${item.color}40`
                  } : {}),
                  ...(gameState !== 'playing' || !!playerChoice || coins < 10 ? styles.choiceDisabled : {})
                }}
              >
                {isSelected && <span style={styles.choiceSelectedBadge}>✓</span>}
                <span style={styles.choiceEmoji}>{item.emoji}</span>
                <span style={styles.choiceLabel}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = {
  container: {
    maxWidth: '400px',
    margin: '0 auto',
    padding: '12px 16px',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    marginBottom: '8px'
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '18px',
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s'
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  difficultyBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.3px'
  },
  easy: {
    background: 'rgba(0,255,136,0.15)',
    color: '#00ff88',
    border: '1px solid rgba(0,255,136,0.2)'
  },
  medium: {
    background: 'rgba(255,170,0,0.15)',
    color: '#ffaa00',
    border: '1px solid rgba(255,170,0,0.2)'
  },
  hard: {
    background: 'rgba(255,68,68,0.15)',
    color: '#ff4444',
    border: '1px solid rgba(255,68,68,0.2)'
  },
  combo: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ff6b6b',
    animation: 'pulse 0.6s ease-in-out infinite'
  },
  coins: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  coinsCount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#00ff88'
  },
  loading: {
    fontSize: '12px',
    animation: 'spin 1s linear infinite'
  },

  // Stats
  stats: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    padding: '8px 16px',
    marginBottom: '6px',
    border: '1px solid rgba(255,255,255,0.04)'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff'
  },
  statLabel: {
    fontSize: '9px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statDivider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255,255,255,0.06)'
  },

  // Coins Summary
  coinsSummary: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '4px 0',
    marginBottom: '4px',
    fontSize: '12px',
    fontWeight: '600'
  },
  coinsSummaryWin: {
    color: '#00ff88'
  },
  coinsSummaryLoss: {
    color: '#ff6b6b'
  },
  coinsSummaryTotal: {
    color: '#fff',
    padding: '2px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px'
  },

  // Warning
  warning: {
    background: 'rgba(255,170,0,0.1)',
    border: '1px solid rgba(255,170,0,0.2)',
    color: '#ffaa00',
    padding: '8px 12px',
    borderRadius: '10px',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  warningBtn: {
    background: 'rgba(255,170,0,0.15)',
    border: '1px solid rgba(255,170,0,0.2)',
    color: '#ffaa00',
    padding: '2px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '11px'
  },

  // Progress
  progressContainer: {
    width: '100%',
    height: '3px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '12px'
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  },
  progressCritical: {
    background: 'linear-gradient(90deg, #ff4444, #ff6b6b)',
    animation: 'pulse 0.5s ease-in-out infinite'
  },

  // Arena
  arena: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    position: 'relative',
    minHeight: '200px'
  },
  arenaGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(102,126,234,0.08), transparent)',
    transition: 'all 0.5s ease',
    pointerEvents: 'none'
  },
  glowWin: {
    background: 'radial-gradient(circle, rgba(0,255,136,0.2), transparent)'
  },
  glowLose: {
    background: 'radial-gradient(circle, rgba(255,68,68,0.2), transparent)'
  },
  glowDraw: {
    background: 'radial-gradient(circle, rgba(255,170,0,0.15), transparent)'
  },

  // Cards
  card: {
    flex: 1,
    maxWidth: '100px',
    minHeight: '110px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '2px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.5s ease',
    padding: '12px 8px'
  },
  cardActive: {
    borderColor: '#667eea',
    background: 'rgba(102,126,234,0.08)',
    boxShadow: '0 0 30px rgba(102,126,234,0.06)'
  },
  cardInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '100%'
  },
  cardLabel: {
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#666',
    fontWeight: '600'
  },
  cardEmoji: {
    fontSize: '38px',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardName: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#fff',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 10px',
    borderRadius: '6px'
  },
  thinking: {
    fontSize: '22px',
    animation: 'float 1s ease-in-out infinite'
  },

  // VS
  vsCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
    padding: '0 8px'
  },
  vsCircle: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    color: '#fff',
    boxShadow: '0 0 20px rgba(102,126,234,0.2)'
  },
  timerBox: {
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.04)'
  },
  timerText: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#00ff88',
    fontVariantNumeric: 'tabular-nums'
  },
  timerCritical: {
    color: '#ff4444',
    animation: 'pulse 0.5s ease-in-out infinite'
  },

  // Result
  resultBanner: {
    padding: '8px 16px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    textAlign: 'center',
    margin: '4px 0 8px'
  },
  resultWin: {
    background: 'rgba(0,255,136,0.1)',
    border: '1px solid rgba(0,255,136,0.2)',
    color: '#00ff88'
  },
  resultLose: {
    background: 'rgba(255,68,68,0.1)',
    border: '1px solid rgba(255,68,68,0.2)',
    color: '#ff4444'
  },
  resultDraw: {
    background: 'rgba(255,170,0,0.1)',
    border: '1px solid rgba(255,170,0,0.2)',
    color: '#ffaa00'
  },

  // Choices
  choicesContainer: {
    padding: '4px 0'
  },
  choicesGrid: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center'
  },
  choicesDisabled: {
    opacity: '0.5'
  },
  choiceBtn: {
    flex: 1,
    maxWidth: '90px',
    padding: '10px 6px',
    borderRadius: '14px',
    border: '2px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    position: 'relative',
    minHeight: '64px'
  },
  choiceSelected: {
    transform: 'scale(1.04)'
  },
  choiceDisabled: {
    opacity: '0.3',
    cursor: 'not-allowed'
  },
  choiceSelectedBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#00ff88',
    color: '#0f0c29',
    fontSize: '8px',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '8px'
  },
  choiceEmoji: {
    fontSize: '22px'
  },
  choiceLabel: {
    fontSize: '10px',
    fontWeight: '500',
    color: '#666'
  }
};

// CSS Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.05); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default BotGame;