// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import WelcomeScreen from './screens/WelcomeScreen';
import QueueScreen from './screens/QueueScreen';
import DuelScreen from './screens/DuelScreen';
import ProfileScreen from './screens/ProfileScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import './App.css';

function App() {
  useEffect(() => {
    // Telegram WebApp SDK'ni ishga tushirish
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready(); // Interfeysni tayyorlaydi
      tg.expand(); // Telefonda to'liq ekranga oladi[citation:1]
      
      // Foydalanuvchi ma'lumotlarini konsolga chiqarish (test uchun)
      console.log('Telegram User:', tg.initDataUnsafe?.user);
    }
  }, []);
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/queue" element={<QueueScreen />} />
          <Route path="/duel" element={<DuelScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;