import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // ✅ 1. ASOSIY STATE'LAR
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('telegram_game_user');
    return savedUser ? JSON.parse(savedUser) : {
      id: Date.now(),
      first_name: 'Foydalanuvchi',
      username: 'user_' + Date.now().toString().slice(-6)
    };
  });
  
  const [gameState, setGameState] = useState({
    status: 'idle',
    opponent: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60,
    gameId: null
  });
  
  const [userCoins, setUserCoins] = useState(() => {
    const savedCoins = localStorage.getItem('telegram_game_coins');
    return savedCoins ? parseInt(savedCoins) : 1500;
  });
  
  const [dailyStatus, setDailyStatus] = useState(() => {
    const savedDaily = localStorage.getItem('telegram_game_daily');
    return savedDaily ? JSON.parse(savedDaily) : { 
      available: true, 
      streak: 1, 
      nextIn: 0,
      lastClaim: null 
    };
  });
  
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
  
  const [notification, setNotification] = useState(null);
  
  // ✅ BOT REJIMI STATE'LARI
  const [botGameMode, setBotGameMode] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState('medium');
  const [botName, setBotName] = useState('');
  const [botLevel, setBotLevel] = useState(1);
  const [botStreak, setBotStreak] = useState(0);
  const [currentWinStreak, setCurrentWinStreak] = useState(0);
  const [botChoiceMade, setBotChoiceMade] = useState(null);
  const [showResultAnimation, setShowResultAnimation] = useState(false);
  
  const timerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const isInitialized = useRef(false);

  // ✅ 2. DASTLABKI SOZLASH
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initApp = async () => {
      try {
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.ready();
          tg.expand();
          
          const userData = tg.initDataUnsafe?.user;
          if (userData && userData.id) {
            const newUser = {
              id: userData.id || Date.now(),
              first_name: userData.first_name || 'Foydalanuvchi',
              username: userData.username || `user_${Date.now()}`
            };
            setUser(newUser);
          }
        }
      } catch (error) {
        console.error('Init xatosi:', error);
      } finally {
        showNotification('🎮 Bot bilan o\'ynash uchun darajani tanlang!', 'success');
      }
    };

    initApp();

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
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
    setBotChoiceMade(null);
    setShowResultAnimation(false);
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: `bot_game_${Date.now()}`
    });
    
    showNotification(`🤖 ${randomBotName} bilan o'ynaysiz!`, 'info');
    
    // O'yin taymerini boshlash
    startGameTimer();
    
    // Bot avval tanlov qiladi (foydalanuvchidan oldin)
    setTimeout(() => {
      const botChoice = generateBotChoice(difficulty);
      setBotChoiceMade(botChoice);
      showNotification(`🤖 Bot tanlov qildi! Endi siz tanlang!`, 'info');
    }, 1000);
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

  // ✅ 6. BOT TANLOVINI YARATISH (FAYDALANUVCHI TANLAMASDAN)
  const generateBotChoice = (difficulty) => {
    let botChoice;
    const choices = ['rock', 'paper', 'scissors'];
    
    if (difficulty === 'easy') {
      // Oson bot - faqat random (70%), bir xil tanlov (30%)
      const random = Math.random();
      if (random < 0.7) {
        botChoice = choices[Math.floor(Math.random() * 3)];
      } else {
        // Biror bir tanlovni ko'proq tanlash
        const preferredChoice = choices[Math.floor(Math.random() * 2)];
        botChoice = preferredChoice;
      }
    } else if (difficulty === 'medium') {
      // O'rta bot - 60% random, 40% strategik
      const random = Math.random();
      if (random < 0.6) {
        botChoice = choices[Math.floor(Math.random() * 3)];
      } else {
        // Eng kam tanlangan variantni tanlash
        const leastChosen = getLeastChosenChoice();
        botChoice = leastChosen;
      }
    } else {
      // Qiyin bot - 50% random, 50% strategik
      const random = Math.random();
      if (random < 0.5) {
        botChoice = choices[Math.floor(Math.random() * 3)];
      } else {
        // Eng ko'p yutgan tanlovni tanlash
        const winningChoice = getWinningPatternChoice();
        botChoice = winningChoice;
      }
    }
    
    return botChoice;
  };

  // ✅ 7. ENG KAM TANLANGAN TANLOV
  const getLeastChosenChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * 3)];
  };

  // ✅ 8. YUTGAN PATTERN TANLOVI
  const getWinningPatternChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * 3)];
  };

  // ✅ 9. FOYDALANUVCHI TANLOVI
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing' || gameState.myChoice || !botChoiceMade) {
      return;
    }
    
    // Bot tanlovi va foydalanuvchi tanlovini o'rnatish
    setGameState(prev => ({
      ...prev,
      myChoice: choice,
      opponentChoice: botChoiceMade
    }));
    
    showNotification(`✅ ${getChoiceName(choice)} tanlandi`, 'info');
    
    // Animatsiya uchun kutish
    setTimeout(() => {
      setShowResultAnimation(true);
      calculateResult(choice, botChoiceMade);
    }, 500);
  };

  // ✅ 10. NATIJANI HISOBLASH
  const calculateResult = (playerChoice, botChoice) => {
    console.log('Natija hisoblanmoqda:', playerChoice, 'vs', botChoice);
    
    if (!playerChoice || !botChoice) {
      console.log('Tanlovlar to\'liq emas');
      return;
    }
    
    // O'yin qoidalari
    const winConditions = {
      'rock': 'scissors',    // Tosh qaychini yengadi
      'paper': 'rock',       // Qog'oz toshni yengadi
      'scissors': 'paper'    // Qaychi qog'ozni yengadi
    };
    
    let result;
    let coinsEarned = 0;
    
    // Ko'paytiruvchini aniqlash
    const multiplier = botDifficulty === 'easy' ? 1 : 
                      botDifficulty === 'medium' ? 1.5 : 2;
    
    // Natijani aniqlash
    if (playerChoice === botChoice) {
      result = 'draw';
      coinsEarned = Math.floor(20 * multiplier);
      setCurrentWinStreak(0);
      setBotStreak(prev => prev + 1);
    } else if (winConditions[playerChoice] === botChoice) {
      result = 'win';
      const baseCoins = Math.floor(50 * multiplier);
      const streakBonus = currentWinStreak * 10;
      coinsEarned = baseCoins + streakBonus;
      
      // Ketma-ket g'alaba
      const newStreak = currentWinStreak + 1;
      setCurrentWinStreak(newStreak);
      setBotStreak(0);
      
      // Max streak yangilash
      if (newStreak > userStats.maxWinStreak) {
        setUserStats(prev => ({ ...prev, maxWinStreak: newStreak }));
      }
    } else {
      result = 'lose';
      coinsEarned = Math.floor(10 * multiplier);
      setCurrentWinStreak(0);
      
      // Bot streak
      const newBotStreak = botStreak + 1;
      setBotStreak(newBotStreak);
      
      // Agar bot ketma-ket 3 marta yutsa, darajasi oshsin
      if (newBotStreak >= 3) {
        setTimeout(() => {
          setBotLevel(prev => {
            if (prev < 10) {
              showNotification(`🤖 Bot darajasi oshdi: ${prev} → ${prev + 1}`, 'success');
              return prev + 1;
            }
            return prev;
          });
        }, 1500);
      }
    }
    
    console.log('Natija:', result, 'Koin:', coinsEarned);
    
    // Taymerni to'xtatish
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // O'yin natijasini yangilash
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        result: result,
        timer: 0
      }));
      
      // Koinlarni yangilash
      setUserCoins(prev => {
        const newCoins = prev + coinsEarned;
        return newCoins;
      });
      
      // Statistika yangilash
      setUserStats(prev => {
        const newStats = { 
          ...prev, 
          totalGames: prev.totalGames + 1,
          totalCoinsEarned: prev.totalCoinsEarned + coinsEarned,
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
        
        // G'alaba foizi
        newStats.winRate = newStats.totalGames > 0 
          ? Math.round((newStats.wins / newStats.totalGames) * 100) 
          : 0;
        
        return newStats;
      });
      
      // Natija haqida xabar
      const resultMessages = {
        win: `🏆 G'alaba! ${botName}ni mag'lub etdingiz! +${coinsEarned} koin`,
        lose: `😔 Mag'lubiyat! ${botName}ga yutqazdingiz. +${coinsEarned} koin`,
        draw: `🤝 Durrang! ${botName} bilan teng. +${coinsEarned} koin`
      };
      
      showNotification(resultMessages[result], result === 'win' ? 'success' : 'info');
      
      // Ketma-ket g'alaba haqida
      if (result === 'win' && currentWinStreak > 1) {
        setTimeout(() => {
          showNotification(`🔥 ${currentWinStreak} ketma-ket g'alaba! Streak bonus: +${currentWinStreak * 10} koin`, 'success');
        }, 1500);
      }
    }, 1000);
  };

  // ✅ 11. O'YINNI TUGATISH (VAQT TUGAGANDA)
  const finishGameWithTimeout = () => {
    const coins = 5;
    
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: 'timeout',
      timer: 0
    }));
    
    setUserCoins(prev => prev + coins);
    setCurrentWinStreak(0);
    
    showNotification('⏰ Vaqt tugadi! +5 koin', 'info');
  };

  // ✅ 12. YANGI O'YIN
  const restartGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setGameState({
      status: 'idle',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null
    });
    
    setShowBotMenu(true);
    setBotGameMode(false);
    setBotChoiceMade(null);
    setShowResultAnimation(false);
  };

  // ✅ 13. KUNLIK BONUS
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
// ✅ 17. ANIMATSIYANI YOPISH FUNKSIYASI
const closeResultAnimation = () => {
  setShowResultAnimation(false);
  
  // Animatsiyadan keyin qo'shimcha ma'lumotlar
  if (gameState.result === 'win') {
    showNotification(`🎉 G'alaba! ${getCoinsFromResult()} koin qo'shildi!`, 'success');
  } else if (gameState.result === 'lose') {
    showNotification(`💪 Keyingi o'yinda omad! ${getCoinsFromResult()} koin qo'shildi`, 'info');
  }
};
  // ✅ 14. YORDAMCHI FUNKSIYALAR
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

  const getProfileImage = (firstName, size = 40) => {
    const style = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: '#31b545',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${size * 0.5}px`,
      fontWeight: 'bold',
      color: '#ffffff'
    };
    
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

  // ✅ 15. ASOSIY RENDER
  return (
    <div className="app">
      {/* 🔔 XABAR KO'RSATISH */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            {notification.message}
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
            {getProfileImage(user?.first_name, 40)}
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
                {getProfileImage(user?.first_name, 80)}
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
            </div>
            
            <div className="bottom-actions">
              <button className="action-btn small" onClick={() => setShowHowToPlay(true)}>
                ❓ Qoidalar
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
                  disabled={gameState.myChoice !== null || !botChoiceMade}
                >
                  <span className="choice-emoji">✊</span>
                  <span className="choice-text">Tosh</span>
                </button>
                
                <button 
                  className={`choice-btn paper ${gameState.myChoice === 'paper' ? 'selected' : ''}`}
                  onClick={() => makeChoice('paper')}
                  disabled={gameState.myChoice !== null || !botChoiceMade}
                >
                  <span className="choice-emoji">✋</span>
                  <span className="choice-text">Qog'oz</span>
                </button>
                
                <button 
                  className={`choice-btn scissors ${gameState.myChoice === 'scissors' ? 'selected' : ''}`}
                  onClick={() => makeChoice('scissors')}
                  disabled={gameState.myChoice !== null || !botChoiceMade}
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
                    {gameState.myChoice ? getChoiceEmoji(gameState.myChoice) : '❓'}
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
                    {botChoiceMade ? '❓' : '🤔'}
                  </div>
                  <div className="choice-status">
                    {botChoiceMade ? '✅ Tanlandi' : '⌛ Tanlov qilmoqda...'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="game-status">
              {!botChoiceMade && (
                <p>🤖 Bot tanlov qilmoqda...</p>
              )}
              {botChoiceMade && !gameState.myChoice && (
                <p>⚡ Bot tanlov qildi! Endi siz tanlang!</p>
              )}
              {showResultAnimation && gameState.myChoice && botChoiceMade && (
                <div className="result-animation">
                  <div className="animation-text">🔮 Natija hisoblanmoqda...</div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* O'YIN TUGADI */}
        {!showBotMenu && gameState.status === 'finished' && (
  <div className="game-screen finished-screen">
    <div className="finished-content">
      {/* Animatsiya qismi */}
      {showResultAnimation && (
        <div className="result-animation-overlay">
          <div className={`result-reveal ${gameState.result}`}>
            {gameState.result === 'win' && (
              <>
                <div className="win-animation">🎉</div>
                <h2 className="result-title-win">G'ALABA!</h2>
                <div className="animation-coins">+{getCoinsFromResult()} koin</div>
              </>
            )}
            {gameState.result === 'lose' && (
              <>
                <div className="lose-animation">💥</div>
                <h2 className="result-title-lose">MAG'LUBIYAT</h2>
                <div className="animation-coins">+{getCoinsFromResult()} koin</div>
              </>
            )}
            {gameState.result === 'draw' && (
              <>
                <div className="draw-animation">🤝</div>
                <h2 className="result-title-draw">DURRANG</h2>
                <div className="animation-coins">+{getCoinsFromResult()} koin</div>
              </>
            )}
            
            {/* Yopish tugmasi */}
            <button 
              className="close-animation-btn"
              onClick={closeResultAnimation}
              aria-label="Animatsiyani yopish"
            >
              Davom etish →
            </button>
          </div>
        </div>
      )}
      
      {/* Asosiy natija ekrani (animatsiyadan keyin) */}
      {!showResultAnimation && (
        <>
          <div className={`result-banner ${gameState.result}`}>
            {gameState.result === 'win' && (
              <>
                <div className="result-icon">🏆</div>
                <h2>G'ALABA!</h2>
                <p className="result-subtitle">+{getCoinsFromResult()} koin</p>
              </>
            )}
            {gameState.result === 'lose' && (
              <>
                <div className="result-icon">😔</div>
                <h2>MAG'LUBIYAT</h2>
                <p className="result-subtitle">+{getCoinsFromResult()} koin</p>
              </>
            )}
            {gameState.result === 'draw' && (
              <>
                <div className="result-icon">🤝</div>
                <h2>DURRANG</h2>
                <p className="result-subtitle">+{getCoinsFromResult()} koin</p>
              </>
            )}
            {gameState.result === 'timeout' && (
              <>
                <div className="result-icon">⏰</div>
                <h2>VAQT TUGADI</h2>
                <p className="result-subtitle">+5 koin</p>
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
          
          <div className="result-actions">
            <button className="play-again-btn" onClick={() => startBotGame(botDifficulty)}>
              🔄 YANA O'YNA
            </button>
            <button className="menu-btn" onClick={restartGame}>
              📋 Bosh menyu
            </button>
          </div>
          
          {currentWinStreak > 1 && gameState.result === 'win' && (
            <div className="streak-bonus-info">
              <span className="bonus-icon">🔥</span>
              <span>{currentWinStreak} ketma-ket g'alaba! Streak bonus: +{currentWinStreak * 10} koin</span>
            </div>
          )}
        </>
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
                    {getProfileImage(user?.first_name, 80)}
                  </div>
                  <div className="profile-info">
                    <h3>{user?.first_name}</h3>
                    <p className="username">@{user?.username}</p>
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
                </div>
                
                <button className="action-btn full" onClick={() => { setShowProfile(false); setShowBotMenu(true); }}>
                  🤖 Bot bilan o'ynash
                </button>
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
                
                <div className="fair-play-info">
                  <h4>⚖️ Halol o'yin:</h4>
                  <p>• Bot har doim siz tanlamasdan oldin tanlov qiladi</p>
                  <p>• Bot sizning tanlovingizni ko'rmaydi</p>
                  <p>• Bot tanlovi random va strategik algoritmlarga asoslanadi</p>
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
          <p className="footer-subtitle">⚖️ Halol o'yin - Bot sizning tanlovingizni ko'rmaydi</p>
        </div>
      </footer>
    </div>
  );

  // ✅ 16. KOINLARNI HISOBLASH FUNKSIYASI
  function getCoinsFromResult() {
    const multiplier = botDifficulty === 'easy' ? 1 : 
                      botDifficulty === 'medium' ? 1.5 : 2;
    
    if (gameState.result === 'win') {
      return Math.floor(50 * multiplier) + (currentWinStreak * 10);
    } else if (gameState.result === 'lose') {
      return Math.floor(10 * multiplier);
    } else if (gameState.result === 'draw') {
      return Math.floor(20 * multiplier);
    }
    return 0;
  }
}

export default App;