// frontend/src/screens/WelcomeScreen.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Oddiy interface'lar
interface SimpleUser {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  rating: number;
  coins: number;
  level: number;
}

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);

  useEffect(() => {
    // Mock user data - keyin Telegram WebApp bilan almashtiriladi
    const mockUser: SimpleUser = {
      id: 'test-user-123',
      name: 'Player',
      gender: 'other',
      rating: 1500,
      coins: 100,
      level: 1
    };
    
    setUser(mockUser);
  }, []);

  const handleEnterQueue = () => {
    if (!user?.gender || user.gender === 'other') {
      setShowGenderModal(true);
    } else {
      navigate('/queue');
    }
  };

  const handleGenderSelect = (gender: 'male' | 'female') => {
    if (user) {
      setUser({ ...user, gender });
      setShowGenderModal(false);
      navigate('/queue');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
      <div className="max-w-md mx-auto py-6">
        {/* Header with animated title */}
        <header className="text-center mb-8 animate-fade-in">
          <div className="inline-block mb-3">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent mb-2 drop-shadow-sm">
              Like Duel
            </h1>
            <span className="text-4xl block mt-1">⚔️</span>
          </div>
          <p className="text-gray-600 font-medium mt-2">Real-time matching game</p>
        </header>

        {/* User Card with improved design */}
        {user && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border border-white/20 transform transition-all hover:scale-[1.02] hover:shadow-3xl">
            <div className="flex items-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-4 ring-white/50">
                  {user.name.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="ml-4 flex-1">
                <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-purple-600">Level {user.level}</span>
                  <div className="h-1 w-1 bg-gray-400 rounded-full"></div>
                  <span className="text-xs text-gray-500">Beginner</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-2xl border border-blue-200/50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold text-blue-600">{user.rating}</p>
                  <span className="text-lg">⭐</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-100/50 p-4 rounded-2xl border border-amber-200/50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Coins</p>
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold text-amber-600">{user.coins}</p>
                  <span className="text-lg">🪙</span>
                </div>
              </div>
            </div>
            
            {user.gender === 'other' && (
              <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200/50">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm font-medium text-orange-700">
                    Please select your gender to start playing
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons with enhanced design */}
        <div className="space-y-3">
          <button 
            onClick={handleEnterQueue}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white py-5 rounded-2xl text-lg font-bold hover:from-purple-700 hover:via-pink-600 hover:to-rose-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transform flex items-center justify-center gap-2"
          >
            <span className="text-2xl">🎮</span>
            <span>Start Duel</span>
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/profile')}
              className="bg-white/90 backdrop-blur-sm text-gray-800 py-4 rounded-2xl text-base font-semibold border-2 border-gray-200 hover:bg-white hover:border-purple-300 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span className="text-xl">👤</span>
              <span>Profile</span>
            </button>
            
            <button 
              onClick={() => navigate('/leaderboard')}
              className="bg-white/90 backdrop-blur-sm text-gray-800 py-4 rounded-2xl text-base font-semibold border-2 border-gray-200 hover:bg-white hover:border-amber-300 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span className="text-xl">🏆</span>
              <span>Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Enhanced Gender Modal */}
        {showGenderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowGenderModal(false)}>
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100 border border-gray-100" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-6">
                <h3 className="text-3xl font-bold text-gray-800 mb-2">Select Gender</h3>
                <p className="text-gray-600">
                  This helps us find suitable opponents for you
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handleGenderSelect('male')}
                  className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 border-2 border-blue-200 hover:border-blue-400 shadow-md hover:shadow-lg"
                >
                  <div className="text-5xl mb-3">👨</div>
                  <div className="font-bold text-blue-700 text-lg">Male</div>
                </button>
                
                <button
                  onClick={() => handleGenderSelect('female')}
                  className="p-6 bg-gradient-to-br from-pink-50 to-pink-100 hover:from-pink-100 hover:to-pink-200 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 border-2 border-pink-200 hover:border-pink-400 shadow-md hover:shadow-lg"
                >
                  <div className="text-5xl mb-3">👩</div>
                  <div className="font-bold text-pink-700 text-lg">Female</div>
                </button>
              </div>
              
              <button
                onClick={() => setShowGenderModal(false)}
                className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors rounded-xl hover:bg-gray-100"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;