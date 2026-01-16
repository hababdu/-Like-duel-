import React, { useEffect, useState, useRef } from 'react';
import './App.css';

const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh' },
  paper: { emoji: '✋', name: 'Qog‘oz' },
  scissors: { emoji: '✌️', name: 'Qaychi' }
};

function App() {
  const [mode, setMode] = useState('menu');           // menu | bot | multiplayer | finished
  const [gameMode, setGameMode] = useState(null);     // 'bot' | 'multiplayer'
  const [difficulty, setDifficulty] = useState('medium');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [opponent, setOpponent] = useState(null);
  const [game, setGame] = useState({
    gameId: null,
    status: 'waiting',
    myChoice: null,
    opponentChoice: null,
    result: null,
    timer: 60
  });

  const ws = useRef(null);
  const timerRef = useRef(null);
  const [notification, setNotification] = useState(null);

  // Telegram WebApp init
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      const initData = tg.initDataUnsafe;
      if (initData?.user) {
        setUser(initData.user);
        connectWebSocket(initData.user.id, initData.user.username, initData.user.first_name);
      }
    }
  }, []);

  const connectWebSocket = (userId, username, firstName) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.current.onopen = () => {
      console.log('WebSocket ulandi');
      ws.current.send(JSON.stringify({
        type: 'register',
        userId,
        username,
        firstName
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    ws.current.onclose = () => {
      console.log('WebSocket uzildi');
      setTimeout(() => connectWebSocket(userId, username, firstName), 3000);
    };
  };

  const handleServerMessage = (data) => {
    switch (data.type) {
      case 'registered':
        console.log('Ro‘yxatdan o‘tdim');
        break;

      case 'game_created':
        setGame(prev => ({ ...prev, gameId: data.gameId, status: 'waiting' }));
        setMode('multiplayer');
        showNotification('O‘yin yaratildi. Raqib qidirlmoqda...');
        break;

      case 'opponent_found':
        setOpponent(data.opponent);
        setGame(prev => ({ ...prev, gameId: data.gameId, status: 'choosing' }));
        showNotification(`Raqib topildi: ${data.opponent.firstName || data.opponent.username}`);
        startTimer();
        break;

      case 'opponent_choice_made':
        showNotification('Raqib tanlov qildi! Endi siz tanlang');
        break;

      case 'choice_accepted':
        setGame(prev => ({ ...prev, myChoice: data.choice }));
        break;

      case 'game_result':
        setGame(prev => ({
          ...prev,
          opponentChoice: data.choices.player1.id === user?.id 
            ? data.choices.player2 
            : data.choices.player1,
          result: data.result,
          status: 'finished'
        }));
        clearInterval(timerRef.current);
        showResult(data);
        break;

      case 'game_timeout':
        setGame(prev => ({ ...prev, result: 'timeout', status: 'finished' }));
        showNotification('Vaqt tugadi!');
        break;

      case 'error':
        showNotification(data.message, 'error');
        break;

      default:
        console.log('Noma’lum xabar:', data);
    }
  };

  const startMultiplayerGame = () => {
    if (!user) return;
    ws.current.send(JSON.stringify({
      type: 'create_game',
      userId: user.id,
      username: user.username,
      firstName: user.first_name
    }));
  };

  const makeChoice = (choice) => {
    if (game.status !== 'choosing' || game.myChoice) return;

    ws.current.send(JSON.stringify({
      type: 'make_choice',
      userId: user.id,
      gameId: game.gameId,
      choice
    }));

    setGame(prev => ({ ...prev, myChoice: choice }));
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGame(prev => {
        if (prev.timer <= 1) {
          clearInterval(timerRef.current);
          return { ...prev, timer: 0 };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
  };

  const showNotification = (text, type = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const showResult = (data) => {
    let message = '';
    let coins = 0;

    if (data.result === 'draw') {
      message = '🤝 Durang!';
      coins = 20;
    } else if (
      (data.winnerId === user?.id) ||
      (data.result === 'player1_win' && data.players.player1.id === user?.id) ||
      (data.result === 'player2_win' && data.players.player2.id === user?.id)
    ) {
      message = '🏆 G‘alaba!';
      coins = 60;
    } else {
      message = '😔 Mag‘lubiyat';
      coins = 10;
    }

    setCoins(c => c + coins);
    showNotification(`${message} +${coins} tanga`, data.winnerId === user?.id ? 'success' : 'error');
  };

  // Bot rejimi (oldingi kodni saqlab qoldim, qisqartirdim)
  const startBotGame = (diff) => {
    setGameMode('bot');
    setDifficulty(diff);
    setMode('playing');
    // ... bot logikasi (oldingi kodingizdan nusxa oling)
  };

  const emoji = (ch) => CHOICES[ch]?.emoji || '?';

  return (
    <div className="app">
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.text}
        </div>
      )}

      <header className="header">
        <h1>✊ Tosh-Qaychi-Qog‘oz ✌️</h1>
        <div className="coins">🪙 {coins}</div>
      </header>

      {mode === 'menu' && (
        <div className="menu">
          <h2>Salom, {user?.first_name || 'o‘yinchi'}!</h2>

          <div className="mode-buttons">
            <button className="btn primary" onClick={startMultiplayerGame}>
              👥 Do‘st bilan o‘ynash
            </button>
            <button className="btn secondary" onClick={() => setMode('bot-select')}>
              🤖 Bot bilan o‘ynash
            </button>
          </div>
        </div>
      )}

      {mode === 'bot-select' && (
        <div className="difficulty-select">
          <h3>Darajani tanlang</h3>
          {['easy', 'medium', 'hard'].map(lvl => (
            <button key={lvl} onClick={() => startBotGame(lvl)}>
              {lvl === 'easy' ? 'Oson' : lvl === 'medium' ? 'O‘rta' : 'Qiyin'}
            </button>
          ))}
        </div>
      )}

      {mode === 'multiplayer' && (
        <div className="multiplayer-screen">
          {game.status === 'waiting' && (
            <div className="waiting">
              <div className="spinner" />
              <h3>Raqib qidirlmoqda...</h3>
              <p>O‘yin ID: {game.gameId?.slice(0,8)}</p>
            </div>
          )}

          {game.status === 'choosing' && (
            <>
              <div className="opponent-info">
                Raqib: {opponent?.firstName || opponent?.username || '???'}
              </div>

              <div className="timer">Qolgan vaqt: {game.timer}s</div>

              <div className="choices">
                {Object.keys(CHOICES).map(key => (
                  <button
                    key={key}
                    className={`choice ${game.myChoice === key ? 'selected' : ''}`}
                    onClick={() => makeChoice(key)}
                    disabled={!!game.myChoice}
                  >
                    {CHOICES[key].emoji}
                    <span>{CHOICES[key].name}</span>
                  </button>
                ))}
              </div>

              <div className="vs">VS</div>

              <div className="opponent-choice">
                {game.opponentChoice ? emoji(game.opponentChoice) : '❓'}
              </div>
            </>
          )}

          {game.status === 'finished' && (
            <div className="result-screen">
              {/* natija ko‘rsatish */}
              <button onClick={() => setMode('menu')}>Menyuga qaytish</button>
            </div>
          )}
        </div>
      )}

      {/* Bot rejimi oynasi — o‘zingizning oldingi kodingizni shu yerga joylashtiring */}
      {mode === 'playing' && gameMode === 'bot' && (
        // Sizning bot o‘yin interfeysingiz
        <div>Bot rejimi (oldingi kod)</div>
      )}
    </div>
  );
}

export default App;