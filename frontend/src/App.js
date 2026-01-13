// App.js - Optimized Component
import { useEffect, useState, useCallback } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'idle',
    opponent: null,
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60
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
  const [websocket, setWebsocket] = useState(null);

  // Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const userData = tg.initDataUnsafe?.user;
      if (userData) {
        setUser(userData);
        initializeGame(userData);
        loadUserData(userData.id);
      }
      
      tg.MainButton.setText("🎮 O'ynash");
      tg.MainButton.color = "#31b545";
      tg.MainButton.onClick(startNewGame);
      tg.MainButton.show();
      
      tg.BackButton.onClick(handleBackButton);
      
      return () => {
        if (websocket) websocket.close();
      };
    }
  }, []);

  // Backend API base URL
  const API_BASE = 'https://your-backend.onrender.com/api';

  // Data fetching
  const loadUserData = async (userId) => {
    try {
      const [coins, items, shop, leaderboardData] = await Promise.all([
        fetch(`${API_BASE}/coins/${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/items/${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/shop/items`).then(r => r.json()),
        fetch(`${API_BASE}/leaderboard/top`).then(r => r.json())
      ]);
      
      if (coins.success) {
        setUserCoins(coins.balance);
        setDailyStatus(coins.dailyBonus || { available: false });
      }
      if (items.success) {
        setInventory(items.items);
        setEquippedItems(items.equipped);
      }
      if (shop.success) setShopItems(shop.items);
      if (leaderboardData.success) setLeaderboard(leaderboardData.leaderboard);
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  // Game functions
  const startNewGame = useCallback(() => {
    if (!user || gameState.status === 'waiting') return;
    
    setGameState({
      status: 'waiting',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60
    });
    
    if (websocket?.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'create_game',
        userId: user.id
      }));
    }
    
    // Timer
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timer <= 1) {
          clearInterval(timer);
          return { ...prev, status: 'finished', result: 'timeout' };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [user, websocket]);

  const makeChoice = useCallback((choice) => {
    if (gameState.status !== 'playing' || gameState.myChoice) return;
    
    setGameState(prev => ({ ...prev, myChoice: choice }));
    
    if (websocket?.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'make_choice',
        userId: user.id,
        gameId: gameState.gameId,
        choice
      }));
    }
  }, [gameState.status, user, websocket]);

  const restartGame = useCallback(() => {
    setGameState({
      status: 'idle',
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      timer: 60,
      gameId: null
    });
  }, []);

  // Helper functions
  const getChoiceEmoji = useCallback((choice) => {
    return { rock: '✊', paper: '✋', scissors: '✌️' }[choice] || '❓';
  }, []);

  const getRarityColor = useCallback((rarity) => {
    const colors = {
      common: '#808080',
      rare: '#1E90FF',
      epic: '#9370DB',
      legendary: '#FFD700'
    };
    return colors[rarity] || colors.common;
  }, []);

  // UI Handlers
  const handleBackButton = useCallback(() => {
    if (showShop) setShowShop(false);
    else if (showProfile) setShowProfile(false);
    else if (showLeaderboard) setShowLeaderboard(false);
  }, [showShop, showProfile, showLeaderboard]);

  const renderGameScreen = () => {
    switch (gameState.status) {
      case 'idle':
        return (
          <div className="game-screen idle">
            <div className="welcome">
              <h2>Xush kelibsiz, {user?.first_name}!</h2>
              <p>Raqibingizni mag'lub qiling va koinlar yuting!</p>
              
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="stat-icon">🪙</span>
                  <span className="stat-text">{userCoins} koin</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-icon">🔥</span>
                  <span className="stat-text">{dailyStatus.streak || 0} kun</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-icon">👥</span>
                  <span className="stat-text">{leaderboard.length} o'yinchi</span>
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
            </div>
          </div>
        );

      case 'waiting':
        return (
          <div className="game-screen waiting">
            <div className="loader">
              <div className="spinner"></div>
              <h2>Raqib qidirilmoqda...</h2>
              <p>Kutish vaqti: {gameState.timer}s</p>
              <button className="cancel-btn" onClick={restartGame}>
                Bekor qilish
              </button>
            </div>
          </div>
        );

      case 'playing':
        return (
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
                {['rock', 'paper', 'scissors'].map(choice => (
                  <button
                    key={choice}
                    className={`choice-btn ${choice} ${gameState.myChoice === choice ? 'selected' : ''}`}
                    onClick={() => makeChoice(choice)}
                  >
                    <span className="choice-emoji">{getChoiceEmoji(choice)}</span>
                    <span className="choice-text">
                      {choice === 'rock' ? 'Tosh' : choice === 'paper' ? 'Qog\'oz' : 'Qaychi'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="choices-display">
              <div className="choice-box you">
                <div className="label">Siz</div>
                <div className="emoji">{getChoiceEmoji(gameState.myChoice)}</div>
                <div className="choice-status">
                  {gameState.myChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                </div>
              </div>
              <div className="vs">VS</div>
              <div className="choice-box opponent">
                <div className="label">Raqib</div>
                <div className="emoji">{getChoiceEmoji(gameState.opponentChoice)}</div>
                <div className="choice-status">
                  {gameState.opponentChoice ? '✅ Tanlandi' : '⌛ Kutmoqda'}
                </div>
              </div>
            </div>
          </div>
        );

      case 'finished':
        return (
          <div className="game-screen finished">
            <div className="result">
              <h2 className={`result-title ${gameState.result}`}>
                {gameState.result === 'win' ? '🏆 G\'ALABA!' : 
                 gameState.result === 'lose' ? '😔 MAG\'LUBIYAT' : 
                 gameState.result === 'draw' ? '🤝 DURRANG' : '⏰ VAQT TUGADI'}
              </h2>
              
              <div className="final-choices">
                <div className="final-choice">
                  <div className="player">Siz</div>
                  <div className="choice-emoji large">{getChoiceEmoji(gameState.myChoice)}</div>
                </div>
                <div className="vs-large">VS</div>
                <div className="final-choice">
                  <div className="player">Raqib</div>
                  <div className="choice-emoji large">{getChoiceEmoji(gameState.opponentChoice)}</div>
                </div>
              </div>
              
              <div className="result-actions">
                <button className="play-again-btn" onClick={startNewGame}>
                  🔄 YANA O'YNA
                </button>
                <button className="menu-btn" onClick={restartGame}>
                  📋 Bosh menyu
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header>
        <div className="header-left">
          <h1>🎮 Tosh-Qaychi-Qog'oz</h1>
        </div>
        
        <div className="header-right">
          {user && (
            <>
              <div className="coins-panel">
                <div className="coins-display">
                  <span className="coin-icon">🪙</span>
                  <span className="coin-amount">{userCoins}</span>
                </div>
              </div>
              
              <button 
                className="profile-header-btn"
                onClick={() => setShowProfile(true)}
              >
                {user.first_name?.[0]}
              </button>
            </>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <main>
        {/* Shop Modal */}
        {showShop && (
          <div className="modal-overlay">
            <div className="modal-content shop-modal">
              <div className="modal-header">
                <h2>🛒 Do'kon</h2>
                <button className="close-modal" onClick={() => setShowShop(false)}>✕</button>
              </div>
              
              <div className="shop-balance">
                <span>Mavjud:</span>
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
                      </div>
                    </div>
                    <div className="item-price">
                      <span>🪙 {item.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Profile Modal */}
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
                  </div>
                </div>
                <div className="profile-details">
                  <h3>{user.first_name}</h3>
                  <p className="username">@{user.username || 'foydalanuvchi'}</p>
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
        
        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal-content leaderboard-modal">
              <div className="modal-header">
                <h2>🏆 Top O'yinchilar</h2>
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
                          {player.userId === user?.id && ' (Siz)'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="leaderboard-score">
                      🪙 {player.totalCoins}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Game Screen */}
        {renderGameScreen()}
      </main>
      
      {/* Footer */}
      <footer>
        <div className="footer-content">
          <p>Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
        </div>
      </footer>
    </div>
  );
}

export default App;