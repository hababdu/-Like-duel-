import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // ✅ 1. ASOSIY STATE'LAR
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('telegram_game_user');
    return savedUser ? JSON.parse(savedUser) : {
      id: Date.now(),
      first_name: 'Foydalanuvchi',
      username: 'user_' + Date.now().toString().slice(-6),
      language_code: 'uz'
    };
  });
  
  const [userPhoto, setUserPhoto] = useState(localStorage.getItem('telegram_game_photo') || null);
  const [gameState, setGameState] = useState({
    status: 'idle',
    opponent: null,
    opponentPhoto: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60,
    gameId: null,
    roomCode: null,
    playersInRoom: 0
  });
  
  const [userCoins, setUserCoins] = useState(() => {
    const savedCoins = localStorage.getItem('telegram_game_coins');
    return savedCoins ? parseInt(savedCoins) : 1500;
  });
  
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [dailyStatus, setDailyStatus] = useState(() => {
    const savedDaily = localStorage.getItem('telegram_game_daily');
    return savedDaily ? JSON.parse(savedDaily) : { 
      available: true, 
      streak: 1, 
      nextIn: 0,
      lastClaim: null 
    };
  });
  
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(true);
  
  const [userStats, setUserStats] = useState(() => {
    const savedStats = localStorage.getItem('telegram_game_stats');
    return savedStats ? JSON.parse(savedStats) : {
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      winRate: 0,
      maxWinStreak: 0,
      totalCoinsEarned: 1500,
      botGamesWon: 0,
      botGamesPlayed: 0
    };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // ✅ BOT REJIMI STATE'LARI
  const [botGameMode, setBotGameMode] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState('medium');
  const [botHistory, setBotHistory] = useState([]);
  const [botName, setBotName] = useState('');
  const [botLevel, setBotLevel] = useState(1);
  const [botAICounter, setBotAICounter] = useState(1);
  const [botPracticeMode, setBotPracticeMode] = useState(false);
  const [botStreak, setBotStreak] = useState(0);
  const [currentWinStreak, setCurrentWinStreak] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  
  const timerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const isInitialized = useRef(false);
  const botDecisionTimeoutRef = useRef(null);

  // ✅ 2. DASTLABKI SOZLASH
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initApp = async () => {
      setIsLoading(true);
      
      try {
        // Telegram WebApp tekshirish
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.ready();
          tg.expand();
          
          const userData = tg.initDataUnsafe?.user;
          if (userData && userData.id) {
            const newUser = {
              id: userData.id || Date.now(),
              first_name: userData.first_name || 'Foydalanuvchi',
              username: userData.username || `user_${Date.now()}`,
              language_code: userData.language_code || 'uz',
              photo_url: userData.photo_url || null
            };
            setUser(newUser);
            if (userData.photo_url) setUserPhoto(userData.photo_url);
          }
        }
        
        // Bot tarixini yuklash
        try {
          const savedBotHistory = localStorage.getItem('telegram_game_bot_history');
          if (savedBotHistory) {
            const parsed = JSON.parse(savedBotHistory);
            if (Array.isArray(parsed)) setBotHistory(parsed);
          }
        } catch (e) {}
        
      } catch (error) {
        console.error('Init xatosi:', error);
      } finally {
        setIsLoading(false);
        showNotification('🎮 Bot bilan o\'ynash uchun darajani tanlang!', 'success');
      }
    };

    initApp();

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      if (botDecisionTimeoutRef.current) clearTimeout(botDecisionTimeoutRef.current);
    };
  }, []);

  // ✅ 3. LOCALSTORAGE DA YANGILASH
  useEffect(() => {
    localStorage.setItem('telegram_game_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('telegram_game_coins', userCoins.toString());
  }, [userCoins]);

  useEffect(() => {
    localStorage.setItem('telegram_game_stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    localStorage.setItem('telegram_game_daily', JSON.stringify(dailyStatus));
  }, [dailyStatus]);

  useEffect(() => {
    localStorage.setItem('telegram_game_bot_history', JSON.stringify(botHistory));
  }, [botHistory]);

  // ✅ 4. BOT O'YINI BOSHLASH
  const startBotGame = (difficulty = 'medium') => {
    if (!user) {
      showNotification('❌ Foydalanuvchi mavjud emas', 'error');
      return;
    }
    
    // Bot nomi va darajasini tanlash
    const botNames = {
      easy: ['Yangi Bot', 'Oson Bot', 'Boshlang\'ich'],
      medium: ['Oʻrta Bot', 'Pro Bot', 'Murabbiy'],
      hard: ['Qiyin Bot', 'Master Bot', 'AI Master']
    };
    
    const selectedNames = botNames[difficulty] || botNames.medium;
    const randomBotName = selectedNames[Math.floor(Math.random() * selectedNames.length)];
    const botLevel = difficulty === 'easy' ? Math.floor(Math.random() * 3) + 1 :
                    difficulty === 'medium' ? Math.floor(Math.random() * 3) + 4 :
                    Math.floor(Math.random() * 3) + 7;
    
    setBotName(randomBotName);
    setBotLevel(botLevel);
    setBotDifficulty(difficulty);
    setBotGameMode(true);
    setShowBotMenu(false);
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (botDecisionTimeoutRef.current) {
      clearTimeout(botDecisionTimeoutRef.current);
      botDecisionTimeoutRef.current = null;
    }
    
    // Bot obyekti yaratish
    const bot = {
      id: 999999 + Math.floor(Math.random() * 1000),
      firstName: randomBotName,
      username: `bot_${difficulty}`,
      isBot: true,
      winRate: difficulty === 'easy' ? Math.floor(Math.random() * 20) + 30 :
               difficulty === 'medium' ? Math.floor(Math.random() * 20) + 50 :
               Math.floor(Math.random() * 20) + 70,
      level: botLevel,
      difficulty: difficulty
    };
    
    // O'yin holatini yangilash
    setGameState({
      status: 'playing',
      opponent: bot,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: `bot_game_${Date.now()}`,
      roomCode: null,
      playersInRoom: 0
    });
    
    setGameResult(null);
    setCoinsEarned(0);
    
    showNotification(`🤖 ${randomBotName} bilan o'ynaysiz!`, 'info');
    
    // O'yin taymerini boshlash
    startGameTimer();
  };

  // ✅ 5. O'YIN TAYMERI
  const startGameTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.status !== 'playing') {
          clearInterval(timerRef.current);
          return prev;
        }
        
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          finishGameWithTimeout();
          return { ...prev, timer: 0 };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

  // ✅ 6. FOYDALANUVCHI TANLOVI
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing' || gameState.myChoice) {
      return;
    }
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      } catch (e) {}
    }
    
    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));
    
    showNotification(`✅ ${getChoiceName(choice)} tanlandi`, 'info');
    
    // Bot tanlov qilish
    setTimeout(() => {
      makeBotChoice(choice);
    }, 500);
  };

  // ✅ 7. BOT TANLOVI
  const makeBotChoice = (playerChoice) => {
    if (gameState.status !== 'playing' || gameState.opponentChoice) {
      return;
    }
    
    let botChoice;
    
    // Bot darajasiga qarab tanlov
    switch (botDifficulty) {
      case 'easy':
        botChoice = getEasyBotChoice();
        break;
      case 'medium':
        botChoice = getMediumBotChoice(playerChoice);
        break;
      case 'hard':
        botChoice = getHardBotChoice(playerChoice);
        break;
      default:
        botChoice = getRandomChoice();
    }
    
    setGameState(prev => ({
      ...prev,
      opponentChoice: botChoice
    }));
    
    // 1 soniyadan keyin natijani hisoblash
    setTimeout(() => {
      calculateResult(gameState.myChoice, botChoice);
    }, 1000);
  };

  // ✅ 8. OSON BOT TANLOVI
  const getEasyBotChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * choices.length)];
  };

  // ✅ 9. O'RTA BOT TANLOVI
  const getMediumBotChoice = (playerChoice) => {
    const choices = ['rock', 'paper', 'scissors'];
    
    // 60% ehtimollik bilan foydalanuvchi tanloviga qarshi tanlaydi
    if (Math.random() < 0.6 && playerChoice) {
      const counterMap = {
        'rock': 'paper',
        'paper': 'scissors',
        'scissors': 'rock'
      };
      return counterMap[playerChoice] || getRandomChoice();
    }
    
    return choices[Math.floor(Math.random() * choices.length)];
  };

  // ✅ 10. QIYIN BOT TANLOVI
  const getHardBotChoice = (playerChoice) => {
    const choices = ['rock', 'paper', 'scissors'];
    
    // 80% ehtimollik bilan foydalanuvchi tanloviga qarshi tanlaydi
    if (Math.random() < 0.8 && playerChoice) {
      const counterMap = {
        'rock': 'paper',
        'paper': 'scissors',
        'scissors': 'rock'
      };
      return counterMap[playerChoice] || getRandomChoice();
    }
    
    return choices[Math.floor(Math.random() * choices.length)];
  };

  // ✅ 11. RANDOM TANLOV
  const getRandomChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * choices.length)];
  };

  // ✅ 12. NATIJANI HISOBLASH
  const calculateResult = (playerChoice, opponentChoice) => {
    if (!playerChoice || !opponentChoice) return;
    
    console.log('Hisoblash:', playerChoice, opponentChoice);
    
    const rules = {
      rock: { beats: 'scissors', loses: 'paper' },
      paper: { beats: 'rock', loses: 'scissors' },
      scissors: { beats: 'paper', loses: 'rock' }
    };
    
    let result;
    let coins = 0;
    const multiplier = botDifficulty === 'easy' ? 1 : 
                      botDifficulty === 'medium' ? 1.5 : 2;
    
    if (playerChoice === opponentChoice) {
      result = 'draw';
      coins = Math.floor(20 * multiplier);
      setCurrentWinStreak(0);
      setBotStreak(prev => prev + 1);
    } else if (rules[playerChoice].beats === opponentChoice) {
      result = 'win';
      const baseCoins = Math.floor(50 * multiplier);
      const streakBonus = currentWinStreak * 10;
      coins = baseCoins + streakBonus;
      
      const newStreak = currentWinStreak + 1;
      setCurrentWinStreak(newStreak);
      setBotStreak(0);
      
      if (newStreak > userStats.maxWinStreak) {
        setUserStats(prev => ({ ...prev, maxWinStreak: newStreak }));
      }
    } else {
      result = 'lose';
      coins = Math.floor(10 * multiplier);
      setCurrentWinStreak(0);
      
      const newBotStreak = botStreak + 1;
      setBotStreak(newBotStreak);
      
      if (newBotStreak >= 3) {
        setTimeout(() => {
          setBotLevel(prev => prev < 10 ? prev + 1 : prev);
          showNotification(`🤖 Bot darajasi oshdi: ${botLevel} → ${botLevel + 1}`, 'success');
        }, 1500);
      }
    }
    
    // Taymerni to'xtatish
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Natijani saqlash
    setGameResult(result);
    setCoinsEarned(coins);
    
    // O'yin natijasini yangilash
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: result,
      timer: 0
    }));
    
    // Koinlarni yangilash
    setUserCoins(prev => prev + coins);
    
    // Bot tarixini yangilash
    const newHistoryEntry = {
      timestamp: Date.now(),
      botDifficulty: botDifficulty,
      botChoice: opponentChoice,
      playerChoice: playerChoice,
      result: result,
      botName: botName,
      botLevel: botLevel,
      coins: coins
    };
    
    setBotHistory(prev => {
      const updated = [...prev, newHistoryEntry];
      if (updated.length > 50) updated.shift();
      return updated;
    });
    
    // Statistika yangilash
    setUserStats(prev => {
      const newStats = { 
        ...prev, 
        totalGames: prev.totalGames + 1,
        totalCoinsEarned: prev.totalCoinsEarned + coins,
        botGamesPlayed: prev.botGamesPlayed + 1
      };
      
      if (result === 'win') {
        newStats.wins += 1;
        newStats.botGamesWon += 1;
      } else if (result === 'lose') {
        newStats.losses += 1;
      } else {
        newStats.draws += 1;
      }
      
      newStats.winRate = newStats.totalGames > 0 
        ? Math.round((newStats.wins / newStats.totalGames) * 100) 
        : 0;
      
      return newStats;
    });
    
    // Natija haqida xabar
    const resultMessages = {
      win: `🏆 G'alaba! ${botName}ni mag'lub etdingiz! +${coins} koin`,
      lose: `😔 Mag'lubiyat! ${botName}ga yutqazdingiz. +${coins} koin`,
      draw: `🤝 Durrang! ${botName} bilan teng. +${coins} koin`
    };
    
    showNotification(resultMessages[result], result === 'win' ? 'success' : 'info');
    
    // Ketma-ket g'alaba haqida
    if (result === 'win' && currentWinStreak > 1) {
      setTimeout(() => {
        showNotification(`🔥 ${currentWinStreak} ketma-ket g'alaba! Streak bonus: +${currentWinStreak * 10} koin`, 'success');
      }, 1500);
    }
  };

  // ✅ 13. O'YINNI TUGATISH (VAQT TUGAGANDA)
  const finishGameWithTimeout = () => {
    setGameResult('timeout');
    setCoinsEarned(5);
    
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: 'timeout',
      timer: 0
    }));
    
    setUserCoins(prev => prev + 5);
    
    showNotification('⏰ Vaqt tugadi! +5 koin', 'info');
  };

  // ✅ 14. YANGI O'YIN
  const restartGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (botDecisionTimeoutRef.current) {
      clearTimeout(botDecisionTimeoutRef.current);
      botDecisionTimeoutRef.current = null;
    }
    
    setGameState({
      status: 'idle',
      opponent: null,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null,
      roomCode: null,
      playersInRoom: 0
    });
    
    setGameResult(null);
    setCoinsEarned(0);
    setShowBotMenu(true);
    setBotGameMode(false);
  };

  // ✅ 15. KUNLIK BONUS
  const claimDailyBonus = () => {
    if (!dailyStatus.available) {
      showNotification(`🎁 Kunlik bonus ${dailyStatus.nextIn || 24} soatdan keyin`, 'info');
      return;
    }
    
    const baseBonus = 100;
    const streakBonus = dailyStatus.streak * 25;
    const bonusAmount = baseBonus + streakBonus;
    
    setUserCoins(prev => prev + bonusAmount);
    setUserStats(prev => ({
      ...prev,
      totalCoinsEarned: prev.totalCoinsEarned + bonusAmount
    }));
    
    setDailyStatus({
      available: false,
      streak: dailyStatus.streak + 1,
      nextIn: 20,
      lastClaim: Date.now()
    });
    
    showNotification(`🎉 +${bonusAmount} koin! (${dailyStatus.streak} kun ketma-ket)`, 'success');
  };

  // ✅ 16. YORDAMCHI FUNKSIYALAR
  const getChoiceName = (choice) => {
    switch (choice) {
      case 'rock': return 'Tosh';
      case 'paper': return 'Qog\'oz';
      case 'scissors': return 'Qaychi';
      default: return 'Tanlanmagan';
    }
  };

  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };

  const getProfileImage = (photoUrl, firstName, size = 40) => {
    const style = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '3px solid #31b545',
      backgroundColor: '#2a2a2a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${size * 0.5}px`,
      fontWeight: 'bold',
      color: '#ffffff'
    };
    
    if (photoUrl) {
      return (
        <img 
          src={photoUrl} 
          alt={firstName}
          style={style}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `
              <div style="${Object.entries(style).map(([k, v]) => `${k}: ${v}`).join(';')}">
                ${firstName?.[0]?.toUpperCase() || 'U'}
              </div>
            `;
          }}
        />
      );
    }
    
    return (
      <div style={style}>
        {firstName?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  const showNotification = (message, type = 'info', duration = 3000) => {
    setNotification({ message, type });
    
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, duration);
  };

  // ✅ 17. BOT STATISTIKASI
  const getBotStats = () => {
    const totalGames = botHistory.length;
    const wins = botHistory.filter(h => h.result === 'win').length;
    const losses = botHistory.filter(h => h.result === 'lose').length;
    const draws = botHistory.filter(h => h.result === 'draw').length;
    
    return {
      totalGames,
      wins,
      losses,
      draws,
      winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
      currentStreak: currentWinStreak,
      botStreak: botStreak
    };
  };

  // ✅ 18. YUKLANMOQDA KOMPONENTI
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>🎮 Tosh-Qaychi-Qog'oz</h2>
          <p>Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // ✅ 19. ASOSIY RENDER
  return (
    <div className="app">
      {/* 🔔 XABAR KO'RSATISH */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            {notification.message}
            <button 
              className="notification-close"
              onClick={() => setNotification(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* 📱 HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🎮</span>
            <div>
              <h1>Tosh • Qaychi • Qog'oz</h1>
              <div className="connection-status">
                <span className="status-dot online"></span>
                <span className="status-text">Online</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <div className="coins-panel">
            <div className="coins-display" title="Koinlar">
              <span className="coin-icon">🪙</span>
              <span className="coin-amount">{userCoins.toLocaleString()}</span>
            </div>
            <button 
              className={`daily-bonus-btn ${dailyStatus.available ? 'available' : 'unavailable'}`}
              onClick={claimDailyBonus}
              title="Kunlik bonus"
            >
              <span className="bonus-icon">🎁</span>
              {dailyStatus.streak > 1 && (
                <span className="bonus-streak">{dailyStatus.streak}</span>
              )}
            </button>
          </div>
          
          <button 
            className="profile-btn"
            onClick={() => setShowProfile(true)}
            aria-label="Profil"
          >
            {getProfileImage(userPhoto, user?.first_name, 40)}
          </button>
        </div>
      </header>
      
      {/* 🎮 ASOSIY KONTENT */}
      <main className="main-content">
        {/* BOSH MENYU - BOT TANLOVI */}
        {showBotMenu && !botGameMode && (
          <div className="game-screen idle-screen">
            <div className="welcome-section">
              <div className="welcome-avatar">
                {getProfileImage(userPhoto, user?.first_name, 80)}
                {currentWinStreak > 0 && (
                  <div className="streak-badge">🔥 {currentWinStreak}</div>
                )}
              </div>
              <h2>Salom, {user?.first_name || 'Dost'}! 👋</h2>
              <p className="welcome-subtitle">AI botlar bilan raqobatlashing!</p>
            </div>
            
            <div className="quick-stats">
              <div className="stat-card-mini">
                <span className="stat-icon">🪙</span>
                <span className="stat-value">{userCoins.toLocaleString()}</span>
                <span className="stat-label">Koin</span>
              </div>
              <div className="stat-card-mini">
                <span className="stat-icon">🏆</span>
                <span className="stat-value">{userStats.winRate}%</span>
                <span className="stat-label">G'alaba</span>
              </div>
              <div className="stat-card-mini">
                <span className="stat-icon">🔥</span>
                <span className="stat-value">{userStats.maxWinStreak}</span>
                <span className="stat-label">Max Streak</span>
              </div>
              <div className="stat-card-mini">
                <span className="stat-icon">🤖</span>
                <span className="stat-value">{userStats.botGamesWon}/{userStats.botGamesPlayed}</span>
                <span className="stat-label">Bot</span>
              </div>
            </div>
            
            {/* BOT DARAJA TANLOVI */}
            <div className="bot-menu-section">
              <div className="section-header">
                <h3>🤖 Bot darajasini tanlang:</h3>
              </div>
              
              <div className="difficulty-buttons">
                <button 
                  className="difficulty-btn easy"
                  onClick={() => startBotGame('easy')}
                >
                  <span className="diff-icon">😊</span>
                  <div className="diff-content">
                    <span className="diff-title">OSON</span>
                    <span className="diff-desc">Yangi boshlaganlar uchun</span>
                    <span className="diff-reward">+50 koin g'alaba</span>
                  </div>
                  <span className="diff-bonus">×1</span>
                </button>
                
                <button 
                  className="difficulty-btn medium"
                  onClick={() => startBotGame('medium')}
                >
                  <span className="diff-icon">😐</span>
                  <div className="diff-content">
                    <span className="diff-title">OʻRTA</span>
                    <span className="diff-desc">Tajribali oʻyinchilar</span>
                    <span className="diff-reward">+75 koin g'alaba</span>
                  </div>
                  <span className="diff-bonus">×1.5</span>
                </button>
                
                <button 
                  className="difficulty-btn hard"
                  onClick={() => startBotGame('hard')}
                >
                  <span className="diff-icon">😎</span>
                  <div className="diff-content">
                    <span className="diff-title">QIYIN</span>
                    <span className="diff-desc">Professional daraja</span>
                    <span className="diff-reward">+100 koin g'alaba</span>
                  </div>
                  <span className="diff-bonus">×2</span>
                </button>
              </div>
              
              <div className="bot-stats">
                <h4>📊 Statistikangiz:</h4>
                <div className="stats-grid-mini">
                  <div className="stat-mini">
                    <span className="stat-icon">🎮</span>
                    <span className="stat-value">{userStats.totalGames}</span>
                    <span className="stat-label">O'yin</span>
                  </div>
                  <div className="stat-mini">
                    <span className="stat-icon">🏆</span>
                    <span className="stat-value">{userStats.wins}</span>
                    <span className="stat-label">G'alaba</span>
                  </div>
                  <div className="stat-mini">
                    <span className="stat-icon">🔥</span>
                    <span className="stat-value">{currentWinStreak}</span>
                    <span className="stat-label">Streak</span>
                  </div>
                  <div className="stat-mini">
                    <span className="stat-icon">🤖</span>
                    <span className="stat-value">{botHistory.length}</span>
                    <span className="stat-label">Bot o'yin</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bottom-actions">
              <button className="action-btn small" onClick={() => setShowHowToPlay(true)}>
                ❓ Qoidalar
              </button>
              <button className="action-btn small" onClick={() => setShowShop(true)}>
                🛒 Do'kon
              </button>
            </div>
          </div>
        )}
        
        {/* O'YIN DAVOM ETMOQDA */}
        {!showBotMenu && gameState.status === 'playing' && (
          <div className="game-screen playing-screen">
            <div className="playing-header">
              <div className="opponent-info">
                <div className="opponent-type">
                  <span className="bot-badge">🤖</span>
                  {botDifficulty.toUpperCase()} BOT
                </div>
                <h2>{botName}</h2>
                <p className="opponent-stats">
                  Daraja: {botLevel} • Streak: {botStreak} • {gameState.timer}s qoldi
                </p>
              </div>
              
              <div className="game-timer">
                <div className="timer-icon">⏰</div>
                <div className="timer-value">{gameState.timer}s</div>
              </div>
            </div>
            
            <div className="choices-section">
              <h3>Tanlang:</h3>
              <div className="choice-buttons">
                <button 
                  className={`choice-btn rock ${gameState.myChoice === 'rock' ? 'selected' : ''}`}
                  onClick={() => makeChoice('rock')}
                  disabled={gameState.myChoice !== null}
                >
                  <span className="choice-emoji">✊</span>
                  <span className="choice-text">Tosh</span>
                </button>
                
                <button 
                  className={`choice-btn paper ${gameState.myChoice === 'paper' ? 'selected' : ''}`}
                  onClick={() => makeChoice('paper')}
                  disabled={gameState.myChoice !== null}
                >
                  <span className="choice-emoji">✋</span>
                  <span className="choice-text">Qog'oz</span>
                </button>
                
                <button 
                  className={`choice-btn scissors ${gameState.myChoice === 'scissors' ? 'selected' : ''}`}
                  onClick={() => makeChoice('scissors')}
                  disabled={gameState.myChoice !== null}
                >
                  <span className="choice-emoji">✌️</span>
                  <span className="choice-text">Qaychi</span>
                </button>
              </div>
            </div>
            
            <div className="choices-display">
              <div className="choice-container you-choice">
                <div className="choice-box you">
                  <div className="choice-label">Siz</div>
                  <div className="choice-emoji-large">
                    {getChoiceEmoji(gameState.myChoice)}
                  </div>
                  <div className="choice-status">
                    {gameState.myChoice ? '✅ Tanlandi' : '⌛ Tanlov qiling'}
                  </div>
                </div>
              </div>
              
              <div className="vs-container">
                <div className="vs-circle">VS</div>
              </div>
              
              <div className="choice-container opponent-choice">
                <div className="choice-box opponent">
                  <div className="choice-label">{botName}</div>
                  <div className="choice-emoji-large">
                    {getChoiceEmoji(gameState.opponentChoice)}
                  </div>
                  <div className="choice-status">
                    {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="game-status">
              {!gameState.myChoice && !gameState.opponentChoice && (
                <p>🎯 Birinchi bo'lib tanlang!</p>
              )}
              {gameState.myChoice && !gameState.opponentChoice && (
                <p>⏳ Bot tanlov qilmoqda...</p>
              )}
              {!gameState.myChoice && gameState.opponentChoice && (
                <p>⚡ Bot tanlov qildi! Endi siz tanlang!</p>
              )}
              {gameState.myChoice && gameState.opponentChoice && (
                <p>🔮 Natija hisoblanmoqda...</p>
              )}
            </div>
            
            <div className="game-info">
              <div className="info-item">
                <span className="info-label">Sizning streak:</span>
                <span className="info-value">{currentWinStreak}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Bot streak:</span>
                <span className="info-value">{botStreak}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Ko'paytiruvchi:</span>
                <span className="info-value">
                  {botDifficulty === 'easy' ? '×1' : 
                   botDifficulty === 'medium' ? '×1.5' : '×2'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* O'YIN TUGADI */}
        {!showBotMenu && gameState.status === 'finished' && (
          <div className="game-screen finished-screen">
            <div className="finished-content">
              <div className={`result-banner ${gameResult}`}>
                {gameResult === 'win' && (
                  <>
                    <div className="result-icon">🏆</div>
                    <h2>G'ALABA!</h2>
                    <p className="result-subtitle">+{coinsEarned} koin</p>
                  </>
                )}
                {gameResult === 'lose' && (
                  <>
                    <div className="result-icon">😔</div>
                    <h2>MAG'LUBIYAT</h2>
                    <p className="result-subtitle">+{coinsEarned} koin</p>
                  </>
                )}
                {gameResult === 'draw' && (
                  <>
                    <div className="result-icon">🤝</div>
                    <h2>DURRANG</h2>
                    <p className="result-subtitle">+{coinsEarned} koin</p>
                  </>
                )}
                {gameResult === 'timeout' && (
                  <>
                    <div className="result-icon">⏰</div>
                    <h2>VAQT TUGADI</h2>
                    <p className="result-subtitle">+{coinsEarned} koin</p>
                  </>
                )}
              </div>
              
              <div className="final-choices">
                <div className="final-choice you">
                  <div className="choice-player">Siz</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.myChoice)}</div>
                  <div className="choice-name">{getChoiceName(gameState.myChoice)}</div>
                </div>
                
                <div className="vs-final">VS</div>
                
                <div className="final-choice opponent">
                  <div className="choice-player">{botName}</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-name">{getChoiceName(gameState.opponentChoice)}</div>
                </div>
              </div>
              
              <div className="result-details">
                <div className="detail-item">
                  <span className="detail-label">Bot darajasi:</span>
                  <span className="detail-value">{botDifficulty} (Daraja: {botLevel})</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Sizning streak:</span>
                  <span className="detail-value">{currentWinStreak}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bot streak:</span>
                  <span className="detail-value">{botStreak}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ko'paytiruvchi:</span>
                  <span className="detail-value">
                    {botDifficulty === 'easy' ? '×1' : 
                     botDifficulty === 'medium' ? '×1.5' : '×2'}
                  </span>
                </div>
              </div>
              
              <div className="result-actions">
                <button className="play-again-btn" onClick={() => startBotGame(botDifficulty)}>
                  🔄 YANA O'YNA
                </button>
                <button className="menu-btn" onClick={restartGame}>
                  📋 Bosh menyu
                </button>
              </div>
              
              {currentWinStreak > 1 && gameResult === 'win' && (
                <div className="streak-bonus-info">
                  <span className="bonus-icon">🔥</span>
                  <span>{currentWinStreak} ketma-ket g'alaba! Streak bonus: +{currentWinStreak * 10} koin</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* MODALLAR */}
        
        {/* PROFIL MODALI */}
        {showProfile && (
          <div className="modal-overlay">
            <div className="modal profile-modal">
              <div className="modal-header">
                <h2>👤 Profil</h2>
                <button className="modal-close" onClick={() => setShowProfile(false)}>✕</button>
              </div>
              
              <div className="modal-content">
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    {getProfileImage(userPhoto, user?.first_name, 80)}
                  </div>
                  <div className="profile-info">
                    <h3>{user?.first_name}</h3>
                    <p className="username">@{user?.username}</p>
                    <div className="user-id">ID: {user?.id}</div>
                  </div>
                </div>
                
                <div className="stats-grid">
                  <div className="stat-card-large">
                    <div className="stat-icon">🪙</div>
                    <div className="stat-content">
                      <div className="stat-value">{userCoins.toLocaleString()}</div>
                      <div className="stat-label">Koinlar</div>
                    </div>
                  </div>
                  
                  <div className="stat-card-large">
                    <div className="stat-icon">🏆</div>
                    <div className="stat-content">
                      <div className="stat-value">{userStats.winRate}%</div>
                      <div className="stat-label">G'alaba %</div>
                    </div>
                  </div>
                  
                  <div className="stat-card-large">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-content">
                      <div className="stat-value">{userStats.maxWinStreak}</div>
                      <div className="stat-label">Max Streak</div>
                    </div>
                  </div>
                  
                  <div className="stat-card-large">
                    <div className="stat-icon">🤖</div>
                    <div className="stat-content">
                      <div className="stat-value">{userStats.botGamesWon}</div>
                      <div className="stat-label">Bot g'alaba</div>
                    </div>
                  </div>
                </div>
                
                <div className="profile-details">
                  <div className="detail-row">
                    <span>Jami o'yinlar:</span>
                    <span>{userStats.totalGames}</span>
                  </div>
                  <div className="detail-row">
                    <span>G'alaba:</span>
                    <span>{userStats.wins}</span>
                  </div>
                  <div className="detail-row">
                    <span>Mag'lubiyat:</span>
                    <span>{userStats.losses}</span>
                  </div>
                  <div className="detail-row">
                    <span>Durrang:</span>
                    <span>{userStats.draws}</span>
                  </div>
                  <div className="detail-row">
                    <span>Jami koin:</span>
                    <span>{userStats.totalCoinsEarned.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="profile-actions">
                  <button className="action-btn full" onClick={() => { setShowProfile(false); setShowBotMenu(true); }}>
                    🤖 Bot bilan o'ynash
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* QOIDALAR MODALI */}
        {showHowToPlay && (
          <div className="modal-overlay">
            <div className="modal rules-modal">
              <div className="modal-header">
                <h2>📖 O'yin Qoidalari</h2>
                <button className="modal-close" onClick={() => setShowHowToPlay(false)}>✕</button>
              </div>
              
              <div className="modal-content">
                <div className="rules-list">
                  <div className="rule-item">
                    <div className="rule-icon">✊</div>
                    <div className="rule-content">
                      <h4>Tosh qaychini yengadi</h4>
                      <p>✊  ✌️</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">✌️</div>
                    <div className="rule-content">
                      <h4>Qaychi qog'ozni yengadi</h4>
                      <p>✌️  ✋</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">✋</div>
                    <div className="rule-content">
                      <h4>Qog'oz toshni yengadi</h4>
                      <p>✋  ✊</p>
                    </div>
                  </div>
                </div>
                
                <div className="coins-info">
                  <h4>💰 Koin mukofotlari:</h4>
                  <div className="coins-list">
                    <div className="coin-item">
                      <span className="coin-difficulty">Oson Bot:</span>
                      <span className="coin-amount">G'alaba: +50 koin</span>
                    </div>
                    <div className="coin-item">
                      <span className="coin-difficulty">Oʻrta Bot:</span>
                      <span className="coin-amount">G'alaba: +75 koin</span>
                    </div>
                    <div className="coin-item">
                      <span className="coin-difficulty">Qiyin Bot:</span>
                      <span className="coin-amount">G'alaba: +100 koin</span>
                    </div>
                    <div className="coin-item">
                      <span className="coin-difficulty">Durrang:</span>
                      <span className="coin-amount">+20 koin</span>
                    </div>
                    <div className="coin-item">
                      <span className="coin-difficulty">Mag'lubiyat:</span>
                      <span className="coin-amount">+10 koin</span>
                    </div>
                  </div>
                </div>
                
                <div className="streak-info">
                  <h4>🔥 Ketma-ket g'alaba:</h4>
                  <p>Har bir ketma-ket g'alaba uchun +10 koin bonus!</p>
                  <p>5 ketma-ket g'alaba = +50 koin bonus!</p>
                </div>
                
                <button className="action-btn full" onClick={() => { setShowHowToPlay(false); setShowBotMenu(true); }}>
                  🤖 Bot bilan o'ynash
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* 🦶 FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-title">🎮 Tosh-Qaychi-Qog'oz • AI Botlar bilan</p>
          <div className="footer-stats">
            <span className="footer-stat">🤖 3 xil bot darajasi</span>
            <span className="footer-stat">🔥 Streak bonuslar</span>
            <span className="footer-stat">🎮 {userStats.totalGames} o'yin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;