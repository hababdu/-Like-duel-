// frontend/src/screens/ProfileScreen.tsx
import { useState , useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// User interfeysini import qilish yoki bu yerda aniqlash
interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId?: number;
  rating?: number;
  coins?: number;
}

// Prop interfeysi
interface ProfileScreenProps {
  user: AppUser;
  onUserUpdate?: (updatedUser: AppUser) => void; // Agar user yangilansa
}

const ProfileScreen = ({ user: propUser, onUserUpdate }: ProfileScreenProps) => {
  const navigate = useNavigate();
  
  // Local state - prop user bilan boshlash
  const [user, setUser] = useState({
    name: propUser.name || 'Player',
    gender: 'other' as 'male' | 'female' | 'other',
    bio: 'I love playing games!',
    rating: propUser.rating || 1500,
    coins: propUser.coins || 100,
    level: 1,
    wins: 0,
    losses: 0,
    streakDays: 0,
    dailySuperLikes: 3,
  });
  
  const [isEditing, setIsEditing] = useState(false);

  // User prop o'zgarishini kuzatish
  useEffect(() => {
    if (propUser) {
      setUser(prev => ({
        ...prev,
        name: propUser.name || prev.name,
        rating: propUser.rating || prev.rating,
        coins: propUser.coins || prev.coins,
      }));
    }
  }, [propUser]);

  const quests = [
    { id: 1, title: 'Play 5 duels', progress: 2, goal: 5, reward: 50 },
    { id: 2, title: 'Win 3 matches', progress: 1, goal: 3, reward: 100 },
    { id: 3, title: 'Use 2 Super Likes', progress: 0, goal: 2, reward: 30 },
  ];

  const achievements = [
    { id: 1, title: 'First Win', icon: '🏆', unlocked: true },
    { id: 2, title: '10 Matches', icon: '🎮', unlocked: false },
    { id: 3, title: 'Rating 1600', icon: '⭐', unlocked: false },
  ];

  const handleSave = () => {
    setIsEditing(false);
    
    // Agar user yangilash funksiyasi mavjud bo'lsa
    if (onUserUpdate) {
      const updatedUser: AppUser = {
        ...propUser,
        name: user.name,
        rating: user.rating,
        coins: user.coins,
      };
      onUserUpdate(updatedUser);
    }
    
    // Bu yerda backendga yangilash yuboriladi
    console.log('Saving user changes:', user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-md mx-auto py-6">
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-700 hover:text-gray-900 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="w-16"></div>
        </header>

        {/* Enhanced Profile Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl ring-4 ring-white/50">
                {user.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
            </div>
            <div className="flex-1 ml-4">
              {isEditing ? (
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className="text-2xl font-bold border-b-2 border-purple-500 outline-none w-full bg-transparent"
                  autoFocus
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold text-purple-600">Level {user.level}</span>
                <div className="h-1 w-1 bg-gray-400 rounded-full"></div>
                <span className="text-xs text-gray-500">Active Player</span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {/* Telegram username ko'rsatish */}
          {propUser.username && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">Telegram:</p>
              <p className="font-medium text-indigo-600">@{propUser.username}</p>
            </div>
          )}

          {/* Enhanced Bio */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Bio</h3>
            {isEditing ? (
              <textarea
                value={user.bio}
                onChange={(e) => setUser({ ...user, bio: e.target.value })}
                className="w-full p-4 border-2 border-purple-200 rounded-2xl outline-none focus:border-purple-400 transition-colors resize-none"
                rows={3}
              />
            ) : (
              <p className="text-gray-700 p-4 bg-gray-50 rounded-2xl border border-gray-200">{user.bio}</p>
            )}
          </div>

          {/* Enhanced Gender */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Gender</h3>
            <div className="flex gap-3">
              {(['male', 'female', 'other'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => isEditing && setUser({ ...user, gender })}
                  className={`flex-1 px-4 py-3 rounded-2xl font-semibold transition-all duration-200 transform ${
                    user.gender === gender
                      ? gender === 'male'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                        : gender === 'female'
                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg scale-105'
                        : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${!isEditing ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95'}`}
                  disabled={!isEditing}
                >
                  {gender === 'male' && '👨 Male'}
                  {gender === 'female' && '👩 Female'}
                  {gender === 'other' && '⚧ Other'}
                </button>
              ))}
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
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
            <div className="bg-gradient-to-br from-emerald-50 to-green-100/50 p-4 rounded-2xl border border-emerald-200/50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-emerald-600">
                {user.wins + user.losses > 0 
                  ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
                  : 0}%
              </p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-rose-100/50 p-4 rounded-2xl border border-pink-200/50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Super Likes</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-pink-600">{user.dailySuperLikes}</p>
                <span className="text-lg">💖</span>
              </div>
            </div>
          </div>

          {isEditing && (
            <button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white py-4 rounded-2xl font-bold hover:from-green-600 hover:via-emerald-600 hover:to-green-700 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Save Changes
            </button>
          )}
        </div>

        {/* Enhanced Quests */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span>📋</span>
            <span>Daily Quests</span>
          </h3>
          <div className="space-y-4">
            {quests.map((quest) => (
              <div key={quest.id} className="border-2 border-gray-200 rounded-2xl p-5 hover:border-purple-300 transition-all duration-200 bg-gradient-to-br from-white to-gray-50/50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-800">{quest.title}</h4>
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <span>+{quest.reward}</span>
                    <span>🪙</span>
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${(quest.progress / quest.goal) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 font-semibold">
                  {quest.progress}/{quest.goal} completed
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Achievements */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border border-white/20">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span>🏆</span>
            <span>Achievements</span>
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-5 rounded-2xl text-center border-2 transition-all duration-200 transform hover:scale-105 ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-300 shadow-lg'
                    : 'bg-gray-100 border-gray-300 opacity-60'
                }`}
              >
                <div className="text-4xl mb-3">{achievement.icon}</div>
                <p className="font-bold text-xs">
                  {achievement.unlocked ? achievement.title : '???'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;