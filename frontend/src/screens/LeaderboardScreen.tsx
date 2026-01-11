// frontend/src/screens/LeaderboardScreen.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LeaderboardScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');

  const globalPlayers = [
    { rank: 1, name: 'ProPlayer', rating: 2450, wins: 156, level: 25 },
    { rank: 2, name: 'DuelMaster', rating: 2310, wins: 142, level: 22 },
    { rank: 3, name: 'LikeKing', rating: 2250, wins: 138, level: 21 },
    { rank: 4, name: 'MatchMaker', rating: 2180, wins: 129, level: 20 },
    { rank: 5, name: 'SwiftChoice', rating: 2100, wins: 121, level: 19 },
    { rank: 6, name: 'You', rating: 1500, wins: 0, level: 1 },
    { rank: 7, name: 'QuickWin', rating: 1950, wins: 98, level: 17 },
    { rank: 8, name: 'SuperLiker', rating: 1870, wins: 87, level: 16 },
    { rank: 9, name: 'DuelDude', rating: 1750, wins: 76, level: 14 },
    { rank: 10, name: 'NewPlayer', rating: 1520, wins: 12, level: 3 },
  ];

  const friends = [
    { name: 'Alex', rating: 1800, online: true },
    { name: 'Sam', rating: 1650, online: false },
    { name: 'Jordan', rating: 1580, online: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-yellow-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Leaderboard 🏆</h1>
          <div className="w-8"></div> {/* Spacer */}
        </header>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-2 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-3 rounded-lg text-center font-bold ${
                activeTab === 'global'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🌍 Global
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-3 rounded-lg text-center font-bold ${
                activeTab === 'friends'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👥 Friends
            </button>
          </div>
        </div>

        {activeTab === 'global' ? (
          /* Global Leaderboard */
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Top 3 Players */}
            <div className="grid grid-cols-3 gap-4 p-6 border-b">
              {globalPlayers.slice(0, 3).map((player) => (
                <div
                  key={player.rank}
                  className={`text-center p-4 rounded-xl ${
                    player.rank === 1
                      ? 'bg-gradient-to-b from-yellow-100 to-amber-100'
                      : player.rank === 2
                      ? 'bg-gradient-to-b from-gray-100 to-slate-100'
                      : 'bg-gradient-to-b from-amber-100 to-orange-100'
                  }`}
                >
                  <div className="text-4xl mb-2">
                    {player.rank === 1 && '🥇'}
                    {player.rank === 2 && '🥈'}
                    {player.rank === 3 && '🥉'}
                  </div>
                  <div className="font-bold text-lg mb-1">{player.name}</div>
                  <div className="text-blue-600 font-bold">{player.rating} ⭐</div>
                  <div className="text-sm text-gray-600">Level {player.level}</div>
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="divide-y">
              {globalPlayers.slice(3).map((player) => (
                <div
                  key={player.rank}
                  className={`flex items-center p-4 ${
                    player.name === 'You' ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="w-10 text-center">
                    <span
                      className={`font-bold ${
                        player.name === 'You' ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {player.rank}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          player.name === 'You'
                            ? 'bg-gradient-to-r from-blue-400 to-purple-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{player.name}</div>
                        <div className="text-sm text-gray-600">
                          Level {player.level} • {player.wins} wins
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{player.rating}</div>
                    <div className="text-sm text-gray-600">rating</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Friends Leaderboard */
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="space-y-4">
              {friends.map((friend, index) => (
                <div
                  key={friend.name}
                  className="flex items-center p-4 border border-gray-200 rounded-lg"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4">
                    {friend.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <div className="font-bold">{friend.name}</div>
                      <div
                        className={`ml-2 w-2 h-2 rounded-full ${
                          friend.online ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      ></div>
                      <span className="text-sm text-gray-600 ml-1">
                        {friend.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-gray-600">Rating: {friend.rating}</div>
                  </div>
                  <div className="space-x-2">
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                      Chat
                    </button>
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition">
                      Duel
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Friends Section */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-gray-700 mb-2">Add Friends</h3>
                <p className="text-gray-600 mb-4">
                  Invite friends to play and compete together!
                </p>
                <button className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:opacity-90 transition">
                  ✨ Invite Friends
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Your Rank Card */}
        <div className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-2">Your Position</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold mb-1">#6</div>
              <div className="text-blue-100">Global Ranking</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">1500</div>
              <div className="text-blue-100">Rating</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/queue')}
            className="w-full mt-4 bg-white text-blue-600 py-3 rounded-lg font-bold hover:bg-blue-50 transition"
          >
            🎮 Play More to Rank Up!
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardScreen;