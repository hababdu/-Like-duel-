import React, { useEffect, useState, useRef } from 'react';
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
    gameId: null,
    roomCode: null,
    playersInRoom: 0
  });
  
  const [userCoins, setUserCoins] = useState(1500);
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ 
    available: true, 
    streak: 3, 
    nextIn: 0
  });
  
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [userStats, setUserStats] = useState({
    wins: 25,
    losses: 10,
    draws: 5,
    totalGames: 40,
    winRate: 62.5,
    rank: 15,
    duelsWon: 12,
    duelsPlayed: 20
  });
  
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  
  const timerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const roomsUpdateRef = useRef(null);

  // 🔹 TELEGRAM WEBAPP SOZLASH
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      
      try {
        // Telegram WebApp mavjudligini tekshirish
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          
          tg.ready();
          tg.expand();
          
          // Theme moslashuvi
          applyTelegramTheme(tg);
          
          // Foydalanuvchi ma'lumotlarini olish
          const userData = tg.initDataUnsafe?.user;
          if (userData) {
            console.log('✅ Telegram user:', userData);
            await setupUser(userData);
          } else {
            console.log('⚠️ No Telegram user, using test data');
            await setupTestUser();
          }
          
          // Telegram tugmalarini sozlash
          setupTelegramButtons(tg);
          
        } else {
          // Telegram WebApp yo'q - test rejimi
          console.log('⚠️ Telegram WebApp not found, using test mode');
          await setupTestUser();
        }
        
        // Do'stlar ro'yxatini yuklash
        loadFriendsList();
        
        // Faol xonalarni yuklash (simulyatsiya)
        loadActiveRooms();
        
      } catch (error) {
        console.error('App init error:', error);
        await setupTestUser();
      }
      
      setIsLoading(false);
      showNotification('🎮 O\'yinga xush kelibsiz!', 'success');
    };

    initApp();

    // Cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      if (roomsUpdateRef.current) clearInterval(roomsUpdateRef.current);
    };
  }, []);

  // 🔹 FOYDALANUVCHINI SOZLASH
  const setupUser = async (userData) => {
    const newUser = {
      id: userData.id || Math.floor(Math.random() * 1000000) + 100000,
      first_name: userData.first_name || 'Foydalanuvchi',
      username: userData.username || '',
      language_code: userData.language_code || 'uz'
    };
    
    setUser(newUser);
    
    if (userData.photo_url) {
      setUserPhoto(userData.photo_url);
    }
    
    await loadUserData(newUser);
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
    await loadUserData(testUser);
  };

  // 🔹 FOYDALANUVCHI MA'LUMOTLARINI YUKLASH
  const loadUserData = async (currentUser) => {
    try {
      // Mock data
      setDailyStatus({
        available: true,
        streak: Math.floor(Math.random() * 10) + 1,
        nextIn: 0
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
          price: 1000
        }
      ];
      
      setInventory(mockInventory);
      
      // Do'kon
      const mockShopItems = [
        { 
          id: 'avatar_dragon', 
          name: 'Ajdarho Avatari', 
          description: 'Kuch va hukmronlik ramzi',
          type: 'avatar', 
          rarity: 'legendary',
          icon: '🐉',
          price: 5000
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
      
      console.log('✅ User data loaded');
      
    } catch (error) {
      console.error('❌ User data loading error:', error);
    }
  };

  // 🔹 DO'STLAR RO'YXATINI YUKLASH
  const loadFriendsList = () => {
    const mockFriends = [
      { id: 222222, name: 'Sarah', username: 'sarah_queen', isOnline: true, lastSeen: Date.now() },
      { id: 333333, name: 'Mike', username: 'mike_rock', isOnline: false, lastSeen: Date.now() - 3600000 },
      { id: 444444, name: 'Luna', username: 'luna_star', isOnline: true, lastSeen: Date.now() },
      { id: 555555, name: 'David', username: 'david_king', isOnline: true, lastSeen: Date.now() },
      { id: 666666, name: 'Emma', username: 'emma_light', isOnline: false, lastSeen: Date.now() - 7200000 }
    ];
    
    setFriends(mockFriends);
  };

  // 🔹 FAOL XONALARNI YUKLASH
  const loadActiveRooms = () => {
    const mockRooms = [
      { code: 'ABC123', host: 'Alex', players: 1, maxPlayers: 2, createdAt: Date.now() - 60000 },
      { code: 'DEF456', host: 'Sarah', players: 2, maxPlayers: 2, createdAt: Date.now() - 120000 },
      { code: 'GHI789', host: 'Mike', players: 1, maxPlayers: 2, createdAt: Date.now() - 180000 },
      { code: 'JKL012', host: 'Luna', players: 2, maxPlayers: 2, createdAt: Date.now() - 240000 },
      { code: 'MNO345', host: 'David', players: 1, maxPlayers: 2, createdAt: Date.now() - 300000 }
    ];
    
    setActiveRooms(mockRooms);
    
    // Har 30 soniyada xonalarni yangilash
    roomsUpdateRef.current = setInterval(() => {
      setActiveRooms(prev => prev.map(room => ({
        ...room,
        players: Math.min(room.players + (Math.random() > 0.7 ? 1 : 0), 2)
      })));
    }, 30000);
  };

  // 🔹 XONA KODI YARATISH
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 🔹 XONA YARATISH
  const createRoom = () => {
    if (!user) {
      showNotification('❌ Foydalanuvchi ma\'lumotlari mavjud emas', 'error');
      return;
    }
    
    const roomCode = generateRoomCode();
    
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      roomCode: roomCode,
      playersInRoom: 1
    }));
    
    // Yangi xonani ro'yxatga qo'shish
    const newRoom = {
      code: roomCode,
      host: user.first_name,
      players: 1,
      maxPlayers: 2,
      createdAt: Date.now()
    };
    
    setActiveRooms(prev => [newRoom, ...prev]);
    setShowCreateRoom(false);
    
    showNotification(`🏠 Xona yaratildi: ${roomCode}\nKodni do'stlaringizga ulashing!`, 'success');
    
    // 60 soniya kutish
    startRoomTimer();
  };

  // 🔹 XONAGA ULASHISH
  const joinRoom = (roomCode) => {
    if (!user) {
      showNotification('❌ Foydalanuvchi ma\'lumotlari mavjud emas', 'error');
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
    
    showNotification(`✅ Xonaga ulandingiz: ${room.code}\nO'yin boshlanishini kuting...`, 'success');
    
    // 5 soniyadan keyin o'yin boshlanishi (simulyatsiya)
    setTimeout(() => {
      startGameWithOpponent(room.host);
    }, 5000);
  };

  // 🔹 DO'ST BILAN O'YNASH
  const playWithFriend = (friend) => {
    if (!user) return;
    
    showNotification(`👋 ${friend.name} bilan o'ynash so'ralmoqda...`, 'info');
    
    // Do'stga "taklif" yuborish (simulyatsiya)
    setTimeout(() => {
      if (Math.random() > 0.3) { // 70% ehtimollik bilan qabul qiladi
        startGameWithOpponent(friend.name, false);
        showNotification(`✅ ${friend.name} taklifni qabul qildi!`, 'success');
      } else {
        showNotification(`❌ ${friend.name} hozir bo'sh emas`, 'info');
      }
    }, 3000);
  };

  // 🔹 RAQIB BILAN O'YIN BOSHLASH
  const startGameWithOpponent = (opponentName, isRandom = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const opponentId = Math.floor(Math.random() * 1000000) + 1000000;
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: {
        id: opponentId,
        firstName: opponentName,
        username: `${opponentName.toLowerCase()}_player`,
        isRandom: isRandom,
        isRealPlayer: true // Haqiqiy o'yinchi deb belgilaymiz
      },
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    showNotification(`🎮 ${opponentName} bilan o'yin boshlanmoqda!`, 'success');
    
    // Taymerni boshlash
    startGameTimer();
    
    // Agar haqiqiy o'yinchi bo'lsa, uning tanlovini simulyatsiya qilish
    if (isRandom) {
      setTimeout(() => {
        simulateOpponentChoice();
      }, Math.floor(Math.random() * 5000) + 3000);
    }
  };

  // 🔹 RAQIB TANLOVI (SIMULYATSIYA)
  const simulateOpponentChoice = () => {
    const choices = ['rock', 'paper', 'scissors'];
    const opponentChoice = choices[Math.floor(Math.random() * choices.length)];
    
    setGameState(prev => ({
      ...prev,
      opponentChoice: opponentChoice
    }));
    
    showNotification(`🎯 Raqib tanlov qildi!`, 'info');
    
    // Agar siz ham tanlagan bo'lsangiz, natijani hisoblash
    if (gameState.myChoice) {
      setTimeout(() => calculateResult(gameState.myChoice, opponentChoice), 1000);
    }
  };

  // 🔹 O'YIN TAYMERI
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

  // 🔹 XONA TAYMERI
  const startRoomTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    let timeLeft = 60;
    
    timerRef.current = setInterval(() => {
      timeLeft -= 1;
      
      setGameState(prev => ({
        ...prev,
        timer: timeLeft
      }));
      
      if (timeLeft <= 0) {
        clearInterval(timerRef.current);
        
        // Agar raqib kelmasa, bot bilan o'ynash
        if (gameState.status === 'waiting') {
          showNotification('⏰ Raqib kelmadi. Bot bilan o\'ynaysiz.', 'info');
          setTimeout(() => {
            playWithBot();
          }, 1000);
        }
      }
    }, 1000);
  };

  // 🔹 BOT BILAN O'YNASH
  const playWithBot = () => {
    const botNames = ['Bot_Pro', 'Bot_Master', 'Bot_Champion', 'Bot_Expert'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];
    
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      opponent: {
        id: 999999,
        firstName: randomName,
        username: 'auto_bot',
        isBot: true,
        isRealPlayer: false
      },
      timer: 60
    }));
    
    showNotification('🤖 Bot bilan o\'ynaysiz', 'info');
    
    startGameTimer();
  };

  // 🔹 TEZKOR O'YIN (RANDOM RAQIB)
  const startQuickGame = () => {
    if (!user) {
      showNotification('❌ Foydalanuvchi ma\'lumotlari mavjud emas', 'error');
      return;
    }
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setGameState({
      status: 'searching',
      opponent: null,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 30,
      gameId: null,
      roomCode: null,
      playersInRoom: 0
    });
    
    showNotification('🔍 Raqib qidirilmoqda...', 'info');
    
    // 3-8 soniya kutish (simulyatsiya)
    const searchTime = Math.floor(Math.random() * 5000) + 3000;
    
    const searchTimer = setInterval(() => {
      setGameState(prev => {
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(searchTimer);
          showNotification('❌ Raqib topilmadi', 'error');
          setGameState({ ...prev, status: 'idle', timer: 60 });
          return prev;
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
    
    // Raqib topish
    setTimeout(() => {
      clearInterval(searchTimer);
      
      const opponentNames = ['Alex', 'Sarah', 'Mike', 'Luna', 'David', 'Emma', 'John', 'Anna'];
      const randomName = opponentNames[Math.floor(Math.random() * opponentNames.length)];
      
      // 80% ehtimollik bilan "haqiqiy o'yinchi" topiladi
      if (Math.random() > 0.2) {
        startGameWithOpponent(randomName, true);
        showNotification(`🎯 Raqib topildi: ${randomName}!`, 'success');
      } else {
        // 20% ehtimollik bilan bot
        playWithBot();
      }
    }, searchTime);
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
    } else if (!gameState.opponent?.isBot) {
      // Agar haqiqiy o'yinchi bo'lsa, uning tanlovini kutish
      showNotification('⏳ Raqib tanlov qilishini kuting...', 'info');
      
      // 2-5 soniyadan keyin raqib tanlov qiladi
      setTimeout(() => {
        if (!gameState.opponentChoice) {
          simulateOpponentChoice();
        }
      }, Math.floor(Math.random() * 3000) + 2000);
    }
  };

  // 🔹 NATIJANI HISOBLASH
  const calculateResult = (playerChoice, opponentChoice) => {
    if (!playerChoice || !opponentChoice) return;
    
    const rules = {
      rock: { beats: 'scissors', loses: 'paper' },
      paper: { beats: 'rock', loses: 'scissors' },
      scissors: { beats: 'paper', loses: 'rock' }
    };
    
    let result;
    let coinsEarned = 0;
    let isDuel = !gameState.opponent?.isBot;
    
    if (playerChoice === opponentChoice) {
      result = 'draw';
      coinsEarned = isDuel ? 25 : 20; // Duelda ko'proq koin
    } else if (rules[playerChoice].beats === opponentChoice) {
      result = 'win';
      coinsEarned = isDuel ? 75 : 50; // Duelda ko'proq koin
      
      // Bonus: ketma-ket g'alaba
      const winStreak = dailyStatus.streak || 1;
      coinsEarned += Math.min(winStreak * 10, 150);
    } else {
      result = 'lose';
      coinsEarned = isDuel ? 15 : 10; // Duelda biroz ko'proq
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
      const newStats = { 
        ...prev, 
        totalGames: prev.totalGames + 1,
        duelsPlayed: isDuel ? prev.duelsPlayed + 1 : prev.duelsPlayed
      };
      
      if (result === 'win') {
        newStats.wins += 1;
        if (isDuel) newStats.duelsWon += 1;
      } else if (result === 'lose') {
        newStats.losses += 1;
      } else {
        newStats.draws += 1;
      }
      
      newStats.winRate = Math.round((newStats.wins / newStats.totalGames) * 100);
      return newStats;
    });
    
    // Kunlik streak yangilash
    if (result === 'win') {
      setDailyStatus(prev => ({
        ...prev,
        streak: (prev.streak || 0) + 1
      }));
    }
    
    // Natija haqida xabar
    const opponentType = gameState.opponent?.isBot ? 'Bot' : 'O\'yinchi';
    const resultMessages = {
      win: `🏆 G'alaba! ${opponentType}ni mag'lub etdingiz! +${coinsEarned} koin`,
      lose: `😔 Mag'lubiyat! ${opponentType}ga yutqazdingiz. +${coinsEarned} koin`,
      draw: `🤝 Durrang! ${opponentType} bilan teng. +${coinsEarned} koin`
    };
    
    showNotification(resultMessages[result], result === 'win' ? 'success' : 'info');
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
      gameId: null,
      roomCode: null,
      playersInRoom: 0
    });
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
  };

  // 🔹 TELEGRAM THEME MOSLASHUVI
  const applyTelegramTheme = (tg) => {
    const theme = tg.themeParams || {};
    document.documentElement.style.setProperty('--tg-bg-color', theme.bg_color || '#1a1a1a');
    document.documentElement.style.setProperty('--tg-text-color', theme.text_color || '#ffffff');
  };

  // 🔹 TELEGRAM TUGMALARI
  const setupTelegramButtons = (tg) => {
    tg.MainButton.setText("⚡ Tezkor O'yin");
    tg.MainButton.color = "#31b545";
    tg.MainButton.textColor = "#ffffff";
    tg.MainButton.onClick(startQuickGame);
    tg.MainButton.show();
  };

  // 🔹 YORDAMCHI FUNKSIYALAR
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

  const getProfileImage = (photoUrl, firstName, size = 40) => {
    const style = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid #31b545',
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
        />
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
          <h2>O'yin Yuklanmoqda...</h2>
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
              {connectionStatus === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="header-right">
          {/* 💰 KOIN PANELI */}
          <div className="coins-panel">
            <div className="coins-display">
              <span className="coin-icon">🪙</span>
              <span className="coin-amount">{userCoins.toLocaleString()}</span>
            </div>
          </div>
          
          {/* 👤 PROFIL */}
          <button 
            className="profile-btn"
            onClick={() => setShowProfile(true)}
          >
            {getProfileImage(userPhoto, user?.first_name, 40)}
          </button>
        </div>
      </header>
      
      {/* 🎮 ASOSIY KONTENT */}
      <main className="main-content">
        {/* IDLE - Bosh menyu */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle-screen">
            <div className="welcome-message">
              <h2>Salom, {user?.first_name}! 👋</h2>
              <p>Haqiqiy o'yinchilar bilan kurashing! 🏆</p>
            </div>
            
            <div className="game-modes">
              <div className="mode-card quick-game" onClick={startQuickGame}>
                <div className="mode-icon">⚡</div>
                <div className="mode-info">
                  <h3>Tezkor O'yin</h3>
                  <p>Random raqib bilan o'ynash</p>
                  <div className="mode-stats">
                    <span className="stat">👥 {activeRooms.length} faol</span>
                    <span className="stat">⏱️ 30s</span>
                  </div>
                </div>
              </div>
              
              <div className="mode-card create-room" onClick={() => setShowCreateRoom(true)}>
                <div className="mode-icon">🏠</div>
                <div className="mode-info">
                  <h3>Xona Yaratish</h3>
                  <p>Do'stlaringizni taklif qiling</p>
                  <div className="mode-stats">
                    <span className="stat">🔐 Maxfiylik</span>
                    <span className="stat">👥 1-2 o'yinchi</span>
                  </div>
                </div>
              </div>
              
              <div className="mode-card join-room" onClick={() => setShowJoinRoom(true)}>
                <div className="mode-icon">🔗</div>
                <div className="mode-info">
                  <h3>Xonaga Ulanish</h3>
                  <p>Kod orqali xonaga ulaning</p>
                  <div className="mode-stats">
                    <span className="stat">🎯 Do'st bilan</span>
                    <span className="stat">🎮 Haqiqiy duel</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* FAOL XONALAR */}
            <div className="active-rooms">
              <h3>🏆 Faol Xonalar ({activeRooms.length})</h3>
              <div className="rooms-list">
                {activeRooms.slice(0, 5).map(room => (
                  <div key={room.code} className="room-item">
                    <div className="room-code">{room.code}</div>
                    <div className="room-info">
                      <div className="room-host">👑 {room.host}</div>
                      <div className="room-players">
                        👥 {room.players}/{room.maxPlayers}
                      </div>
                    </div>
                    <button 
                      className="join-room-btn"
                      onClick={() => joinRoom(room.code)}
                      disabled={room.players >= room.maxPlayers}
                    >
                      {room.players >= room.maxPlayers ? 'To\'ldi' : 'Ulanish'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* DO'STLAR */}
            <div className="friends-section">
              <h3>👥 Do'stlar ({friends.filter(f => f.isOnline).length} online)</h3>
              <div className="friends-list">
                {friends.slice(0, 4).map(friend => (
                  <div key={friend.id} className="friend-item">
                    <div className="friend-avatar">
                      {getProfileImage(null, friend.name, 32)}
                      <span className={`online-status ${friend.isOnline ? 'online' : 'offline'}`}></span>
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{friend.name}</div>
                      <div className="friend-username">@{friend.username}</div>
                    </div>
                    <button 
                      className="play-friend-btn"
                      onClick={() => playWithFriend(friend)}
                      disabled={!friend.isOnline}
                    >
                      🎮 O'ynash
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* STATISTIKA */}
            <div className="user-stats">
              <div className="stat-row">
                <div className="stat-item">
                  <span className="stat-label">Duel G'alaba:</span>
                  <span className="stat-value">{userStats.duelsWon}/{userStats.duelsPlayed}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Umumiy G'alaba:</span>
                  <span className="stat-value">{userStats.winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* SEARCHING - Raqib qidirilmoqda */}
        {gameState.status === 'searching' && (
          <div className="game-screen searching-screen">
            <div className="searching-content">
              <div className="spinner large"></div>
              <h2>Raqib qidirilmoqda...</h2>
              
              <div className="searching-animation">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </div>
              
              <div className="searching-stats">
                <div className="searching-stat">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-value">{gameState.timer}s</div>
                  <div className="stat-label">qoldi</div>
                </div>
                <div className="searching-stat">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">{activeRooms.length}</div>
                  <div className="stat-label">faol o'yinchi</div>
                </div>
              </div>
              
              <div className="searching-tips">
                <p>💡 <strong>Maslahat:</strong> Xona yaratib do'stlaringizni taklif qiling!</p>
              </div>
              
              <button className="cancel-btn" onClick={restartGame}>
                ❌ Bekor qilish
              </button>
            </div>
          </div>
        )}
        
        {/* WAITING - Xonada kutish */}
        {gameState.status === 'waiting' && (
          <div className="game-screen waiting-screen">
            <div className="waiting-content">
              <h2>🏠 Xona: {gameState.roomCode}</h2>
              <p>Do'stlaringizni taklif qiling!</p>
              
              <div className="room-info">
                <div className="room-code-large">{gameState.roomCode}</div>
                <div className="players-count">
                  👥 {gameState.playersInRoom}/2 o'yinchi
                </div>
              </div>
              
              <div className="timer-display">
                <div className="timer-icon">⏰</div>
                <div className="timer-value">{gameState.timer}s</div>
              </div>
              
              <div className="share-section">
                <h4>Xonani ulashing:</h4>
                <div className="share-buttons">
                  <button className="share-btn" onClick={() => {
                    navigator.clipboard.writeText(gameState.roomCode);
                    showNotification('✅ Xona kodi nusxalandi!');
                  }}>
                    📋 Nusxalash
                  </button>
                  <button className="share-btn" onClick={() => {
                    showNotification('📢 Xona havolasi yaratildi!');
                  }}>
                    🔗 Havola
                  </button>
                </div>
              </div>
              
              <div className="waiting-actions">
                <button className="cancel-btn" onClick={restartGame}>
                  ❌ Xonani yopish
                </button>
                <button className="start-bot-btn" onClick={playWithBot}>
                  🤖 Bot bilan boshlash
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
                <div className="player-type-badge">
                  {gameState.opponent?.isBot ? '🤖 Bot' : '👤 Haqiqiy O\'yinchi'}
                </div>
                <h3>{gameState.opponent?.firstName || 'Raqib'}</h3>
                <p className="opponent-type">
                  {gameState.opponent?.isRealPlayer ? 'Haqiqiy duel!' : 'Bot bilan o\'yin'}
                </p>
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
                      {gameState.myChoice ? '✅ Tanlandi' : '⌛ Tanlov qiling'}
                    </div>
                  </div>
                </div>
                
                <div className="vs">VS</div>
                
                <div className="choice-container opponent-choice">
                  <div className="choice-box opponent">
                    <div className="choice-label">
                      {gameState.opponent?.firstName || 'Raqib'}
                    </div>
                    <div className="choice-emoji-large">
                      {getChoiceEmoji(gameState.opponentChoice)}
                    </div>
                    <div className="choice-status">
                      {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* O'yin holati */}
              <div className="game-status">
                {gameState.myChoice && !gameState.opponentChoice && (
                  <p>⏳ Raqib tanlov qilishini kuting...</p>
                )}
                {gameState.opponentChoice && !gameState.myChoice && (
                  <p>🎯 Raqib tanlov qildi! Siz ham tanlang!</p>
                )}
                {gameState.myChoice && gameState.opponentChoice && (
                  <p>⚡ Natija hisoblanmoqda...</p>
                )}
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
              
              <div className="opponent-type-result">
                {gameState.opponent?.isBot ? '🤖 Bot bilan o\'yin' : '👤 Haqiqiy duel!'}
              </div>
              
              <div className="final-choices">
                <div className="final-choice">
                  <div className="choice-player">Siz</div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.myChoice)}</div>
                  <div className="choice-name">
                    {getChoiceName(gameState.myChoice)}
                  </div>
                </div>
                
                <div className="vs-final">VS</div>
                
                <div className="final-choice">
                  <div className="choice-player">
                    {gameState.opponent?.firstName || 'Raqib'}
                  </div>
                  <div className="choice-emoji-final">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-name">
                    {getChoiceName(gameState.opponentChoice)}
                  </div>
                </div>
              </div>
              
              <div className="result-actions">
                <button className="play-again-btn" onClick={startQuickGame}>
                  🔄 YANA O'YNA
                </button>
                <button className="menu-btn" onClick={restartGame}>
                  📋 Bosh menyu
                </button>
                <button className="room-btn" onClick={() => setShowCreateRoom(true)}>
                  🏠 Xona Yaratish
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
                <p>Xona yaratib, do'stlaringizni taklif qiling!</p>
                
                <div className="room-settings">
                  <div className="setting-item">
                    <span className="setting-label">O'yinchilar:</span>
                    <span className="setting-value">2 kishi</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Vaqt:</span>
                    <span className="setting-value">60 soniya</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Koinlar:</span>
                    <span className="setting-value">2x ko'paytirilgan</span>
                  </div>
                </div>
                
                <button className="create-room-btn" onClick={createRoom}>
                  🏠 XONA YARATISH
                </button>
                
                <div className="modal-footer">
                  <p>🎯 Do'stlaringizga xona kodini yuboring!</p>
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
                  />
                </div>
                
                <button 
                  className="join-btn"
                  onClick={() => joinRoom(roomCodeInput)}
                  disabled={roomCodeInput.length !== 6}
                >
                  🔗 XONAGA ULANISH
                </button>
                
                <div className="active-rooms-list">
                  <h4>💡 Faol xonalar:</h4>
                  {activeRooms.slice(0, 3).map(room => (
                    <div key={room.code} className="suggested-room">
                      <span>{room.code}</span>
                      <span>👑 {room.host}</span>
                      <span>👥 {room.players}/2</span>
                      <button 
                        className="quick-join-btn"
                        onClick={() => {
                          setRoomCodeInput(room.code);
                          joinRoom(room.code);
                        }}
                        disabled={room.players >= 2}
                      >
                        Ulanish
                      </button>
                    </div>
                  ))}
                </div>
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
                  {getProfileImage(userPhoto, user?.first_name, 80)}
                </div>
                <div className="profile-details">
                  <h3>{user?.first_name}</h3>
                  <p>@{user?.username || 'noma\'lum'}</p>
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
                  <div className="stat-icon">⚔️</div>
                  <div className="stat-content">
                    <div className="stat-label">Duel G'alaba</div>
                    <div className="stat-value">{userStats.duelsWon}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <div className="stat-label">Umumiy G'alaba</div>
                    <div className="stat-value">{userStats.wins}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-content">
                    <div className="stat-label">Streak</div>
                    <div className="stat-value">{dailyStatus.streak} kun</div>
                  </div>
                </div>
              </div>
              
              <div className="profile-actions">
                <button className="action-btn" onClick={startQuickGame}>
                  ⚡ Tezkor O'yin
                </button>
                <button className="action-btn" onClick={() => setShowCreateRoom(true)}>
                  🏠 Xona Yaratish
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* 🦶 FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-title">🎮 Tosh-Qaychi-Qog'oz • Haqiqiy Duel</p>
          <p className="footer-info">
            {activeRooms.length} faol xona • {friends.filter(f => f.isOnline).length} online o'yinchi
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;