import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';

function App() {
  // Asosiy state'lar
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'idle',
    opponent: null,
    opponentPhoto: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60,
    gameId: null
  });
  
  const [userCoins, setUserCoins] = useState(1500);
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ 
    available: true, 
    streak: 3, 
    nextIn: 0,
    lastClaim: null 
  });
  
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userStats, setUserStats] = useState({
    wins: 25,
    losses: 10,
    draws: 5,
    totalGames: 40,
    winRate: 62.5,
    rank: 15
  });
  
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  const timerRef = useRef(null);
  const botTimerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const userRef = useRef(null); // 🔥 User'ni ref'da saqlaymiz

  // 🔹 TELEGRAM WEBAPP SOZLASH
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      
      // Telegram WebApp mavjudligini tekshirish
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        try {
          // Telegram WebApp'ni boshlash
          tg.ready();
          tg.expand();
          
          // Theme moslashuvi
          applyTelegramTheme(tg);
          
          // Foydalanuvchi ma'lumotlarini olish
          const userData = tg.initDataUnsafe?.user;
          if (userData) {
            console.log('✅ Telegram user data:', userData);
            await setupUser(userData, tg);
          } else {
            console.log('⚠️ No Telegram user data, using test data');
            await setupTestUser();
          }
          
          // Telegram tugmalarini sozlash
          setupTelegramButtons(tg);
          
        } catch (error) {
          console.error('Telegram init error:', error);
          await setupTestUser();
        }
      } else {
        // Telegram WebApp yo'q - test rejimi
        console.log('⚠️ Telegram WebApp not found, using test mode');
        await setupTestUser();
      }
      
      setIsLoading(false);
    };

    initApp();

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (botTimerRef.current) clearInterval(botTimerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, []);

  // 🔹 USER REF'NI YANGILASH (har state o'zgarganida)
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 🔹 TELEGRAM THEME MOSLASHUVI
  const applyTelegramTheme = (tg) => {
    const theme = tg.themeParams || {};
    
    // CSS custom properties
    document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color || '#1a1a1a');
    document.documentElement.style.setProperty('--tg-text-color', theme.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-hint-color', theme.hint_color || '#999999');
    document.documentElement.style.setProperty('--tg-link-color', theme.link_color || '#4a9eff');
    document.documentElement.style.setProperty('--tg-button-color', theme.button_color || '#31b545');
    document.documentElement.style.setProperty('--tg-button-text-color', theme.button_text_color || '#ffffff');
    
    // Background color
    tg.setBackgroundColor(theme.bg_color || '#1a1a1a');
    
    // Header color
    tg.setHeaderColor(theme.bg_color || '#1a1a1a');
  };

  // 🔹 FOYDALANUVCHINI SOZLASH
  const setupUser = async (userData, tg) => {
    const newUser = {
      id: userData.id,
      first_name: userData.first_name || 'Foydalanuvchi',
      username: userData.username || '',
      language_code: userData.language_code || 'uz'
    };
    
    setUser(newUser);
    userRef.current = newUser; // 🔥 Ref'ni ham yangilaymiz
    
    // Telegram profil rasmini olish
    if (userData.photo_url) {
      setUserPhoto(userData.photo_url);
    }
    
    // Ma'lumotlarni yuklash
    await loadUserData(newUser);
    
    // Haptic feedback (tebranish)
    if (tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    // Bot haqida xabar
    showNotification('🎮 O\'yinga xush kelibsiz!');
  };

  // 🔹 TEST FOYDALANUVCHI
  const setupTestUser = async () => {
    const testUser = {
      id: Math.floor(Math.random() * 1000000) + 100000,
      first_name: 'Test',
      username: 'test_player',
      photo_url: null
    };
    
    setUser(testUser);
    userRef.current = testUser; // 🔥 Ref'ni ham yangilaymiz
    await loadUserData(testUser);
    
    // Test rejimi haqida xabar
    showNotification('🔧 Test rejimi - Offline o\'ynash');
  };

  // 🔹 FOYDALANUVCHI MA'LUMOTLARINI YUKLASH
  const loadUserData = async (currentUser) => {
    try {
      // Mock data - asosiy ma'lumotlar
      console.log('Loading data for user:', currentUser);
      
      // Kunlik bonus holati
      setDailyStatus({
        available: true,
        streak: Math.floor(Math.random() * 10) + 1,
        nextIn: 0,
        lastClaim: Date.now() - 12 * 60 * 60 * 1000
      });
      
      // Inventar
      const mockInventory = [
        { 
          itemId: 'avatar_gold', 
          name: 'Oltin Avatar', 
          type: 'avatar',
          rarity: 'epic',
          icon: '👑',
          equipped: true,
          price: 1000,
          color: '#FFD700'
        },
        { 
          itemId: 'frame_fire', 
          name: 'Olov Ramkasi', 
          type: 'frame',
          rarity: 'rare',
          icon: '🔥',
          equipped: true,
          price: 500,
          color: '#FF4500'
        }
      ];
      
      setInventory(mockInventory);
      
      // Kiyilgan buyumlar
      setEquippedItems({
        avatar: mockInventory.find(item => item.itemId === 'avatar_gold'),
        frame: mockInventory.find(item => item.itemId === 'frame_fire')
      });
      
      // Do'kon mahsulotlari
      const mockShopItems = [
        { 
          id: 'avatar_dragon', 
          name: 'Ajdarho Avatari', 
          description: 'Kuch va hukmronlik ramzi',
          type: 'avatar', 
          rarity: 'legendary',
          icon: '🐉',
          price: 5000,
          color: '#FF4500'
        }
      ];
      
      setShopItems(mockShopItems);
      
      // Reyting jadvali
      const mockLeaderboard = [
        { 
          userId: 111111, 
          name: 'Alex', 
          totalCoins: 12850, 
          winStreak: 15,
          rank: 1
        }
      ];
      
      setLeaderboard(mockLeaderboard);
      
      console.log('✅ User data loaded successfully');
      
    } catch (error) {
      console.error('❌ User data loading error:', error);
      showNotification('❌ Ma\'lumotlar yuklanmadi, internetni tekshiring');
    }
  };

  // 🔹 TELEGRAM TUGMALARINI SOZLASH
  const setupTelegramButtons = (tg) => {
    // Asosiy tugma
    tg.MainButton.setText("🎮 O'YINNI BOSHLASH");
    tg.MainButton.color = "#31b545";
    tg.MainButton.textColor = "#ffffff";
    tg.MainButton.onClick(startNewGame);
    tg.MainButton.show();
    
    // Orqaga tugmasi
    tg.BackButton.onClick(() => {
      if (showShop) setShowShop(false);
      else if (showProfile) setShowProfile(false);
      else if (showLeaderboard) setShowLeaderboard(false);
      else tg.BackButton.hide();
    });
    
    // Settings tugmasi
    if (tg.SettingsButton) {
      tg.SettingsButton.show();
      tg.SettingsButton.onClick(() => {
        setShowProfile(true);
      });
    }
  };

  // 🔹 XABAR KO'RSATISH
  const showNotification = (message, type = 'info', duration = 3000) => {
    setNotification({ message, type });
    
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, duration);
    
    // Haptic feedback (agar Telegram bo'lsa)
    if (window.Telegram?.WebApp?.HapticFeedback) {
      const haptic = window.Telegram.WebApp.HapticFeedback;
      if (type === 'success') haptic.notificationOccurred('success');
      else if (type === 'error') haptic.notificationOccurred('error');
      else haptic.selectionChanged();
    }
  };

  // 🔹 YANGI O'YIN BOSHLASH - ASOSIY FUNKSIYA
  const startNewGame = useCallback(() => {
    console.log('🎮 startNewGame chaqirildi');
    console.log('Current user:', user);
    console.log('Ref user:', userRef.current);
    
    // 🔥 User'ni ref orqali tekshirish
    const currentUser = userRef.current;
    
    if (!currentUser) {
      console.error('❌ Foydalanuvchi ma\'lumotlari mavjud emas!');
      showNotification('❌ Foydalanuvchi ma\'lumotlari mavjud emas! Iltimos, qayta yuklang.', 'error');
      
      // Qayta urinish - test foydalanuvchi yaratish
      setupTestUser();
      setTimeout(() => {
        startNewGame();
      }, 1000);
      return;
    }
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (botTimerRef.current) {
      clearInterval(botTimerRef.current);
      botTimerRef.current = null;
    }
    
    // O'yin holatini yangilash
    setGameState({
      status: 'waiting',
      opponent: null,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    console.log('🎮 O\'yin boshlanmoqda, foydalanuvchi:', currentUser.first_name);
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    // Asosiy tugmani yashirish
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.MainButton.hide();
    }
    
    // Taymerni boshlash
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.status !== 'waiting') {
          clearInterval(timerRef.current);
          return prev;
        }
        
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          
          // Agar raqib topilmagan bo'lsa, bot o'ynash
          if (prev.status === 'waiting') {
            setTimeout(() => playWithBot(), 1000);
          }
          
          return prev;
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
    
    showNotification('🔍 Raqib qidirilmoqda...', 'info');
    
    // 3-10 soniya orasida raqib topish (simulyatsiya)
    const waitTime = Math.floor(Math.random() * 7000) + 3000;
    setTimeout(() => {
      setGameState(prevState => {
        if (prevState.status === 'waiting') {
          findOpponent();
        }
        return prevState;
      });
    }, waitTime);
  }, [user]); // 🔥 user dependency qo'shildi

  // 🔹 RAQIB TOPISH (SIMULYATSIYA)
  const findOpponent = () => {
    const botNames = ['Alex', 'Sarah', 'Mike', 'Luna', 'David'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    const botId = Math.floor(Math.random() * 1000000) + 1000000;
    
    const opponent = {
      id: botId,
      firstName: randomName,
      username: `${randomName.toLowerCase()}_bot`,
      photo_url: null,
      isBot: true
    };
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: opponent,
      timer: 60
    }));
    
    showNotification(`🎯 Raqib topildi: ${randomName}!`, 'success');
    
    // Bot o'yinchi ham tanlov qilishi
    setTimeout(() => {
      setGameState(prev => {
        if (prev.status === 'playing' && !prev.opponentChoice) {
          makeBotChoice();
        }
        return prev;
      });
    }, Math.floor(Math.random() * 3000) + 2000);
    
    // O'yin vaqti
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
          finishGame('timeout');
          return { ...prev, timer: 0 };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

  // 🔹 BOT TANLOVI
  const makeBotChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    setGameState(prev => ({
      ...prev,
      opponentChoice: botChoice
    }));
    
    // Agar ikkala o'yinchi ham tanlagan bo'lsa, natijani hisoblash
    if (gameState.myChoice) {
      setTimeout(() => calculateResult(gameState.myChoice, botChoice), 1000);
    }
  };

  // 🔹 BOT BILAN O'YNASH
  const playWithBot = () => {
    const botNames = ['Bot_Junior', 'Bot_Pro'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: {
        id: 999999,
        firstName: randomName,
        username: 'auto_bot',
        isBot: true
      },
      timer: 30
    }));
    
    showNotification('🤖 Bot bilan o\'ynaysiz', 'info');
    
    // Bot tezroq tanlov qiladi
    setTimeout(() => {
      makeBotChoice();
    }, 1500);
  };

  // 🔹 TANLOV QILISH
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing' || gameState.myChoice) {
      return;
    }
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    
    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));
    
    showNotification(`✅ Tanlovingiz: ${getChoiceName(choice)}`, 'info');
    
    // Agar raqib ham tanlagan bo'lsa, natijani hisoblash
    if (gameState.opponentChoice) {
      setTimeout(() => calculateResult(choice, gameState.opponentChoice), 1000);
    } else if (gameState.opponent?.isBot) {
      // Agar bot bo'lsa, u ham tezroq tanlaydi
      setTimeout(() => {
        if (!gameState.opponentChoice) {
          makeBotChoice();
        }
      }, 500);
    }
  };

  // 🔹 NATIJANI HISOBLASH
  const calculateResult = (playerChoice, opponentChoice) => {
    if (!playerChoice || !opponentChoice) return;
    
    // O'yin qoidalari
    const rules = {
      rock: { beats: 'scissors', loses: 'paper' },
      paper: { beats: 'rock', loses: 'scissors' },
      scissors: { beats: 'paper', loses: 'rock' }
    };
    
    let result;
    let coinsEarned = 0;
    
    if (playerChoice === opponentChoice) {
      result = 'draw';
      coinsEarned = 20;
    } else if (rules[playerChoice].beats === opponentChoice) {
      result = 'win';
      coinsEarned = 50;
      
      // Bonus: ketma-ket g'alaba
      const winStreak = dailyStatus.streak || 1;
      coinsEarned += Math.min(winStreak * 5, 100);
    } else {
      result = 'lose';
      coinsEarned = 10;
    }
    
    // Taymerni to'xtatish
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // O'yin natijasini yangilash
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: result,
      timer: 0
    }));
    
    // Koinlarni yangilash
    setUserCoins(prev => prev + coinsEarned);
    
    // Statistika yangilash
    setUserStats(prev => {
      const newStats = { ...prev, totalGames: prev.totalGames + 1 };
      if (result === 'win') newStats.wins += 1;
      else if (result === 'lose') newStats.losses += 1;
      else newStats.draws += 1;
      
      // G'alaba foizi
      newStats.winRate = Math.round((newStats.wins / newStats.totalGames) * 100);
      return newStats;
    });
    
    // Natija haqida xabar
    const resultMessages = {
      win: `🏆 G'alaba! +${coinsEarned} koin qozondingiz!`,
      lose: `😔 Mag'lubiyat! +${coinsEarned} koin qozondingiz`,
      draw: `🤝 Durrang! +${coinsEarned} koin qozondingiz`
    };
    
    showNotification(resultMessages[result], result === 'win' ? 'success' : 'info');
    
    // Asosiy tugmani qayta ko'rsatish
    if (window.Telegram?.WebApp) {
      setTimeout(() => {
        window.Telegram.WebApp.MainButton.show();
      }, 2000);
    }
  };

  // 🔹 O'YINNI TUGATISH
  const finishGame = (result) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    let coinsEarned = 0;
    if (result === 'timeout') {
      coinsEarned = 5;
      showNotification('⏰ Vaqt tugadi! +5 koin', 'info');
    }
    
    setUserCoins(prev => prev + coinsEarned);
    
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: result
    }));
    
    // Asosiy tugmani qayta ko'rsatish
    if (window.Telegram?.WebApp) {
      setTimeout(() => {
        window.Telegram.WebApp.MainButton.show();
      }, 1000);
    }
  };

  // 🔹 TANLOV NOMINI OLISH
  const getChoiceName = (choice) => {
    switch (choice) {
      case 'rock': return 'Tosh';
      case 'paper': return 'Qog\'oz';
      case 'scissors': return 'Qaychi';
      default: return 'Noma\'lum';
    }
  };

  // 🔹 TANLOV EMOJISI
  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };

  // 🔹 RARITY RANGI
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#808080';
      case 'rare': return '#1E90FF';
      case 'epic': return '#9370DB';
      case 'legendary': return '#FFD700';
      default: return '#808080';
    }
  };

  // 🔹 PROFIL RASMINI KO'RSATISH
  const getProfileImage = (photoUrl, firstName, size = 40, hasFrame = false) => {
    const style = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      objectFit: 'cover',
      border: hasFrame ? '3px solid #FFD700' : '2px solid #31b545',
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
        <div className="profile-image-container" style={{ position: 'relative' }}>
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
        </div>
      );
    }
    
    return (
      <div style={style}>
        {firstName?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  // 🔹 YUKLANMOQDA KOMPONENTI
  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>Telegram O'yin Yuklanmoqda...</h2>
          <p>Iltimos, biroz kuting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 🔔 XABAR KO'RSATISH */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {/* 📱 HEADER */}
      <header className="header">
        <div className="header-left">
          <h1>🎮 Tosh • Qaychi • Qog'oz</h1>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus}`}></span>
            <span className="status-text">
              {connectionStatus === 'connected' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="header-right">
          {/* 💰 KOIN PANELI */}
          <div className="coins-panel">
            <div className="coins-display" title="Koinlar">
              <span className="coin-icon">🪙</span>
              <span className="coin-amount">{userCoins.toLocaleString()}</span>
            </div>
            <button 
              className={`daily-bonus-btn ${dailyStatus.available ? 'available' : 'unavailable'}`}
              onClick={() => {
                const bonusAmount = 100 + (dailyStatus.streak || 0) * 25;
                const newStreak = (dailyStatus.streak || 0) + 1;
                
                setUserCoins(prev => prev + bonusAmount);
                setDailyStatus(prev => ({
                  ...prev,
                  available: false,
                  streak: newStreak,
                  lastClaim: Date.now()
                }));
                
                showNotification(`🎉 +${bonusAmount} koin! (${newStreak} kun ketma-ket)`, 'success');
              }}
              title={dailyStatus.available ? 'Kunlik bonus olish' : 'Kunlik bonus tugadi'}
            >
              <span className="bonus-icon">🎁</span>
              {dailyStatus.streak > 0 && (
                <span className="bonus-streak">{dailyStatus.streak}</span>
              )}
            </button>
          </div>
          
          {/* 👤 PROFIL */}
          <button 
            className="profile-btn"
            onClick={() => setShowProfile(true)}
            aria-label="Profil"
          >
            {getProfileImage(userPhoto, user?.first_name, 40, true)}
          </button>
        </div>
      </header>
      
      {/* 🎮 ASOSIY KONTENT */}
      <main className="main-content">
        {/* IDLE - Bosh menyu */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle-screen">
            <div className="welcome-message">
              <h2>Salom, {user?.first_name || 'Foydalanuvchi'}! 👋</h2>
              <p>Raqibingizni mag'lub qiling va koinlar yuting! 🏆</p>
            </div>
            
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="stat-icon">🪙</span>
                <span className="stat-text">{userCoins.toLocaleString()} koin</span>
              </div>
              <div className="quick-stat">
                <span className="stat-icon">🔥</span>
                <span className="stat-text">{dailyStatus.streak || 0} kun streak</span>
              </div>
              <div className="quick-stat">
                <span className="stat-icon">👥</span>
                <span className="stat-text">{leaderboard.length} o'yinchi</span>
              </div>
            </div>
            
            <div className="game-rules">
              <h3>📖 O'yin qoidalari:</h3>
              <ul className="rules-list">
                <li><span>✊</span> Tosh qaychini yengadi</li>
                <li><span>✌️</span> Qaychi qog'ozni yengadi</li>
                <li><span>✋</span> Qog'oz toshni yengadi</li>
                <li><span>🏆</span> G'alaba: +50 koin</li>
                <li><span>🤝</span> Durrang: +20 koin</li>
                <li><span>🎁</span> Har kun: Daily bonus</li>
              </ul>
            </div>
            
            <div className="action-buttons">
              <button className="secondary-btn" onClick={() => setShowProfile(true)}>
                👤 Profil
              </button>
              <button className="secondary-btn" onClick={() => setShowShop(true)}>
                🛒 Do'kon
              </button>
              <button className="secondary-btn" onClick={() => setShowLeaderboard(true)}>
                📊 Reyting
              </button>
            </div>
          </div>
        )}
        
        {/* WAITING - Raqib qidirilmoqda */}
        {gameState.status === 'waiting' && (
          <div className="game-screen waiting-screen">
            <div className="waiting-content">
              <div className="spinner large"></div>
              <h2>Raqib qidirilmoqda...</h2>
              
              <div className="waiting-animation">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </div>
              
              <div className="waiting-stats">
                <div className="waiting-stat">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-value">{gameState.timer}s</div>
                  <div className="stat-label">qoldi</div>
                </div>
                <div className="waiting-stat">
                  <div className="stat-icon">👤</div>
                  <div className="stat-value">1</div>
                  <div className="stat-label">siz</div>
                </div>
                <div className="waiting-stat">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">?</div>
                  <div className="stat-label">raqib</div>
                </div>
              </div>
              
              <div className="waiting-tips">
                <p>💡 <strong>Maslahat:</strong> Do'stlaringizni taklif qiling tezroq o'ynash uchun!</p>
              </div>
              
              <div className="waiting-actions">
                <button className="cancel-btn" onClick={() => {
                  setGameState({
                    status: 'idle',
                    opponent: null,
                    opponentPhoto: null,
                    myChoice: null,
                    opponentChoice: null,
                    result: null,
                    timer: 60,
                    gameId: null
                  });
                  
                  if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.MainButton.show();
                  }
                }}>
                  ❌ Bekor qilish
                </button>
                <button className="retry-btn" onClick={startNewGame}>
                  🔄 Qayta urinish
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* PLAYING - O'yin davom etmoqda */}
        {gameState.status === 'playing' && (
          <div className="game-screen playing-screen">
            <div className="playing-content">
              {/* Raqib ma'lumotlari */}
              <div className="opponent-info">
                <h3>👤 Raqib:</h3>
                <div className="opponent-card">
                  <div className="opponent-avatar">
                    {getProfileImage(gameState.opponentPhoto, gameState.opponent?.firstName, 50, false)}
                  </div>
                  <div className="opponent-details">
                    <h4>{gameState.opponent?.firstName || 'Raqib'}</h4>
                    <p className="opponent-status">
                      {gameState.opponent?.isBot ? '🤖 Bot' : '👤 O\'yinchi'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Taymer */}
              <div className="game-timer">
                <div className="timer-icon">⏰</div>
                <div className="timer-value">{gameState.timer}s qoldi</div>
              </div>
              
              {/* Tanlovlar */}
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
              
              {/* Tanlovlar ko'rinishi */}
              <div className="choices-display">
                <div className="choice-container player-choice">
                  <div className="choice-box you">
                    <div className="choice-label">Siz</div>
                    <div className="choice-emoji-large">
                      {getChoiceEmoji(gameState.myChoice)}
                    </div>
                    <div className="choice-status">
                      {gameState.myChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
                
                <div className="vs">VS</div>
                
                <div className="choice-container opponent-choice">
                  <div className="choice-box opponent">
                    <div className="choice-label">Raqib</div>
                    <div className="choice-emoji-large">
                      {getChoiceEmoji(gameState.opponentChoice)}
                    </div>
                    <div className="choice-status">
                      {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* FINISHED - O'yin tugadi */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished-screen">
            <div className="finished-content">
              <h2 className={`result-title ${gameState.result}`}>
                {gameState.result === 'win' ? '🏆 G\'ALABA!' : 
                 gameState.result === 'lose' ? '😔 MAG\'LUBIYAT' : 
                 gameState.result === 'draw' ? '🤝 DURRANG' : 
                 '⏰ VAQT TUGADI'}
              </h2>
              
              <div className="final-choices">
                <div className="final-choice">
                  <div className="choice-player">Siz</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.myChoice)}</div>
                  <div className="choice-name">
                    {gameState.myChoice === 'rock' ? 'Tosh' : 
                     gameState.myChoice === 'paper' ? 'Qog\'oz' : 'Qaychi'}
                  </div>
                </div>
                
                <div className="vs-final">VS</div>
                
                <div className="final-choice">
                  <div className="choice-player">Raqib</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-name">
                    {gameState.opponentChoice === 'rock' ? 'Tosh' : 
                     gameState.opponentChoice === 'paper' ? 'Qog\'oz' : 'Qaychi'}
                  </div>
                </div>
              </div>
              
              <div className="result-message">
                {gameState.result === 'win' && 'Tabriklaymiz! Siz raqibingizni mag\'lub etdingiz! 🎉'}
                {gameState.result === 'lose' && 'Afsuski, raqibingiz sizni mag\'lub etdi. Keyingi safar omad!'}
                {gameState.result === 'draw' && 'Qiziq! Ikkalangiz ham teng kuchdasiz!'}
                {gameState.result === 'timeout' && 'Vaqt tugadi. Keyingi safar tezroq harakat qiling!'}
              </div>
              
              <div className="result-actions">
                <button className="play-again-btn" onClick={startNewGame}>
                  🔄 YANA O'YNA
                </button>
                <button className="menu-btn" onClick={() => {
                  setGameState({
                    status: 'idle',
                    opponent: null,
                    opponentPhoto: null,
                    myChoice: null,
                    opponentChoice: null,
                    result: null,
                    timer: 60,
                    gameId: null
                  });
                  
                  if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.MainButton.show();
                  }
                }}>
                  📋 Bosh menyu
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* PROFIL MODALI */}
        {showProfile && (
          <div className="modal-overlay">
            <div className="modal profile-modal">
              <div className="modal-header">
                <h2>👤 Profil</h2>
                <button className="modal-close" onClick={() => setShowProfile(false)}>✕</button>
              </div>
              
              <div className="profile-info">
                <div className="profile-avatar">
                  {getProfileImage(userPhoto, user?.first_name, 80, true)}
                </div>
                
                <div className="profile-details">
                  <h3>{user?.first_name || 'Foydalanuvchi'}</h3>
                  <p className="username">@{user?.username || 'noma\'lum'}</p>
                  <div className="user-id">ID: {user?.id || '000000'}</div>
                </div>
              </div>
              
              <div className="profile-stats">
                <div className="stat-card">
                  <div className="stat-icon">🪙</div>
                  <div className="stat-content">
                    <div className="stat-label">Koinlar</div>
                    <div className="stat-value">{userCoins.toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <div className="stat-label">G'alaba</div>
                    <div className="stat-value">{userStats.wins}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Reyting</div>
                    <div className="stat-value">#{userStats.rank}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-content">
                    <div className="stat-label">Streak</div>
                    <div className="stat-value">{dailyStatus.streak || 0} kun</div>
                  </div>
                </div>
              </div>
              
              <div className="profile-actions">
                <button className="action-btn" onClick={() => { setShowShop(true); setShowProfile(false); }}>
                  🛒 Do'kon
                </button>
                <button className="action-btn" onClick={() => { setShowLeaderboard(true); setShowProfile(false); }}>
                  📊 Reyting
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* 🦶 FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-title">🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
          <p className="footer-copyright">© 2024 - Offline Demo Version</p>
        </div>
      </footer>
    </div>
  );
}

export default App;