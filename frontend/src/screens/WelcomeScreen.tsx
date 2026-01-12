import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSocket } from '../utils/socket';

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
      // Mock authentication for development
      setTimeout(() => {
        setUser({
          id: '123',
          firstName: 'Telegram User',
          username: 'telegramuser',
          rating: 1500,
          coins: 100,
          level: 1,
          dailySuperLikes: 3
        });
        setLoading(false);
      }, 1000);
    };

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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Telegram bilan autentifikatsiya qilinmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8 pt-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-3">Like Duel 🎮</h1>
          <p className="text-gray-600 text-lg">Telegram orqali kirish</p>
        </header>

        {user ? (
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8 border border-gray-100 animate-slide-up">
            <div className="flex items-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mr-5 shadow-lg">
                {user.firstName.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{user.firstName}</h2>
                {user.username && (
                  <p className="text-gray-600 mt-1">@{user.username}</p>
                )}
                <div className="inline-block px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-sm font-semibold rounded-full mt-2">
                  Level {user.level}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Rating</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-blue-600">{user.rating}</p>
                  <span className="text-xl ml-2">⭐</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-amber-100 p-4 rounded-2xl border border-yellow-200">
                <p className="text-sm text-gray-600 mb-1">Coins</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-yellow-600">{user.coins}</p>
                  <span className="text-xl ml-2">🪙</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4 rounded-2xl border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Wins</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-green-600">0</p>
                  <span className="text-xl ml-2">🏆</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-rose-100 p-4 rounded-2xl border border-pink-200">
                <p className="text-sm text-gray-600 mb-1">Super Likes</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-pink-600">{user.dailySuperLikes}</p>
                  <span className="text-xl ml-2">💖</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-5 rounded-2xl text-xl font-bold hover:opacity-90 transition-all duration-200 shadow-2xl hover:shadow-3xl hover:scale-[1.02] active:scale-[0.98]"
            >
              🎮 Start Duel
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please open this app from Telegram to play Like Duel
            </p>
            <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
              <p className="text-orange-700 font-medium">
                ⚠️ This game requires Telegram Mini App environment
              </p>
            </div>
          </div>
        )}

        <div className="text-center text-gray-500 text-sm mt-8">
          <p className="mb-2">Built with ❤️ for Telegram Mini Apps</p>
          <div className="flex justify-center space-x-6 mt-4">
            <span className="text-xs bg-blue-50 px-3 py-1 rounded-full text-blue-600">⚡ Fast</span>
            <span className="text-xs bg-green-50 px-3 py-1 rounded-full text-green-600">🆓 Free</span>
            <span className="text-xs bg-purple-50 px-3 py-1 rounded-full text-purple-600">🎮 Fun</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;