import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  // ✅ 1. Asosiy state'lar
  const [user, setUser] = useState(() => {
    // LocalStorage'dan foydalanuvchi ma'lumotlarini olish
    const savedUser = localStorage.getItem('telegram_game_user');
    return savedUser ? JSON.parse(savedUser) : null;
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
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  const [userStats, setUserStats] = useState(() => {
    const savedStats = localStorage.getItem('telegram_game_stats');
    return savedStats ? JSON.parse(savedStats) : {
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      winRate: 0,
      rank: 999,
      duelsWon: 0,
      duelsPlayed: 0,
      maxWinStreak: 0,
      totalCoinsEarned: 1500
    };
  });
  
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [currentWinStreak, setCurrentWinStreak] = useState(0);
  
  const timerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const roomsUpdateRef = useRef(null);
  const isInitialized = useRef(false);

  // ✅ 2. TELEGRAM WEBAPP BOSHLASH
  useEffect(() => {
    // Bir marta ishlashini ta'minlash
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initApp = async () => {
      setIsLoading(true);
      console.log('🎮 App boshlanmoqda...');
      
      try {
        // Telegram WebApp tekshirish
        if (window.Telegram?.WebApp) {
          console.log('✅ Telegram WebApp topildi');
          const tg = window.Telegram.WebApp;
          
          // Telegram WebApp'ni tayyorlash
          tg.ready();
          tg.expand();
          
          // Theme moslashuvi
          applyTelegramTheme(tg);
          
          // Foydalanuvchi ma'lumotlarini olish
          const userData = tg.initDataUnsafe?.user;
          if (userData && userData.id) {
            console.log('✅ Telegram user data mavjud:', userData);
            await setupUser(userData, tg);
          } else {
            console.log('⚠️ Telegram user data yo\'q, test foydalanuvchi');
            await setupTestUser();
          }
          
          // Telegram tugmalarini sozlash
          setupTelegramButtons(tg);
          
        } else {
          // Telegram WebApp yo'q - test rejimi
          console.log('⚠️ Telegram WebApp topilmadi, test rejimi');
          await setupTestUser();
        }
        
        // Dastlabki ma'lumotlarni yuklash
        await loadInitialData();
        
      } catch (error) {
        console.error('❌ App init xatosi:', error);
        // Xatolik bo'lsa ham test foydalanuvchi yaratish
        await setupTestUser();
        await loadInitialData();
      } finally {
        setIsLoading(false);
        showNotification('🎮 O\'yinga xush kelibsiz!', 'success');
      }
    };

    initApp();

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      if (roomsUpdateRef.current) clearInterval(roomsUpdateRef.current);
    };
  }, []);

  // ✅ 3. LOCALSTORAGE DA YANGILASH
  useEffect(() => {
    if (user) {
      localStorage.setItem('telegram_game_user', JSON.stringify(user));
    }
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
    if (userPhoto) {
      localStorage.setItem('telegram_game_photo', userPhoto);
    }
  }, [userPhoto]);

  // ✅ 4. FOYDALANUVCHI SOZLASH
  const setupUser = async (userData, tg) => {
    console.log('🔄 Foydalanuvchi sozlanmoqda...');
    
    const newUser = {
      id: userData.id || Date.now(),
      first_name: userData.first_name || 'Foydalanuvchi',
      username: userData.username || `user_${Date.now()}`,
      language_code: userData.language_code || 'uz',
      is_premium: userData.is_premium || false,
      photo_url: userData.photo_url || null
    };
    
    setUser(newUser);
    console.log('✅ Foydalanuvchi o\'rnatildi:', newUser.first_name);
    
    // Telegram profil rasmini olish
    if (userData.photo_url) {
      setUserPhoto(userData.photo_url);
    }
    
    // Haptic feedback
    if (tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (e) {
        console.log('⚠️ Haptic feedback ishlamadi');
      }
    }
  };

  // ✅ 5. TEST FOYDALANUVCHI
  const setupTestUser = async () => {
    console.log('🔄 Test foydalanuvchi yaratilmoqda...');
    
    const testUser = {
      id: Math.floor(Math.random() * 900000) + 100000,
      first_name: 'Test',
      username: 'test_player_' + Date.now().toString().slice(-6),
      language_code: 'uz',
      is_premium: false,
      photo_url: null
    };
    
    setUser(testUser);
    console.log('✅ Test foydalanuvchi yaratildi:', testUser.first_name);
  };

  // ✅ 6. DASLABKI MA'LUMOTLARNI YUKLASH
  const loadInitialData = async () => {
    console.log('📦 Dastlabki ma\'lumotlar yuklanmoqda...');
    
    // Kunlik bonus holati
    const lastClaim = dailyStatus.lastClaim ? new Date(dailyStatus.lastClaim) : null;
    const now = new Date();
    
    if (lastClaim) {
      const hoursDiff = (now - lastClaim) / (1000 * 60 * 60);
      setDailyStatus(prev => ({
        ...prev,
        available: hoursDiff >= 20,
        nextIn: hoursDiff < 20 ? Math.ceil(20 - hoursDiff) : 0
      }));
    }
    
    // Inventar
    const mockInventory = [
      { 
        itemId: 'avatar_default', 
        name: 'Boshlang\'ich Avatar', 
        type: 'avatar',
        rarity: 'common',
        icon: '👤',
        equipped: true,
        price: 0,
        color: '#4CAF50'
      },
      { 
        itemId: 'frame_basic', 
        name: 'Oddiy Ramka', 
        type: 'frame',
        rarity: 'common',
        icon: '🔲',
        equipped: true,
        price: 0,
        color: '#2196F3'
      }
    ];
    
    setInventory(mockInventory);
    setEquippedItems({
      avatar: mockInventory[0],
      frame: mockInventory[1]
    });
    
    // Do'kon mahsulotlari
    const mockShopItems = [
      { 
        id: 'avatar_gold', 
        name: 'Oltin Avatar', 
        description: 'Eksklyuziv oltin avatar',
        type: 'avatar', 
        rarity: 'legendary',
        icon: '👑',
        price: 5000,
        color: '#FFD700'
      },
      { 
        id: 'avatar_dragon', 
        name: 'Ajdarho', 
        description: 'Kuchli ajdarho avatari',
        type: 'avatar', 
        rarity: 'epic',
        icon: '🐉',
        price: 2500,
        color: '#FF5722'
      },
      { 
        id: 'frame_fire', 
        name: 'Olov Ramkasi', 
        description: 'Alangali ramka',
        type: 'frame', 
        rarity: 'epic',
        icon: '🔥',
        price: 2000,
        color: '#FF9800'
      },
      { 
        id: 'frame_diamond', 
        name: 'Olmos Ramka', 
        description: 'Yorqin olmos ramka',
        type: 'frame', 
        rarity: 'legendary',
        icon: '💎',
        price: 4000,
        color: '#00BCD4'
      },
      { 
        id: 'title_champion', 
        name: 'Chempion', 
        description: 'G\'olib unvoni',
        type: 'title', 
        rarity: 'epic',
        icon: '🏆',
        price: 3000,
        color: '#9C27B0'
      },
      { 
        id: 'title_king', 
        name: 'Shoh', 
        description: 'Eng yuqori unvon',
        type: 'title', 
        rarity: 'legendary',
        icon: '👑',
        price: 5000,
        color: '#FFC107'
      }
    ];
    
    setShopItems(mockShopItems);
    
    // Reyting jadvali
    const mockLeaderboard = Array.from({ length: 10 }, (_, i) => ({
      userId: 100000 + i,
      name: ['Alex', 'Sarah', 'Mike', 'Luna', 'David', 'Emma', 'John', 'Anna', 'Tom', 'Lisa'][i],
      username: ['alex_champ', 'sarah_queen', 'mike_rock', 'luna_star', 'david_king', 'emma_light', 'john_pro', 'anna_star', 'tom_war', 'lisa_moon'][i],
      photo_url: null,
      totalCoins: 10000 - (i * 800),
      winStreak: 10 - i,
      weeklyWins: 50 - (i * 5),
      rank: i + 1,
      equippedItems: []
    }));
    
    setLeaderboard(mockLeaderboard);
    
    // Do'stlar ro'yxati
    const mockFriends = [
      { id: 200001, name: 'Sarah', username: 'sarah_queen', isOnline: true, lastSeen: Date.now(), winRate: 78 },
      { id: 200002, name: 'Mike', username: 'mike_rock', isOnline: false, lastSeen: Date.now() - 3600000, winRate: 65 },
      { id: 200003, name: 'Luna', username: 'luna_star', isOnline: true, lastSeen: Date.now(), winRate: 82 },
      { id: 200004, name: 'David', username: 'david_king', isOnline: true, lastSeen: Date.now(), winRate: 71 },
      { id: 200005, name: 'Emma', username: 'emma_light', isOnline: false, lastSeen: Date.now() - 7200000, winRate: 69 }
    ];
    
    setFriends(mockFriends);
    
    // Faol xonalar
    const mockRooms = [
      { code: 'ABC123', host: 'Alex', players: 2, maxPlayers: 2, createdAt: Date.now() - 60000, isPublic: true },
      { code: 'DEF456', host: 'Sarah', players: 1, maxPlayers: 2, createdAt: Date.now() - 120000, isPublic: true },
      { code: 'GHI789', host: 'Mike', players: 2, maxPlayers: 2, createdAt: Date.now() - 180000, isPublic: false },
      { code: 'JKL012', host: 'Luna', players: 1, maxPlayers: 2, createdAt: Date.now() - 240000, isPublic: true },
      { code: 'MNO345', host: 'David', players: 1, maxPlayers: 2, createdAt: Date.now() - 300000, isPublic: true }
    ];
    
    setActiveRooms(mockRooms);
    
    // Xonalarni yangilash
    roomsUpdateRef.current = setInterval(() => {
      setActiveRooms(prev => prev.map(room => ({
        ...room,
        players: Math.min(room.players + (Math.random() > 0.8 ? 1 : 0), 2),
        isPublic: Math.random() > 0.3
      })).filter(room => room.createdAt > Date.now() - 600000)); // 10 daqiqadan ko'p bo'lmagan xonalar
    }, 30000);
    
    console.log('✅ Barcha ma\'lumotlar yuklandi');
  };

  // ✅ 7. TEZKOR O'YIN BOSHLASH
  const startQuickGame = () => {
    console.log('🎮 Tezkor o\'yin boshlanmoqda...');
    
    if (!user || !user.id) {
      console.error('❌ Foydalanuvchi mavjud emas');
      showNotification('❌ Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, qayta yuklang.', 'error');
      return;
    }
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // O'yin holatini yangilash
    setGameState({
      status: 'searching',
      opponent: null,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 30,
      gameId: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomCode: null,
      playersInRoom: 0
    });
    
    showNotification('🔍 Raqib qidirilmoqda...', 'info');
    
    // Taymerni boshlash
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          
          // Agar raqib topilmasa
          if (prev.status === 'searching') {
            showNotification('❌ Raqib topilmadi. Qayta urinib ko\'ring.', 'info');
            return { ...prev, status: 'idle', timer: 60 };
          }
          
          return prev;
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
    
    // 2-6 soniyadan keyin raqib topish (simulyatsiya)
    const searchTime = Math.floor(Math.random() * 4000) + 2000;
    
    setTimeout(() => {
      if (gameState.status === 'searching') {
        clearInterval(timerRef.current);
        
        // 70% ehtimollik bilan "haqiqiy o'yinchi"
        if (Math.random() > 0.3) {
          startGameWithRealPlayer();
        } else {
          startGameWithBot();
        }
      }
    }, searchTime);
  };

  // ✅ 8. HAQIQIY O'YINCHI BILAN O'YIN
  const startGameWithRealPlayer = () => {
    const opponentNames = ['Alex', 'Sarah', 'Mike', 'Luna', 'David', 'Emma', 'John', 'Anna'];
    const randomName = opponentNames[Math.floor(Math.random() * opponentNames.length)];
    const opponentId = Math.floor(Math.random() * 900000) + 100000;
    
    const opponent = {
      id: opponentId,
      firstName: randomName,
      username: `${randomName.toLowerCase()}_player`,
      isBot: false,
      isRealPlayer: true,
      winRate: Math.floor(Math.random() * 30) + 50,
      level: Math.floor(Math.random() * 10) + 1
    };
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: opponent,
      timer: 60
    }));
    
    showNotification(`🎯 Raqib topildi: ${randomName} (${opponent.winRate}% g'alaba)`, 'success');
    
    // O'yin taymerini boshlash
    startGameTimer();
    
    // "Haqiqiy o'yinchi" 3-8 soniyada tanlov qiladi
    setTimeout(() => {
      if (gameState.status === 'playing' && !gameState.opponentChoice) {
        makeOpponentChoice();
      }
    }, Math.floor(Math.random() * 5000) + 3000);
  };

  // ✅ 9. BOT BILAN O'YIN
  const startGameWithBot = () => {
    const botNames = ['Bot_Pro', 'Bot_Master', 'Bot_Champion', 'Bot_Expert', 'Bot_Ultimate'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    
    const bot = {
      id: 999999,
      firstName: randomName,
      username: 'auto_bot',
      isBot: true,
      isRealPlayer: false,
      winRate: Math.floor(Math.random() * 40) + 40,
      level: Math.floor(Math.random() * 5) + 1
    };
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: bot,
      timer: 60
    }));
    
    showNotification(`🤖 ${randomName} bilan o\'ynaysiz`, 'info');
    
    // O'yin taymerini boshlash
    startGameTimer();
    
    // Bot 2-5 soniyada tanlov qiladi
    setTimeout(() => {
      if (gameState.status === 'playing' && !gameState.opponentChoice) {
        makeOpponentChoice();
      }
    }, Math.floor(Math.random() * 3000) + 2000);
  };

  // ✅ 10. O'YIN TAYMERI
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
          finishGame('timeout');
          return { ...prev, timer: 0 };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

  // ✅ 11. RAQIB TANLOVI
  const makeOpponentChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    const opponentChoice = choices[Math.floor(Math.random() * choices.length)];
    
    setGameState(prev => ({
      ...prev,
      opponentChoice: opponentChoice
    }));
    
    // Agar foydalanuvchi ham tanlagan bo'lsa, natijani hisoblash
    if (gameState.myChoice) {
      setTimeout(() => {
        calculateResult(gameState.myChoice, opponentChoice);
      }, 1000);
    }
  };

  // ✅ 12. FOYDALANUVCHI TANLOVI
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
    
    // Agar raqib ham tanlagan bo'lsa, natijani hisoblash
    if (gameState.opponentChoice) {
      setTimeout(() => {
        calculateResult(choice, gameState.opponentChoice);
      }, 1000);
    }
  };

  // ✅ 13. NATIJANI HISOBLASH
  const calculateResult = (playerChoice, opponentChoice) => {
    if (!playerChoice || !opponentChoice) return;
    
    const rules = {
      rock: { beats: 'scissors', loses: 'paper' },
      paper: { beats: 'rock', loses: 'scissors' },
      scissors: { beats: 'paper', loses: 'rock' }
    };
    
    let result;
    let coinsEarned = 0;
    let isRealPlayer = gameState.opponent?.isRealPlayer;
    let multiplier = isRealPlayer ? 2 : 1; // Haqiqiy o'yinchi bilan 2x ko'proq koin
    
    if (playerChoice === opponentChoice) {
      result = 'draw';
      coinsEarned = 20 * multiplier;
      setCurrentWinStreak(0);
    } else if (rules[playerChoice].beats === opponentChoice) {
      result = 'win';
      const baseCoins = 50 * multiplier;
      const streakBonus = currentWinStreak * 10;
      coinsEarned = baseCoins + streakBonus;
      
      // Ketma-ket g'alaba
      const newStreak = currentWinStreak + 1;
      setCurrentWinStreak(newStreak);
      
      // Max streak yangilash
      if (newStreak > userStats.maxWinStreak) {
        setUserStats(prev => ({ ...prev, maxWinStreak: newStreak }));
      }
    } else {
      result = 'lose';
      coinsEarned = 10 * multiplier;
      setCurrentWinStreak(0);
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
    setUserCoins(prev => {
      const newCoins = prev + coinsEarned;
      return newCoins;
    });
    
    // Statistika yangilash
    setUserStats(prev => {
      const newStats = { 
        ...prev, 
        totalGames: prev.totalGames + 1,
        totalCoinsEarned: prev.totalCoinsEarned + coinsEarned
      };
      
      if (result === 'win') {
        newStats.wins += 1;
        if (isRealPlayer) newStats.duelsWon += 1;
      } else if (result === 'lose') {
        newStats.losses += 1;
      } else {
        newStats.draws += 1;
      }
      
      // G'alaba foizi
      newStats.winRate = newStats.totalGames > 0 
        ? Math.round((newStats.wins / newStats.totalGames) * 100) 
        : 0;
        
      if (isRealPlayer) {
        newStats.duelsPlayed += 1;
      }
      
      return newStats;
    });
    
    // Natija haqida xabar
    const opponentType = gameState.opponent?.isBot ? 'Bot' : 'O\'yinchi';
    const resultMessages = {
      win: `🏆 G'alaba! ${opponentType}ni mag'lub etdingiz! +${coinsEarned} koin`,
      lose: `😔 Mag'lubiyat! ${opponentType}ga yutqazdingiz. +${coinsEarned} koin`,
      draw: `🤝 Durrang! ${opponentType} bilan teng. +${coinsEarned} koin`
    };
    
    showNotification(resultMessages[result], result === 'win' ? 'success' : 'info');
    
    // Ketma-ket g'alaba haqida
    if (result === 'win' && currentWinStreak > 1) {
      setTimeout(() => {
        showNotification(`🔥 ${currentWinStreak} ketma-ket g'alaba! Streak bonus: +${currentWinStreak * 10} koin`, 'success');
      }, 1500);
    }
  };

  // ✅ 14. O'YINNI TUGATISH
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

  // ✅ 16. SOVG'A SOTIB OLISH
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
      equipped: false,
      purchasedAt: Date.now()
    };
    
    setInventory(prev => [...prev, newItem]);
    
    showNotification(`✅ "${item.name}" sotib olindi!`, 'success');
  };

  // ✅ 17. SOVG'ANI KIYISH
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

  // ✅ 18. XONA YARATISH
  const createRoom = () => {
    if (!user || !user.id) {
      showNotification('❌ Foydalanuvchi mavjud emas', 'error');
      return;
    }
    
    const roomCode = generateRoomCode();
    
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      roomCode: roomCode,
      playersInRoom: 1,
      timer: 120
    }));
    
    // Yangi xonani ro'yxatga qo'shish
    const newRoom = {
      code: roomCode,
      host: user.first_name,
      players: 1,
      maxPlayers: 2,
      createdAt: Date.now(),
      isPublic: true
    };
    
    setActiveRooms(prev => [newRoom, ...prev]);
    setShowCreateRoom(false);
    
    showNotification(`🏠 Xona yaratildi: ${roomCode}\nKodni do'stlaringizga ulashing!`, 'success');
    
    // Xona taymeri
    startRoomTimer();
  };

  // ✅ 19. XONAGA ULANISH
  const joinRoom = (roomCode) => {
    if (!user || !user.id) {
      showNotification('❌ Foydalanuvchi mavjud emas', 'error');
      return;
    }
    
    if (!roomCode) {
      showNotification('❌ Xona kodi kiritilmadi', 'error');
      return;
    }
    
    // Xonani topish
    const room = activeRooms.find(r => r.code === roomCode.toUpperCase());
    
    if (!room) {
      showNotification('❌ Xona topilmadi', 'error');
      return;
    }
    
    if (room.players >= room.maxPlayers) {
      showNotification('❌ Xona to\'ldi', 'error');
      return;
    }
    
    // Xonaga ulanish
    setGameState(prev => ({
      ...prev,
      status: 'joining',
      roomCode: room.code,
      opponent: {
        id: 0,
        firstName: room.host,
        username: 'host',
        isHost: true
      },
      playersInRoom: room.players + 1
    }));
    
    // Xonani yangilash
    setActiveRooms(prev => 
      prev.map(r => r.code === room.code ? { ...r, players: r.players + 1 } : r)
    );
    
    setShowJoinRoom(false);
    setRoomCodeInput('');
    
    showNotification(`✅ Xonaga ulandingiz: ${room.code}`, 'success');
    
    // 5 soniyadan keyin o'yin boshlanishi
    setTimeout(() => {
      startGameWithRealPlayer();
    }, 5000);
  };

  // ✅ 20. YORDAMCHI FUNKSIYALAR
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const getChoiceName = (choice) => {
    switch (choice) {
      case 'rock': return 'Tosh';
      case 'paper': return 'Qog\'oz';
      case 'scissors': return 'Qaychi';
      default: return 'Noma\'lum';
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

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#808080';
      case 'uncommon': return '#1E90FF';
      case 'rare': return '#32CD32';
      case 'epic': return '#9370DB';
      case 'legendary': return '#FFD700';
      default: return '#808080';
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

  const applyTelegramTheme = (tg) => {
    const theme = tg.themeParams || {};
    
    // CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--tg-bg-color', theme.bg_color || '#1a1a2e');
    root.style.setProperty('--tg-text-color', theme.text_color || '#ffffff');
    root.style.setProperty('--tg-hint-color', theme.hint_color || '#aaaaaa');
    root.style.setProperty('--tg-link-color', theme.link_color || '#4a9eff');
    root.style.setProperty('--tg-button-color', theme.button_color || '#31b545');
    root.style.setProperty('--tg-button-text-color', theme.button_text_color || '#ffffff');
    
    // Background color
    try {
      tg.setBackgroundColor(theme.bg_color || '#1a1a2e');
      tg.setHeaderColor(theme.bg_color || '#1a1a2e');
    } catch (e) {}
  };

  const setupTelegramButtons = (tg) => {
    try {
      tg.MainButton.setText("🎮 Tezkor O'yin");
      tg.MainButton.color = "#31b545";
      tg.MainButton.textColor = "#ffffff";
      tg.MainButton.onClick(startQuickGame);
      tg.MainButton.show();
    } catch (e) {
      console.log('⚠️ Telegram buttons setup failed');
    }
  };

  const startRoomTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.status !== 'waiting') {
          clearInterval(timerRef.current);
          return prev;
        }
        
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          showNotification('⏰ Xona muddati tugadi', 'info');
          setGameState(prevState => ({ ...prevState, status: 'idle' }));
          return { ...prev, timer: 0 };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('✅ Nusxalandi!', 'success');
    });
  };

  const restartGame = () => {
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
  };

  // ✅ 21. YUKLANMOQDA KOMPONENTI
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

  // ✅ 22. ASOSIY RENDER
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
                <span className={`status-dot ${connectionStatus}`}></span>
                <span className="status-text">{connectionStatus === 'online' ? 'Online' : 'Offline'}</span>
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
              title={dailyStatus.available ? 'Kunlik bonus olish' : `Kunlik bonus ${dailyStatus.nextIn || 24} soatdan keyin`}
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
        {/* IDLE - Bosh menyu */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && !showCreateRoom && !showJoinRoom && (
          <div className="game-screen idle-screen">
            <div className="welcome-section">
              <div className="welcome-avatar">
                {getProfileImage(userPhoto, user?.first_name, 80)}
                {currentWinStreak > 0 && (
                  <div className="streak-badge">🔥 {currentWinStreak}</div>
                )}
              </div>
              <h2>Salom, {user?.first_name || 'Dost'}! 👋</h2>
              <p className="welcome-subtitle">Haqiqiy o'yinchilar bilan raqobatlashing!</p>
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
                <span className="stat-label">Streak</span>
              </div>
            </div>
            
            <div className="game-modes">
              <button className="game-mode-btn primary" onClick={startQuickGame}>
                <span className="mode-icon">⚡</span>
                <div className="mode-content">
                  <h3>Tezkor O'yin</h3>
                  <p>Random raqib bilan duel</p>
                </div>
                <span className="mode-arrow">→</span>
              </button>
              
              <button className="game-mode-btn secondary" onClick={() => setShowCreateRoom(true)}>
                <span className="mode-icon">🏠</span>
                <div className="mode-content">
                  <h3>Xona Yaratish</h3>
                  <p>Do'stlaringizni taklif qiling</p>
                </div>
                <span className="mode-arrow">→</span>
              </button>
              
              <button className="game-mode-btn secondary" onClick={() => setShowJoinRoom(true)}>
                <span className="mode-icon">🔗</span>
                <div className="mode-content">
                  <h3>Xonaga Ulanish</h3>
                  <p>Kod orqali xonaga ulaning</p>
                </div>
                <span className="mode-arrow">→</span>
              </button>
            </div>
            
            <div className="active-rooms-section">
              <div className="section-header">
                <h3>🎯 Faol Duel Xonalari</h3>
                <span className="online-count">{activeRooms.length} ta</span>
              </div>
              <div className="rooms-grid">
                {activeRooms.slice(0, 3).map(room => (
                  <div key={room.code} className="room-card">
                    <div className="room-code">{room.code}</div>
                    <div className="room-host">👑 {room.host}</div>
                    <div className="room-players">
                      <span className={`player-count ${room.players === 2 ? 'full' : ''}`}>
                        👥 {room.players}/2
                      </span>
                    </div>
                    <button 
                      className={`join-btn ${room.players === 2 ? 'disabled' : ''}`}
                      onClick={() => joinRoom(room.code)}
                      disabled={room.players === 2}
                    >
                      {room.players === 2 ? 'To\'ldi' : 'Ulanish'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bottom-actions">
              <button className="action-btn small" onClick={() => setShowHowToPlay(true)}>
                ❓ Qoidalar
              </button>
              <button className="action-btn small" onClick={() => setShowLeaderboard(true)}>
                🏆 Reyting
              </button>
              <button className="action-btn small" onClick={() => setShowShop(true)}>
                🛒 Do'kon
              </button>
            </div>
          </div>
        )}
        
        {/* SEARCHING - Raqib qidirilmoqda */}
        {gameState.status === 'searching' && (
          <div className="game-screen searching-screen">
            <div className="searching-content">
              <div className="searching-spinner">
                <div className="spinner"></div>
              </div>
              <h2>Raqib qidirilmoqda...</h2>
              <p className="searching-subtitle">Haqiqiy o'yinchilar orasidan</p>
              
              <div className="searching-stats">
                <div className="searching-stat">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-value">{gameState.timer}s</div>
                  <div className="stat-label">qoldi</div>
                </div>
                <div className="searching-stat">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">{activeRooms.length}</div>
                  <div className="stat-label">faol</div>
                </div>
                <div className="searching-stat">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-value">70%</div>
                  <div className="stat-label">haqiqiy</div>
                </div>
              </div>
              
              <div className="searching-tips">
                <p>💡 <strong>Maslahat:</strong> Xona yaratib do'stlaringiz bilan o'ynashingiz mumkin!</p>
              </div>
              
              <button className="cancel-btn" onClick={restartGame}>
                ❌ Bekor qilish
              </button>
            </div>
          </div>
        )}
        
        {/* PLAYING - O'yin davom etmoqda */}
        {gameState.status === 'playing' && (
          <div className="game-screen playing-screen">
            <div className="playing-header">
              <div className="opponent-info">
                <div className="opponent-type">
                  {gameState.opponent?.isRealPlayer ? '👤 HAQIQIY O\'YINCHI' : '🤖 BOT'}
                </div>
                <h2>{gameState.opponent?.firstName || 'Raqib'}</h2>
                <p className="opponent-stats">
                  {gameState.opponent?.winRate}% g'alaba • {gameState.opponent?.level}-daraja
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
                  <div className="choice-label">{gameState.opponent?.firstName}</div>
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
                <p>⏳ Raqib tanlov qilishini kuting...</p>
              )}
              {!gameState.myChoice && gameState.opponentChoice && (
                <p>⚡ Raqib tanlov qildi! Siz ham tanlang!</p>
              )}
              {gameState.myChoice && gameState.opponentChoice && (
                <p>🔮 Natija hisoblanmoqda...</p>
              )}
            </div>
          </div>
        )}
        
        {/* FINISHED - O'yin tugadi */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished-screen">
            <div className="finished-content">
              <div className={`result-banner ${gameState.result}`}>
                {gameState.result === 'win' && (
                  <>
                    <div className="result-icon">🏆</div>
                    <h2>G'ALABA!</h2>
                  </>
                )}
                {gameState.result === 'lose' && (
                  <>
                    <div className="result-icon">😔</div>
                    <h2>MAG'LUBIYAT</h2>
                  </>
                )}
                {gameState.result === 'draw' && (
                  <>
                    <div className="result-icon">🤝</div>
                    <h2>DURRANG</h2>
                  </>
                )}
                {gameState.result === 'timeout' && (
                  <>
                    <div className="result-icon">⏰</div>
                    <h2>VAQT TUGADI</h2>
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
                  <div className="choice-player">{gameState.opponent?.firstName}</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-name">{getChoiceName(gameState.opponentChoice)}</div>
                </div>
              </div>
              
              <div className="result-details">
                <div className="detail-item">
                  <span className="detail-label">Raqib turi:</span>
                  <span className="detail-value">
                    {gameState.opponent?.isRealPlayer ? '👤 Haqiqiy o\'yinchi' : '🤖 Bot'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ketma-ket g'alaba:</span>
                  <span className="detail-value">{currentWinStreak}</span>
                </div>
              </div>
              
              <div className="result-actions">
                <button className="play-again-btn" onClick={startQuickGame}>
                  🔄 YANA O'YNA
                </button>
                <button className="menu-btn" onClick={restartGame}>
                  📋 Bosh menyu
                </button>
              </div>
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
                      <div className="stat-value">{userStats.wins}</div>
                      <div className="stat-label">G'alaba</div>
                    </div>
                  </div>
                  
                  <div className="stat-card-large">
                    <div className="stat-icon">📊</div>
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
                </div>
                
                <div className="profile-details">
                  <div className="detail-row">
                    <span>Jami o'yinlar:</span>
                    <span>{userStats.totalGames}</span>
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
                  <button className="action-btn full" onClick={() => { setShowProfile(false); startQuickGame(); }}>
                    🎮 O'ynash
                  </button>
                  <button className="action-btn full secondary" onClick={() => { setShowShop(true); setShowProfile(false); }}>
                    🛒 Do'kon
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* DO'KON MODALI */}
        {showShop && (
          <div className="modal-overlay">
            <div className="modal shop-modal">
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button className="modal-close" onClick={() => setShowShop(false)}>✕</button>
              </div>
              
              <div className="modal-content">
                <div className="shop-header">
                  <div className="balance-display">
                    <span className="balance-label">Mavjud:</span>
                    <span className="balance-amount">🪙 {userCoins.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="shop-items">
                  {shopItems.map(item => (
                    <div key={item.id} className="shop-item-card" style={{ borderColor: getRarityColor(item.rarity) }}>
                      <div className="item-icon" style={{ color: item.color }}>{item.icon}</div>
                      <div className="item-info">
                        <h4>{item.name}</h4>
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
                      <p>Qaychi toshga yengiladi</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">✌️</div>
                    <div className="rule-content">
                      <h4>Qaychi qog'ozni yengadi</h4>
                      <p>Qog'oz qaychiga yengiladi</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">✋</div>
                    <div className="rule-content">
                      <h4>Qog'oz toshni yengadi</h4>
                      <p>Tosh qog'ozga yengiladi</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">🏆</div>
                    <div className="rule-content">
                      <h4>G'alaba</h4>
                      <p>Bot: +50 koin • O'yinchi: +100 koin</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">🤝</div>
                    <div className="rule-content">
                      <h4>Durrang</h4>
                      <p>+20 koin</p>
                    </div>
                  </div>
                  
                  <div className="rule-item">
                    <div className="rule-icon">🔥</div>
                    <div className="rule-content">
                      <h4>Ketma-ket g'alaba</h4>
                      <p>Har bir ketma-ket g'alaba uchun +10 koin bonus</p>
                    </div>
                  </div>
                </div>
                
                <button className="action-btn full" onClick={() => { setShowHowToPlay(false); startQuickGame(); }}>
                  🎮 O'ynashni Boshlash
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* XONA YARATISH MODALI */}
        {showCreateRoom && (
          <div className="modal-overlay">
            <div className="modal create-room-modal">
              <div className="modal-header">
                <h2>🏠 Xona Yaratish</h2>
                <button className="modal-close" onClick={() => setShowCreateRoom(false)}>✕</button>
              </div>
              
              <div className="modal-content">
                <div className="room-features">
                  <div className="feature">
                    <span className="feature-icon">👥</span>
                    <span className="feature-text">2 o'yinchi</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">⏱️</span>
                    <span className="feature-text">120 soniya</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🪙</span>
                    <span className="feature-text">2x koin</span>
                  </div>
                </div>
                
                <button className="create-room-btn" onClick={createRoom}>
                  🏠 XONA YARATISH
                </button>
                
                <div className="room-instructions">
                  <p>✅ Xona yaratilgandan so'ng:</p>
                  <ol>
                    <li>Xona kodini do'stlaringizga yuboring</li>
                    <li>Do'stingiz kod orqali xonaga ulanadi</li>
                    <li>O'yin avtomatik boshlanadi</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* XONAGA ULANISH MODALI */}
        {showJoinRoom && (
          <div className="modal-overlay">
            <div className="modal join-room-modal">
              <div className="modal-header">
                <h2>🔗 Xonaga Ulanish</h2>
                <button className="modal-close" onClick={() => setShowJoinRoom(false)}>✕</button>
              </div>
              
              <div className="modal-content">
                <div className="input-group">
                  <label>Xona kodi:</label>
                  <input
                    type="text"
                    placeholder="Masalan: ABC123"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="room-input"
                  />
                </div>
                
                <button 
                  className="join-btn"
                  onClick={() => joinRoom(roomCodeInput)}
                  disabled={roomCodeInput.length !== 6}
                >
                  🔗 ULANISH
                </button>
                
                <div className="suggested-rooms">
                  <h4>💡 Faol xonalar:</h4>
                  {activeRooms.slice(0, 3).map(room => (
                    <div key={room.code} className="suggested-room" onClick={() => {
                      setRoomCodeInput(room.code);
                      joinRoom(room.code);
                    }}>
                      <span className="room-code-suggest">{room.code}</span>
                      <span className="room-host-suggest">👑 {room.host}</span>
                      <span className={`room-players-suggest ${room.players === 2 ? 'full' : ''}`}>
                        👥 {room.players}/2
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* 🦶 FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-title">🎮 Tosh-Qaychi-Qog'oz • Haqiqiy Duel</p>
          <div className="footer-stats">
            <span className="footer-stat">👥 {activeRooms.length * 2} o'yinchi</span>
            <span className="footer-stat">🏆 {leaderboard[0]?.name || 'Alex'} yetakchi</span>
            <span className="footer-stat">🎮 {userStats.totalGames} o'yin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;