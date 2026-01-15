import { useState, useEffect, useRef } from 'react';
import './App.css';

const CHOICES = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️'
};

function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('menu'); // menu | matchmaking | playing | finished
  const [gameMode, setGameMode] = useState(null); // "bot" | "multi"
  const [ws, setWs] = useState(null);
  const [game, setGame] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [coins, setCoins] = useState(1000);

  const wsRef = useRef(null);

  // Telegram Web App init
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      const u = tg.initDataUnsafe?.user;
      if (u) {
        setUser({
          id: u.id,
          first_name: u.first_name,
          username: u.username,
          photo_url: u.photo_url
        });
      }
    }
  }, []);

  // WebSocket
  useEffect(() => {
    const socket = new WebSocket('wss://your-domain.com/ws'); // ← o'zgartiring!

    socket.onopen = () => {
      console.log('WS connected');
      setWs(socket);
      wsRef.current = socket;

      if (user?.id) {
        socket.send(JSON.stringify({
          type: 'register',
          userId: user.id,
          firstName: user.first_name,
          username: user.username || '',
          photoUrl: user.photo_url || ''
        }));
      }
    };

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        switch (data.type) {
          case 'searching_opponent':
            setMode('matchmaking');
            break;

          case 'match_found':
            setGame(data);
            setMode('playing');
            break;

          case 'countdown':
            setGame(prev => ({ ...prev, countdown: data.seconds }));
            break;

          case 'game_start':
            setGame(prev => ({ ...prev, status: 'choosing' }));
            break;

          case 'choice_made':
            setGame(prev => ({ ...prev, opponentChose: true }));
            break;

          case 'game_result':
            setGame(prev => ({ ...prev, ...data, status: 'finished' }));
            setMode('finished');
            // coins yangilash logikasi qo'shishingiz mumkin
            break;

          case 'opponent_left':
            setGame(null);
            setMode('menu');
            alert("Raqib o'yindan chiqib ketdi ☹️");
            break;

          case 'time_left':
            setGame(prev => ({ ...prev, timeLeft: data.seconds }));
            break;

          default:
            console.log('Unknown WS message:', data);
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    socket.onclose = () => {
      console.log('WS closed');
      setWs(null);
    };

    return () => socket.close();
  }, [user]);

  const startMultiplayer = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("Server bilan aloqa yo'q");
      return;
    }

    setGameMode('multi');
    setMode('matchmaking');

    ws.send(JSON.stringify({
      type: 'join_multiplayer',
      userId: user.id,
      firstName: user.first_name,
      username: user.username || ''
    }));
  };

  const makeChoice = (choice) => {
    if (!ws || !game?.gameId || myChoice) return;

    setMyChoice(choice);

    ws.send(JSON.stringify({
      type: 'make_choice',
      userId: user.id,
      gameId: game.gameId,
      choice
    }));
  };

  const backToMenu = () => {
    setMode('menu');
    setGame(null);
    setMyChoice(null);
    setGameMode(null);
  };

  return (
    <div className="app-container">

      {mode === 'menu' && (
        <div className="menu">
          <h1>Tosh-Qaychi-Qog'oz</h1>
          <div className="mode-buttons">
            <button onClick={() => setGameMode('bot')}>Bot bilan o'ynash</button>
            <button onClick={startMultiplayer}>Real o'yinchilar bilan</button>
          </div>
        </div>
      )}

      {mode === 'matchmaking' && (
        <div className="waiting-screen">
          <h2>Raqib qidirilmoqda...</h2>
          <div className="spinner" />
          <button onClick={backToMenu}>Bekor qilish</button>
        </div>
      )}

      {mode === 'playing' && game && (
        <div className="game-screen">
          <div className="vs-header">
            <div className="player">
              <div>Siz</div>
              {myChoice ? CHOICES[myChoice] : '?'}
            </div>
            <div>VS</div>
            <div className="player">
              <div>{game.opponent.name}</div>
              {game.opponentChose ? CHOICES[game.opponent.choice || '?'] : '?'}
            </div>
          </div>

          {game.status === 'choosing' && !myChoice && (
            <div className="choices">
              <button onClick={() => makeChoice('rock')}>✊</button>
              <button onClick={() => makeChoice('paper')}>✋</button>
              <button onClick={() => makeChoice('scissors')}>✌️</button>
            </div>
          )}

          {game.status === 'choosing' && myChoice && (
            <div>Raqib tanlamoqda...</div>
          )}

          {game.countdown && <div className="countdown">Boshlanish: {game.countdown}</div>}
          {game.timeLeft && <div>Qolgan vaqt: {game.timeLeft} s</div>}

          <button className="back-btn" onClick={backToMenu}>Chiqish</button>
        </div>
      )}

      {mode === 'finished' && game && (
        <div className="result-screen">
          <h1>
            {game.result === 'p1_win' ? 'Gʻalaba! 🏆' :
             game.result === 'p2_win' ? 'Magʻlubiyat 😔' :
             game.result === 'draw' ? 'Durang 🤝' : 'Vaqt tugadi ⏰'}
          </h1>

          <div className="final-choices">
            <div>Siz: {CHOICES[myChoice]}</div>
            <div>Raqib: {CHOICES[game.choices?.p2]}</div>
          </div>

          <button onClick={backToMenu}>Menyuga qaytish</button>
        </div>
      )}

    </div>
  );
}

export default App;