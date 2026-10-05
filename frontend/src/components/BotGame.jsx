// ============================================================
// BotGame.js - TO'LIQ TUZATILGAN + YAXSHI DIZAYN
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../Icon';
import { authHeaders } from '../api';

const CHOICES = {
  rock: { icon: 'rock', color: '#fb7185', label: 'Tosh' },
  paper: { icon: 'paper', color: '#6366f1', label: 'Qog\'oz' },
  scissors: { icon: 'scissors', color: '#fbbf24', label: 'Qaychi' }
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

  const timerRef = useRef(null);
  const roundRef = useRef(null);

  // ======================
  // UPDATE COINS FROM USER
  // ======================
  useEffect(() => {
    if (user?.coins !== undefined) {
      setCoins(user.coins);
    }
  }, [user]);

  // ======================
  // SERVER: vaqt tugadi (-10 tanga)
  // ======================
  const reportTimeout = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bot/timeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.success) {
        setCoins(data.coins);
        if (setUser) setUser(prev => ({ ...prev, coins: data.coins }));
      }
    } catch (error) {
      console.error('❌ Timeout report error:', error);
    }
  }, [API_URL, setUser]);

  // ======================
  // START ROUND
  // ======================
  const startRound = useCallback(() => {
    if (roundRef.current) clearTimeout(roundRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

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
          
          reportTimeout();
          
          showNotif('⏰ Vaqt tugadi! -10 🪙', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [coins, setUser, showNotif, reportTimeout]);

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

    setPlayerChoice(choice);
    triggerHaptic?.('light');

    // Natija va mukofot SERVERDA hisoblanadi (mijozga ishonilmaydi)
    let data = null;
    try {
      const response = await fetch(`${API_URL}/api/bot/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ choice, difficulty })
      });
      data = await response.json();
    } catch (error) {
      console.error('❌ Bot play error:', error);
    }

    if (!data?.success) {
      setPlayerChoice(null);
      showNotif(data?.message || '⚠️ Server bilan aloqa yo\'q', 'error');
      return;
    }

    const roundResult = data.result;
    const finalChange = data.change;
    const comboBonus = data.combo || 0;
    setBotChoice(data.botChoice);
    setCoins(data.coins);
    if (setUser) {
      setUser(prev => ({ ...prev, coins: data.coins }));
    }

    if (roundResult === 'win') {
      setStreak(data.streak);
      setWins(prev => prev + 1);
    } else if (roundResult === 'lose') {
      setStreak(0);
    }
    setRoundsPlayed(prev => prev + 1);

    setResult(roundResult);
    setGameState('result');

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

    if (timerRef.current) clearInterval(timerRef.current);
    if (roundRef.current) clearTimeout(roundRef.current);

    roundRef.current = setTimeout(() => {
      startRound();
    }, 2000);
  }, [
    gameState, playerChoice, coins, API_URL, difficulty, streak,
    setUser, showNotif, triggerHaptic, startRound
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
    };
  }, []);

  // ======================
  // REFRESH COINS
  // ======================
  const refreshCoins = useCallback(async () => {
    if (!user?.tgId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${user.tgId}`, { headers: authHeaders() });
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
  const formatChoice = (key) => CHOICES[key]?.label || key;
  const getChoiceEmoji = (key) => <Icon name={CHOICES[key]?.icon || 'help'} />;

  // ======================
  // RENDER
  // ======================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBackToMenu} style={styles.backBtn}><Icon name="arrowLeft" /></button>
        <div style={styles.headerCenter}>
          <span style={{
            ...styles.difficultyBadge,
            ...(difficulty === 'easy' ? styles.easy : difficulty === 'medium' ? styles.medium : styles.hard)
          }}>
            {difficulty === 'easy' ? '🟢 Oson' : difficulty === 'medium' ? '🟡 O\'rta' : '🔴 Qiyin'}
          </span>
          {streak >= 2 && <span style={styles.combo}><Icon name="flame" /> x{streak}</span>}
        </div>
        <div style={styles.coins} onClick={refreshCoins}>
          <span><Icon name="coin" /></span>
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
          <span style={styles.statValue} >{wins}</span>
          <span style={styles.statLabel}>G'alaba</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={styles.statValue} >{roundsPlayed - wins}</span>
          <span style={styles.statLabel}>Mag'lubiyat</span>
        </div>
      </div>

      {/* Coins Warning */}
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
              {playerChoice ? getChoiceEmoji(playerChoice) : <Icon name="user" />}
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
                <span style={styles.thinking}><Icon name="bot" /></span>
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
                {isSelected && <span style={styles.choiceSelectedBadge}><Icon name="check" /></span>}
                <span style={styles.choiceEmoji}><Icon name={item.icon} /></span>
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
    minHeight: '70vh',
    background: 'linear-gradient(180deg, rgba(15,12,41,0.78) 0%, rgba(48,43,99,0.55) 50%, rgba(36,36,62,0.78) 100%)',
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
    color: 'var(--ink)',
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
    color: 'var(--win)',
    border: '1px solid rgba(0,255,136,0.2)'
  },
  medium: {
    background: 'rgba(255,170,0,0.15)',
    color: 'var(--gold)',
    border: '1px solid rgba(255,170,0,0.2)'
  },
  hard: {
    background: 'rgba(255,68,68,0.15)',
    color: 'var(--lose)',
    border: '1px solid rgba(255,68,68,0.2)'
  },
  combo: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--lose)',
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
    color: 'var(--win)'
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
    marginBottom: '8px',
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
    color: 'var(--ink)'
  },
  statLabel: {
    fontSize: '9px',
    color: '#6b6b78',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statDivider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255,255,255,0.06)'
  },

  // Warning
  warning: {
    background: 'rgba(255,170,0,0.1)',
    border: '1px solid rgba(255,170,0,0.2)',
    color: 'var(--gold)',
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
    color: 'var(--gold)',
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
    background: 'linear-gradient(90deg, var(--ac), var(--ac-2))',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  },
  progressCritical: {
    background: 'linear-gradient(90deg, var(--lose), var(--lose))',
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
    borderColor: 'var(--ac)',
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
    color: '#6b6b78',
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
    color: 'var(--ink)',
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
    background: 'linear-gradient(135deg, var(--ac), var(--ac-2))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    color: 'var(--ink)',
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
    color: 'var(--win)',
    fontVariantNumeric: 'tabular-nums'
  },
  timerCritical: {
    color: 'var(--lose)',
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
    color: 'var(--win)'
  },
  resultLose: {
    background: 'rgba(255,68,68,0.1)',
    border: '1px solid rgba(255,68,68,0.2)',
    color: 'var(--lose)'
  },
  resultDraw: {
    background: 'rgba(255,170,0,0.1)',
    border: '1px solid rgba(255,170,0,0.2)',
    color: 'var(--gold)'
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
    color: 'var(--ink)',
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
    background: 'var(--win)',
    color: 'var(--bg)',
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
    color: '#6b6b78'
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
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .duel-chat-message {
    animation: slideUp 0.2s ease-out;
  }
`;
document.head.appendChild(styleSheet);

export default BotGame;