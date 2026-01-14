import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';

function App() {
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
  
  const [userCoins, setUserCoins] = useState(1000);
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ available: true });
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userStats, setUserStats] = useState({ wins: 15, losses: 5, draws: 3, totalGames: 23 });
  const [websocket, setWebsocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  
  const websocketRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const timerRef = useRef(null);

  // Telegram WebApp ni sozlash
  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Telegram WebApp'ni tayyorlash
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
        
        // Theme'ni moslashtirish
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#1a1a1a');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#aaaaaa');
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#4a9eff');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#31b545');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
        
        // Foydalanuvchi ma'lumotlarini olish
        const userData = tg.initDataUnsafe?.user;
        if (userData) {
          console.log('👤 Telegram foydalanuvchi:', userData);
          setUser(userData);
          
          // Telegram profil rasmini olish
          if (userData.photo_url) {
            setUserPhoto(userData.photo_url);
          }
          
          // WebSocket ulanishi
          initializeWebSocket(userData);
          
          // User data yuklash
          loadUserData(userData);
        } else {
          console.log('⚠️ Telegram user data mavjud emas, test rejimida');
          const testUser = {
            id: 123456789,
            first_name: "Test",
            username: "test_user",
            photo_url: null
          };
          setUser(testUser);
          loadUserData(testUser);
          initializeWebSocket(testUser);
        }
        
        // Telegram asosiy tugmasini sozlash
        tg.MainButton.setText("🎮 O'YINNI BOSHLASH");
        tg.MainButton.color = "#31b545";
        tg.MainButton.onClick(startNewGame);
        tg.MainButton.show();
        
        // Orqaga tugmasi
        tg.BackButton.onClick(() => {
          if (showShop) setShowShop(false);
          else if (showProfile) setShowProfile(false);
          else if (showLeaderboard) setShowLeaderboard(false);
          tg.BackButton.hide();
        });
        
        // Bottom bar
        tg.SettingsButton.show();
        tg.SettingsButton.onClick(() => {
          setShowProfile(true);
        });
        
        tg.setHeaderColor('#1a1a1a');
        tg.setBackgroundColor('#1a1a1a');
        
        setIsLoading(false);
        
        // App yopilganda WebSocket'ni yopish
        return () => {
          if (websocketRef.current) {
            websocketRef.current.close();
          }
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        };
      } else {
        console.log('⚠️ Telegram WebApp mavjud emas, test rejimida');
        const testUser = {
          id: 123456789,
          first_name: "Test",
          username: "test_user",
          photo_url: null
        };
        setUser(testUser);
        loadUserData(testUser);
        initializeWebSocket(testUser);
        setIsLoading(false);
      }
    };

    initTelegram();
  }, []);

  // WebSocket ulanishi
  const initializeWebSocket = useCallback((userData) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket allaqachon ulangan');
      return;
    }
    
    // Backend URL (o'zgartiring)
    const wsUrl = process.env.NODE_ENV === 'development' 
      ? 'ws://localhost:10000/ws'
      : 'wss://your-backend.onrender.com/ws';
    
    console.log(`🔌 WebSocket ulanmoqda: ${wsUrl}`);
    setConnectionStatus('connecting');
    
    try {
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;
      setWebsocket(ws);
      
      ws.onopen = () => {
        console.log('✅ WebSocket ulandi');
        setConnectionStatus('connected');
        
        // Foydalanuvchini ro'yxatdan o'tkazish
        ws.send(JSON.stringify({
          type: 'register',
          userId: userData.id,
          username: userData.username || '',
          firstName: userData.first_name || 'User',
          photoUrl: userData.photo_url || null
        }));
        
        // Ping interval (30 soniyada 1 marta)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'ping', 
              timestamp: Date.now(),
              userId: userData.id 
            }));
          }
        }, 30000);
        
        // Connected haqida xabar
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 WebSocket xabari:', data);
          handleGameUpdate(data);
        } catch (error) {
          console.error('❌ Xabar pars qilish xatosi:', error, event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket xatosi:', error);
        setConnectionStatus('error');
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Serverga ulanishda xato!');
        }
      };
      
      ws.onclose = (event) => {
        console.log(`🔌 WebSocket uzildi: ${event.code} - ${event.reason}`);
        setConnectionStatus('disconnected');
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // 3 soniyadan keyin qayta ulanish
        if (userData) {
          setTimeout(() => {
            console.log('🔄 WebSocket qayta ulanmoqda...');
            initializeWebSocket(userData);
          }, 3000);
        }
      };
      
    } catch (error) {
      console.error('❌ WebSocket yaratish xatosi:', error);
      setConnectionStatus('error');
    }
  }, []);

  // Foydalanuvchi ma'lumotlarini yuklash
  const loadUserData = (userData) => {
    setIsLoading(true);
    
    // Mock data (backend mavjud bo'lganda to'g'ri API chaqiruvi qiling)
    setTimeout(() => {
      setUserCoins(1250);
      setDailyStatus({ 
        available: true, 
        streak: 5, 
        nextIn: 0,
        lastClaim: Date.now() - 24 * 60 * 60 * 1000
      });
      
      // Inventar
      setInventory([
        { 
          itemId: 'avatar_gold', 
          name: 'Oltin Avatar', 
          type: 'avatar',
          rarity: 'epic',
          icon: '👑',
          equipped: true,
          price: 1000 
        },
        { 
          itemId: 'frame_fire', 
          name: 'Olov Ramkasi', 
          type: 'frame',
          rarity: 'rare',
          icon: '🔥',
          equipped: true,
          price: 500 
        },
        { 
          itemId: 'title_champion', 
          name: 'Chempion', 
          type: 'title',
          rarity: 'legendary',
          icon: '🏆',
          equipped: true,
          price: 2000 
        },
        { 
          itemId: 'effect_sparkle', 
          name: 'Yorqin Effekt', 
          type: 'effect',
          rarity: 'rare',
          icon: '✨',
          equipped: false,
          price: 300 
        }
      ]);
      
      // Kiyilgan buyumlar
      setEquippedItems({
        avatar: { id: 'avatar_gold', name: 'Oltin Avatar', icon: '👑' },
        frame: { id: 'frame_fire', name: 'Olov Ramkasi', icon: '🔥' },
        title: { id: 'title_champion', name: 'Chempion', icon: '🏆' }
      });
      
      // Reyting jadvali
      setLeaderboard([
        { 
          userId: 111111, 
          name: 'Alex', 
          username: 'alex_champ',
          photo_url: null,
          totalCoins: 8500, 
          winStreak: 12,
          weeklyWins: 45,
          rank: 1,
          equippedItems: ['avatar_gold', 'frame_diamond']
        },
        { 
          userId: 222222, 
          name: 'Sarah', 
          username: 'sarah_queen',
          photo_url: null,
          totalCoins: 7200, 
          winStreak: 8,
          weeklyWins: 38,
          rank: 2,
          equippedItems: ['avatar_queen', 'title_pro']
        },
        { 
          userId: 333333, 
          name: 'Mike', 
          username: 'mike_rock',
          photo_url: null,
          totalCoins: 6500, 
          winStreak: 5,
          weeklyWins: 32,
          rank: 3,
          equippedItems: ['avatar_rock', 'frame_gold']
        },
        { 
          userId: 444444, 
          name: 'Luna', 
          username: 'luna_star',
          photo_url: null,
          totalCoins: 5800, 
          winStreak: 7,
          weeklyWins: 28,
          rank: 4,
          equippedItems: ['avatar_star', 'effect_glow']
        },
        { 
          userId: 555555, 
          name: 'David', 
          username: 'david_king',
          photo_url: null,
          totalCoins: 5200, 
          winStreak: 4,
          weeklyWins: 25,
          rank: 5,
          equippedItems: ['avatar_king', 'frame_silver']
        }
      ]);
      
      // Do'kon mahsulotlari
      setShopItems([
        { 
          id: 'avatar_dragon', 
          name: 'Ajdarho Avatari', 
          description: 'Mavjud eng zo\'r avatar',
          type: 'avatar', 
          rarity: 'legendary',
          icon: '🐉',
          price: 5000 
        },
        { 
          id: 'avatar_phoenix', 
          name: 'Feniks Avatari', 
          description: 'Qayta tug\'ilish ramzi',
          type: 'avatar', 
          rarity: 'epic',
          icon: '🔥',
          price: 2500 
        },
        { 
          id: 'frame_diamond', 
          name: 'Olmos Ramkasi', 
          description: 'Yorqin olmos ramka',
          type: 'frame', 
          rarity: 'legendary',
          icon: '💎',
          price: 3000 
        },
        { 
          id: 'frame_neon', 
          name: 'Neon Ramka', 
          description: 'Zamonaviy neon ramka',
          type: 'frame', 
          rarity: 'epic',
          icon: '💡',
          price: 1500 
        },
        { 
          id: 'title_legend', 
          name: 'AFSONA', 
          description: 'Eng yuqori unvon',
          type: 'title', 
          rarity: 'legendary',
          icon: '👑',
          price: 4000 
        },
        { 
          id: 'title_master', 
          name: 'USTOZ', 
          description: 'Tajribali o\'yinchi',
          type: 'title', 
          rarity: 'rare',
          icon: '🎓',
          price: 1000 
        },
        { 
          id: 'effect_glow', 
          name: 'Yorqinlik Effekti', 
          description: 'Profilni yoritadi',
          type: 'effect', 
          rarity: 'epic',
          icon: '🌟',
          price: 1200 
        },
        { 
          id: 'effect_spark', 
          name: 'Chaqmoq Effekti', 
          description: 'Chaqmoq chaqadi',
          type: 'effect', 
          rarity: 'rare',
          icon: '⚡',
          price: 800 
        }
      ]);
      
      setIsLoading(false);
    }, 1000);
  };

  // YANGI O'YIN BOSHLASH
  const startNewGame = () => {
    if (!user) {
      console.error('❌ Foydalanuvchi mavjud emas');
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Foydalanuvchi ma\'lumotlari mavjud emas');
      }
      return;
    }
    
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket ulanmagan');
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Serverga ulanmoqda...');
      }
      initializeWebSocket(user);
      setTimeout(() => startNewGame(), 2000);
      return;
    }
    
    console.log('🎮 Yangi oyin boshlanmoqda...');
    
    // Oldingi taymerni tozalash
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
      gameId: null
    });
    
    // Taymerni yangilash
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.status !== 'waiting' && prev.status !== 'playing') {
          clearInterval(timerRef.current);
          return prev;
        }
        
        const newTimer = prev.timer - 1;
        
        if (newTimer <= 0) {
          clearInterval(timerRef.current);
          
          // WebSocket orqali timeout haqida xabar berish
          if (websocketRef.current?.readyState === WebSocket.OPEN && prev.gameId) {
            websocketRef.current.send(JSON.stringify({
              type: 'game_timeout',
              gameId: prev.gameId,
              userId: user.id
            }));
          }
          
          return { 
            ...prev, 
            status: 'finished', 
            result: 'timeout',
            timer: 0 
          };
        }
        
        return { ...prev, timer: newTimer };
      });
    }, 1000);
    
    // Haptic feedback
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    // O'yin yaratish
    websocketRef.current.send(JSON.stringify({
      type: 'create_game',
      userId: user.id,
      username: user.username || '',
      firstName: user.first_name || 'User',
      photoUrl: userPhoto
    }));
    
    // Asosiy tugmani yashirish
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.MainButton.hide();
    }
  };

  // O'YIN YANGILANISHINI QABUL QILISH
  const handleGameUpdate = (data) => {
    console.log('🔄 Oyin yangilanishi:', data);
    
    switch (data.type) {
      case 'registered':
        console.log('✅ Foydalanuvchi ro\'yxatdan o\'tdi:', data.userId);
        break;
        
      case 'game_created':
        console.log(`🎮 O'yin yaratildi: ${data.gameId}`);
        setGameState(prev => ({
          ...prev,
          gameId: data.gameId,
          status: 'waiting'
        }));
        
        // 1 soniyadan keyin raqib qidirish
        setTimeout(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'find_opponent',
              userId: user.id,
              gameId: data.gameId,
              playerInfo: {
                name: user.first_name,
                photo: userPhoto
              }
            }));
          }
        }, 1000);
        break;
        
      case 'waiting_for_opponent':
        setGameState(prev => ({
          ...prev,
          status: 'waiting'
        }));
        console.log(`⏳ Raqib qidirilmoqda... ${data.waitingPlayersCount || 0} o'yinchi kutmoqda`);
        break;
        
      case 'opponent_found':
        console.log(`🎯 Raqib topildi: ${data.opponent.firstName}`);
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          opponentPhoto: data.opponent.photoUrl || null,
          status: 'playing',
          timer: 60
        }));
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(`Raqib topildi: ${data.opponent.firstName}!`);
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        break;
        
      case 'matchmaking_timeout':
        console.log('⏰ Raqib topilmadi, vaqt tugadi');
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          result: 'timeout'
        }));
        
        // Asosiy tugmani qayta ko'rsatish
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.show();
        }
        break;
        
      case 'opponent_choice_made':
        console.log('🎯 Raqib tanlov qildi!');
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Raqib tanlov qildi!');
          window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
        break;
        
      case 'choice_accepted':
        console.log('✅ Tanlov qabul qilindi:', data.choice);
        setGameState(prev => ({
          ...prev,
          myChoice: data.choice
        }));
        break;
        
      case 'game_result':
        console.log('🏁 Oyin natijasi:', data.result);
        
        // Taymerni to'xtatish
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        setGameState(prev => ({
          ...prev,
          opponentChoice: data.choices?.player2,
          result: data.result === 'player1_win' ? 'win' : 
                  data.result === 'player2_win' ? 'lose' : 'draw',
          status: 'finished'
        }));
        
        // Koinlarni yangilash
        let coinsEarned = 0;
        if (data.result === 'player1_win') {
          coinsEarned = 50;
          setUserStats(prev => ({ ...prev, wins: prev.wins + 1, totalGames: prev.totalGames + 1 }));
        } else if (data.result === 'draw') {
          coinsEarned = 20;
          setUserStats(prev => ({ ...prev, draws: prev.draws + 1, totalGames: prev.totalGames + 1 }));
        } else {
          coinsEarned = 10;
          setUserStats(prev => ({ ...prev, losses: prev.losses + 1, totalGames: prev.totalGames + 1 }));
        }
        
        setUserCoins(prev => prev + coinsEarned);
        
        // Haptic feedback
        if (window.Telegram?.WebApp) {
          if (data.result === 'player1_win') {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            window.Telegram.WebApp.showAlert(`🏆 G'alaba! +${coinsEarned} koin qozondingiz!`);
          } else if (data.result === 'draw') {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            window.Telegram.WebApp.showAlert(`🤝 Durrang! +${coinsEarned} koin qozondingiz!`);
          } else {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            window.Telegram.WebApp.showAlert(`😔 Mag'lubiyat! +${coinsEarned} koin qozondingiz.`);
          }
        }
        
        // Asosiy tugmani qayta ko'rsatish
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.show();
        }
        break;
        
      case 'game_timeout':
        console.log('⏰ Oyin vaqti tugadi');
        setGameState(prev => ({
          ...prev,
          result: 'timeout',
          status: 'finished'
        }));
        
        // Asosiy tugmani qayta ko'rsatish
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.show();
        }
        break;
        
      case 'pong':
        console.log('🏓 Pong qaytdi:', data.timestamp);
        break;
        
      case 'error':
        console.error('❌ Server xatosi:', data.message);
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(`Xato: ${data.message}`);
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
        break;
    }
  };

  // Tanlov qilish
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing' || !gameState.gameId) {
      console.error('❌ O\'yin davomida emas');
      return;
    }
    
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket ulanmagan');
      return;
    }
    
    // Agar allaqachon tanlagan bo'lsa
    if (gameState.myChoice) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Siz allaqachon tanlov qilgansiz!');
      }
      return;
    }
    
    console.log(`🎯 Tanlov: ${choice}`);
    
    // Haptic feedback
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    
    websocketRef.current.send(JSON.stringify({
      type: 'make_choice',
      userId: user.id,
      gameId: gameState.gameId,
      choice: choice,
      timestamp: Date.now()
    }));
  };

  // Kunlik bonus olish
  const claimDailyBonus = () => {
    if (!dailyStatus.available) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Kunlik bonus ${dailyStatus.nextIn || 0} soatdan keyin mavjud`);
      }
      return;
    }
    
    const bonusAmount = 100 + (dailyStatus.streak || 0) * 20;
    setUserCoins(prev => prev + bonusAmount);
    setDailyStatus(prev => ({ ...prev, available: false, streak: (prev.streak || 0) + 1 }));
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(`🎉 +${bonusAmount} koin! (${dailyStatus.streak + 1} kun ketma-ket)`);
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  };

  // Sovg'a sotib olish
  const purchaseItem = (item) => {
    if (userCoins < item.price) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Koinlar yetarli emas! Sizda ${userCoins} koin, kerak ${item.price}`);
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
      return;
    }
    
    setUserCoins(prev => prev - item.price);
    
    // Inventarga qo'shish
    const newItem = {
      itemId: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      icon: item.icon,
      equipped: false,
      price: item.price
    };
    
    setInventory(prev => [...prev, newItem]);
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(`✅ "${item.name}" sovg'asi sotib olindi!`);
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  };

  // Sovg'ani kiyish
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
        [item.type]: {
          id: equipped.itemId,
          name: equipped.name,
          icon: equipped.icon
        }
      }));
    }
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(`✅ "${item.name}" kiyildi!`);
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  // O'yinni qayta boshlash
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

  // Emoji tanlash
  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };

  // Rarity ranglari
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#808080';
      case 'rare': return '#1E90FF';
      case 'epic': return '#9370DB';
      case 'legendary': return '#FFD700';
      default: return '#808080';
    }
  };

  // Profil rasmni yuklash
  const getProfileImage = (photoUrl, firstName, size = 40) => {
    if (photoUrl) {
      return (
        <img 
          src={photoUrl} 
          alt={firstName}
          className="profile-image"
          style={{ width: size, height: size, borderRadius: '50%' }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    return (
      <div 
        className="profile-initial"
        style={{ 
          width: size, 
          height: size, 
          fontSize: size * 0.5,
          backgroundColor: '#31b545',
          color: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }}
      >
        {firstName?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  // Yuklanmoqda komponenti
  if (isLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <h2>Telegram o'yin yuklanmoqda...</h2>
          <p>Iltimos, kuting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sarlavha qismi */}
      <header className="app-header">
        <div className="header-left">
          <h1>🎮 Tosh • Qaychi • Qog'oz</h1>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus}`}></span>
            <span className="status-text">
              {connectionStatus === 'connected' ? 'Online' : 
               connectionStatus === 'connecting' ? 'Ulanmoqda...' : 
               connectionStatus === 'error' ? 'Xato' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="header-right">
          {user && (
            <>
              {/* Koin paneli */}
              <div className="coins-panel">
                <div className="coins-display">
                  <span className="coin-icon">🪙</span>
                  <span className="coin-amount">{userCoins.toLocaleString()}</span>
                </div>
                <button 
                  className={`daily-bonus-btn ${dailyStatus.available ? 'available' : 'unavailable'}`}
                  onClick={claimDailyBonus}
                  disabled={!dailyStatus.available}
                  title={dailyStatus.available ? 'Kunlik bonus olish' : `${dailyStatus.nextIn || 20} soatdan keyin`}
                >
                  <span className="bonus-icon">🎁</span>
                  {dailyStatus.streak > 0 && (
                    <span className="bonus-streak">{dailyStatus.streak}</span>
                  )}
                </button>
              </div>
              
              {/* Profil tugmasi */}
              <button 
                className="profile-header-btn"
                onClick={() => setShowProfile(true)}
                aria-label="Profil"
              >
                {getProfileImage(userPhoto, user.first_name, 40)}
                {equippedItems.avatar && (
                  <div className="avatar-frame-small">
                    <span className="frame-icon">{equippedItems.avatar.icon}</span>
                  </div>
                )}
              </button>
            </>
          )}
        </div>
      </header>
      
      {/* Asosiy kontent */}
      <main className="app-main">
        {/* DO'KON MODALI */}
        {showShop && (
          <div className="modal-overlay">
            <div className="modal-content shop-modal">
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button 
                  className="close-modal" 
                  onClick={() => setShowShop(false)}
                  aria-label="Yopish"
                >
                  ✕
                </button>
              </div>
              
              <div className="shop-balance">
                <span>Mavjud koinlar:</span>
                <span className="shop-coins">🪙 {userCoins.toLocaleString()}</span>
              </div>
              
              <div className="shop-items-grid">
                {shopItems.map(item => (
                  <div 
                    key={item.id} 
                    className="shop-item-card"
                    style={{ borderColor: getRarityColor(item.rarity) }}
                  >
                    <div className="item-icon">{item.icon}</div>
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p className="item-description">{item.description}</p>
                      <div className="item-meta">
                        <span className="item-type">{item.type}</span>
                        <span 
                          className="item-rarity" 
                          style={{ color: getRarityColor(item.rarity) }}
                        >
                          {item.rarity}
                        </span>
                      </div>
                    </div>
                    <div className="item-price">
                      <span>🪙 {item.price.toLocaleString()}</span>
                      <button 
                        className={`buy-btn ${userCoins >= item.price ? 'can-buy' : 'cannot-buy'}`}
                        onClick={() => purchaseItem(item)}
                        disabled={userCoins < item.price}
                      >
                        {userCoins >= item.price ? 'Sotib olish' : 'Koin yetarli emas'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="inventory-preview">
                <h3>Sizning sovg'alaringiz: {inventory.length} ta</h3>
                <div className="inventory-items">
                  {inventory.slice(0, 6).map(item => (
                    <div 
                      key={item.itemId} 
                      className={`inventory-item ${item.equipped ? 'equipped' : ''} ${item.rarity}`}
                      onClick={() => equipItem(item)}
                      title={`${item.name} ${item.equipped ? '(Kiyilgan)' : ''}`}
                    >
                      <span className="item-icon-small">{item.icon}</span>
                      {item.equipped && <span className="equipped-badge">✓</span>}
                    </div>
                  ))}
                  {inventory.length > 6 && (
                    <div className="inventory-more" title="Ko'proq...">
                      +{inventory.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* PROFIL MODALI */}
        {showProfile && (
          <div className="modal-overlay">
            <div className="modal-content profile-modal">
              <div className="modal-header">
                <h2>👤 Profil</h2>
                <button 
                  className="close-modal" 
                  onClick={() => setShowProfile(false)}
                  aria-label="Yopish"
                >
                  ✕
                </button>
              </div>
              
              <div className="profile-info">
                <div className="profile-avatar-large">
                  <div className="avatar-circle">
                    {getProfileImage(userPhoto, user.first_name, 80)}
                    {equippedItems.frame && (
                      <div className="avatar-frame-large">
                        <span className="frame-effect">{equippedItems.frame.icon}</span>
                      </div>
                    )}
                  </div>
                  {equippedItems.title && (
                    <div className="player-title-badge">
                      {equippedItems.title.icon} {equippedItems.title.name}
                    </div>
                  )}
                </div>
                
                <div className="profile-details">
                  <h3>{user.first_name}</h3>
                  <p className="username">@{user.username || 'noma\'lum'}</p>
                  <div className="user-id">ID: {user.id}</div>
                </div>
              </div>
              
              <div className="profile-stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🪙</div>
                  <div className="stat-info">
                    <div className="stat-label">Koinlar</div>
                    <div className="stat-value">{userCoins.toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-info">
                    <div className="stat-label">G'alaba</div>
                    <div className="stat-value">{userStats.wins}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <div className="stat-label">Reyting</div>
                    <div className="stat-value">#{userStats.rank || '-'}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-info">
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
                <button className="action-btn" onClick={() => window.Telegram?.WebApp.openLink('https://t.me/yourbot')}>
                  🤖 Bot
                </button>
                <button className="action-btn" onClick={() => window.Telegram?.WebApp.openLink('https://t.me/channel')}>
                  📢 Kanal
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* REYTING MODALI */}
        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal-content leaderboard-modal">
              <div className="modal-header">
                <h2>🏆 Top 10 O'yinchi</h2>
                <button 
                  className="close-modal" 
                  onClick={() => setShowLeaderboard(false)}
                  aria-label="Yopish"
                >
                  ✕
                </button>
              </div>
              
              <div className="leaderboard-list">
                {leaderboard.map((player, index) => (
                  <div 
                    key={player.userId} 
                    className={`leaderboard-item ${player.userId === user?.id ? 'current-user' : ''}`}
                  >
                    <div className="leaderboard-rank">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                    </div>
                    
                    <div className="leaderboard-player">
                      <div className="player-avatar">
                        {getProfileImage(player.photo_url, player.name, 36)}
                        {player.equippedItems && player.equippedItems.includes('avatar') && (
                          <div className="player-frame">👑</div>
                        )}
                      </div>
                      <div className="player-info">
                        <div className="player-name">
                          {player.name}
                          {player.userId === user?.id && <span className="you-badge"> (Siz)</span>}
                        </div>
                        <div className="player-stats">
                          🪙 {player.totalCoins.toLocaleString()} | 🔥 {player.winStreak} | 📈 {player.weeklyWins}
                        </div>
                      </div>
                    </div>
                    
                    <div className="leaderboard-score">
                      <span className="weekly-wins">#{player.rank}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="leaderboard-footer">
                <p>⚡ Haftalik reyting har yakshanba yangilanadi</p>
                <p>📊 Sizning reytingingiz: #{userStats.rank || 'Hali reytingda emas'}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* O'YIN EKRANLARI */}
        
        {/* IDLE - O'yin boshlanmagan */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle">
            <div className="welcome-container">
              <h2>Xush kelibsiz, {user?.first_name}! 👋</h2>
              <p className="welcome-text">Raqibingizni mag'lub qiling va koinlar yuting! 🏆</p>
              
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
                  <span className="stat-text">{leaderboard.length || 0} o'yinchi</span>
                </div>
              </div>
              
              <div className="game-rules-card">
                <h4>📖 O'yin qoidalari:</h4>
                <ul className="rules-list">
                  <li><span className="rule-emoji">✊</span> Tosh qaychini yengadi</li>
                  <li><span className="rule-emoji">✌️</span> Qaychi qog'ozni yengadi</li>
                  <li><span className="rule-emoji">✋</span> Qog'oz toshni yengadi</li>
                  <li><span className="rule-emoji">🏆</span> G'alaba: +50 koin</li>
                  <li><span className="rule-emoji">🤝</span> Durrang: +20 koin</li>
                  <li><span className="rule-emoji">🎁</span> Har kun: Daily bonus</li>
                </ul>
              </div>
              
              <div className="stats-panel">
                <h4>📊 Statistika:</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">O'yinlar:</span>
                    <span className="stat-value">{userStats.totalGames || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">G'alaba:</span>
                    <span className="stat-value">{userStats.wins || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Mag'lubiyat:</span>
                    <span className="stat-value">{userStats.losses || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Durrang:</span>
                    <span className="stat-value">{userStats.draws || 0}</span>
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
          </div>
        )}
        
        {/* WAITING - Raqib kutilmoqda */}
        {gameState.status === 'waiting' && (
          <div className="game-screen waiting">
            <div className="waiting-container">
              <div className="loader">
                <div className="spinner"></div>
              </div>
              
              <h2>Raqib qidirilmoqda...</h2>
              
              <div className="searching-animation">
                <div className="searching-text">
                  <span className="searching-dot">.</span>
                  <span className="searching-dot">.</span>
                  <span className="searching-dot">.</span>
                </div>
              </div>
              
              <div className="waiting-stats">
                <div className="waiting-stat">
                  <span className="stat-icon">⏱️</span>
                  <span className="stat-value">{gameState.timer}s</span>
                  <span className="stat-label">qoldi</span>
                </div>
                
                <div className="waiting-stat">
                  <span className="stat-icon">👤</span>
                  <span className="stat-value">1</span>
                  <span className="stat-label">siz</span>
                </div>
                
                <div className="waiting-stat">
                  <span className="stat-icon">👥</span>
                  <span className="stat-value">?</span>
                  <span className="stat-label">raqib</span>
                </div>
              </div>
              
              <div className="waiting-tips">
                <h4>💡 Tezkor raqib topish uchun:</h4>
                <ul>
                  <li>Do'stlaringizni taklif qiling</li>
                  <li>Faqat o'yin davomida bo'ling</li>
                  <li>Internet aloqasini tekshiring</li>
                </ul>
              </div>
              
              <div className="waiting-actions">
                <button className="cancel-btn" onClick={restartGame}>
                  ❌ Bekor qilish
                </button>
                
                <button className="refresh-btn" onClick={() => {
                  restartGame();
                  setTimeout(startNewGame, 500);
                }}>
                  🔄 Qayta urinish
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* PLAYING - O'yin davom etmoqda */}
        {gameState.status === 'playing' && (
          <div className="game-screen playing">
            <div className="playing-container">
              {/* Raqib ma'lumotlari */}
              <div className="opponent-info">
                <h3>👤 Raqib:</h3>
                <div className="opponent-card">
                  <div className="avatar opponent-avatar">
                    {getProfileImage(gameState.opponentPhoto, gameState.opponent?.firstName, 50)}
                  </div>
                  <div className="opponent-details">
                    <h4>{gameState.opponent?.firstName || 'Raqib'}</h4>
                    <p>Tanlov kutilmoqda...</p>
                  </div>
                </div>
              </div>
              
              {/* Taymer */}
              <div className="timer-display">
                <div className="timer-icon">⏰</div>
                <div className="timer-value">{gameState.timer}s qoldi</div>
              </div>
              
              {/* Tanlov tugmalari */}
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
                <div className="player-choice">
                  <div className="choice-box you">
                    <div className="label">Siz</div>
                    <div className="emoji">{getChoiceEmoji(gameState.myChoice)}</div>
                    <div className="choice-status">
                      {gameState.myChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
                
                <div className="vs">VS</div>
                
                <div className="player-choice">
                  <div className="choice-box opponent">
                    <div className="label">Raqib</div>
                    <div className="emoji">{getChoiceEmoji(gameState.opponentChoice)}</div>
                    <div className="choice-status">
                      {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Savollar */}
              <div className="game-tips">
                <p>💡 <strong>Maslahat:</strong> {gameState.myChoice ? 
                  'Raqib tanlov qilishini kutayapmaniz...' : 
                  'Tezroq tanlang, vaqt chegarasi bor!'}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* FINISHED - O'yin tugadi */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished">
            <div className="result-container">
              <h2 className={`result-title ${gameState.result}`}>
                {gameState.result === 'win' ? '🏆 G\'ALABA!' : 
                 gameState.result === 'lose' ? '😔 MAG\'LUBIYAT' : 
                 gameState.result === 'draw' ? '🤝 DURRANG' : 
                 '⏰ VAQT TUGADI'}
              </h2>
              
              <div className="final-choices">
                <div className="final-choice">
                  <div className="player">Siz</div>
                  <div className="choice-emoji large">{getChoiceEmoji(gameState.myChoice)}</div>
                  <div className="choice-name">
                    {gameState.myChoice === 'rock' ? 'Tosh' : 
                     gameState.myChoice === 'paper' ? 'Qog\'oz' : 'Qaychi'}
                  </div>
                </div>
                
                <div className="vs-large">VS</div>
                
                <div className="final-choice">
                  <div className="player">Raqib</div>
                  <div className="choice-emoji large">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-name">
                    {gameState.opponentChoice === 'rock' ? 'Tosh' : 
                     gameState.opponentChoice === 'paper' ? 'Qog\'oz' : 'Qaychi'}
                  </div>
                </div>
              </div>
              
              {/* Koin mukofoti */}
              <div className="coins-reward">
                <div className="reward-badge">
                  <div className="reward-icon">🪙</div>
                  <div className="reward-amount">
                    +{gameState.result === 'win' ? 50 : 
                      gameState.result === 'lose' ? 10 : 
                      gameState.result === 'draw' ? 20 : 0}
                  </div>
                  <div className="reward-label">Koinlar</div>
                </div>
                
                {gameState.result === 'win' && (
                  <div className="bonus-info">
                    <p>🔥 Ketma-ket g'alaba qozonsangiz, bonus koinlar olasiz!</p>
                  </div>
                )}
              </div>
              
              <div className="result-description">
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
      
      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p className="footer-title">🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
          <div className="footer-links">
            <button 
              className="footer-link"
              onClick={() => window.Telegram?.WebApp.openLink('https://t.me/yourbot')}
            >
              🤖 Bot
            </button>
            <span className="link-separator">•</span>
            <button 
              className="footer-link"
              onClick={() => window.Telegram?.WebApp.openLink('https://t.me/channel')}
            >
              📢 Kanal
            </button>
            <span className="link-separator">•</span>
            <button 
              className="footer-link"
              onClick={() => window.Telegram?.WebApp.openLink('https://t.me/support')}
            >
              🆘 Yordam
            </button>
          </div>
          <p className="footer-info">© 2024 - Barcha huquqlar himoyalangan</p>
        </div>
      </footer>
    </div>
  );
}

export default App;