import React, { useEffect, useState, useRef } from 'react';
import './DuelGame.css';

function DuelGame({ socket, playerCoins, setCoins, currentRating, setRating, onBackToMenu, showNotif }) {
  const [gameState, setGameState] = useState('menu');
  const [opponent, setOpponent] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [timer, setTimer] = useState(30);
  
  // 💬 Chat Statelari
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState(""); // Erkin yoziladigan matn
  const [hasBoughtLink, setHasBoughtLink] = useState(false); // Profil sotib olinganini tekshirish
  const chatEndRef = useRef(null);

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user || { id: '99887766', first_name: 'Habibullo Dev', username: 'habibullo_dev' };

  const quickMessages = ["Salom! 👋", "Omad! 🍀", "Yaxshi! 👍", "Qoyil! 😮", "Raxmat! 🤝"];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!socket) return;

    socket.on('match_found', ({ roomId, opponent }) => {
      setRoomId(roomId);
      setOpponent(opponent);
      setGameState('playing');
      setChatMessages([]);
      setHasBoughtLink(false); // Har bir yangi o'yinda sotib olish statini yangilash
    });

    socket.on('round_result', ({ myChoice: serverMyChoice, opponentChoice: serverOppChoice, result, rewardCoins, rewardXP }) => {
      setMyChoice(serverMyChoice);
      setOpponentChoice(serverOppChoice);
      setRoundResult(result);
      setGameState('result');

      const newCoins = Math.max(0, playerCoins + rewardCoins);
      const newRating = Math.max(0, currentRating + rewardXP);
      setCoins(newCoins);
      setRating(newRating);
      saveBalanceToDatabase(user.id, newCoins, newRating);
    });

    socket.on('chat_message', ({ senderId, text }) => {
      setChatMessages(prev => [...prev, { senderId, text }]);
    });

    socket.on('opponent_left', () => {
      showNotif("Raqib tark etdi! Texnik g'alaba 🏆", "success");
      const newCoins = playerCoins + 1;
      const newRating = currentRating + 15;
      setCoins(newCoins);
      setRating(newRating);
      saveBalanceToDatabase(user.id, newCoins, newRating);
      resetGame();
    });

    return () => {
      socket.off('match_found');
      socket.off('round_result');
      socket.off('chat_message');
      socket.off('opponent_left');
    };
  }, [socket, playerCoins, currentRating]);

  const saveBalanceToDatabase = async (tgId, finalCoins, finalRating) => {
    try {
      await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: tgId.toString(), coins: finalCoins, rating: finalRating })
      });
    } catch (err) { console.error(err); }
  };

  // 🕵️ Shaxsiy chat havolasini 10 tangaga sotib olish funksiyasi
  const buyOpponentChatLink = async () => {
    if (playerCoins < 10) {
      showNotif("Mablag' yetarli emas! 10 🪙 kerak.", "error");
      return;
    }
    try {
      const res = await fetch('https://telegram-bot-server-2-matj.onrender.com/api/user/buy-chat-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.id.toString() })
      });
      const data = await res.json();
      if (data.success) {
        setCoins(data.coins);
        setHasBoughtLink(true);
        showNotif("Profil havolasi ochildi! 🔓", "success");
      }
    } catch (err) { console.error(err); }
  };

  const startSearching = () => {
    if (playerCoins < 1) { showNotif("Kamida 1 🪙 kerak.", "error"); return; }
    setGameState('searching');
    socket.emit('find_match', { player: { tgId: user.id.toString(), name: user.first_name, username: user.username, rating: currentRating, coins: playerCoins }, stake: 1 });
  };

  // Chatga xabar yuborish (Ham tezkor tugma, ham yozilgan matn uchun umumiy)
  const sendChatMessage = (text) => {
    if (!text.trim()) return;
    socket.emit('send_chat_message', { roomId, senderId: user.id.toString(), text });
    setChatMessages(prev => [...prev, { senderId: user.id.toString(), text }]);
    setTypedMessage(""); // Inputni tozalash
  };

  const resetGame = () => { setGameState('menu'); setOpponent(null); setRoomId(null); setMyChoice(null); };

  return (
    <div className="duel-game-page">
      {gameState === 'menu' && (
        <div className="duel-card">
          <h2>Onlayn Arena</h2>
          <div className="stats-preview-row">
            <div className="stat-preview-box"><span>Balans</span><strong>🪙 {playerCoins}</strong></div>
            <div className="stat-preview-box"><span>Reyting</span><strong>🏆 {currentRating} XP</strong></div>
          </div>
          <button className="duel-action-btn start-btn" onClick={startSearching}>Raqib Qidirish 🔍</button>
          <button className="duel-action-btn cancel-btn" onClick={onBackToMenu}>Asosiy Menyu 🚪</button>
        </div>
      )}

      {gameState === 'searching' && (
        <div className="duel-card searching-card">
          <div className="radar-spinner"><div className="circle-1"></div><div className="circle-2"></div></div>
          <h2>Raqib qidirilmoqda...</h2>
          <button className="duel-action-btn cancel-btn" onClick={() => { socket.emit('cancel_search', { tgId: user.id.toString() }); resetGame(); }}>To'xtatish ❌</button>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'result') && (
        <div className="arena-wrapper">
          {/* Yuqori Panel + Profil sotib olish tugmasi */}
          <div className="arena-players-bar">
            <div className="arena-player"><h4>{user.first_name}</h4></div>
            <div className="arena-timer-circle"><span>{gameState === 'playing' ? timer : '⚡'}</span></div>
            <div className="arena-player" style={{ textAlign: 'right' }}>
              <h4>{opponent?.name || 'Raqib'}</h4>
              {opponent?.username ? (
                hasBoughtLink ? (
                  <a href={`https://t.me/${opponent.username}`} target="_blank" rel="noreferrer" className="pm-link-btn opened">💬 Yozish</a>
                ) : (
                  <button onClick={buyOpponentChatLink} className="pm-link-btn buy-btn">🔓 Shaxsiy Chat (10🪙)</button>
                )
              ) : <span style={{fontSize: '10px', color: '#aaa'}}>Profil yopiq</span>}
            </div>
          </div>

          {gameState === 'playing' ? (
            <div className="arena-main-card">
              <div className="arena-buttons-grid">
                <button className="arena-choice-card rock-card" onClick={() => { setMyChoice('rock'); socket.emit('player_choice', { roomId, choice: 'rock' }); }} disabled={!!myChoice}>🪨 Tosh</button>
                <button className="arena-choice-card paper-card" onClick={() => { setMyChoice('paper'); socket.emit('player_choice', { roomId, choice: 'paper' }); }} disabled={!!myChoice}>📄 Qog'oz</button>
                <button className="arena-choice-card scissors-card" onClick={() => { setMyChoice('scissors'); socket.emit('player_choice', { roomId, choice: 'scissors' }); }} disabled={!!myChoice}>✂️ Qaychi</button>
              </div>
            </div>
          ) : (
            <div className="duel-card result-card">
              <h2>{roundResult === 'win' && "G'alaba!"}{roundResult === 'lose' && "Mag'lubiyat"}{roundResult === 'draw' && "Durang!"}</h2>
              <button className="duel-action-btn start-btn" onClick={resetGame}>Tugash 🚪</button>
            </div>
          )}

          {/* 💬 REAL-TIME VA ERKIN INPUT CHAT */}
          <div className="chat-container">
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.senderId === user.id.toString() ? 'me' : 'opponent'}`}>{msg.text}</div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {/* Tezkor iboralar */}
            <div className="quick-chat-grid">
              {quickMessages.map((msg, idx) => (
                <button key={idx} className="quick-chat-btn" onClick={() => sendChatMessage(msg)}>{msg}</button>
              ))}
            </div>

            {/* Real Matn Yozish Inputi */}
            <div className="chat-input-row">
              <input 
                type="text" 
                placeholder="Xabar yozing..." 
                value={typedMessage} 
                onChange={(e) => setTypedMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(typedMessage)}
              />
              <button onClick={() => sendChatMessage(typedMessage)}>🚀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DuelGame;