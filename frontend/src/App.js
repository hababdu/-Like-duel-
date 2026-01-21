// src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initTelegramWebApp } from './utils/telegram';
import { connectToGameServer } from './utils/gameWebSocket';
import { Toaster, toast } from 'react-hot-toast';

// Layout komponentlari
import Layout from './components/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Asosiy sahifalar
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import MultiplayerPage from './pages/MultiplayerPage';
import TournamentPage from './pages/TournamentPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import ShopPage from './pages/ShopPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SettingsPage from './pages/SettingsPage';

// Context'lar
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { NotificationProvider } from './contexts/NotificationContext';

// O'rnatish
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Telegram Web App ni ishga tushirish
        const userData = await initTelegramWebApp();
        
        // 2. Game server'ga ulanish
        const ws = await connectToGameServer(
          userData,
          {
            onOpen: () => {
              setConnectionStatus('connected');
              toast.success('Serverga ulandi');
            },
            onClose: () => {
              setConnectionStatus('disconnected');
              toast.error('Server bilan aloqa uzildi');
            },
            onError: (error) => {
              console.error('WebSocket error:', error);
              toast.error('Xatolik yuz berdi');
            },
            onMessage: handleServerMessage
          }
        );

        // 3. App holatini yangilash
        window.gameSocket = ws;
        setIsInitialized(true);

      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Ilovani ishga tushirishda xatolik');
      }
    };

    initializeApp();

    return () => {
      if (window.gameSocket) {
        window.gameSocket.close();
      }
    };
  }, []);

  const handleServerMessage = (data) => {
    console.log('Server message:', data);
    
    switch (data.type) {
      case 'notification':
        toast(data.message, {
          icon: '🔔',
          duration: 3000
        });
        break;
      case 'game_invitation':
        showGameInvitation(data);
        break;
      case 'match_found':
        handleMatchFound(data);
        break;
      case 'game_result':
        handleGameResult(data);
        break;
    }
  };

  const showGameInvitation = (invitation) => {
    // Notification yoki modal ko'rsatish
  };

  const handleMatchFound = (data) => {
    // O'yin sahifasiga yo'naltirish
  };

  const handleGameResult = (data) => {
    // O'yin natijasini ko'rsatish
  };

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Ilova yuklanmoqda...</p>
        <p className="connection-status">
          Server: {connectionStatus === 'connected' ? '✅' : '❌'}
        </p>
      </div>
    );
  }

  return (
    <AuthProvider>
      <GameProvider>
        <NotificationProvider>
          <Router>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
            
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                
                <Route path="game" element={
                  <ProtectedRoute>
                    <GamePage />
                  </ProtectedRoute>
                } />
                
                <Route path="multiplayer" element={
                  <ProtectedRoute>
                    <MultiplayerPage />
                  </ProtectedRoute>
                } />
                
                <Route path="tournaments" element={
                  <ProtectedRoute>
                    <TournamentPage />
                  </ProtectedRoute>
                } />
                
                <Route path="profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                
                <Route path="friends" element={
                  <ProtectedRoute>
                    <FriendsPage />
                  </ProtectedRoute>
                } />
                
                <Route path="chat" element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } />
                
                <Route path="shop" element={
                  <ProtectedRoute>
                    <ShopPage />
                  </ProtectedRoute>
                } />
                
                <Route path="leaderboard" element={<LeaderboardPage />} />
                
                <Route path="settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } />
              </Route>
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </GameProvider>
    </AuthProvider>
  );
}

export default App;