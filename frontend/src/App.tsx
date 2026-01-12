import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initTelegramWebApp, getTelegramUser } from './utils/telegram';
import { initSocket, getSocketInfo, disconnectSocket } from './utils/socket';
import BottomNavigation from './components/BottomNavigation';
import HomeScreen from './screens/HomeScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import DuelScreen from './screens/DuelScreen';
import QueueScreen from './screens/QueueScreen';
import SettingsScreen from './screens/SettingsScreen';
import './App.css';

interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId?: number;
  rating?: number;
  coins?: number;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [socketInfo, setSocketInfo] = useState<any>(null);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing Like Duel App...');
      
      try {
        // 1. Telegram WebApp ni tekshirish
        console.log('🔍 Checking Telegram WebApp...');
        const tg = initTelegramWebApp();
        let appUser: AppUser | null = null;
        
        if (tg) {
          console.log('✅ Telegram WebApp detected');
          const telegramUser = getTelegramUser();
          
          if (telegramUser) {
            console.log('👤 Telegram user found:', telegramUser.first_name);
            appUser = {
              id: `telegram_${telegramUser.id}`,
              name: telegramUser.first_name,
              username: telegramUser.username,
              telegramId: telegramUser.id,
              rating: 1500,
              coins: 100,
            };
          }
        }
        
        // 2. Agar Telegram user bo'lmasa, test user yaratish
        if (!appUser) {
          console.log('⚠️ No Telegram user, creating test user');
          appUser = {
            id: 'test-user-123',
            name: 'Test Player',
            username: 'test_player',
            rating: 1500,
            coins: 250,
          };
        }
        
        setUser(appUser);
        console.log('✅ User set:', appUser.name);
        
        // 3. Socket'ni ishga tushirish
        console.log('🔌 Initializing socket connection...');
        const socket = initSocket(appUser.id);
        
        // Socket connection holatini kuzatish
        const checkConnection = () => {
          const info = getSocketInfo();
          setSocketInfo(info);
          console.log('📡 Socket info:', info);
        };
        
        // 5 soniyadan so'ng connection holatini tekshirish
        setTimeout(checkConnection, 5000);
        
        // 4. Socket event'larni qo'shish
        socket.on('welcome', (data) => {
          console.log('👋 Server welcome:', data.message);
        });
        
        socket.on('user_connected', (data) => {
          console.log('👤 User connected:', data.userId);
        });
        
        // 5. Connection timeout (agar 10 soniyada ulanmasa)
        const connectionTimeout = setTimeout(() => {
          const info = getSocketInfo();
          if (!info.connected) {
            console.error('🔴 Socket connection timeout after 10 seconds');
            console.log('📡 Current socket info:', info);
          }
        }, 10000);
        
        // Cleanup function
        return () => {
          clearTimeout(connectionTimeout);
          console.log('🧹 Cleaning up socket connection...');
          disconnectSocket();
        };
        
      } catch (error) {
        console.error('🔥 App initialization error:', error);
        
        // Error holatida default user
        const defaultUser = {
          id: 'default-user',
          name: 'Player',
          rating: 1500,
          coins: 100,
        };
        
        setUser(defaultUser);
        
        // Socket'ni default user bilan ulash
        initSocket(defaultUser.id);
        
      } finally {
        setLoading(false);
        console.log('✅ App initialization complete');
      }
    };

    initializeApp();
  }, []);

  // Loading holati
  if (loading) {
    return (
      <div className="app-loading">
        <p style={{ marginTop: '20px', color: '#666' }}>
          Connecting to server...
          {socketInfo && (
            <span style={{ fontSize: '12px', display: 'block', marginTop: '5px' }}>
              Socket: {socketInfo.connected ? '✅ Connected' : '⏳ Connecting...'}
            </span>
          )}
        </p>
      </div>
    );
  }

  // Agar user null bo'lsa
  if (!user) {
    return (
      <div className="error-screen">
        <h2>⚠️ Error Loading App</h2>
        <p>Unable to initialize user. Please refresh the page.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#0088cc',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            marginTop: '20px',
            cursor: 'pointer'
          }}
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div className="telegram-app">
        {/* Socket status indicator (debug uchun) */}
        {socketInfo && (
          <div className="socket-status" style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: socketInfo.connected ? '#34a853' : '#e91e63',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            zIndex: 1000,
            opacity: 0.8
          }}>
            {socketInfo.connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        )}
        
        <Routes>
          <Route path="/" element={<HomeScreen user={user} />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/profile" element={<ProfileScreen user={user} />} />
          <Route path="/queue" element={<QueueScreen />} />
          <Route path="/duel" element={<DuelScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <BottomNavigation />
      </div>
    </Router>
  );
}

export default App;