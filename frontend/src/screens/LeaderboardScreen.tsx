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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-md mx-auto py-6">
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-700 hover:text-gray-900 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <div className="w-16"></div>
        </header>

        {/* Enhanced Tabs */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-2 mb-6 border border-white/20">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-4 rounded-2xl text-center font-bold transition-all duration-200 transform ${
                activeTab === 'global'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl mr-2">🌍</span>
              <span>Global</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-4 rounded-2xl text-center font-bold transition-all duration-200 transform ${
                activeTab === 'friends'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl mr-2">👥</span>
              <span>Friends</span>
            </button>
          </div>
        </div>

        {activeTab === 'global' ? (
          /* Enhanced Global Leaderboard */
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/20">
            {/* Enhanced Top 3 Players */}
            <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-br from-amber-50/50 to-orange-50/50 border-b-2 border-amber-200/50">
              {globalPlayers.slice(0, 3).map((player) => (
                <div
                  key={player.rank}
                  className={`text-center p-5 rounded-2xl border-2 transition-all duration-200 transform hover:scale-105 ${
                    player.rank === 1
                      ? 'bg-gradient-to-br from-yellow-100 via-amber-100 to-yellow-50 border-amber-300 shadow-xl'
                      : player.rank === 2
                      ? 'bg-gradient-to-br from-gray-100 via-slate-100 to-gray-50 border-gray-300 shadow-lg'
                      : 'bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50 border-orange-300 shadow-lg'
                  }`}
                >
                  <div className="text-5xl mb-3">
                    {player.rank === 1 && '🥇'}
                    {player.rank === 2 && '🥈'}
                    {player.rank === 3 && '🥉'}
                  </div>
                  <div className="font-bold text-lg mb-2">{player.name}</div>
                  <div className="text-blue-600 font-bold text-lg flex items-center justify-center gap-1">
                    <span>{player.rating}</span>
                    <span>⭐</span>
                  </div>
                  <div className="text-xs text-gray-600 font-semibold mt-1">Level {player.level}</div>
                </div>
              ))}
            </div>

            {/* Enhanced Leaderboard List */}
            <div className="divide-y divide-gray-200">
              {globalPlayers.slice(3).map((player) => (
                <div
                  key={player.rank}
                  className={`flex items-center p-5 transition-all duration-200 hover:bg-gray-50 ${
                    player.name === 'You' ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="w-12 text-center">
                    <span
                      className={`font-black text-lg ${
                        player.name === 'You' ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {player.rank}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 text-lg font-bold shadow-md ${
                          player.name === 'You'
                            ? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white ring-2 ring-blue-300'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <div className={`font-bold text-lg ${player.name === 'You' ? 'text-blue-700' : 'text-gray-800'}`}>{player.name}</div>
                        <div className="text-sm text-gray-600 font-medium">
                          Level {player.level} • {player.wins} wins
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600 text-lg">{player.rating}</div>
                    <div className="text-xs text-gray-500 font-semibold">rating</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Enhanced Friends Leaderboard */
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border border-white/20">
            <div className="space-y-4">
              {friends.map((friend) => (
                <div
                  key={friend.name}
                  className="flex items-center p-5 border-2 border-gray-200 rounded-2xl hover:border-purple-300 transition-all duration-200 bg-gradient-to-br from-white to-gray-50/50 shadow-sm hover:shadow-md"
                >
                  <div className="relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4 shadow-lg ring-2 ring-white">
                      {friend.name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                      friend.online ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-bold text-lg text-gray-800">{friend.name}</div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        friend.online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {friend.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-gray-600 font-semibold flex items-center gap-1">
                      <span>Rating:</span>
                      <span className="text-blue-600">{friend.rating}</span>
                      <span>⭐</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 text-sm">
                      Chat
                    </button>
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 text-sm">
                      Duel
                    </button>
                  </div>
                </div>
              ))}

              {/* Enhanced Add Friends Section */}
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200 shadow-lg">
                <h3 className="font-bold text-gray-800 mb-2 text-lg">Add Friends</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  Invite friends to play and compete together!
                </p>
                <button className="w-full py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white rounded-2xl font-bold hover:from-green-600 hover:via-emerald-600 hover:to-green-700 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                  <span className="text-xl">✨</span>
                  <span>Invite Friends</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Your Rank Card */}
        <div className="mt-6 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 text-white rounded-3xl p-8 shadow-2xl border-2 border-white/20">
          <h3 className="text-2xl font-bold mb-6 text-center">Your Position</h3>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-5xl font-black mb-2">#6</div>
              <div className="text-blue-100 font-semibold">Global Ranking</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black mb-2">1500</div>
              <div className="text-blue-100 font-semibold flex items-center justify-end gap-1">
                <span>Rating</span>
                <span>⭐</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/queue')}
            className="w-full bg-white/95 backdrop-blur-sm text-blue-600 py-4 rounded-2xl font-bold hover:bg-white transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="text-xl">🎮</span>
            <span>Play More to Rank Up!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardScreen;