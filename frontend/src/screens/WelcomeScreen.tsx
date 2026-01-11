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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Like Duel 🎮</h1>
          <p className="text-gray-600">Real-time matching game</p>
        </header>

        {user && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
                <p className="text-gray-600">Level {user.level}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Rating</p>
                <p className="text-xl font-bold text-blue-600">{user.rating} ⭐</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Coins</p>
                <p className="text-xl font-bold text-yellow-600">{user.coins} 🪙</p>
              </div>
            </div>
            
            {user.gender === 'other' && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">
                  ⚠️ Please select your gender to start playing
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleEnterQueue}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl text-lg font-bold hover:opacity-90 transition shadow-lg"
          >
            🎮 Start Duel
          </button>
          
          <button 
            onClick={() => navigate('/profile')}
            className="w-full bg-white text-gray-800 py-4 rounded-xl text-lg font-bold border-2 border-gray-200 hover:bg-gray-50 transition"
          >
            👤 My Profile
          </button>
          
          <button 
            onClick={() => navigate('/leaderboard')}
            className="w-full bg-white text-gray-800 py-4 rounded-xl text-lg font-bold border-2 border-gray-200 hover:bg-gray-50 transition"
          >
            🏆 Leaderboard
          </button>
        </div>

        {/* Gender Modal */}
        {showGenderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Select Gender</h3>
              <p className="text-gray-600 mb-6">
                This helps us find suitable opponents for you
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handleGenderSelect('male')}
                  className="p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                >
                  <div className="text-4xl mb-2">👨</div>
                  <div className="font-bold text-blue-700">Male</div>
                </button>
                
                <button
                  onClick={() => handleGenderSelect('female')}
                  className="p-4 bg-pink-50 hover:bg-pink-100 rounded-xl transition"
                >
                  <div className="text-4xl mb-2">👩</div>
                  <div className="font-bold text-pink-700">Female</div>
                </button>
              </div>
              
              <button
                onClick={() => setShowGenderModal(false)}
                className="w-full py-3 text-gray-600 hover:text-gray-800 transition"
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