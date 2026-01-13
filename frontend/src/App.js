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
  
  const [websocket, setWebsocket] = useState(null);
  
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const userData = tg.initDataUnsafe?.user;
      setUser(userData);
      
      if (userData) {
        initializeGame(userData);
      }
      
      tg.MainButton.setText("🎮 O'ynash");
      tg.MainButton.color = "#31b545";
      tg.MainButton.onClick(startNewGame);
      tg.MainButton.show();
      
      // Telegram haqida xabar yuborish
      tg.sendData(JSON.stringify({ 
        type: 'web_app_ready',
        userId: userData?.id 
      }));
    }
    
    return () => {
      if (websocket) websocket.close();
    };
  }, []);
  
  // O'yinni boshlash
  const initializeGame = async (userData) => {
    try {
      // WebSocket ulanishi
      const ws = new WebSocket('https://telegram-bot-server-2-matj.onrender.com/ws');
      // yoki polling:
      // setInterval(checkGameStatus, 2000);
      
      setWebsocket(ws);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleGameUpdate(data);
      };
      
      // Backend'ga foydalanuvchini ro'yxatdan o'tkazish
      await fetch('https://your-backend.onrender.com/api/register-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
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
      timer: 60
    });
    
    // Backend'ga so'rov
    fetch('https://your-backend.onrender.com/api/create-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id,
        username: user.username,
        firstName: user.first_name
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setGameState(prev => ({
          ...prev,
          gameId: data.gameId,
          status: 'waiting'
        }));
        
        // Taymer boshlash
        startTimer();
      }
    });
  };
  
  // Raqib qidirish
  const findOpponent = () => {
    fetch('https://your-backend.onrender.com/api/find-opponent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
    .then(res => res.json())
    .then(data => {
      if (data.opponent) {
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          status: 'playing'
        }));
      }
    });
  };
  
  // Tanlov qilish
  const makeChoice = (choice) => {
    if (gameState.status !== 'playing') return;
    
    setGameState(prev => ({
      ...prev,
      myChoice: choice
    }));
    
    // Backend'ga tanlovni yuborish
    fetch('https://your-backend.onrender.com/api/make-choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        gameId: gameState.gameId,
        choice: choice
      })
    });
    
    // Taymer to'xtatish
    clearInterval(window.gameTimer);
  };
  
  // O'yin yangilanishini qabul qilish
  const handleGameUpdate = (data) => {
    switch (data.type) {
      case 'opponent_found':
        setGameState(prev => ({
          ...prev,
          opponent: data.opponent,
          status: 'playing'
        }));
        break;
        
      case 'opponent_choice':
        setGameState(prev => ({
          ...prev,
          opponentChoice: data.choice
        }));
        
        // Agar ikkalasi ham tanlagan bo'lsa
        if (gameState.myChoice && data.choice) {
          setTimeout(() => calculateResult(gameState.myChoice, data.choice), 1000);
        }
        break;
        
      case 'game_result':
        setGameState(prev => ({
          ...prev,
          result: data.result,
          status: 'finished'
        }));
        break;
        
      case 'timeout':
        setGameState(prev => ({
          ...prev,
          result: 'timeout',
          status: 'finished'
        }));
        break;
    }
  };
  
  // Natijani hisoblash
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
      status: 'finished'
    }));
    
    // Backend'ga natijani yuborish
    fetch('https://your-backend.onrender.com/api/save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: gameState.gameId,
        winnerId: result === 'win' ? user.id : result === 'lose' ? gameState.opponent?.id : null,
        result: result
      })
    });
  };
  
  // Taymer
  const startTimer = () => {
    let timeLeft = 60;
    window.gameTimer = setInterval(() => {
      timeLeft--;
      setGameState(prev => ({ ...prev, timer: timeLeft }));
      
      if (timeLeft <= 0) {
        clearInterval(window.gameTimer);
        if (gameState.status === 'waiting') {
          setGameState(prev => ({ ...prev, status: 'timeout' }));
        }
      }
    }, 1000);
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
    
    startNewGame();
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
              <button className="start-btn" onClick={startNewGame}>
                🎮 O'YINNI BOSHLASH
              </button>
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
              
              <button className="cancel-btn" onClick={() => setGameState({...gameState, status: 'idle'})}>
                Bekor qilish
              </button>
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
                >
                  ✊ Tosh
                </button>
                <button 
                  className={`choice-btn ${gameState.myChoice === 'paper' ? 'selected' : ''}`}
                  onClick={() => makeChoice('paper')}
                >
                  ✋ Qog'oz
                </button>
                <button 
                  className={`choice-btn ${gameState.myChoice === 'scissors' ? 'selected' : ''}`}
                  onClick={() => makeChoice('scissors')}
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
                </div>
              </div>
              
              <div className="vs">VS</div>
              
              <div className="player-choice">
                <div className="choice-box opponent">
                  <div className="label">Raqib</div>
                  <div className="emoji">{getChoiceEmoji(gameState.opponentChoice)}</div>
                </div>
              </div>
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
              
              <div className="result-description">
                {gameState.result === 'win' && 'Siz raqibingizni mag\'lub etdingiz! 🎉'}
                {gameState.result === 'lose' && 'Raqibingiz sizni mag\'lub etdi.'}
                {gameState.result === 'draw' && 'Ikkalangiz ham teng kuchdasiz!'}
                {gameState.result === 'timeout' && 'Vaqt tugadi.'}
              </div>
              
              <button className="play-again-btn" onClick={restartGame}>
                🔄 YANA O'YNA
              </button>
              
              <button className="menu-btn" onClick={() => setGameState({...gameState, status: 'idle'})}>
                📋 Bosh menyu
              </button>
            </div>
          </div>
        )}
        
        {/* STATISTIKA */}
        <div className="stats-panel">
          <div className="stat-item">
            <span className="stat-label">O'yinlar:</span>
            <span className="stat-value">0</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">G'alaba:</span>
            <span className="stat-value">0</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Mag'lubiyat:</span>
            <span className="stat-value">0</span>
          </div>
        </div>
      </main>
      
      <footer>
        <p>🎮 Telegram Mini App • Tosh-Qaychi-Qog'oz</p>
      </footer>
    </div>
  );
}

export default App;