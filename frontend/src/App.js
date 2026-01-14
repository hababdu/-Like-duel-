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
    status: 'idle', // idle, searching, playing, finished, waiting
    opponent: null,
    opponentPhoto: null,
    myChoice: null,
    opponentChoice: null,
    result: null, // win, lose, draw, timeout
    timer: 60,
    gameId: null,
    roomCode: null,
    playersInRoom: 0,
    isBot: false
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
  const [showHistory, setShowHistory] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  
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
      totalCoinsEarned: 1500,
      level: 1,
      xp: 0
    };
  });
  
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentWinStreak, setCurrentWinStreak] = useState(0);
  const [websocket, setWebsocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  
  const timerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const roomsUpdateRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const isInitialized = useRef(false);

  // ✅ 2. TELEGRAM WEBAPP BOSHLASH
  useEffect(() => {
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
        
        // WebSocket ulanishi
        await connectWebSocket();
        
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (websocket) websocket.close();
    };
  }, []);

  // ✅ 3. WEBSOCKET ULASHISH
  const connectWebSocket = async () => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('🔗 WebSocket allaqachon ulangan');
      return;
    }
    
    const backendUrl = window.location.hostname.includes('localhost') 
      ? 'ws://localhost:10000'
      : `wss://${window.location.hostname}`;
    
    console.log(`🔌 WebSocket ulanmoqda: ${backendUrl}`);
    
    try {
      const ws = new WebSocket(backendUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket ulandi');
        setIsConnected(true);
        setConnectionStatus('online');
        
        // Foydalanuvchini ro'yxatdan o'tkazish
        if (user && user.id) {
          ws.send(JSON.stringify({
            type: 'register',
            userId: user.id,
            userData: user
          }));
        }
        
        // Ping-Pong
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ WebSocket xabar oqish xatosi:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket xatosi:', error);
        setConnectionStatus('error');
        showNotification('🔌 Serverga ulanishda xato', 'error');
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket uzildi');
        setIsConnected(false);
        setConnectionStatus('offline');
        
        // Qayta ulanish
        if (user && user.id) {
          reconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };
      
      setWebsocket(ws);
      
    } catch (error) {
      console.error('❌ WebSocket ulanish xatosi:', error);
      setConnectionStatus('error');
    }
  };

  // ✅ 4. WEBSOCKET XABARLARINI QAYTA ISHLASH
  const handleWebSocketMessage = (data) => {
    console.log('📥 WebSocket xabar:', data.type);
    
    switch (data.type) {
      case 'registered':
        console.log('✅ Ro\'yxatdan o\'tildi');
        if (data.user) {
          setUser(prev => ({ ...prev, ...data.user }));
        }
        if (data.coins) {
          setUserCoins(data.coins);
        }
        if (data.stats) {
          setUserStats(data.stats);
        }
        break;
        
      case 'game_created':
        console.log('🎮 O\'yin yaratildi:', data.gameId);
        setGameState(prev => ({
          ...prev,
          gameId: data.gameId,
          status: 'searching',
          timer: 30,
          myChoice: null,
          opponentChoice: null,
          result: null
        }));
        showNotification('🔍 Raqib qidirilmoqda...', 'info');
        startSearchTimer();
        break;
        
      case 'opponent_found':
        console.log('🎯 Raqib topildi:', data.opponent);
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          status: 'playing',
          timer: 60,
          isBot: data.isBot || false
        }));
        showNotification(`🎯 ${data.opponent.firstName} bilan o'yin boshlanmoqda...`, 'success');
        startGameTimer();
        break;
        
      case 'room_joined':
        console.log('🏠 Xonaga ulandi');
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          status: 'playing',
          timer: 60,
          isBot: false
        }));
        showNotification(`🔗 ${data.opponent.firstName} bilan xonaga ulandingiz`, 'success');
        startGameTimer();
        break;
        
      case 'opponent_choice_made':
        console.log('⚠️ Raqib tanlov qildi');
        showNotification('🎯 Raqib tanlov qildi!', 'info');
        break;
        
      case 'choice_accepted':
        console.log('✅ Tanlov qabul qilindi:', data.choice);
        setGameState(prev => ({ ...prev, myChoice: data.choice }));
        break;
        
      case 'game_result':
        handleGameResult(data);
        break;
        
      case 'game_timeout':
        console.log('⏰ O\'yin vaqti tugadi');
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          result: 'timeout'
        }));
        showNotification('⏰ O\'yin vaqti tugadi', 'info');
        break;
        
      case 'opponent_disconnected':
        console.log('🔌 Raqib ulanish uzdi');
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          result: 'disconnected'
        }));
        showNotification('😔 Raqib ulanish uzdi', 'info');
        break;
        
      case 'pong':
        // Ping-Pong javobi
        break;
        
      case 'error':
        console.error('❌ Server xatosi:', data.message);
        showNotification(`❌ ${data.message}`, 'error');
        setGameState(prev => ({ ...prev, status: 'idle' }));
        break;
        
      default:
        console.log('❌ Noma\'lum xabar turi:', data.type);
    }
  };

  // ✅ 5. O'YIN NATIJASINI QAYTA ISHLASH
  const handleGameResult = (data) => {
    const { result, winnerId, isDraw, choices, coins, players } = data;
    
    // Natijani aniqlash
    let resultType = 'draw';
    if (result === 'player1_win' && winnerId === user.id) {
      resultType = 'win';
    } else if (result === 'player2_win' && winnerId === user.id) {
      resultType = 'win';
    } else if (result === 'player1_win' || result === 'player2_win') {
      resultType = 'lose';
    }
    
    // Koinlarni aniqlash
    const coinsEarned = user.id === players.player1.id 
      ? coins.player1Coins 
      : coins.player2Coins;
    
    // Koinlarni yangilash
    setUserCoins(prev => {
      const newCoins = prev + coinsEarned;
      localStorage.setItem('telegram_game_coins', newCoins.toString());
      return newCoins;
    });
    
    // Tanlovlarni aniqlash
    const myChoice = user.id === players.player1.id ? choices.player1 : choices.player2;
    const opponentChoice = user.id === players.player1.id ? choices.player2 : choices.player1;
    
    // O'yin holatini yangilash
    setGameState(prev => ({
      ...prev,
      status: 'finished',
      result: resultType,
      myChoice: myChoice,
      opponentChoice: opponentChoice
    }));
    
    // Statistika yangilash
    const isWin = resultType === 'win';
    const isRealPlayer = !players.player2.isBot;
    
    setUserStats(prev => {
      const newStats = { ...prev };
      newStats.totalGames += 1;
      
      if (isWin) {
        newStats.wins += 1;
        if (isRealPlayer) newStats.duelsWon += 1;
        
        // Ketma-ket g'alaba
        const newStreak = currentWinStreak + 1;
        setCurrentWinStreak(newStreak);
        if (newStreak > prev.maxWinStreak) {
          newStats.maxWinStreak = newStreak;
        }
      } else if (resultType === 'lose') {
        newStats.losses += 1;
        setCurrentWinStreak(0);
      } else {
        newStats.draws += 1;
        setCurrentWinStreak(0);
      }
      
      if (isRealPlayer) {
        newStats.duelsPlayed += 1;
      }
      
      // G'alaba foizi
      newStats.winRate = newStats.totalGames > 0 
        ? Math.round((newStats.wins / newStats.totalGames) * 100) 
        : 0;
        
      // Koinlar
      newStats.totalCoinsEarned += coinsEarned;
      
      // XP va level
      newStats.xp += coinsEarned;
      const newLevel = Math.floor(newStats.xp / 1000) + 1;
      if (newLevel > newStats.level) {
        newStats.level = newLevel;
        showNotification(`🎉 Daraja ko'tarildi: ${newLevel}`, 'success');
      }
      
      // LocalStorage'ga saqlash
      localStorage.setItem('telegram_game_stats', JSON.stringify(newStats));
      
      return newStats;
    });
    
    // Match history ga qo'shish
    const matchData = {
      id: Date.now(),
      opponent: players.player2.isBot ? players.player2 : players.player1.id === user.id ? players.player2 : players.player1,
      result: resultType,
      myChoice: myChoice,
      opponentChoice: opponentChoice,
      coinsEarned: coinsEarned,
      date: new Date().toISOString(),
      isBot: players.player2.isBot
    };
    
    setMatchHistory(prev => [matchData, ...prev.slice(0, 49)]);
    
    // Natija haqida xabar
    const opponentType = players.player2.isBot ? 'Bot' : 'O\'yinchi';
    const resultMessages = {
      win: `🏆 ${opponentType}ni mag'lub etdingiz! +${coinsEarned} koin`,
      lose: `😔 ${opponentType}ga yutqazdingiz. +${coinsEarned} koin`,
      draw: `🤝 ${opponentType} bilan durrang. +${coinsEarned} koin`
    };
    
    showNotification(resultMessages[resultType], resultType === 'win' ? 'success' : 'info');
    
    // Ketma-ket g'alaba haqida
    if (resultType === 'win' && currentWinStreak > 1) {
      setTimeout(() => {
        showNotification(`🔥 ${currentWinStreak} ketma-ket g'alaba!`, 'success');
      }, 1500);
    }
  };

  // ✅ 6. FOYDALANUVCHI SOZLASH
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
    localStorage.setItem('telegram_game_user', JSON.stringify(newUser));
    console.log('✅ Foydalanuvchi o\'rnatildi:', newUser.first_name);
    
    // Telegram profil rasmini olish
    if (userData.photo_url) {
      setUserPhoto(userData.photo_url);
      localStorage.setItem('telegram_game_photo', userData.photo_url);
    }
    
    // Haptic feedback
    if (tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (e) {
        console.log('⚠️ Haptic feedback ishlamadi');
      }
    }
    
    // API orqali serverga saqlash
    try {
      await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch (error) {
      console.error('❌ Serverga saqlash xatosi:', error);
    }
  };

  // ✅ 7. TEST FOYDALANUVCHI
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
    localStorage.setItem('telegram_game_user', JSON.stringify(testUser));
    console.log('✅ Test foydalanuvchi yaratildi:', testUser.first_name);
  };

  // ✅ 8. DASLABKI MA'LUMOTLARNI YUKLASH
  const loadInitialData = async () => {
    console.log('📦 Dastlabki ma\'lumotlar yuklanmoqda...');
    
    try {
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
      
      // API orqali ma'lumotlarni olish
      if (user && user.id) {
        // Foydalanuvchi ma'lumotlari
        const userResponse = await fetch(`/api/user/${user.id}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.success) {
            setUserStats(userData.stats || userStats);
            if (userData.coins) setUserCoins(userData.coins);
          }
        }
        
        // Do'kon mahsulotlari
        const shopResponse = await fetch('/api/shop/items');
        if (shopResponse.ok) {
          const shopData = await shopResponse.json();
          if (shopData.success) {
            setShopItems(shopData.items || []);
          }
        }
        
        // Reyting jadvali
        const leaderboardResponse = await fetch('/api/leaderboard?limit=10');
        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json();
          if (leaderboardData.success) {
            setLeaderboard(leaderboardData.leaderboard || []);
          }
        }
        
        // O'yin tarixi
        const historyResponse = await fetch(`/api/games/${user.id}?limit=10`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          if (historyData.success) {
            setGameHistory(historyData.games || []);
          }
        }
        
        // Faol xonalar
        const roomsResponse = await fetch('/api/rooms/active');
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json();
          if (roomsData.success) {
            setActiveRooms(roomsData.rooms || []);
          }
        }
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
      
      // Do'stlar ro'yxati
      const mockFriends = [
        { id: 200001, name: 'Sarah', username: 'sarah_queen', isOnline: true, lastSeen: Date.now(), winRate: 78 },
        { id: 200002, name: 'Mike', username: 'mike_rock', isOnline: false, lastSeen: Date.now() - 3600000, winRate: 65 },
        { id: 200003, name: 'Luna', username: 'luna_star', isOnline: true, lastSeen: Date.now(), winRate: 82 }
      ];
      
      setFriends(mockFriends);
      
      // Xonalarni yangilash
      roomsUpdateRef.current = setInterval(async () => {
        try {
          const response = await fetch('/api/rooms/active');
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setActiveRooms(data.rooms || []);
            }
          }
        } catch (error) {
          console.error('❌ Xonalarni yangilash xatosi:', error);
        }
      }, 30000);
      
      console.log('✅ Barcha ma\'lumotlar yuklandi');
      
    } catch (error) {
      console.error('❌ Malumotlar yuklash xatosi:', error);
      // Mock ma'lumotlar bilan ishlash
      loadMockData();
    }
  };

  // ✅ 9. MOCK MA'LUMOTLAR
  const loadMockData = () => {
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
      }
    ];
    
    setShopItems(mockShopItems);
    
    // Reyting jadvali
    const mockLeaderboard = Array.from({ length: 10 }, (_, i) => ({
      userId: 100000 + i,
      name: ['Alex', 'Sarah', 'Mike', 'Luna', 'David'][i % 5],
      username: ['alex_champ', 'sarah_queen', 'mike_rock', 'luna_star', 'david_king'][i % 5],
      photo_url: null,
      totalCoins: 10000 - (i * 800),
      winStreak: 10 - i,
      weeklyWins: 50 - (i * 5),
      rank: i + 1,
      equippedItems: []
    }));
    
    setLeaderboard(mockLeaderboard);
    
    // Faol xonalar
    const mockRooms = [
      { code: 'ABC123', host: 'Alex', players: 2, maxPlayers: 2, createdAt: Date.now() - 60000, isPublic: true },
      { code: 'DEF456', host: 'Sarah', players: 1, maxPlayers: 2, createdAt: Date.now() - 120000, isPublic: true }
    ];
    
    setActiveRooms(mockRooms);
    
    // O'yin tarixi
    const mockHistory = [
      {
        id: 1,
        opponent: { name: 'Sarah', isBot: false },
        result: 'win',
        myChoice: 'rock',
        opponentChoice: 'scissors',
        coinsEarned: 100,
        date: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    
    setGameHistory(mockHistory);
  };

  // ✅ 10. TEZKOR O'YIN BOSHLASH
  const startQuickGame = () => {
    console.log('🎮 Tezkor o\'yin boshlanmoqda...');
    
    if (!user || !user.id) {
      console.error('❌ Foydalanuvchi mavjud emas');
      showNotification('❌ Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, qayta yuklang.', 'error');
      return;
    }
    
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket ulanmagan');
      showNotification('❌ Serverga ulanilmagan. Iltimos, qayta urinib ko\'ring.', 'error');
      connectWebSocket();
      return;
    }
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // O'yin holatini yangilash
    setGameState(prev => ({
      ...prev,
      status: 'searching',
      opponent: null,
      opponentPhoto: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 30,
      gameId: null,
      roomCode: null,
      playersInRoom: 0,
      isBot: false
    }));
    
    // WebSocket orqali o'yin yaratish
    websocket.send(JSON.stringify({
      type: 'quick_game',
      userId: user.id
    }));
  };

  // ✅ 11. XONA YARATISH
  const createRoom = async () => {
    if (!user || !user.id) {
      showNotification('❌ Foydalanuvchi mavjud emas', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const roomCode = data.roomCode;
        
        setGameState(prev => ({
          ...prev,
          status: 'waiting',
          roomCode: roomCode,
          playersInRoom: 1,
          timer: 120,
          gameId: data.gameId
        }));
        
        setActiveRooms(prev => [{
          code: roomCode,
          host: user.first_name,
          players: 1,
          maxPlayers: 2,
          createdAt: Date.now(),
          gameId: data.gameId
        }, ...prev]);
        
        setShowCreateRoom(false);
        
        showNotification(`🏠 Xona yaratildi: ${roomCode}\nKodni do'stlaringizga ulashing!`, 'success');
        
        // Xona taymeri
        startRoomTimer();
        
      } else {
        showNotification(`❌ ${data.error}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Xona yaratish xatosi:', error);
      showNotification('❌ Server bilan aloqa uzildi', 'error');
    }
  };

  // ✅ 12. XONAGA ULANISH
  const joinRoom = async (roomCode) => {
    if (!user || !user.id) {
      showNotification('❌ Foydalanuvchi mavjud emas', 'error');
      return;
    }
    
    if (!roomCode || roomCode.length !== 6) {
      showNotification('❌ Xona kodi 6 ta belgidan iborat bo\'lishi kerak', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          roomCode: roomCode.toUpperCase() 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGameState(prev => ({
          ...prev,
          status: 'joining',
          roomCode: roomCode.toUpperCase(),
          gameId: data.gameId,
          playersInRoom: 2
        }));
        
        setShowJoinRoom(false);
        setRoomCodeInput('');
        
        showNotification(`✅ Xonaga ulandingiz: ${roomCode}`, 'success');
        
      } else {
        showNotification(`❌ ${data.error}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Xonaga ulanish xatosi:', error);
      showNotification('❌ Server bilan aloqa uzildi', 'error');
    }
  };

  // ✅ 13. TANLOV QILISH
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing' || gameState.myChoice || !websocket) {
      return;
    }
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      } catch (e) {}
    }
    
    // WebSocket orqali tanlovni yuborish
    websocket.send(JSON.stringify({
      type: 'make_choice',
      userId: user.id,
      gameId: gameState.gameId,
      choice: choice
    }));
    
    showNotification(`✅ ${getChoiceName(choice)} tanlandi`, 'info');
  };

  // ✅ 14. TAYMERLAR
  const startSearchTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          
          if (prev.status === 'searching') {
            showNotification('❌ Raqib topilmadi. Qayta urinib ko\'ring.', 'info');
            return { ...prev, status: 'idle', timer: 60 };
          }
          
          return prev;
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

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
          // WebSocket orqali timeout xabarini yuborish
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
              type: 'game_timeout',
              gameId: prev.gameId
            }));
          }
          return { ...prev, timer: 0, status: 'finished', result: 'timeout' };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
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
          return { ...prev, status: 'idle', timer: 60 };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
  };

  // ✅ 15. KUNLIK BONUS
  const claimDailyBonus = async () => {
    if (!dailyStatus.available) {
      showNotification(`🎁 Kunlik bonus ${dailyStatus.nextIn || 24} soatdan keyin`, 'info');
      return;
    }
    
    try {
      const response = await fetch('/api/daily-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserCoins(prev => prev + data.amount);
        setUserStats(prev => ({
          ...prev,
          totalCoinsEarned: prev.totalCoinsEarned + data.amount
        }));
        
        setDailyStatus({
          available: false,
          streak: data.streak,
          nextIn: 20,
          lastClaim: Date.now()
        });
        
        localStorage.setItem('telegram_game_daily', JSON.stringify({
          available: false,
          streak: data.streak,
          nextIn: 20,
          lastClaim: Date.now()
        }));
        
        showNotification(`🎉 ${data.message}`, 'success');
      } else {
        showNotification(`❌ ${data.message}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Daily bonus xatosi:', error);
      
      // Mock bonus agar server ishlamasa
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
    }
  };

  // ✅ 16. SOVG'A SOTIB OLISH
  const purchaseItem = async (item) => {
    if (userCoins < item.price) {
      showNotification(`❌ Koinlar yetarli emas! Sizda ${userCoins} koin`, 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId: item.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserCoins(data.newBalance);
        
        // Inventarga qo'shish
        const newItem = {
          itemId: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          icon: item.icon,
          color: item.color,
          price: item.price,
          purchasedAt: Date.now(),
          equipped: false
        };
        
        setInventory(prev => [...prev, newItem]);
        showNotification(`✅ "${item.name}" sotib olindi!`, 'success');
        
      } else {
        showNotification(`❌ ${data.error}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Sovga sotib olish xatosi:', error);
      
      // Mock sotib olish
      setUserCoins(prev => prev - item.price);
      
      const newItem = {
        itemId: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        icon: item.icon,
        color: item.color,
        price: item.price,
        purchasedAt: Date.now(),
        equipped: false
      };
      
      setInventory(prev => [...prev, newItem]);
      showNotification(`✅ "${item.name}" sotib olindi!`, 'success');
    }
  };

  // ✅ 17. SOVG'ANI KIYISH
  const equipItem = async (item) => {
    try {
      const response = await fetch('/api/items/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId: item.itemId })
      });
      
      const data = await response.json();
      
      if (data.success) {
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
      } else {
        showNotification(`❌ ${data.error}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Sovga kiyish xatosi:', error);
      
      // Mock kiyish
      const updatedInventory = inventory.map(invItem => {
        if (invItem.type === item.type) {
          return { ...invItem, equipped: false };
        }
        return invItem;
      });
      
      const finalInventory = updatedInventory.map(invItem => {
        if (invItem.itemId === item.itemId) {
          return { ...invItem, equipped: true };
        }
        return invItem;
      });
      
      setInventory(finalInventory);
      
      const equipped = finalInventory.find(invItem => invItem.equipped && invItem.type === item.type);
      if (equipped) {
        setEquippedItems(prev => ({
          ...prev,
          [item.type]: equipped
        }));
      }
      
      showNotification(`👕 "${item.name}" kiyildi!`, 'success');
    }
  };

  // ✅ 18. O'YINNI QAYTA BOSHLASH
  const restartGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
      playersInRoom: 0,
      isBot: false
    });
  };

  // ✅ 19. YORDAMCHI FUNKSIYALAR
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('✅ Nusxalandi!', 'success');
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win': return '#4CAF50';
      case 'lose': return '#F44336';
      case 'draw': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getResultText = (result) => {
    switch (result) {
      case 'win': return 'Gʻalaba';
      case 'lose': return 'Magʻlubiyat';
      case 'draw': return 'Durrang';
      default: return 'Nomaʼlum';
    }
  };

  // ✅ 20. YUKLANMOQDA KOMPONENTI
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>🎮 Tosh-Qaychi-Qog'oz</h2>
          <p>Yuklanmoqda...</p>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus}`}></span>
            <span>{connectionStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ 21. ASOSIY RENDER
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
                <span className="status-text">
                  {connectionStatus === 'online' ? 'Online' : 'Offline'}
                  {!isConnected && ' (Qayta ulanmoqda...)'}
                </span>
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
            {currentWinStreak > 0 && (
              <div className="streak-indicator">🔥{currentWinStreak}</div>
            )}
          </button>
        </div>
      </header>
      
      {/* 🎮 ASOSIY KONTENT */}
      <main className="main-content">
  {/* IDLE - Bosh menyu */}
  {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && !showCreateRoom && !showJoinRoom && !showHowToPlay && !showHistory && !showFriends && (
    <div className="game-screen idle-screen">
      <div className="welcome-section">
        <div className="welcome-avatar">
          {getProfileImage(userPhoto, user?.first_name, 80)}
          <div className="level-badge">Lvl {userStats.level}</div>
          {currentWinStreak > 0 && (
            <div className="streak-badge">🔥 {currentWinStreak}</div>
          )}
        </div>
        <h2>Salom, {user?.first_name || 'Dost'}! 👋</h2>
        <p className="welcome-subtitle">Haqiqiy o'yinchilar bilan raqobatlashing!</p>
        
        <div className="connection-indicator">
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>
            {isConnected ? `Serverga ulangan | ${activeRooms.length} ta faol xona` : 'Serverga ulanilmagan'}
          </span>
        </div>
      </div>
      
      <div className="quick-stats">
        <div className="stat-card-mini" onClick={() => setShowProfile(true)}>
          <span className="stat-icon">🪙</span>
          <span className="stat-value">{userCoins.toLocaleString()}</span>
          <span className="stat-label">Koin</span>
        </div>
        <div className="stat-card-mini" onClick={() => setShowProfile(true)}>
          <span className="stat-icon">🏆</span>
          <span className="stat-value">{userStats.winRate}%</span>
          <span className="stat-label">G'alaba</span>
        </div>
        <div className="stat-card-mini" onClick={() => setShowProfile(true)}>
          <span className="stat-icon">🔥</span>
          <span className="stat-value">{userStats.maxWinStreak}</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat-card-mini" onClick={() => setShowHistory(true)}>
          <span className="stat-icon">📊</span>
          <span className="stat-value">{userStats.totalGames}</span>
          <span className="stat-label">O'yin</span>
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
      
      {activeRooms.length > 0 && (
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
      )}
      
      <div className="bottom-actions">
        <button className="action-btn small" onClick={() => setShowHowToPlay(true)}>
          ❓ Qoidalar
        </button>
        <button className="action-btn small" onClick={() => setShowLeaderboard(true)}>
          🏆 Reyting
        </button>
        <button className="action-btn small" onClick={() => setShowHistory(true)}>
          📜 Tarix
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
  
  {/* WAITING - Xonada kutish */}
  {gameState.status === 'waiting' && (
    <div className="game-screen waiting-screen">
      <div className="waiting-content">
        <div className="room-header">
          <h2>🏠 Xona: {gameState.roomCode}</h2>
          <p className="room-subtitle">Do'stlaringizni taklif qiling</p>
        </div>
        
        <div className="room-info">
          <div className="room-code-display">
            <span className="code-label">Xona kodi:</span>
            <span className="code-value">{gameState.roomCode}</span>
            <button 
              className="copy-btn"
              onClick={() => copyToClipboard(gameState.roomCode)}
            >
              📋 Nusxalash
            </button>
          </div>
          
          <div className="room-stats">
            <div className="room-stat">
              <span className="stat-icon">👤</span>
              <span className="stat-value">{gameState.playersInRoom}/2</span>
              <span className="stat-label">O'yinchi</span>
            </div>
            <div className="room-stat">
              <span className="stat-icon">⏱️</span>
              <span className="stat-value">{formatTime(gameState.timer)}</span>
              <span className="stat-label">Qolgan vaqt</span>
            </div>
            <div className="room-stat">
              <span className="stat-icon">🪙</span>
              <span className="stat-value">2x</span>
              <span className="stat-label">Bonus</span>
            </div>
          </div>
        </div>
        
        <div className="waiting-players">
          <div className="player-card host">
            <div className="player-avatar">
              {getProfileImage(userPhoto, user?.first_name, 50)}
            </div>
            <div className="player-info">
              <h4>{user?.first_name}</h4>
              <p className="player-role">👑 Xona egasi</p>
            </div>
            <div className="player-status ready">✅</div>
          </div>
          
          <div className="player-card waiting">
            <div className="player-avatar empty">
              <span className="empty-icon">👤</span>
            </div>
            <div className="player-info">
              <h4>Kutilmoqda...</h4>
              <p className="player-role">2-o'yinchi</p>
            </div>
            <div className="player-status waiting">⏳</div>
          </div>
        </div>
        
        <div className="waiting-instructions">
          <h4>📋 Qo'llanma:</h4>
          <ol>
            <li>Xona kodini do'stlaringizga yuboring: <strong>{gameState.roomCode}</strong></li>
            <li>Do'stingiz "Xonaga Ulanish" bo'limiga kirib kodni kiritadi</li>
            <li>O'yin avtomatik boshlanadi</li>
          </ol>
        </div>
        
        <div className="waiting-actions">
          <button className="cancel-btn" onClick={restartGame}>
            ❌ Xonani yopish
          </button>
        </div>
      </div>
    </div>
  )}
  
  {/* PLAYING - O'yin davom etmoqda */}
  {gameState.status === 'playing' && (
    <div className="game-screen playing-screen">
      <div className="playing-header">
        <div className="opponent-info">
          <div className="opponent-type">
            {gameState.isBot ? '🤖 BOT' : '👤 HAQIQIY O\'YINCHI'}
          </div>
          <h2>{gameState.opponent?.firstName || 'Raqib'}</h2>
          <p className="opponent-stats">
            {gameState.isBot ? 'AI daraja: 3' : 'Online'}
          </p>
        </div>
        
        <div className="game-timer">
          <div className="timer-icon">⏰</div>
          <div className="timer-value">{formatTime(gameState.timer)}</div>
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
      
      {gameState.myChoice && (
        <div className="selected-choice-info">
          <p>Siz <strong>{getChoiceName(gameState.myChoice)}</strong> tanladingiz</p>
        </div>
      )}
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
          {gameState.result === 'disconnected' && (
            <>
              <div className="result-icon">🔌</div>
              <h2>RAQIB KETDI</h2>
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
              {gameState.isBot ? '🤖 Bot' : '👤 Haqiqiy o\'yinchi'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Ketma-ket g'alaba:</span>
            <span className="detail-value">{currentWinStreak}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Jami koinlar:</span>
            <span className="detail-value">🪙 {userCoins.toLocaleString()}</span>
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
              <div className="level-badge-large">Lvl {userStats.level}</div>
            </div>
            <div className="profile-info">
              <h3>{user?.first_name}</h3>
              <p className="username">@{user?.username || 'username_yoq'}</p>
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
              <span>Duellar:</span>
              <span>{userStats.duelsWon}/{userStats.duelsPlayed}</span>
            </div>
            <div className="detail-row">
              <span>Jami koin:</span>
              <span>{userStats.totalCoinsEarned.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span>XP:</span>
              <span>{userStats.xp}/{(userStats.level + 1) * 1000}</span>
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
            <div className="inventory-count">
              <span className="inventory-label">Inventar:</span>
              <span className="inventory-value">{inventory.length} ta</span>
            </div>
          </div>
          
          <div className="shop-tabs">
            <button className="shop-tab active">🏷️ Barcha</button>
            <button className="shop-tab">👤 Avatar</button>
            <button className="shop-tab">🖼️ Ramka</button>
            <button className="shop-tab">🏆 Unvon</button>
          </div>
          
          <div className="shop-items">
            {shopItems.map(item => {
              const alreadyOwned = inventory.some(invItem => invItem.itemId === item.id);
              const isEquipped = equippedItems[item.type]?.itemId === item.id;
              
              return (
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
                    {alreadyOwned ? (
                      <div className="item-owned">
                        <div className="owned-badge">✅ Sotib olingan</div>
                        {isEquipped ? (
                          <button className="equipped-btn" disabled>
                            👕 Kiyilgan
                          </button>
                        ) : (
                          <button 
                            className="equip-btn"
                            onClick={() => equipItem(inventory.find(invItem => invItem.itemId === item.id))}
                          >
                            👕 Kiymoq
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="item-price">🪙 {item.price.toLocaleString()}</div>
                        <button 
                          className={`buy-btn ${userCoins >= item.price ? '' : 'disabled'}`}
                          onClick={() => purchaseItem(item)}
                          disabled={userCoins < item.price}
                        >
                          {userCoins >= item.price ? 'Sotib olish' : 'Koin yetarli emas'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="inventory-preview">
            <h4>🎒 Kiyilgan sovg'alar:</h4>
            <div className="equipped-items">
              {Object.values(equippedItems).map(item => (
                <div key={item.itemId} className="equipped-item">
                  <span className="equipped-icon" style={{ color: item.color }}>{item.icon}</span>
                  <span className="equipped-name">{item.name}</span>
                </div>
              ))}
              {Object.keys(equippedItems).length === 0 && (
                <p className="no-equipped">Hech qanday sovg'a kiyilmagan</p>
              )}
            </div>
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
            
            <div className="rule-item">
              <div className="rule-icon">🎁</div>
              <div className="rule-content">
                <h4>Kunlik bonus</h4>
                <p>Har 20 soatda +100-300 koin</p>
              </div>
            </div>
          </div>
          
          <div className="rules-footer">
            <button className="action-btn full" onClick={() => { setShowHowToPlay(false); startQuickGame(); }}>
              🎮 O'ynashni Boshlash
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
  
  {/* REYTING MODALI */}
  {showLeaderboard && (
    <div className="modal-overlay">
      <div className="modal leaderboard-modal">
        <div className="modal-header">
          <h2>🏆 Reyting Jadvali</h2>
          <button className="modal-close" onClick={() => setShowLeaderboard(false)}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="leaderboard-tabs">
            <button className="leaderboard-tab active">🪙 Koinlar</button>
            <button className="leaderboard-tab">🏆 G'alaba</button>
            <button className="leaderboard-tab">🔥 Streak</button>
            <button className="leaderboard-tab">📊 Daraja</button>
          </div>
          
          <div className="leaderboard-list">
            {leaderboard.map((player, index) => {
              const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
              
              return (
                <div key={player.userId} className={`leaderboard-item ${player.userId === user?.id ? 'you' : ''}`}>
                  <div className="player-rank">
                    {index < 10 ? medals[index] : `${index + 1}.`}
                  </div>
                  <div className="player-avatar">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} />
                    ) : (
                      <div className="avatar-placeholder">{player.name?.[0]}</div>
                    )}
                  </div>
                  <div className="player-info">
                    <div className="player-name">
                      {player.name}
                      {player.userId === user?.id && <span className="you-badge"> (Siz)</span>}
                    </div>
                    <div className="player-username">@{player.username}</div>
                  </div>
                  <div className="player-stats">
                    <div className="stat-value">🪙 {player.totalCoins?.toLocaleString() || 0}</div>
                    <div className="stat-label">{player.winRate || 0}% g'alaba</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {user && (
            <div className="your-position">
              <h4>📊 Sizning o'rningiz:</h4>
              <div className="position-card">
                <div className="position-rank">#{userStats.rank || 999}</div>
                <div className="position-info">
                  <div className="position-name">{user.first_name}</div>
                  <div className="position-stats">
                    🪙 {userCoins.toLocaleString()} • 🏆 {userStats.winRate}% • 🔥 {userStats.maxWinStreak}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )}
  
  {/* O'YIN TARIXI MODALI */}
  {showHistory && (
    <div className="modal-overlay">
      <div className="modal history-modal">
        <div className="modal-header">
          <h2>📜 O'yin Tarixi</h2>
          <button className="modal-close" onClick={() => setShowHistory(false)}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="history-filters">
            <button className="filter-btn active">📅 Barchasi</button>
            <button className="filter-btn">🏆 G'alaba</button>
            <button className="filter-btn">🤝 Durrang</button>
            <button className="filter-btn">🤖 Bot</button>
          </div>
          
          <div className="history-stats">
            <div className="history-stat">
              <div className="stat-value">{userStats.totalGames}</div>
              <div className="stat-label">Jami o'yin</div>
            </div>
            <div className="history-stat">
              <div className="stat-value">{userStats.wins}</div>
              <div className="stat-label">G'alaba</div>
            </div>
            <div className="history-stat">
              <div className="stat-value">{userStats.winRate}%</div>
              <div className="stat-label">G'alaba %</div>
            </div>
            <div className="history-stat">
              <div className="stat-value">{currentWinStreak}</div>
              <div className="stat-label">Joriy streak</div>
            </div>
          </div>
          
          <div className="history-list">
            {(matchHistory.length > 0 ? matchHistory : gameHistory).map((match, index) => (
              <div key={match.id || index} className="history-item">
                <div className="match-result" style={{ color: getResultColor(match.result) }}>
                  {match.result === 'win' ? '🏆' : match.result === 'lose' ? '😔' : '🤝'}
                  <span>{getResultText(match.result)}</span>
                </div>
                
                <div className="match-info">
                  <div className="match-opponent">
                    <span className="opponent-type">
                      {match.isBot ? '🤖' : '👤'}
                    </span>
                    <span className="opponent-name">
                      {match.opponent?.name || 'Raqib'}
                    </span>
                  </div>
                  
                  <div className="match-choices">
                    <span className="choice-you" title={getChoiceName(match.myChoice)}>
                      {getChoiceEmoji(match.myChoice)}
                    </span>
                    <span className="vs">vs</span>
                    <span className="choice-opponent" title={getChoiceName(match.opponentChoice)}>
                      {getChoiceEmoji(match.opponentChoice)}
                    </span>
                  </div>
                </div>
                
                <div className="match-details">
                  <div className="match-coins">
                    🪙 +{match.coinsEarned || 0}
                  </div>
                  <div className="match-date">
                    {formatDate(match.date)}
                  </div>
                </div>
              </div>
            ))}
            
            {(matchHistory.length === 0 && gameHistory.length === 0) && (
              <div className="no-history">
                <div className="no-history-icon">📜</div>
                <h3>O'yin tarixi mavjud emas</h3>
                <p>Birinchi o'yinni boshlang va tarix yozing!</p>
                <button className="action-btn" onClick={() => { setShowHistory(false); startQuickGame(); }}>
                  🎮 O'ynashni boshlash
                </button>
              </div>
            )}
          </div>
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
          
          <div className="room-benefits">
            <h4>✅ Afzalliklar:</h4>
            <ul>
              <li>Do'stlaringiz bilan o'ynashingiz mumkin</li>
              <li>Xususiy xona - faqat siz tanlaganlar</li>
              <li>2 baravar ko'proq koinlar</li>
              <li>O'yin tarixida saqlanadi</li>
            </ul>
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
            <div className="input-hint">6 ta harf yoki raqam</div>
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
              <div 
                key={room.code} 
                className="suggested-room" 
                onClick={() => {
                  setRoomCodeInput(room.code);
                  joinRoom(room.code);
                }}
              >
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
  
  {/* DO'STLAR MODALI */}
  {showFriends && (
    <div className="modal-overlay">
      <div className="modal friends-modal">
        <div className="modal-header">
          <h2>👥 Do'stlar</h2>
          <button className="modal-close" onClick={() => setShowFriends(false)}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="friends-search">
            <input
              type="text"
              placeholder="Do'st qidirish..."
              className="search-input"
            />
            <button className="search-btn">🔍</button>
          </div>
          
          <div className="friends-list">
            {friends.map(friend => (
              <div key={friend.id} className="friend-item">
                <div className="friend-avatar">
                  {getProfileImage(null, friend.name, 40)}
                  <div className={`online-status ${friend.isOnline ? 'online' : 'offline'}`}></div>
                </div>
                <div className="friend-info">
                  <div className="friend-name">
                    {friend.name}
                    <span className="friend-username">@{friend.username}</span>
                  </div>
                  <div className="friend-stats">
                    <span className="win-rate">🏆 {friend.winRate}%</span>
                    <span className="last-seen">
                      {friend.isOnline ? 'Online' : `${Math.floor((Date.now() - friend.lastSeen) / 60000)} daqiqa oldin`}
                    </span>
                  </div>
                </div>
                <div className="friend-actions">
                  <button className="invite-btn" onClick={() => {
                    // Invite to room logic
                    if (gameState.roomCode) {
                      showNotification(`${friend.name} ga taklif yuborildi`, 'info');
                    } else {
                      showNotification('Avval xona yarating', 'error');
                    }
                  }}>
                    🎮 Taklif
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="invite-section">
            <h4>📤 Do'stlaringizni taklif qiling:</h4>
            <div className="invite-methods">
              <button className="invite-method" onClick={() => {
                const text = `🎮 Salom! Meni Tosh-Qaychi-Qog'oz o'yinida mag'lub qila olasanmi? ${window.location.href}`;
                navigator.clipboard.writeText(text);
                showNotification('Havola nusxalandi!', 'success');
              }}>
                🔗 Havolani nusxalash
              </button>
            </div>
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
        <button 
          className="reconnect-btn" 
          onClick={connectWebSocket}
          disabled={isConnected}
        >
          {isConnected ? '✅ Ulangan' : '🔄 Qayta ulanish'}
        </button>
      </div>
    </div>
  </footer>
</div>
);
}