import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GameProvider } from './contexts/GameContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import MultiplayerPage from './pages/MultiplayerPage';
import BotGamePage from './pages/BotGamePage';
import TournamentPage from './pages/TournamentPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import GameRoomPage from './pages/GameRoomPage';
import TournamentRoomPage from './pages/TournamentRoomPage';
import AdminPage from './pages/AdminPage';
import LoadingScreen from './components/common/LoadingScreen';
import ErrorBoundary from './components/common/ErrorBoundary';

// Styles
import './styles/global.css';
import './styles/animations.css';
import './styles/responsive.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [appError, setAppError] = useState(null);

  useEffect(() => {
    // Initialize app
    const initApp = async () => {
      try {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Check for device info
        const deviceInfo = {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: {
            width: window.screen.width,
            height: window.screen.height
          }
        };
        
        localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));
        
        // Simulate loading
        setTimeout(() => setIsLoading(false), 1000);
      } catch (error) {
        console.error('App initialization error:', error);
        setAppError(error.message);
        setIsLoading(false);
      }
    };
    
    initApp();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Tosh-Qaychi-Qog'oz yuklanmoqda..." />;
  }

  if (appError) {
    return (
      <div className="app-error">
        <h1>Xatolik yuz berdi</h1>
        <p>{appError}</p>
        <button onClick={() => window.location.reload()}>
          Qayta yuklash
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <GameProvider>
            <Router>
              <div className="app">
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    },
                  }}
                />
                
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="play" element={<MultiplayerPage />} />
                    <Route path="bot" element={<BotGamePage />} />
                    <Route path="tournaments" element={<TournamentPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                    <Route path="friends" element={<FriendsPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="game/:gameId" element={<GameRoomPage />} />
                    <Route path="tournament/:tournamentId" element={<TournamentRoomPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </div>
            </Router>
          </GameProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;