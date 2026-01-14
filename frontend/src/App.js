import { useEffect, useState, useCallback } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, waiting, playing, finished
    opponent: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60,
    gameId: null
  });
  
  const [userCoins, setUserCoins] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [equippedItems, setEquippedItems] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ available: false });
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  
  // Telegram WebApp ni sozlash
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const userData = tg.initDataUnsafe?.user;
      setUser(userData);
      
      if (userData) {
        initializeGame(userData);
        loadUserData(userData.id);
      }
      
      // Telegram tugmalarini sozlash
      tg.MainButton.setText("🎮 O'ynash");
      tg.MainButton.color = "#31b545";
      tg.MainButton.onClick(startNewGame);
      tg.MainButton.show();
      
      tg.BackButton.onClick(() => {
        if (showShop) setShowShop(false);
        else if (showProfile) setShowProfile(false);
        else if (showLeaderboard) setShowLeaderboard(false);
        else tg.BackButton.hide();
      });
      
      tg.sendData(JSON.stringify({ 
        type: 'web_app_ready',
        userId: userData?.id 
      }));
    }
    
    return () => {
      if (websocket) websocket.close();
    };
  }, []);
  
  // Foydalanuvchi ma'lumotlarini yuklash
  const loadUserData = async (userId) => {
    try {
      await Promise.all([
        fetchUserCoins(userId),
        fetchInventory(userId),
        fetchShopItems(),
        fetchLeaderboard()
      ]);
    } catch (error) {
      console.error('Ma\'lumot yuklash xatosi:', error);
    }
  };
  
  // Koinlarni olish
  const fetchUserCoins = async (userId) => {
    try {
      const response = await fetch(`https://your-backend.onrender.com/api/coins/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setUserCoins(data.balance);
        setDailyStatus(data.dailyBonus || { available: false });
      }
    } catch (error) {
      console.error('Koinlarni olish xatosi:', error);
    }
  };
  
  // Inventarni olish
  const fetchInventory = async (userId) => {
    try {
      const response = await fetch(`https://your-backend.onrender.com/api/items/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setInventory(data.items);
        setEquippedItems(data.equipped);
      }
    } catch (error) {
      console.error('Inventar yuklash xatosi:', error);
    }
  };
  
  // Do'kon mahsulotlarini olish
  const fetchShopItems = async () => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/shop/items');
      const data = await response.json();
      
      if (data.success) {
        setShopItems(data.items);
      }
    } catch (error) {
      console.error('Do\'kon yuklash xatosi:', error);
    }
  };
  
  // Reyting jadvalini olish
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/leaderboard/top');
      const data = await response.json();
      
      if (data.success) {
        setLeaderboard(data.leaderboard);
      }
    } catch (error) {
      console.error('Reyting yuklash xatosi:', error);
    }
  };
  
  // Kunlik bonus olish
  const claimDailyBonus = async () => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/daily-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserCoins(prev => prev + data.amount);
        setDailyStatus(prev => ({ ...prev, available: false }));
        
        // Telegram haqida xabar
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(`+${data.amount} koin olindi! (${data.streak} kun ketma-ket)`);
        }
        
        // Daily status ni yangilash
        setTimeout(() => {
          fetchUserCoins(user.id);
        }, 1000);
      } else {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(data.message);
        }
      }
    } catch (error) {
      console.error('Daily bonus xatosi:', error);
    }
  };
  
  // Sovg'a sotib olish
  const purchaseItem = async (item) => {
    if (userCoins < item.price) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Koinlar yetarli emas!');
      }
      return;
    }
    
    try {
      const response = await fetch('https://your-backend.onrender.com/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          itemId: item.id 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserCoins(data.newBalance);
        // Inventarni yangilash
        await fetchInventory(user.id);
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(`"${item.name}" sovg'asi sotib olindi!`);
        }
      } else {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(data.error);
        }
      }
    } catch (error) {
      console.error('Sotib olish xatosi:', error);
    }
  };
  
  // Sovg'ani kiyish
  const equipItem = async (itemId) => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/items/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          itemId 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Inventarni yangilash
        await fetchInventory(user.id);
      }
    } catch (error) {
      console.error('Kiyish xatosi:', error);
    }
  };
  
  // O'yinni boshlash
  const initializeGame = async (userData) => {
    try {
      // WebSocket ulanishi
      const ws = new WebSocket('wss://your-backend.onrender.com/ws');
      
      setWebsocket(ws);
      
      ws.onopen = () => {
        console.log('WebSocket ulandi');
        // Foydalanuvchini ro'yxatdan o'tkazish
        ws.send(JSON.stringify({
          type: 'register',
          userId: userData.id,
          username: userData.username,
          firstName: userData.first_name
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleGameUpdate(data);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket xatosi:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket uzildi');
      };
      
    } catch (error) {
      console.error('Oyin boshlash xatosi:', error);
    }
  };
  
  // Yangi o'yin boshlash
  const startNewGame = () => {
    if (!user) return;
    
    setGameState({
      ...gameState,
      status: 'waiting',
      timer: 60,
      myChoice: null,
      opponentChoice: null,
      result: null
    });
    
    // Backend'ga so'rov
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'create_game',
        userId: user.id,
        username: user.username,
        firstName: user.first_name
      }));
    }
    
    // Taymer boshlash
    startTimer();
  };
  
  // Taymer
  const startTimer = () => {
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
    
    return timer;
  };
  
  // Tanlov qilish
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing') return;
    
    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));
    
    // Backend'ga tanlovni yuborish
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'make_choice',
        userId: user.id,
        gameId: gameState.gameId,
        choice: choice
      }));
    }
  };
  
  // O'yin yangilanishini qabul qilish
  const handleGameUpdate = (data) => {
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
        break;
        
      case 'opponent_choice_made':
        // Raqib tanlov qilganligi haqida bildirish
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Raqib tanlov qildi!');
        }
        break;
        
      case 'choice_accepted':
        console.log('Tanlov qabul qilindi:', data.choice);
        break;
        
      case 'game_result':
        setGameState(prev => ({
          ...prev,
          opponentChoice: data.choices?.player2,
          result: data.result === 'player1_win' ? 'win' : 
                  data.result === 'player2_win' ? 'lose' : 'draw',
          status: 'finished'
        }));
        
        // Koinlarni yangilash
        if (data.result === 'player1_win') {
          // G'alaba uchun koinlar
          const winCoins = 50 + (data.winStreak || 0) * 10;
          setUserCoins(prev => prev + winCoins);
        } else if (data.result === 'draw') {
          setUserCoins(prev => prev + 20);
        } else {
          setUserCoins(prev => prev + 10);
        }
        break;
        
      case 'game_timeout':
        setGameState(prev => ({
          ...prev,
          result: 'timeout',
          status: 'finished'
        }));
        break;
    }
  };
  
  // O'yinni qayta boshlash
  const restartGame = () => {
    setGameState({
      status: 'idle',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null
    });
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
  
  // Profil ma'lumotlarini yuklash
  const loadUserStats = async () => {
    try {
      const response = await fetch(`https://your-backend.onrender.com/api/stats/${user.id}`);
      const data = await response.json();
      if (data.success) setUserStats(data.stats?.user);
    } catch (error) {
      console.error('Statistika yuklash xatosi:', error);
    }
  };
  
  // Profil ochilganda statistikani yuklash
  useEffect(() => {
    if (showProfile && user) {
      loadUserStats();
    }
  }, [showProfile, user]);
  
  return (
    <div className="app">
      {/* Sarlavha qismi */}
      <header>
        <div className="header-left">
          <h1>🎮 Tosh • Qaychi • Qog'oz</h1>
        </div>
        
        <div className="header-right">
          {user && (
            <>
              {/* Koin paneli */}
              <div className="coins-panel">
                <div className="coins-display">
                  <span className="coin-icon">🪙</span>
                  <span className="coin-amount">{userCoins}</span>
                </div>
                <button 
                  className={`daily-bonus-btn ${dailyStatus.available ? 'available' : 'unavailable'}`}
                  onClick={claimDailyBonus}
                  disabled={!dailyStatus.available}
                  title={dailyStatus.available ? 'Kunlik bonus' : `${dailyStatus.nextIn || 20} soatdan keyin`}
                >
                  🎁
                </button>
              </div>
              
              {/* Profil tugmasi */}
              <button 
                className="profile-header-btn"
                onClick={() => setShowProfile(true)}
              >
                <div className="profile-avatar-small">
                  {user.first_name?.[0]}
                  {equippedItems.avatar && (
                    <div className="avatar-frame-small"></div>
                  )}
                </div>
              </button>
            </>
          )}
        </div>
      </header>
      
      {/* Asosiy kontent */}
      <main>
        {/* DO'KON MODALI */}
        {showShop && (
          <div className="modal-overlay">
            <div className="modal-content shop-modal">
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button className="close-modal" onClick={() => setShowShop(false)}>✕</button>
              </div>
              
              <div className="shop-balance">
                <span>Mavjud koinlar:</span>
                <span className="shop-coins">🪙 {userCoins}</span>
              </div>
              
              <div className="shop-items-grid">
                {shopItems.map(item => (
                  <div 
                    key={item.id} 
                    className="shop-item-card"
                    style={{ borderColor: getRarityColor(item.rarity) }}
                  >
                    <div className="item-icon">{item.icon || '🎁'}</div>
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                      <div className="item-meta">
                        <span className="item-type">{item.type}</span>
                        <span className="item-rarity" style={{ color: getRarityColor(item.rarity) }}>
                          {item.rarity}
                        </span>
                      </div>
                    </div>
                    <div className="item-price">
                      <span>🪙 {item.price}</span>
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
              
              <div className="inventory-preview">
                <h3>Sizning sovg'alaringiz: {inventory.length} ta</h3>
                <div className="inventory-items">
                  {inventory.slice(0, 5).map(item => (
                    <div 
                      key={item.itemId} 
                      className={`inventory-item ${item.equipped ? 'equipped' : ''}`}
                      onClick={() => equipItem(item.itemId)}
                      title={item.equipped ? 'Kiyilgan' : 'Kiyish'}
                    >
                      {item.icon || '🎁'}
                    </div>
                  ))}
                  {inventory.length > 5 && (
                    <div className="inventory-more">+{inventory.length - 5}</div>
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
                <button className="close-modal" onClick={() => setShowProfile(false)}>✕</button>
              </div>
              
              <div className="profile-info">
                <div className="profile-avatar-large">
                  <div className="avatar-circle">
                    {user.first_name?.[0]}
                    {equippedItems.avatar && (
                      <div className="avatar-frame-large">
                        <div className="frame-effect"></div>
                      </div>
                    )}
                  </div>
                  {equippedItems.title && (
                    <div className="player-title-badge">{equippedItems.title.name}</div>
                  )}
                </div>
                
                <div className="profile-details">
                  <h3>{user.first_name}</h3>
                  <p className="username">@{user.username || 'noma\'lum'}</p>
                </div>
              </div>
              
              <div className="profile-stats-grid">
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
                    <div className="stat-value">{userStats?.wins || 0}</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <div className="stat-label">Reyting</div>
                    <div className="stat-value">#{userStats?.rank || '-'}</div>
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
              </div>
            </div>
          </div>
        )}
        
        {/* REYTING MODALI */}
        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal-content leaderboard-modal">
              <div className="modal-header">
                <h2>🏆 Top 50 O'yinchi</h2>
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
                        {player.equippedItems?.includes('avatar_frame') && (
                          <div className="player-frame"></div>
                        )}
                      </div>
                      <div className="player-info">
                        <div className="player-name">
                          {player.name}
                          {player.userId === user?.id && ' (Siz)'}
                        </div>
                        <div className="player-stats">
                          🪙 {player.totalCoins} | 🔥 {player.winStreak}
                        </div>
                      </div>
                    </div>
                    
                    <div className="leaderboard-score">
                      <span className="weekly-wins">📈 {player.weeklyWins}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="leaderboard-footer">
                <p>⚡ Haftalik reyting har yakshanba yangilanadi</p>
              </div>
            </div>
          </div>
        )}
        
        {/* O'YIN HOLATI */}
        
        {/* IDLE - O'yin boshlanmagan */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="game-screen idle">
            <div className="welcome">
              <h2>Xush kelibsiz, {user?.first_name}! 👋</h2>
              <p>Raqibingizni mag'lub qiling va koinlar yuting! 🏆</p>
              
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="stat-icon">🪙</span>
                  <span className="stat-text">{userCoins} koin</span>
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
              
              <button className="start-btn" onClick={startNewGame}>
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
                <h4>📖 O'yin qoidalari:</h4>
                <ul>
                  <li>✊ Tosh qaychini yengadi</li>
                  <li>✌️ Qaychi qog'ozni yengadi</li>
                  <li>✋ Qog'oz toshni yengadi</li>
                  <li>🏆 G'alaba: +50 koin</li>
                  <li>🤝 Durrang: +20 koin</li>
                  <li>🎁 Har kun: Daily bonus</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* WAITING - Raqib kutilmoqda */}
        // WAITING - Raqib kutilmoqda
{gameState.status === 'waiting' && (
  <div className="game-screen waiting">
    <div className="loader">
      <div className="spinner"></div>
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
          <span className="stat-icon">👥</span>
          <span className="stat-value">?</span>
          <span className="stat-label">o'yinchi</span>
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
          setTimeout(startNewGame, 1000);
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
            <div className="opponent-info">
              <h3>👤 Raqib:</h3>
              <div className="opponent-card">
                <div className="avatar opponent-avatar">
                  {gameState.opponent?.firstName?.[0] || '?'}
                </div>
                <div>
                  <h4>{gameState.opponent?.firstName || 'Raqib'}</h4>
                  <p>Tanlov kutilmoqda...</p>
                </div>
              </div>
            </div>
            
            <div className="timer">⏰ {gameState.timer}s qoldi</div>
            
            <div className="choices">
              <h3>Tanlang:</h3>
              <div className="choice-buttons">
                <button 
                  className={`choice-btn rock ${gameState.myChoice === 'rock' ? 'selected' : ''}`}
                  onClick={() => makeChoice('rock')}
                >
                  <span className="choice-emoji">✊</span>
                  <span className="choice-text">Tosh</span>
                </button>
                <button 
                  className={`choice-btn paper ${gameState.myChoice === 'paper' ? 'selected' : ''}`}
                  onClick={() => makeChoice('paper')}
                >
                  <span className="choice-emoji">✋</span>
                  <span className="choice-text">Qog'oz</span>
                </button>
                <button 
                  className={`choice-btn scissors ${gameState.myChoice === 'scissors' ? 'selected' : ''}`}
                  onClick={() => makeChoice('scissors')}
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
        )}
        
        {/* FINISHED - O'yin tugadi */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished">
            <div className="result">
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
        
        {/* STATISTIKA PANELI (faqat idle vaqtida) */}
        {gameState.status === 'idle' && !showShop && !showProfile && !showLeaderboard && (
          <div className="stats-panel">
            <div className="stat-item">
              <span className="stat-label">O'yinlar:</span>
              <span className="stat-value">{userStats?.totalGames || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">G'alaba:</span>
              <span className="stat-value">{userStats?.wins || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Mag'lubiyat:</span>
              <span className="stat-value">{userStats?.losses || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Durrang:</span>
              <span className="stat-value">{userStats?.draws || 0}</span>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer>
        <div className="footer-content">
          <p>🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
          <p className="footer-links">
            <span onClick={() => window.Telegram?.WebApp.openLink('https://t.me/yourbot')}>
              🤖 Bot
            </span> • 
            <span onClick={() => window.Telegram?.WebApp.openLink('https://t.me/channel')}>
              📢 Kanal
            </span> • 
            <span onClick={() => window.Telegram?.WebApp.openLink('https://t.me/support')}>
              🆘 Yordam
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;