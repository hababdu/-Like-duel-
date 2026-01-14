import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // Asosiy state'lar
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, waiting, playing, finished
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
    setUser({
      id: userData.id,
      first_name: userData.first_name || 'Foydalanuvchi',
      username: userData.username || '',
      language_code: userData.language_code || 'uz'
    });
    
    // Telegram profil rasmini olish
    if (userData.photo_url) {
      setUserPhoto(userData.photo_url);
    }
    
    // Ma'lumotlarni yuklash
    await loadUserData(userData.id);
    
    // Haptic feedback (tebranish)
    tg.HapticFeedback.impactOccurred('light');
    
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
    await loadUserData(testUser.id);
    
    // Test rejimi haqida xabar
    showNotification('🔧 Test rejimi - Offline o\'ynash');
  };

  // 🔹 FOYDALANUVCHI MA'LUMOTLARINI YUKLASH
  const loadUserData = async (userId) => {
    try {
      // Mock data (backend mavjud bo'lganda API chaqiriladi)
      
      // Kunlik bonus holati
      setDailyStatus({
        available: true,
        streak: Math.floor(Math.random() * 10) + 1,
        nextIn: 0,
        lastClaim: Date.now() - 12 * 60 * 60 * 1000 // 12 soat oldin
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
        },
        { 
          itemId: 'title_champion', 
          name: 'Chempion', 
          type: 'title',
          rarity: 'legendary',
          icon: '🏆',
          equipped: true,
          price: 2000,
          color: '#9370DB'
        },
        { 
          itemId: 'effect_sparkle', 
          name: 'Yorqin Effekt', 
          type: 'effect',
          rarity: 'rare',
          icon: '✨',
          equipped: false,
          price: 300,
          color: '#FF69B4'
        },
        { 
          itemId: 'avatar_silver', 
          name: 'Kumush Avatar', 
          type: 'avatar',
          rarity: 'rare',
          icon: '🥈',
          equipped: false,
          price: 500,
          color: '#C0C0C0'
        }
      ];
      
      setInventory(mockInventory);
      
      // Kiyilgan buyumlar
      setEquippedItems({
        avatar: mockInventory.find(item => item.itemId === 'avatar_gold'),
        frame: mockInventory.find(item => item.itemId === 'frame_fire'),
        title: mockInventory.find(item => item.itemId === 'title_champion')
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
        },
        { 
          id: 'avatar_phoenix', 
          name: 'Feniks Avatari', 
          description: 'Qayta tug\'ilish ramzi',
          type: 'avatar', 
          rarity: 'epic',
          icon: '🔥',
          price: 2500,
          color: '#FF8C00'
        },
        { 
          id: 'frame_diamond', 
          name: 'Olmos Ramkasi', 
          description: 'Yorqin olmos ramka',
          type: 'frame', 
          rarity: 'legendary',
          icon: '💎',
          price: 3000,
          color: '#B9F2FF'
        },
        { 
          id: 'frame_neon', 
          name: 'Neon Ramka', 
          description: 'Zamonaviy neon ramka',
          type: 'frame', 
          rarity: 'epic',
          icon: '💡',
          price: 1500,
          color: '#00FF00'
        },
        { 
          id: 'title_legend', 
          name: 'AFSONA', 
          description: 'Eng yuqori unvon',
          type: 'title', 
          rarity: 'legendary',
          icon: '👑',
          price: 4000,
          color: '#FFD700'
        },
        { 
          id: 'title_master', 
          name: 'USTOZ', 
          description: 'Tajribali o\'yinchi',
          type: 'title', 
          rarity: 'rare',
          icon: '🎓',
          price: 1000,
          color: '#9370DB'
        },
        { 
          id: 'effect_glow', 
          name: 'Yorqinlik Effekti', 
          description: 'Profilni yoritadi',
          type: 'effect', 
          rarity: 'epic',
          icon: '🌟',
          price: 1200,
          color: '#FFFF00'
        },
        { 
          id: 'effect_spark', 
          name: 'Chaqmoq Effekti', 
          description: 'Chaqmoq chaqadi',
          type: 'effect', 
          rarity: 'rare',
          icon: '⚡',
          price: 800,
          color: '#FFD700'
        },
        { 
          id: 'avatar_ocean', 
          name: 'Okean Avatari', 
          description: 'Chuqur okean ramzi',
          type: 'avatar', 
          rarity: 'epic',
          icon: '🌊',
          price: 1800,
          color: '#1E90FF'
        },
        { 
          id: 'frame_celestial', 
          name: 'Osmon Ramkasi', 
          description: 'Yulduzli osmon ramkasi',
          type: 'frame', 
          rarity: 'legendary',
          icon: '🌌',
          price: 3500,
          color: '#4B0082'
        }
      ];
      
      setShopItems(mockShopItems);
      
      // Reyting jadvali
      const mockLeaderboard = [
        { 
          userId: 111111, 
          name: 'Alex', 
          username: 'alex_champ',
          photo_url: null,
          totalCoins: 12850, 
          winStreak: 15,
          weeklyWins: 58,
          rank: 1,
          equippedItems: ['avatar_dragon', 'frame_diamond']
        },
        { 
          userId: 222222, 
          name: 'Sarah', 
          username: 'sarah_queen',
          photo_url: null,
          totalCoins: 11500, 
          winStreak: 12,
          weeklyWins: 49,
          rank: 2,
          equippedItems: ['avatar_phoenix', 'title_legend']
        },
        { 
          userId: 333333, 
          name: 'Mike', 
          username: 'mike_rock',
          photo_url: null,
          totalCoins: 10200, 
          winStreak: 8,
          weeklyWins: 42,
          rank: 3,
          equippedItems: ['avatar_ocean', 'frame_neon']
        },
        { 
          userId: 444444, 
          name: 'Luna', 
          username: 'luna_star',
          photo_url: null,
          totalCoins: 9500, 
          winStreak: 10,
          weeklyWins: 38,
          rank: 4,
          equippedItems: ['avatar_silver', 'effect_glow']
        },
        { 
          userId: 555555, 
          name: 'David', 
          username: 'david_king',
          photo_url: null,
          totalCoins: 8800, 
          winStreak: 6,
          weeklyWins: 35,
          rank: 5,
          equippedItems: ['avatar_gold', 'frame_celestial']
        },
        { 
          userId: 666666, 
          name: 'Emma', 
          username: 'emma_light',
          photo_url: null,
          totalCoins: 8200, 
          winStreak: 7,
          weeklyWins: 32,
          rank: 6,
          equippedItems: ['avatar_phoenix', 'effect_spark']
        },
        { 
          userId: 777777, 
          name: 'John', 
          username: 'john_pro',
          photo_url: null,
          totalCoins: 7800, 
          winStreak: 5,
          weeklyWins: 30,
          rank: 7,
          equippedItems: ['avatar_dragon', 'title_master']
        },
        { 
          userId: 888888, 
          name: 'Anna', 
          username: 'anna_star',
          photo_url: null,
          totalCoins: 7300, 
          winStreak: 9,
          weeklyWins: 28,
          rank: 8,
          equippedItems: ['avatar_ocean', 'frame_neon']
        },
        { 
          userId: 999999, 
          name: 'Tom', 
          username: 'tom_warrior',
          photo_url: null,
          totalCoins: 6900, 
          winStreak: 4,
          weeklyWins: 26,
          rank: 9,
          equippedItems: ['avatar_silver', 'effect_glow']
        },
        { 
          userId: 101010, 
          name: 'Lisa', 
          username: 'lisa_moon',
          photo_url: null,
          totalCoins: 6500, 
          winStreak: 11,
          weeklyWins: 24,
          rank: 10,
          equippedItems: ['avatar_gold', 'title_champion']
        }
      ];
      
      // Agar user leaderboard'da bo'lsa, uni qo'shamiz
      if (user?.id) {
        const userInLeaderboard = mockLeaderboard.find(p => p.userId === user.id);
        if (!userInLeaderboard) {
          mockLeaderboard.push({
            userId: user.id,
            name: user.first_name,
            username: user.username,
            photo_url: userPhoto,
            totalCoins: userCoins,
            winStreak: dailyStatus.streak,
            weeklyWins: Math.floor(Math.random() * 20) + 10,
            rank: Math.floor(Math.random() * 90) + 11,
            equippedItems: ['avatar_gold', 'frame_fire']
          });
        }
      }
      
      setLeaderboard(mockLeaderboard);
      
      // O'yin statistika
      setUserStats({
        wins: Math.floor(Math.random() * 50) + 10,
        losses: Math.floor(Math.random() * 20) + 5,
        draws: Math.floor(Math.random() * 10) + 2,
        totalGames: Math.floor(Math.random() * 80) + 20,
        winRate: Math.floor(Math.random() * 30) + 50,
        rank: Math.floor(Math.random() * 90) + 11
      });
      
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
    if (window.Telegram?.WebApp) {
      const haptic = window.Telegram.WebApp.HapticFeedback;
      if (type === 'success') haptic.notificationOccurred('success');
      else if (type === 'error') haptic.notificationOccurred('error');
      else haptic.selectionChanged();
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
          {hasFrame && equippedItems.frame && (
            <div className="avatar-frame" style={{
              position: 'absolute',
              top: '-5px',
              left: '-5px',
              right: '-5px',
              bottom: '-5px',
              border: '3px solid',
              borderImage: 'linear-gradient(45deg, #FFD700, #FF8C00) 1',
              borderRadius: '50%',
              pointerEvents: 'none'
            }}>
              <span style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '12px'
              }}>
                {equippedItems.frame.icon}
              </span>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div style={style}>
        {firstName?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  // 🔹 YANGI O'YIN BOSHLASH
  const startNewGame = () => {
    if (!user) {
      showNotification('❌ Foydalanuvchi ma\'lumotlari mavjud emas', 'error');
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
    
    // Haptic feedback
    if (window.Telegram?.WebApp) {
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
      if (gameState.status === 'waiting') {
        findOpponent();
      }
    }, waitTime);
  };

  // 🔹 RAQIB TOPISH (SIMULYATSIYA)
  const findOpponent = () => {
    const botNames = [
      'Alex', 'Sarah', 'Mike', 'Luna', 'David', 'Emma', 'John', 'Anna', 'Tom', 'Lisa',
      'Max', 'Sophia', 'Daniel', 'Olivia', 'James', 'Isabella', 'William', 'Mia', 'Benjamin', 'Charlotte'
    ];
    
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
      if (gameState.status === 'playing' && !gameState.opponentChoice) {
        makeBotChoice();
      }
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
    const botNames = ['Bot_Junior', 'Bot_Pro', 'Bot_Master', 'Bot_Champion'];
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
    if (window.Telegram?.WebApp) {
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
      coinsEarned += Math.min(winStreak * 5, 100); // Maksimum 100 bonus
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
    
    // Kunlik streak yangilash
    if (result === 'win') {
      setDailyStatus(prev => ({
        ...prev,
        streak: (prev.streak || 0) + 1
      }));
    } else if (result === 'lose') {
      setDailyStatus(prev => ({
        ...prev,
        streak: 0
      }));
    }
    
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

  // 🔹 KUNLIK BONUS OLISH
  const claimDailyBonus = () => {
    if (!dailyStatus.available) {
      showNotification(`🎁 Kunlik bonus ${dailyStatus.nextIn || 24} soatdan keyin`, 'info');
      return;
    }
    
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
  };

  // 🔹 SOVG'A SOTIB OLISH
  const purchaseItem = (item) => {
    if (userCoins < item.price) {
      showNotification(`❌ Koinlar yetarli emas! Sizda ${userCoins} koin`, 'error');
      return;
    }
    
    setUserCoins(prev => prev - item.price);
    
    // Inventarga qo'shish
    const newItem = {
      ...item,
      itemId: item.id,
      equipped: false
    };
    
    setInventory(prev => [...prev, newItem]);
    
    showNotification(`✅ "${item.name}" sovg'asi sotib olindi!`, 'success');
  };

  // 🔹 SOVG'ANI KIYISH
  const equipItem = (item) => {
    // Barcha shu turdagi buyumlarni kiyilmagan qilish
    const updatedInventory = inventory.map(invItem => {
      if (invItem.type === item.type) {
        return { ...invItem, equipped: false };
      }
      return invItem;
    });
    
    // Yangi buyumni kiyish
    const finalInventory = updatedInventory.map(invItem => {
      if (invItem.itemId === item.itemId) {
        return { ...invItem, equipped: true };
      }
      return invItem;
    });
    
    setInventory(finalInventory);
    
    // Kiyilgan buyumlarni yangilash
    const equipped = finalInventory.find(invItem => invItem.equipped && invItem.type === item.type);
    if (equipped) {
      setEquippedItems(prev => ({
        ...prev,
        [item.type]: equipped
      }));
    }
    
    showNotification(`👕 "${item.name}" kiyildi!`, 'success');
  };

  // 🔹 O'YINNI QAYTA BOSHLASH
  const restartGame = () => {
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
    
    // Asosiy tugmani ko'rsatish
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.MainButton.show();
    }
  };

  // 🔹 TELEGRAM HAQORATLARI
  const openTelegramLink = (url) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
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
              onClick={claimDailyBonus}
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
        {/* 🏪 DO'KON MODALI */}
        {showShop && (
          <div className="modal-overlay">
            <div className="modal shop-modal">
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button className="modal-close" onClick={() => setShowShop(false)}>✕</button>
              </div>
              
              <div className="shop-balance">
                <span>Mavjud koinlar:</span>
                <span className="balance-amount">🪙 {userCoins.toLocaleString()}</span>
              </div>
              
              <div className="shop-items">
                {shopItems.map(item => (
                  <div key={item.id} className="shop-item" style={{ borderColor: getRarityColor(item.rarity) }}>
                    <div className="item-icon">{item.icon}</div>
                    <div className="item-info">
                      <h3>{item.name}</h3>
                      <p className="item-desc">{item.description}</p>
                      <div className="item-tags">
                        <span className="item-type">{item.type}</span>
                        <span className="item-rarity" style={{ color: getRarityColor(item.rarity) }}>
                          {item.rarity}
                        </span>
                      </div>
                    </div>
                    <div className="item-action">
                      <div className="item-price">🪙 {item.price.toLocaleString()}</div>
                      <button 
                        className={`buy-btn ${userCoins >= item.price ? '' : 'disabled'}`}
                        onClick={() => purchaseItem(item)}
                        disabled={userCoins < item.price}
                      >
                        {userCoins >= item.price ? 'Sotib olish' : 'Koin yetarli emas'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* 👤 PROFIL MODALI */}
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
                  {equippedItems.title && (
                    <div className="player-title" style={{ background: equippedItems.title.color }}>
                      {equippedItems.title.icon} {equippedItems.title.name}
                    </div>
                  )}
                </div>
                
                <div className="profile-details">
                  <h3>{user?.first_name}</h3>
                  <p className="username">@{user?.username || 'noma\'lum'}</p>
                  <div className="user-id">ID: {user?.id}</div>
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
              
              <div className="profile-inventory">
                <h4>📦 Inventar ({inventory.length})</h4>
                <div className="inventory-items">
                  {inventory.slice(0, 8).map(item => (
                    <div 
                      key={item.itemId}
                      className={`inventory-item ${item.equipped ? 'equipped' : ''}`}
                      onClick={() => equipItem(item)}
                      title={`${item.name} ${item.equipped ? '(Kiyilgan)' : ''}`}
                      style={{ borderColor: getRarityColor(item.rarity) }}
                    >
                      <span className="item-icon">{item.icon}</span>
                      {item.equipped && <span className="equipped-badge">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="profile-actions">
                <button className="action-btn" onClick={() => { setShowShop(true); setShowProfile(false); }}>
                  🛒 Do'kon
                </button>
                <button className="action-btn" onClick={() => { setShowLeaderboard(true); setShowProfile(false); }}>
                  📊 Reyting
                </button>
                <button className="action-btn" onClick={() => openTelegramLink('https://t.me/')}>
                  🤖 Bot
                </button>
                <button className="action-btn" onClick={() => openTelegramLink('https://t.me/')}>
                  📢 Kanal
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 🏆 REYTING MODALI */}
        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal leaderboard-modal">
              <div className="modal-header">
                <h2>🏆 Top 10 O'yinchi</h2>
                <button className="modal-close" onClick={() => setShowLeaderboard(false)}>✕</button>
              </div>
              
              <div className="leaderboard-list">
                {leaderboard.slice(0, 10).map((player, index) => (
                  <div 
                    key={player.userId}
                    className={`leaderboard-player ${player.userId === user?.id ? 'current' : ''}`}
                  >
                    <div className="player-rank">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                    </div>
                    
                    <div className="player-info">
                      <div className="player-avatar">
                        {getProfileImage(player.photo_url, player.name, 36, true)}
                      </div>
                      <div className="player-details">
                        <div className="player-name">
                          {player.name}
                          {player.userId === user?.id && <span className="you-badge"> (Siz)</span>}
                        </div>
                        <div className="player-stats">
                          🪙 {player.totalCoins.toLocaleString()} | 🔥 {player.winStreak}
                        </div>
                      </div>
                    </div>
                    
                    <div className="player-score">#{player.rank}</div>
                  </div>
                ))}
              </div>
              
              <div className="leaderboard-footer">
                <p>⚡ Sizning reytingingiz: #{userStats.rank}</p>
                <p>📅 Haftalik reyting yangilanadi</p>
              </div>
            </div>
          </div>
        )}
        
        {/* 🎮 O'YIN EKRANLARI */}
        
        {/* IDLE - Bosh menyu */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle-screen">
            <div className="welcome-message">
              <h2>Salom, {user?.first_name}! 👋</h2>
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
            
            <div className="user-stats">
              <h3>📊 Sizning statistika:</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">O'yinlar:</span>
                  <span className="stat-value">{userStats.totalGames}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">G'alaba:</span>
                  <span className="stat-value">{userStats.wins}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Mag'lubiyat:</span>
                  <span className="stat-value">{userStats.losses}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Durrang:</span>
                  <span className="stat-value">{userStats.draws}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">G'alaba %:</span>
                  <span className="stat-value">{userStats.winRate}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Reyting:</span>
                  <span className="stat-value">#{userStats.rank}</span>
                </div>
              </div>
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
                <button className="cancel-btn" onClick={restartGame}>
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
              
              {/* Maslahat */}
              <div className="game-tips">
                <p>💡 <strong>Maslahat:</strong> {gameState.myChoice ? 
                  'Raqib tanlov qilishini kuting...' : 
                  'Tezroq tanlang, vaqt chegarasi bor!'}</p>
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
              
              {/* Koin mukofoti */}
              <div className="coins-reward">
                <div className="reward-card">
                  <div className="reward-icon">🪙</div>
                  <div className="reward-amount">
                    +{gameState.result === 'win' ? 50 : 
                      gameState.result === 'lose' ? 10 : 
                      gameState.result === 'draw' ? 20 : 5}
                  </div>
                  <div className="reward-label">koin qozondingiz</div>
                </div>
                
                {gameState.result === 'win' && (
                  <div className="win-streak">
                    <span className="streak-icon">🔥</span>
                    <span className="streak-text">Ketma-ket {dailyStatus.streak} g'alaba</span>
                  </div>
                )}
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
                <button className="menu-btn" onClick={restartGame}>
                  📋 Bosh menyu
                </button>
                <button className="shop-btn" onClick={() => setShowShop(true)}>
                  🛒 Do'kon
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
          <div className="footer-links">
            <button className="footer-link" onClick={() => openTelegramLink('https://t.me/')}>
              🤖 Bot
            </button>
            <span className="link-separator">•</span>
            <button className="footer-link" onClick={() => openTelegramLink('https://t.me/')}>
              📢 Kanal
            </button>
            <span className="link-separator">•</span>
            <button className="footer-link" onClick={() => openTelegramLink('https://t.me/')}>
              🆘 Yordam
            </button>
          </div>
          <p className="footer-copyright">© 2024 - Barcha huquqlar himoyalangan</p>
        </div>
      </footer>
    </div>
  );
}

export default App;