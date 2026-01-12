// App.tsx - YANGI VERSIYA
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { socketService } from './utils/socket';

// Screens
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import QueueScreen from './screens/QueueScreen';
import DuelScreen from './screens/DuelScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';

// Import CSS
import './App.css';

const App = () => {
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [user, setUser] = useState({
    id: '123',
    name: 'Telegram User',
    username: 'telegramuser',
    telegramId: 123456789,
    rating: 1500,
    coins: 100
  });

  useEffect(() => {
    console.log('🚀 App starting...');
    
    // Initialize socket with mock mode enabled
    socketService.initSocket('mock-token');
    
    const socket = socketService.getSocket();
    
    if (socket) {
      // Set up connection listeners
      socket.on('connect', () => {
        console.log('✅ App: Socket connected');
        setSocketStatus('connected');
      });

      socket.on('connect_error', (error) => {
        console.error('❌ App: Socket connection error', error);
        setSocketStatus('disconnected');
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 App: Socket disconnected', reason);
        setSocketStatus('disconnected');
      });

      // For mock mode, simulate connection
      if (socket.id === 'mock-socket') {
        setTimeout(() => {
          setSocketStatus('connected');
        }, 1500);
      }
    }

    // Load user data from localStorage or mock
    const savedUser = localStorage.getItem('like_duel_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('disconnect');
      }
    };
  }, []);

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem('like_duel_user', JSON.stringify(updatedUser));
    console.log('👤 User updated:', updatedUser);
  };

  // Connection status component
  const ConnectionStatus = () => {
    return (
      <div className={`connection-status ${socketStatus}`}>
        <div className="status-indicator">
          {socketStatus === 'connecting' && '🔄'}
          {socketStatus === 'connected' && '✅'}
          {socketStatus === 'disconnected' && '❌'}
        </div>
        <span className="status-text">
          {socketStatus === 'connecting' && 'Connecting to server...'}
          {socketStatus === 'connected' && 'Connected'}
          {socketStatus === 'disconnected' && 'Offline mode'}
        </span>
      </div>
    );
  };

  return (
    <Router>
      <div className="app-container">
        <ConnectionStatus />
        
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route 
            path="/home" 
            element={<HomeScreen user={user} />} 
          />
          <Route path="/queue" element={<QueueScreen />} />
          <Route path="/duel" element={<DuelScreen />} />
          <Route 
            path="/profile" 
            element={
              <ProfileScreen 
                user={user} 
                onUserUpdate={handleUserUpdate} 
              />
            } 
          />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          
          {/* Coming soon pages */}
          <Route path="/practice" element={
            <div className="coming-soon">
              <h1>Practice Mode</h1>
              <p>Coming soon!</p>
            </div>
          } />
          <Route path="/friends" element={
            <div className="coming-soon">
              <h1>Friends</h1>
              <p>Coming soon!</p>
            </div>
          } />
          <Route path="/rewards" element={
            <div className="coming-soon">
              <h1>Daily Rewards</h1>
              <p>Coming soon!</p>
            </div>
          } />
          <Route path="/shop" element={
            <div className="coming-soon">
              <h1>Shop</h1>
              <p>Coming soon!</p>
            </div>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Development Info Footer */}
        {process.env.NODE_ENV === 'development' && (
          <div className="dev-info">
            <small>
              Socket: {socketStatus} | Mode: {socketService.getSocket()?.id === 'mock-socket' ? 'Mock' : 'Real'}
            </small>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;