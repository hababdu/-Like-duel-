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

// Components
import Layout from './components/Layout';

// Import CSS
import './App.css';

interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId?: number;
  rating: number;
  coins: number;
  level: number;
  dailySuperLikes: number;
  wins?: number;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
}

const App = () => {
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🚀 App starting...');
    
    // Load user data from localStorage
    const savedUser = localStorage.getItem('like_duel_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        console.log('👤 Loaded user from storage:', parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Initialize socket
    setTimeout(() => {
      socketService.initSocket();
      setSocketStatus('connected');
      setLoading(false);
    }, 1000);

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleUserUpdate = (updatedUser: AppUser) => {
    setUser(updatedUser);
    localStorage.setItem('like_duel_user', JSON.stringify(updatedUser));
    console.log('👤 User updated:', updatedUser);
  };

  // Function to handle user authentication from WelcomeScreen
  const handleUserAuthenticated = (userData: any) => {
    // Convert WelcomeScreen's TelegramUser to AppUser format
    const appUser: AppUser = {
      id: userData.id || `user-${Date.now()}`,
      name: userData.name || userData.firstName || 'Telegram User',
      username: userData.username || `user${userData.id}`,
      telegramId: userData.telegramId || parseInt(userData.id) || 0,
      rating: userData.rating || 1500,
      coins: userData.coins || 100,
      level: userData.level || 1,
      dailySuperLikes: userData.dailySuperLikes || 3,
      wins: userData.wins || 0,
      bio: userData.bio || 'I love playing games!',
      gender: userData.gender || 'other'
    };
    
    setUser(appUser);
    localStorage.setItem('like_duel_user', JSON.stringify(appUser));
    console.log('✅ User authenticated:', appUser);
  };

  // Default user for development
  const defaultUser: AppUser = {
    id: 'guest-123',
    name: 'Guest Player',
    username: 'guest',
    telegramId: 0,
    rating: 1500,
    coins: 100,
    level: 1,
    dailySuperLikes: 3,
    wins: 0,
    bio: 'I love playing games!',
    gender: 'other'
  };

  // Update WelcomeScreen to pass authentication handler
  const UpdatedWelcomeScreen = () => (
    <WelcomeScreen onUserAuthenticated={handleUserAuthenticated} />
  );

  // Connection status component
  const ConnectionStatus = () => {
    if (loading || !user) return null;
    
    return (
      <div className={`connection-status ${socketStatus}`}>
        <div className="status-indicator">
          {socketStatus === 'connecting' && '🔄'}
          {socketStatus === 'connected' && '✅'}
          {socketStatus === 'disconnected' && '❌'}
        </div>
        <span className="status-text">
          {socketStatus === 'connecting' && 'Connecting...'}
          {socketStatus === 'connected' && 'Connected'}
          {socketStatus === 'disconnected' && 'Offline mode'}
        </span>
      </div>
    );
  };

  // Protected route component
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring delay-1"></div>
          <div className="spinner-ring delay-2"></div>
          <div className="spinner-center">⚡</div>
        </div>
        <h2>Loading Like Duel...</h2>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container">
        <ConnectionStatus />
        
        <Routes>
          <Route 
            path="/" 
            element={<UpdatedWelcomeScreen />} 
          />
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Layout>
                  {/* user undefined bo'lsa defaultUser yuboramiz */}
                  <HomeScreen user={user || defaultUser} />
                </Layout>
              </ProtectedRoute>
            } 
          />
          <Route path="/queue" element={
            <ProtectedRoute>
              <Layout>
                <QueueScreen />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/duel" element={
            <ProtectedRoute>
              <Layout showNavbar={false}>
                <DuelScreen />
              </Layout>
            </ProtectedRoute>
          } />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfileScreen 
                    user={user || defaultUser} 
                    onUserUpdate={handleUserUpdate} 
                  />
                </Layout>
              </ProtectedRoute>
            } 
          />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <SettingsScreen />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <Layout>
                <LeaderboardScreen />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Coming soon pages */}
          <Route path="/practice" element={
            <ProtectedRoute>
              <Layout>
                <div className="coming-soon">
                  <h1>Practice Mode</h1>
                  <p>Coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/friends" element={
            <ProtectedRoute>
              <Layout>
                <div className="coming-soon">
                  <h1>Friends</h1>
                  <p>Coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/rewards" element={
            <ProtectedRoute>
              <Layout>
                <div className="coming-soon">
                  <h1>Daily Rewards</h1>
                  <p>Coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/shop" element={
            <ProtectedRoute>
              <Layout>
                <div className="coming-soon">
                  <h1>Shop</h1>
                  <p>Coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Development Info Footer */}
        {process.env.NODE_ENV === 'development' && (
          <div className="dev-info">
            <small>
              Socket: {socketStatus} | User: {user?.name || 'Guest'}
            </small>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;