import { useEffect, useState, useCallback } from 'react';
import './App.css';

function App() {
  // States
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'idle',
    opponent: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60,
    gameId: null
  });
  
  const [userCoins, setUserCoins] = useState(100);
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ 
    available: true, 
    streak: 0, 
    nextIn: 0 
  });
  
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [websocket, setWebsocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameTimer, setGameTimer] = useState(null);

  // ==================== CORE FUNCTIONS ====================

  // Start new game function
  const startNewGame = useCallback(() => {
    if (!user) {
      showTelegramAlert('Iltimos, avval tizimga kiring');
      return;
    }

    if (gameState.status === 'waiting' || gameState.status === 'playing') {
      showTelegramAlert('O\'yin allaqachon davom etmoqda');
      return;
    }

    console.log('🎮 Starting new game...');

    // Reset game state
    setGameState({
      status: 'waiting',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null
    });

    // Send game creation request via WebSocket
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const gameData = {
        type: 'create_game',
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        photoUrl: user.photo_url
      };
      
      websocket.send(JSON.stringify(gameData));
      
      // Start timer for waiting
      clearInterval(gameTimer);
      let timeLeft = 60;
      
      const timer = setInterval(() => {
        timeLeft--;
        setGameState(prev => ({ ...prev, timer: timeLeft }));
        
        if (timeLeft <= 0) {
          clearInterval(timer);
          if (gameState.status === 'waiting') {
            setGameState(prev => ({ 
              ...prev, 
              status: 'finished',
              result: 'timeout' 
            }));
          }
        }
      }, 1000);
      
      setGameTimer(timer);
    } else {
      console.error('WebSocket not connected');
      showTelegramAlert('Serverga ulanmadi. Iltimos, qayta urinib ko\'ring');
    }
  }, [user, websocket, gameState.status, gameTimer]);

  // Make choice function
  const makeChoice = useCallback((choice) => {
    if (gameState.status !== 'playing' || !gameState.gameId) {
      showTelegramAlert('Hozir tanlov qila olmaysiz');
      return;
    }

    if (gameState.myChoice) {
      showTelegramAlert('Siz allaqachon tanlov qilgansiz');
      return;
    }

    console.log(`🤔 Making choice: ${choice}`);

    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'make_choice',
        userId: user.id,
        gameId: gameState.gameId,
        choice: choice
      }));
    }
  }, [gameState, user, websocket]);

  // Restart game function
  const restartGame = useCallback(() => {
    clearInterval(gameTimer);
    setGameState({
      status: 'idle',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null
    });
  }, [gameTimer]);

  // ==================== GAME LOGIC FUNCTIONS ====================

  // Initialize WebSocket connection
  const initializeGame = useCallback(async (userData) => {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'wss://rock-paper-scissors-game-production.up.railway.app/ws';
      const ws = new WebSocket(wsUrl);

      setWebsocket(ws);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setLoading(false);
        
        // Register user
        ws.send(JSON.stringify({
          type: 'register',
          userId: userData.id,
          username: userData.username,
          firstName: userData.first_name,
          photoUrl: userData.photo_url
        }));

        // Setup Telegram main button
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.MainButton.offClick(startNewGame);
          tg.MainButton.onClick(startNewGame);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleGameUpdate(data);
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setLoading(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Try to reconnect after 5 seconds
        setTimeout(() => {
          if (userData) initializeGame(userData);
        }, 5000);
      };

    } catch (error) {
      console.error('Game initialization error:', error);
      setLoading(false);
    }
  }, [startNewGame]);

  // Handle game updates from WebSocket
  const handleGameUpdate = useCallback((data) => {
    console.log('📩 Game update:', data.type);

    switch (data.type) {
      case 'game_created':
        setGameState(prev => ({
          ...prev,
          gameId: data.gameId,
          status: 'waiting'
        }));
        break;

      case 'opponent_found':
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          status: 'playing'
        }));
        showTelegramAlert(`Raqib topildi: ${data.opponent.firstName}`);
        break;

      case 'game_result':
        setGameState(prev => ({
          ...prev,
          opponentChoice: data.choices?.player2,
          result: data.result === 'player1_win' ? 'win' : 
                  data.result === 'player2_win' ? 'lose' : 'draw',
          status: 'finished'
        }));

        // Award coins based on result
        const coinRewards = {
          'win': 50,
          'lose': 10,
          'draw': 20,
          'timeout': 5
        };

        const reward = coinRewards[data.result === 'player1_win' ? 'win' : 
                                  data.result === 'player2_win' ? 'lose' : 'draw'] || 0;
        
        if (reward > 0) {
          setUserCoins(prev => prev + reward);
          showTelegramAlert(`🎉 +${reward} koin yutib oldingiz!`);
        }
        break;

      case 'opponent_choice_made':
        showTelegramAlert('Raqib tanlov qildi!');
        break;

      case 'game_timeout':
        setGameState(prev => ({
          ...prev,
          result: 'timeout',
          status: 'finished'
        }));
        showTelegramAlert('⏰ Vaqt tugadi');
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);

  // ==================== USER DATA FUNCTIONS ====================

  // Load user data
  const loadUserData = useCallback(async (userId) => {
    try {
      // Mock data for demo
      setUserCoins(1000);
      setDailyStatus({ available: true, streak: 7, nextIn: 0 });
      
      // Mock shop items
      setShopItems([
        {
          id: 'frame_gold',
          name: 'Oltin Ramka',
          description: 'Profil rasmingiz uchun oltin ramka',
          type: 'frame',
          price: 500,
          rarity: 'epic',
          icon: '🖼️'
        },
        {
          id: 'title_champion',
          name: 'Chempion Unvoni',
          description: 'G\'olib bo\'lganlar uchun maxsus unvon',
          type: 'title',
          price: 1000,
          rarity: 'legendary',
          icon: '🏆'
        },
        {
          id: 'effect_fire',
          name: 'Olov Effekti',
          description: 'Profilga olov effekti qo\'shish',
          type: 'effect',
          price: 300,
          rarity: 'rare',
          icon: '🔥'
        }
      ]);

      // Mock inventory
      setInventory([
        { itemId: 'frame_silver', name: 'Kumush Ramka', type: 'frame', equipped: true },
        { itemId: 'title_pro', name: 'Pro Unvon', type: 'title', equipped: false }
      ]);

      // Mock leaderboard
      setLeaderboard([
        { userId: 1, name: 'Ali', totalCoins: 5000, winStreak: 15, weeklyWins: 42 },
        { userId: 2, name: 'Vali', totalCoins: 4200, winStreak: 12, weeklyWins: 38 },
        { userId: 3, name: 'Hasan', totalCoins: 3800, winStreak: 8, weeklyWins: 35 },
        { userId: 4, name: 'Husan', totalCoins: 3500, winStreak: 5, weeklyWins: 32 },
        { userId: user?.id, name: user?.first_name, totalCoins: 1000, winStreak: 3, weeklyWins: 15 }
      ]);

    } catch (error) {
      console.error('User data loading error:', error);
    }
  }, [user]);

  // Claim daily bonus
  const claimDailyBonus = useCallback(async () => {
    if (!dailyStatus.available) {
      showTelegramAlert(`Kunlik bonus ${dailyStatus.nextIn} soatdan keyin`);
      return;
    }

    try {
      const bonus = 100 + (dailyStatus.streak * 20);
      setUserCoins(prev => prev + bonus);
      setDailyStatus(prev => ({ 
        ...prev, 
        available: false, 
        streak: prev.streak + 1,
        nextIn: 24 
      }));

      showTelegramAlert(`🎁 +${bonus} koin bonus olindi! Streak: ${dailyStatus.streak + 1}`);
    } catch (error) {
      console.error('Daily bonus error:', error);
    }
  }, [dailyStatus]);

  // Purchase item
  const purchaseItem = useCallback(async (item) => {
    if (userCoins < item.price) {
      showTelegramAlert('Koinlar yetarli emas!');
      return;
    }

    try {
      setUserCoins(prev => prev - item.price);
      setInventory(prev => [...prev, { 
        itemId: item.id, 
        name: item.name, 
        type: item.type, 
        equipped: false 
      }]);

      showTelegramAlert(`✅ "${item.name}" sovg'asi sotib olindi!`);
    } catch (error) {
      console.error('Purchase error:', error);
    }
  }, [userCoins]);

  // Equip item
  const equipItem = useCallback(async (itemId) => {
    try {
      const item = inventory.find(i => i.itemId === itemId);
      if (!item) return;

      // Unequip all items of same type
      const updatedInventory = inventory.map(i => ({
        ...i,
        equipped: i.type === item.type ? false : i.equipped
      }));

      // Equip selected item
      const finalInventory = updatedInventory.map(i => ({
        ...i,
        equipped: i.itemId === itemId ? true : i.equipped
      }));

      setInventory(finalInventory);
      
      // Update equipped items
      const equipped = {};
      finalInventory.forEach(i => {
        if (i.equipped) {
          equipped[i.type] = i;
        }
      });
      setEquippedItems(equipped);

      showTelegramAlert(`✅ "${item.name}" kiyildi`);
    } catch (error) {
      console.error('Equip error:', error);
    }
  }, [inventory]);

  // ==================== HELPER FUNCTIONS ====================

  // Show Telegram alert
  const showTelegramAlert = useCallback((message) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(message);
    } else {
      alert(message);
    }
  }, []);

  // Get choice emoji
  const getChoiceEmoji = useCallback((choice) => {
    const emojis = {
      'rock': '✊',
      'paper': '✋',
      'scissors': '✌️'
    };
    return emojis[choice] || '❓';
  }, []);

  // Get rarity color
  const getRarityColor = useCallback((rarity) => {
    const colors = {
      'common': '#808080',
      'rare': '#1E90FF',
      'epic': '#9370DB',
      'legendary': '#FFD700'
    };
    return colors[rarity] || '#808080';
  }, []);

  // ==================== UI COMPONENTS ====================

  // User avatar component
  const UserAvatar = ({ size = 'medium', showFrame = true, photoUrl = null, user = null }) => {
    const sizes = {
      'small': '40px',
      'medium': '60px',
      'large': '100px'
    };

    const fontSize = {
      'small': '18px',
      'medium': '24px',
      'large': '36px'
    };

    return (
      <div className={`avatar-container ${size}`}>
        <div 
          className="avatar"
          style={{
            width: sizes[size],
            height: sizes[size],
            fontSize: fontSize[size],
            backgroundImage: photoUrl ? `url(${photoUrl})` : 'none',
            backgroundColor: photoUrl ? 'transparent' : '#6366f1'
          }}
        >
          {!photoUrl && user?.first_name?.[0]}
        </div>
        {showFrame && equippedItems.frame && (
          <div className={`avatar-frame ${size}`}></div>
        )}
      </div>
    );
  };

  // ==================== TELEGRAM INITIALIZATION ====================

  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Initialize Telegram WebApp
        tg.ready();
        tg.expand();
        
        // Get user data
        const userData = tg.initDataUnsafe?.user;
        if (userData) {
          setUser(userData);
          setUserPhoto(userData.photo_url);
          loadUserData(userData.id);
          initializeGame(userData);
        }

        // Setup main button
        tg.MainButton.setText("🎮 O'ynash");
        tg.MainButton.color = "#31b545";
        tg.MainButton.textColor = "#ffffff";
        tg.MainButton.onClick(startNewGame);
        tg.MainButton.show();

        // Setup back button
        tg.BackButton.onClick(() => {
          if (showShop) setShowShop(false);
          else if (showProfile) setShowProfile(false);
          else if (showLeaderboard) setShowLeaderboard(false);
          else tg.BackButton.hide();
        });

        // Send ready message
        tg.sendData(JSON.stringify({ 
          type: 'web_app_ready',
          userId: userData?.id 
        }));

        setLoading(false);
      } else {
        // Demo mode for browser
        const demoUser = {
          id: 123456789,
          first_name: 'Demo',
          username: 'demo_user',
          photo_url: null
        };
        
        setUser(demoUser);
        loadUserData(demoUser.id);
        setLoading(false);
      }
    };

    initTelegram();

    // Cleanup
    return () => {
      if (websocket) websocket.close();
      clearInterval(gameTimer);
    };
  }, []);

  // ==================== RENDER LOADING ====================

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader">
          <div className="spinner"></div>
          <h2>Yuklanmoqda...</h2>
          <p>Iltimos, kuting</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🎮 Tosh • Qaychi • Qog'oz</h1>
        </div>
        
        <div className="header-right">
          {user && (
            <>
              <div className="coins-panel">
                <div className="coins-display">
                  <span className="coin-icon">🪙</span>
                  <span className="coin-amount">{userCoins}</span>
                </div>
                <button 
                  className={`daily-bonus-btn ${dailyStatus.available ? 'available' : 'unavailable'}`}
                  onClick={claimDailyBonus}
                  disabled={!dailyStatus.available}
                  title={dailyStatus.available ? 'Kunlik bonus' : `${dailyStatus.nextIn} soatdan keyin`}
                >
                  🎁
                </button>
              </div>
              
              <button 
                className="profile-header-btn"
                onClick={() => setShowProfile(true)}
              >
                <UserAvatar 
                  size="small" 
                  photoUrl={userPhoto} 
                  user={user} 
                  showFrame={true}
                />
              </button>
            </>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* SHOP MODAL */}
        {showShop && (
          <div className="modal-overlay" onClick={() => setShowShop(false)}>
            <div className="modal-content shop-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button className="close-modal" onClick={() => setShowShop(false)}>✕</button>
              </div>
              
              <div className="shop-balance">
                <span>Mavjud koinlar:</span>
                <span className="shop-coins">🪙 {userCoins}</span>
              </div>
              
              <div className="shop-items">
                {shopItems.map(item => (
                  <div 
                    key={item.id} 
                    className="shop-item"
                    style={{ borderColor: getRarityColor(item.rarity) }}
                  >
                    <div className="item-icon">{item.icon}</div>
                    <div className="item-details">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
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
                    <div className="item-actions">
                      <div className="item-price">🪙 {item.price}</div>
                      <button 
                        className="buy-btn"
                        onClick={() => purchaseItem(item)}
                        disabled={userCoins < item.price}
                      >
                        {userCoins >= item.price ? 'Sotib olish' : 'Koin yetarli emas'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="inventory-section">
                <h3>📦 Sizning sovg'alaringiz</h3>
                <div className="inventory-items">
                  {inventory.map(item => (
                    <div 
                      key={item.itemId}
                      className={`inventory-item ${item.equipped ? 'equipped' : ''}`}
                      onClick={() => equipItem(item.itemId)}
                      title={item.equipped ? 'Kiyilgan' : 'Kiyish'}
                    >
                      <div className="inventory-item-icon">
                        {shopItems.find(si => si.id === item.itemId)?.icon || '🎁'}
                      </div>
                      <div className="inventory-item-name">{item.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfile && (
          <div className="modal-overlay" onClick={() => setShowProfile(false)}>
            <div className="modal-content profile-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>👤 Profil</h2>
                <button className="close-modal" onClick={() => setShowProfile(false)}>✕</button>
              </div>
              
              <div className="profile-info">
                <UserAvatar 
                  size="large" 
                  photoUrl={userPhoto} 
                  user={user} 
                  showFrame={true}
                />
                
                <div className="profile-details">
                  <h2>{user?.first_name}</h2>
                  <p className="username">@{user?.username || 'noma\'lum'}</p>
                </div>
              </div>
              
              <div className="profile-stats">
                <div className="stat-card">
                  <div className="stat-icon">🪙</div>
                  <div className="stat-info">
                    <div className="stat-label">Koinlar</div>
                    <div className="stat-value">{userCoins}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-info">
                    <div className="stat-label">G'alaba</div>
                    <div className="stat-value">0</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <div className="stat-label">Reyting</div>
                    <div className="stat-value">#-</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-info">
                    <div className="stat-label">Streak</div>
                    <div className="stat-value">{dailyStatus.streak}</div>
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
                <button className="action-btn" onClick={() => window.open('https://t.me/yourbot', '_blank')}>
                  🤖 Bot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD MODAL */}
        {showLeaderboard && (
          <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
            <div className="modal-content leaderboard-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🏆 Top 10 O'yinchi</h2>
                <button className="close-modal" onClick={() => setShowLeaderboard(false)}>✕</button>
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
                        {player.name?.[0]}
                      </div>
                      <div className="player-info">
                        <div className="player-name">
                          {player.name}
                          {player.userId === user?.id && <span className="you-badge"> (Siz)</span>}
                        </div>
                        <div className="player-stats">
                          🪙 {player.totalCoins} | 🔥 {player.winStreak}
                        </div>
                      </div>
                    </div>
                    
                    <div className="leaderboard-score">
                      📈 {player.weeklyWins}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* IDLE SCREEN */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle-screen">
            <div className="welcome-container">
              <div className="welcome-header">
                <h1>Xush kelibsiz, {user?.first_name}! 👋</h1>
                <p className="subtitle">Raqibingizni mag'lub qiling va koinlar yuting! 🏆</p>
              </div>
              
              <div className="quick-stats">
                <div className="stat-badge">
                  <span className="stat-icon">🪙</span>
                  <span className="stat-text">{userCoins} koin</span>
                </div>
                <div className="stat-badge">
                  <span className="stat-icon">🔥</span>
                  <span className="stat-text">{dailyStatus.streak} kun streak</span>
                </div>
                <div className="stat-badge">
                  <span className="stat-icon">👥</span>
                  <span className="stat-text">{leaderboard.length} o'yinchi</span>
                </div>
              </div>
              
              <button className="start-game-btn" onClick={startNewGame}>
                🎮 O'YINNI BOSHLASH
              </button>
              
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
              
              <div className="game-rules">
                <h3>📖 O'yin qoidalari:</h3>
                <ul className="rules-list">
                  <li>✊ <strong>Tosh</strong> qaychini yengadi</li>
                  <li>✌️ <strong>Qaychi</strong> qog'ozni yengadi</li>
                  <li>✋ <strong>Qog'oz</strong> toshni yengadi</li>
                  <li>🏆 <strong>G'alaba:</strong> +50 koin</li>
                  <li>🤝 <strong>Durrang:</strong> +20 koin</li>
                  <li>🎁 <strong>Har kun:</strong> Daily bonus</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* WAITING SCREEN */}
        {gameState.status === 'waiting' && (
          <div className="game-screen waiting-screen">
            <div className="waiting-container">
              <div className="loader-animation">
                <div className="spinner-large"></div>
                <div className="searching-dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
              
              <h2>Raqib qidirilmoqda...</h2>
              <p className="timer-display">⏰ {gameState.timer}s qoldi</p>
              
              <div className="waiting-info">
                <p>Raqib topilganda sizga bildirish beriladi</p>
                <p className="tip">💡 Maslahat: Sovg'alar sotib oling va statistikangizni oshiring!</p>
              </div>
              
              <button className="cancel-btn" onClick={restartGame}>
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState.status === 'playing' && (
          <div className="game-screen playing-screen">
            <div className="playing-container">
              <div className="opponent-section">
                <h3>👤 Raqib:</h3>
                <div className="opponent-card">
                  <div className="opponent-avatar">
                    {gameState.opponent?.photoUrl ? (
                      <img 
                        src={gameState.opponent.photoUrl} 
                        alt={gameState.opponent.firstName}
                        className="opponent-avatar-img"
                      />
                    ) : (
                      <div className="opponent-avatar-placeholder">
                        {gameState.opponent?.firstName?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="opponent-info">
                    <h4>{gameState.opponent?.firstName || 'Raqib'}</h4>
                    <p>Tanlov kutilmoqda...</p>
                  </div>
                </div>
              </div>
              
              <div className="timer-section">
                <div className="timer-circle">
                  ⏰ {gameState.timer}s
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
                <div className="player-choice-display">
                  <div className="choice-box you">
                    <div className="choice-label">Siz</div>
                    <div className="choice-emoji-large">{getChoiceEmoji(gameState.myChoice)}</div>
                    <div className="choice-status">
                      {gameState.myChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
                
                <div className="vs-divider">VS</div>
                
                <div className="player-choice-display">
                  <div className="choice-box opponent">
                    <div className="choice-label">Raqib</div>
                    <div className="choice-emoji-large">{getChoiceEmoji(gameState.opponentChoice)}</div>
                    <div className="choice-status">
                      {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINISHED SCREEN */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished-screen">
            <div className="result-container">
              <div className={`result-header ${gameState.result}`}>
                <h2>
                  {gameState.result === 'win' ? '🏆 G\'ALABA!' : 
                   gameState.result === 'lose' ? '😔 MAG\'LUBIYAT' : 
                   gameState.result === 'draw' ? '🤝 DURRANG' : 
                   '⏰ VAQT TUGADI'}
                </h2>
              </div>
              
              <div className="players-showcase">
                <div className="player-showcase you-showcase">
                  <div className="player-avatar-large">
                    <UserAvatar 
                      size="medium" 
                      photoUrl={userPhoto} 
                      user={user} 
                      showFrame={true}
                    />
                  </div>
                  <div className="player-name">Siz</div>
                  <div className="player-choice-final">{getChoiceEmoji(gameState.myChoice)}</div>
                </div>
                
                <div className="vs-final">VS</div>
                
                <div className="player-showcase opponent-showcase">
                  <div className="player-avatar-large">
                    {gameState.opponent?.photoUrl ? (
                      <img 
                        src={gameState.opponent.photoUrl} 
                        alt={gameState.opponent.firstName}
                        className="opponent-avatar-final"
                      />
                    ) : (
                      <div className="opponent-avatar-final-placeholder">
                        {gameState.opponent?.firstName?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="player-name">{gameState.opponent?.firstName || 'Raqib'}</div>
                  <div className="player-choice-final">{getChoiceEmoji(gameState.opponentChoice)}</div>
                </div>
              </div>
              
              <div className="result-details">
                <div className="coins-earned">
                  <div className="coin-reward">
                    <div className="reward-icon">🪙</div>
                    <div className="reward-amount">
                      +{gameState.result === 'win' ? 50 : 
                        gameState.result === 'lose' ? 10 : 
                        gameState.result === 'draw' ? 20 : 0}
                    </div>
                    <div className="reward-label">Koinlar</div>
                  </div>
                </div>
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

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <p>🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz • {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;