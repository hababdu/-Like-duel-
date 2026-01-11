// frontend/src/screens/ProfileScreen.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: 'Player',
    gender: 'other' as 'male' | 'female' | 'other',
    bio: 'I love playing games!',
    rating: 1500,
    coins: 100,
    level: 1,
    wins: 0,
    losses: 0,
    streakDays: 0,
    dailySuperLikes: 3,
  });
  const [isEditing, setIsEditing] = useState(false);

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
    // Bu yerda backendga yangilash yuboriladi
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Profile 👤</h1>
          <div className="w-8"></div> {/* Spacer */}
        </header>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mr-4">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className="text-2xl font-bold border-b-2 border-blue-500 outline-none w-full"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
              )}
              <p className="text-gray-600">Level {user.level}</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-blue-500 hover:text-blue-700"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {/* Bio */}
          <div className="mb-4">
            <h3 className="font-bold text-gray-700 mb-2">Bio</h3>
            {isEditing ? (
              <textarea
                value={user.bio}
                onChange={(e) => setUser({ ...user, bio: e.target.value })}
                className="w-full p-2 border rounded-lg outline-none"
                rows={3}
              />
            ) : (
              <p className="text-gray-600">{user.bio}</p>
            )}
          </div>

          {/* Gender */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-2">Gender</h3>
            <div className="flex gap-2">
              {(['male', 'female', 'other'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => isEditing && setUser({ ...user, gender })}
                  className={`px-4 py-2 rounded-lg ${
                    user.gender === gender
                      ? gender === 'male'
                        ? 'bg-blue-500 text-white'
                        : gender === 'female'
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  } ${!isEditing ? 'opacity-50 cursor-default' : 'hover:opacity-90'}`}
                  disabled={!isEditing}
                >
                  {gender === 'male' && '👨 Male'}
                  {gender === 'female' && '👩 Female'}
                  {gender === 'other' && '⚧ Other'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Rating</p>
              <p className="text-xl font-bold text-blue-600">{user.rating} ⭐</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Coins</p>
              <p className="text-xl font-bold text-yellow-600">{user.coins} 🪙</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Win Rate</p>
              <p className="text-xl font-bold text-green-600">
                {user.wins + user.losses > 0 
                  ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
                  : 0}%
              </p>
            </div>
            <div className="bg-pink-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Super Likes</p>
              <p className="text-xl font-bold text-pink-600">{user.dailySuperLikes} 💖</p>
            </div>
          </div>

          {isEditing && (
            <button
              onClick={handleSave}
              className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition"
            >
              Save Changes
            </button>
          )}
        </div>

        {/* Quests */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Daily Quests 📋</h3>
          <div className="space-y-4">
            {quests.map((quest) => (
              <div key={quest.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-700">{quest.title}</h4>
                  <span className="text-yellow-600 font-bold">+{quest.reward} 🪙</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(quest.progress / quest.goal) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {quest.progress}/{quest.goal}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Achievements 🏆</h3>
          <div className="grid grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg text-center ${
                  achievement.unlocked
                    ? 'bg-gradient-to-b from-yellow-50 to-orange-50'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-3xl mb-2">{achievement.icon}</div>
                <p className="font-bold text-sm">
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