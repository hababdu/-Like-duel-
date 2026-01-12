// frontend/src/screens/WelcomeScreen.tsx - TO'LIQ YANGI VERSIYA
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {  initSocket } from '../utils/socket';
import { jwtDecode } from 'jwt-decode'; // npm install jwt-decode

interface TelegramUser {
  id: string;
  firstName: string;
  username?: string;
  rating: number;
  coins: number;
  level: number;
  dailySuperLikes: number;
}

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authenticateUser = async () => {
      // Telegram WebApp mavjudligini tekshirish
      if (!window.Telegram?.WebApp) {
        console.log('Not in Telegram environment');
        setLoading(false);
        return;
      }

      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const initData = tg;
      
      if (!initData) {
        console.error('No initData from Telegram');
        setLoading(false);
        return;
      }

      try {
        // 1. Backend'ga authentication so'rovi
        const response = await fetch('https://your-backend.onrender.com/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ initData })
        });

        const data = await response.json();
        
        if (data.success) {
          // 2. User ma'lumotlarini saqlash
          setUser(data.user);
          
          // 3. JWT token'ni localStorage'ga saqlash
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user_data', JSON.stringify(data.user));
          
          // 4. Socket.io ulanishini yangilash
          const socket = initSocket();
          socket.auth = { token: data.token };
          socket.connect();
          
          console.log('✅ User authenticated:', data.user.name);
        } else {
          console.error('Authentication failed:', data.error);
        }
      } catch (error) {
        console.error('Auth request failed:', error);
      } finally {
        setLoading(false);
      }
    };

    // Avval localStorage'dan tekshirish
    const savedUser = localStorage.getItem('user_data');
    const savedToken = localStorage.getItem('auth_token');
    
    if (savedUser && savedToken) {
      // Token amal qilish muddatini tekshirish
      try {
        const decoded: any = jwtDecode(savedToken);
        const isExpired = decoded.exp * 1000 < Date.now();
        
        if (!isExpired) {
          setUser(JSON.parse(savedUser));
          setLoading(false);
          return;
        }
      } catch (error) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
    
    // Yangi authentication
    authenticateUser();
  }, []);

  const handleStartGame = () => {
    if (user) {
      navigate('/queue');
    } else {
      alert('Please authenticate first');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Telegram bilan autentifikatsiya qilinmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Like Duel 🎮</h1>
          <p className="text-gray-600">Telegram orqali kirish</p>
        </header>

        {user ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                {user.firstName.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{user.firstName}</h2>
                {user.username && (
                  <p className="text-gray-600">@{user.username}</p>
                )}
                <p className="text-gray-600">Level {user.level}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Rating</p>
                <p className="text-xl font-bold text-blue-600">{user.rating} ⭐</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Coins</p>
                <p className="text-xl font-bold text-yellow-600">{user.coins} 🪙</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Wins</p>
                <p className="text-xl font-bold text-green-600">0 🏆</p>
              </div>
              <div className="bg-pink-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Super Likes</p>
                <p className="text-xl font-bold text-pink-600">{user.dailySuperLikes} 💖</p>
              </div>
            </div>
            
            <button 
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl text-lg font-bold hover:opacity-90 transition shadow-lg"
            >
              🎮 Start Duel
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please open this app from Telegram to play Like Duel
            </p>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-orange-700">
                ⚠️ This game requires Telegram Mini App environment
              </p>
            </div>
          </div>
        )}

        <div className="text-center text-gray-500 text-sm mt-6">
          <p>Built with ❤️ for Telegram Mini Apps</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;