// src/App.jsx
import React, { useEffect, useState } from 'react';
import './App.css';

import BotGame from './components/BotGame';
import MultiplayerGame from './components/MultiplayerGame';
import MenuScreen from './components/MenuScreen';
import DifficultySelect from './components/DifficultySelect';

import RPSBot from './RPSBot';

export const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', color: '#64748b' },
  paper: { emoji: '✋', name: 'Qog‘oz', color: '#3b82f6' },
  scissors: { emoji: '✌️', name: 'Qaychi', color: '#10b981' }
};

function App() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(1500);
  const [mode, setMode] = useState('menu');
  const [difficulty, setDifficulty] = useState('medium');

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.MainButton.setText("O'ynash").show();

      const initData = tg.initDataUnsafe;
      if (initData?.user) {
        setUser(initData.user);
        setCoins(prev => prev + (initData.user.id % 500 || 0));
      }
    }
  }, []);

  const showNotif = (text, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${text}`);
    // keyinchalik toast yoki modal qo'shishingiz mumkin
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">✊ Qaychi Qog‘oz ✌️</div>
        <div className="coins-display">
          <span>🪙 {coins.toLocaleString()}</span>
        </div>
      </header>

      {mode === 'menu' && (
        <MenuScreen
          user={user}
          onMultiplayer={() => setMode('multiplayer')}
          onBotGame={() => setMode('bot-select')}
        />
      )}

      {mode === 'bot-select' && (
        <DifficultySelect
          onSelect={diff => {
            setDifficulty(diff);
            setMode('playing-bot');
          }}
          onBack={() => setMode('menu')}
        />
      )}

      {mode === 'playing-bot' && (
        <BotGame
          difficulty={difficulty}
          coins={coins}
          setCoins={setCoins}
          CHOICES={CHOICES}
          onBackToMenu={() => setMode('menu')}
          showNotif={showNotif}
        />
      )}

      {mode === 'multiplayer' && (
        <MultiplayerGame
          user={user}
          coins={coins}
          setCoins={setCoins}
          CHOICES={CHOICES}
          onBackToMenu={() => setMode('menu')}
          showNotif={showNotif}
        />
      )}

      <footer>
        <p>Telegram o‘yini • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;