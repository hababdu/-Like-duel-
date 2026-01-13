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
    timer: 60,
    gameId: null
  });
  
  const [gameStats, setGameStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0
  });
  
  // Telegram WebApp object
  const [tg, setTg] = useState(null);
  
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const telegramApp = window.Telegram.WebApp;
      telegramApp.ready();
      telegramApp.expand();
      
      setTg(telegramApp);
      
      const userData = telegramApp.initDataUnsafe?.user;
      setUser(userData);
      
      // Bot orqali foydalanuvchini saqlash
      if (userData) {
        saveUserToBot(userData);
      }
      
      // TELEGRAM TUGMASINI SOZLASH
      telegramApp.MainButton.setText("🎮 O'YINNI BOSHLASH");
      telegramApp.MainButton.color = "#31b545";
      telegramApp.MainButton.onClick(handleTelegramButtonClick);
      telegramApp.MainButton.show();
      
      // Statistikani yuklash
      if (userData?.id) {
        loadUserStats(userData.id);
      }
    }
    
    return () => {
      // Tozalash
      if (tg?.MainButton) {
        tg.MainButton.offClick(handleTelegramButtonClick);
      }
    };
  }, []);
  
  // Telegram tugmasi bosilganda
  const handleTelegramButtonClick = () => {
    switch (gameState.status) {
      case 'idle':
        startNewGame();
        break;
      case 'waiting':
        cancelGame();
        break;
      case 'playing':
        // O'ynash davomida tugma yashirin
        break;
      case 'finished':
        restartGame();
        break;
      case 'timeout':
        restartGame();
        break;
      default:
        startNewGame();
    }
  };
  
  // Telegram tugmasini yangilash
  const updateTelegramButton = () => {
    if (!tg) return;
    
    switch (gameState.status) {
      case 'idle':
        tg.MainButton.setText("🎮 O'YINNI BOSHLASH");
        tg.MainButton.color = "#31b545";
        tg.MainButton.show();
        break;
        
      case 'waiting':
        tg.MainButton.setText("❌ BEKOR QILISH");
        tg.MainButton.color = "#ef4444";
        tg.MainButton.show();
        break;
        
      case 'playing':
        // O'ynash davomida tugmani yashirish
        tg.MainButton.hide();
        break;
        
      case 'finished':
      case 'timeout':
        tg.MainButton.setText("🔄 QAYTA O'YNA");
        tg.MainButton.color = "#3b82f6";
        tg.MainButton.show();
        break;
    }
  };
  
  // Holat o'zgarganda Telegram tugmasini yangilash
  useEffect(() => {
    updateTelegramButton();
  }, [gameState.status]);
  
  // Foydalanuvchini botga saqlash
  const saveUserToBot = async (userData) => {
    try {
      await fetch('https://telegram-bot-server-2-matj.onrender.com/api/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
    } catch (error) {
      console.error('Foydalanuvchi saqlash xatosi:', error);
    }
  };
  
  // Statistikani yuklash
  const loadUserStats = async (userId) => {
    try {
      const response = await fetch(`https://telegram-bot-server-2-matj.onrender.com/api/stats/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats?.user) {
          setGameStats({
            totalGames: data.stats.user.totalGames || 0,
            wins: data.stats.user.wins || 0,
            losses: data.stats.user.losses || 0,
            draws: data.stats.user.draws || 0
          });
        }
      }
    } catch (error) {
      console.error('Statistika yuklash xatosi:', error);
    }
  };
  
  // YANGI O'YIN BOSHLASH (ASOSIY FUNKSIYA)
  const startNewGame = async () => {
    if (!user) return;
    
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      timer: 60,
      opponent: null,
      myChoice: null,
      opponentChoice: null,
      result: null,
      gameId: null
    }));
    
    try {
      const response = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/create-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          username: user.username,
          firstName: user.first_name
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setGameState(prev => ({
            ...prev,
            gameId: data.gameId,
            status: 'waiting'
          }));
          
          // Raqib qidirish
          findOpponent(data.gameId);
          
          // Taymer boshlash
          startTimer();
        }
      }
    } catch (error) {
      console.error('O\'yin yaratish xatosi:', error);
      setGameState(prev => ({ ...prev, status: 'idle' }));
    }
  };
  
  // RAQIB QIDIRISH
  const findOpponent = async (gameId) => {
    const maxAttempts = 30; // 30 marta urinish (60 soniya)
    let attempts = 0;
    
    const checkOpponent = async () => {
      if (gameState.status !== 'waiting') return;
      
      try {
        const response = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/find-opponent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: user.id,
            gameId: gameId
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.opponent) {
            // Raqib topildi
            setGameState(prev => ({
              ...prev,
              opponent: data.opponent,
              status: 'playing'
            }));
            
            // Real-time yangilanish uchun polling boshlash
            startGamePolling(gameId);
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkOpponent, 2000); // 2 soniyadan keyin qayta urinish
        } else {
          // Vaqt tugadi
          setGameState(prev => ({ ...prev, status: 'timeout' }));
        }
        
      } catch (error) {
        console.error('Raqib qidirish xatosi:', error);
      }
    };
    
    checkOpponent();
  };
  
  // O'YIN HOLATINI TEKSHIRISH (POLLING)
  const startGamePolling = (gameId) => {
    const pollInterval = setInterval(async () => {
      if (gameState.status !== 'playing') {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        const response = await fetch(`https://telegram-bot-server-2-matj.onrender.com/api/game-status/${gameId}?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.game) {
            // Raqib tanlovini tekshirish
            if (data.game.player2?.choice && !gameState.opponentChoice) {
              setGameState(prev => ({
                ...prev,
                opponentChoice: data.game.player2.choice
              }));
              
              // Agar ikkalasi ham tanlagan bo'lsa
              if (gameState.myChoice && data.game.player2.choice) {
                calculateResult(gameState.myChoice, data.game.player2.choice);
                clearInterval(pollInterval);
              }
            }
            
            // O'yin tugaganini tekshirish
            if (data.game.status === 'finished') {
              const result = data.game.result === 'player1_win' ? 'win' : 
                           data.game.result === 'player2_win' ? 'lose' : 'draw';
              
              setGameState(prev => ({
                ...prev,
                result: result,
                status: 'finished'
              }));
              
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error('Polling xatosi:', error);
      }
    }, 1000); // Har soniyada tekshirish
  };
  
  // O'YINNI BEKOR QILISH
  const cancelGame = () => {
    if (gameState.gameId) {
      // Backend'ga bekor qilish haqida xabar berish
      fetch('https://telegram-bot-server-2-matj.onrender.com/api/cancel-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gameState.gameId })
      }).catch(console.error);
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
  };
  
  // TANLOV QILISH
  const makeChoice = async (choice) => {
    if (gameState.status !== 'playing' || !gameState.gameId) return;
    
    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));
    
    try {
      await fetch('https://telegram-bot-server-2-matj.onrender.com/api/make-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          gameId: gameState.gameId,
          choice: choice
        })
      });
      
      // Raqib tanlovini kutish
      setTimeout(() => {
        if (gameState.opponentChoice) {
          calculateResult(choice, gameState.opponentChoice);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Tanlov saqlash xatosi:', error);
    }
  };
  
  // NATIJANI HISOBLASH
  const calculateResult = (myChoice, opponentChoice) => {
    const rules = {
      rock: { beats: 'scissors', loses: 'paper' },
      paper: { beats: 'rock', loses: 'scissors' },
      scissors: { beats: 'paper', loses: 'rock' }
    };
    
    let result;
    if (myChoice === opponentChoice) {
      result = 'draw';
    } else if (rules[myChoice].beats === opponentChoice) {
      result = 'win';
    } else {
      result = 'lose';
    }
    
    setGameState(prev => ({
      ...prev,
      result: result,
      status: 'finished',
      opponentChoice: opponentChoice
    }));
    
    // Statistikani yangilash
    updateStats(result);
  };
  
  // STATISTIKANI YANGILASH
  const updateStats = (result) => {
    setGameStats(prev => ({
      totalGames: prev.totalGames + 1,
      wins: result === 'win' ? prev.wins + 1 : prev.wins,
      losses: result === 'lose' ? prev.losses + 1 : prev.losses,
      draws: result === 'draw' ? prev.draws + 1 : prev.draws
    }));
  };
  
  // TAYMER
  const startTimer = () => {
    let timeLeft = 60;
    const timer = setInterval(() => {
      timeLeft--;
      setGameState(prev => ({ ...prev, timer: timeLeft }));
      
      if (timeLeft <= 0 || gameState.status !== 'waiting') {
        clearInterval(timer);
        if (gameState.status === 'waiting') {
          setGameState(prev => ({ ...prev, status: 'timeout' }));
        }
      }
    }, 1000);
  };
  
  // QAYTA O'YNA
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
  
  // EMOJI TANLASH
  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };
  
  return (
    <div className="app">
      <header>
        <h1>🎮 Tosh • Qaychi • Qog'oz</h1>
        {user && (
          <div className="user-info">
            <span className="avatar">{user.first_name?.[0]}</span>
            <span>{user.first_name}</span>
          </div>
        )}
      </header>
      
      <main>
        {/* O'YIN HOLATI */}
        {gameState.status === 'idle' && (
          <div className="game-screen idle">
            <div className="welcome">
              <h2>Xush kelibsiz, {user?.first_name}!</h2>
              <p>Raqibingizni mag'lub qiling 🏆</p>
              
              {/* INSTRUKSIYA */}
              <div className="instructions">
                <p>O'yinni boshlash uchun pastdagi <strong>"🎮 O'YINNI BOSHLASH"</strong> tugmasini bosing.</p>
                <p>Telegram'ning pastki panelidagi tugma bilan boshqaring.</p>
              </div>
              
              {/* STATISTIKA KO'RINISHI */}
              <div className="user-stats">
                <h3>📊 Sizning statistikangiz:</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">O'yinlar:</span>
                    <span className="stat-value">{gameStats.totalGames}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">G'alaba:</span>
                    <span className="stat-value">{gameStats.wins}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Mag'lubiyat:</span>
                    <span className="stat-value">{gameStats.losses}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Durrang:</span>
                    <span className="stat-value">{gameStats.draws}</span>
                  </div>
                </div>
                
                {gameStats.totalGames > 0 && (
                  <div className="win-rate">
                    G'alaba foizi: {Math.round((gameStats.wins / gameStats.totalGames) * 100)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* RAQIB KUTISH */}
        {gameState.status === 'waiting' && (
          <div className="game-screen waiting">
            <div className="loader">
              <div className="spinner"></div>
              <h2>Raqib qidirilmoqda...</h2>
              <p>Kutish vaqti: {gameState.timer}s</p>
              
              <div className="searching">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              
              <div className="waiting-info">
                <p>Bekor qilish uchun pastdagi <strong>"❌ BEKOR QILISH"</strong> tugmasini bosing.</p>
                <p className="hint">Telegram'ning pastki panelidagi tugma o'zgaradi</p>
              </div>
            </div>
          </div>
        )}
        
        {/* O'YIN DAVOM ETMOQDA */}
        {gameState.status === 'playing' && (
          <div className="game-screen playing">
            <div className="opponent-info">
              <h3>👤 Raqib:</h3>
              <div className="opponent-card">
                <div className="avatar">{
                  gameState.opponent?.firstName?.[0] || '?'
                }</div>
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
                  className={`choice-btn ${gameState.myChoice === 'rock' ? 'selected' : ''}`}
                  onClick={() => makeChoice('rock')}
                  disabled={gameState.myChoice !== null}
                >
                  ✊ Tosh
                </button>
                <button 
                  className={`choice-btn ${gameState.myChoice === 'paper' ? 'selected' : ''}`}
                  onClick={() => makeChoice('paper')}
                  disabled={gameState.myChoice !== null}
                >
                  ✋ Qog'oz
                </button>
                <button 
                  className={`choice-btn ${gameState.myChoice === 'scissors' ? 'selected' : ''}`}
                  onClick={() => makeChoice('scissors')}
                  disabled={gameState.myChoice !== null}
                >
                  ✌️ Qaychi
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
                    {gameState.myChoice ? '✅ Tanlandi' : '⏳ Kutilyapti'}
                  </div>
                </div>
              </div>
              
              <div className="vs">VS</div>
              
              <div className="player-choice">
                <div className="choice-box opponent">
                  <div className="label">Raqib</div>
                  <div className="emoji">{getChoiceEmoji(gameState.opponentChoice)}</div>
                  <div className="choice-status">
                    {gameState.opponentChoice ? '✅ Tanlandi' : '⏳ Kutilyapti'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* O'yin qoidalari */}
            <div className="game-rules">
              <p><strong>Qoidalar:</strong> ✊ Tosh ✌️ Qaychi'ni yengadi • ✌️ Qaychi ✋ Qog'oz'ni yengadi • ✋ Qog'oz ✊ Tosh'ni yengadi</p>
            </div>
          </div>
        )}
        
        {/* O'YIN TUGADI */}
        {gameState.status === 'finished' && (
          <div className="game-screen finished">
            <div className="result">
              <h2 className={`result-title ${gameState.result}`}>
                {gameState.result === 'win' ? '🏆 G\'ALABA!' : 
                 gameState.result === 'lose' ? '😔 MAG\'LUBIYAT' : 
                 '🤝 DURRANG'}
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
              
              <div className="result-description">
                {gameState.result === 'win' && 'Siz raqibingizni mag\'lub etdingiz! 🎉'}
                {gameState.result === 'lose' && 'Raqibingiz sizni mag\'lub etdi.'}
                {gameState.result === 'draw' && 'Ikkalangiz ham teng kuchdasiz!'}
              </div>
              
              <div className="next-steps">
                <p>Yana o'ynash uchun pastdagi <strong>"🔄 QAYTA O'YNA"</strong> tugmasini bosing.</p>
                <p className="hint">Telegram'ning pastki panelidagi tugma o'zgaradi</p>
              </div>
            </div>
          </div>
        )}
        
        {/* VAQT TUGADI */}
        {gameState.status === 'timeout' && (
          <div className="game-screen finished">
            <div className="result">
              <h2 className="result-title timeout">⏰ VAQT TUGADI</h2>
              
              <div className="timeout-message">
                <p>Raqib topilmadi yoki vaqt tugadi.</p>
                <p>Yana urinib ko'ring!</p>
              </div>
              
              <div className="next-steps">
                <p>Qayta urinish uchun pastdagi <strong>"🔄 QAYTA O'YNA"</strong> tugmasini bosing.</p>
                <p className="hint">Telegram'ning pastki panelidagi tugma o'zgaradi</p>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer>
        <p>🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
        <p className="footer-hint">⤵️ Pastdagi Telegram tugmasi bilan boshqaring</p>
      </footer>
    </div>
  );
}

export default App;