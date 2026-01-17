// components/MultiplayerGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerGame.css'; // agar alohida CSS bo'lsa (ixtiyoriy)

 function MultiplayerGame({
  user,
  coins,
  setCoins,
  CHOICES,
  onBackToMenu,
  showNotif
}) {
  const ws = useRef(null);
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [multiResult, setMultiResult] = useState(null);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);

  // WebSocket ulanish
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'register',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player'
      }));

      // navbatga qo‘shilishni avtomatik boshlaymiz
      socket.send(JSON.stringify({
        type: 'join_queue',
        userId: user.id,
        username: user.username || `user_${user.id}`,
        firstName: user.first_name || 'Player'
      }));
    };

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleWsMessage(data);
      } catch (err) {
        console.error("WebSocket parse xatosi:", err);
      }
    };

    socket.onclose = () => {
      showNotif("Server bilan aloqa uzildi. Qayta ulanmoqda...", "error");
      setTimeout(() => {
        // qayta ulanish (rekursiv emas, faqat bir marta)
        if (ws.current) ws.current.close();
        // yangi ulanishni App komponentida yoki bu yerda qayta ishga tushirish mumkin
      }, 4000);
    };

    socket.onerror = (err) => {
      console.error("WebSocket xatosi:", err);
      showNotif("Serverga ulanishda xato", "error");
    };

    ws.current = socket;

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      clearInterval(timerRef.current);
    };
  }, [user, showNotif]);

  const handleWsMessage = (data) => {
    switch (data.type) {
      case 'joined_queue':
        showNotif("Navbatga qo‘shildingiz...", "info");
        break;

      case 'match_found':
        setGameId(data.gameId);
        setOpponent(data.opponent);
        setMyChoice(null);
        setOpponentChoice(null);
        setMultiResult(null);
        setTimer(60);
        startTimer();
        showNotif(
          `${data.opponent?.firstName || data.opponent?.username || 'Raqib'} topildi!`,
          "success"
        );
        break;

      case 'opponent_choice_made':
        showNotif("Raqib tanlov qildi!", "info");
        break;

      case 'game_result':
        clearInterval(timerRef.current);
        setOpponentChoice(
          data.players?.player1?.id === user?.id
            ? data.choices?.player2
            : data.choices?.player1
        );
        setMultiResult(data.result);

        const isWin = data.winnerId === user?.id;
        const msg =
          data.result === 'draw' ? 'Durang' :
          isWin ? 'G‘alaba!' : 'Mag‘lubiyat';

        const type =
          data.result === 'draw' ? 'warning' :
          isWin ? 'success' : 'error';

        showNotif(msg, type);

        // coins o'zgartirish (serverdan kelgan ma'lumotga qarab yoki lokal logika)
        if (data.result !== 'draw') {
          const change = isWin ? 100 : -50;
          setCoins(c => Math.max(0, c + change));
        }
        break;

      case 'game_timeout':
        clearInterval(timerRef.current);
        setMultiResult('timeout');
        showNotif("Vaqt tugadi", "warning");
        break;

      case 'opponent_disconnected':
        setMultiResult('abandoned');
        showNotif(
          data.message || "Raqib uzildi. O‘yin yakunlandi.",
          "warning"
        );
        clearInterval(timerRef.current);
        break;

      case 'left_queue':
        showNotif("Qidiruv to‘xtatildi", "info");
        onBackToMenu();
        break;

      case 'error':
        showNotif(data.message || "Xato yuz berdi", "error");
        break;

      default:
        console.log("Noma‘lum WS xabar:", data);
    }
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'timeout',
              gameId,
              userId: user?.id
            }));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleMultiChoice = (choice) => {
    if (myChoice || multiResult || !gameId) return;

    setMyChoice(choice);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'make_choice',
        userId: user?.id,
        gameId,
        choice
      }));
    } else {
      showNotif("Server bilan aloqa yo‘q", "error");
    }
  };

  const ChoiceButtons = () => (
    <div className="choice-buttons">
      {Object.entries(CHOICES).map(([key, val]) => (
        <button
          key={key}
          className="choice-btn"
          style={{ '--choice-color': val.color || '#888' }}
          onClick={() => handleMultiChoice(key)}
          disabled={!!myChoice || !!multiResult}
        >
          {val.emoji}
          <span>{val.name}</span>
        </button>
      ))}
    </div>
  );

  const getResultTitle = () => {
    if (multiResult === 'draw') return 'DURRANG';
    if (multiResult === 'timeout') return 'VAQT TUGADI';
    if (multiResult === 'abandoned') return 'O‘YIN TO‘XTADI';

    const iWon =
      (multiResult === 'player1_win' && opponent?.id !== user?.id) ||
      (multiResult === 'player2_win' && opponent?.id === user?.id);

    return iWon ? 'G‘ALABA!' : 'MAG‘LUBIYAT';
  };

  return (
    <main className="game-screen multiplayer-game">
      <div className="timer-bar">
        <div className="timer-progress" style={{ width: `${(timer / 60) * 100}%` }} />
        <span>{timer}s</span>
      </div>

      {!opponent ? (
        <div className="waiting-screen">
          <div className="spinner" />
          <h3>Raqib qidirlmoqda...</h3>
          {gameId && <p>O'yin ID: {gameId.slice(0, 8)}...</p>}
          <button 
            className="cancel-btn"
            onClick={() => {
              if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                  type: 'leave_queue',
                  userId: user?.id
                }));
              }
              onBackToMenu();
            }}
          >
            Bekor qilish
          </button>
        </div>
      ) : (
        <>
          <div className="opponent-info">
            Raqib: {opponent?.firstName || opponent?.username || '???'}
          </div>

          <div className="versus-container">
            <div className="player-side">
              <div className="label">SIZ</div>
              <div className="choice-display big">
                {myChoice ? CHOICES[myChoice]?.emoji : '?'}
              </div>
            </div>
            <div className="vs">VS</div>
            <div className="player-side">
              <div className="label">RAQIB</div>
              <div className="choice-display big">
                {opponentChoice ? CHOICES[opponentChoice]?.emoji : '❓'}
              </div>
            </div>
          </div>

          {!myChoice && multiResult === null && <ChoiceButtons />}

          {multiResult && (
            <div className={`result-overlay ${multiResult}`}>
              <h2>{getResultTitle()}</h2>

              <div className="result-choices">
                <div>{myChoice ? CHOICES[myChoice]?.emoji : '?'}</div>
                <div>VS</div>
                <div>{opponentChoice ? CHOICES[opponentChoice]?.emoji : '?'}</div>
              </div>

              <div className="result-actions">
                <button onClick={onBackToMenu}>
                  Menyuga qaytish
                </button>
                <button 
                  onClick={() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                      ws.current.send(JSON.stringify({
                        type: 'join_queue',
                        userId: user.id,
                        username: user.username || `user_${user.id}`,
                        firstName: user.first_name || 'Player'
                      }));
                    }
                    setOpponent(null);
                    setGameId(null);
                    setMyChoice(null);
                    setOpponentChoice(null);
                    setMultiResult(null);
                    setTimer(60);
                  }}
                >
                  Yangi o'yin
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
} 

export default  MultiplayerGame ;