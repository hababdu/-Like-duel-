import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';

interface User {
  id: string;
  name: string;
  username?: string;
}

interface HomeScreenProps {
  user: User;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const navigate = useNavigate();
  
  // State
  const [stats, setStats] = useState({
    rating: 1520,
    coins: 250,
    level: 5,
    rank: 156,
    wins: 12,
    losses: 8,
    winRate: 60,
    dailySuperLikes: 3,
    streakDays: 7,
  });
  
  const [onlineCount, setOnlineCount] = useState(245);
  const [liveMatches, setLiveMatches] = useState([
    { id: 1, player1: 'Alex', player2: 'Sam', status: 'voting' },
    { id: 2, player1: 'Mike', player2: 'John', status: 'dueling' },
  ]);
  
  const [dailyQuests, setDailyQuests] = useState([
    { id: 1, title: 'Play 3 duels', progress: 1, total: 3, reward: 50, completed: false },
    { id: 2, title: 'Win 2 matches', progress: 0, total: 2, reward: 100, completed: false },
    { id: 3, title: 'Use Super Like', progress: 0, total: 1, reward: 30, completed: false },
  ]);

  // Quick actions
  const quickActions = [
    { id: 1, icon: '⚔️', label: 'Quick Duel', color: '#0088cc', path: '/queue' },
    { id: 2, icon: '👥', label: 'Friends', color: '#34a853', path: '/friends' },
    { id: 3, icon: '🎁', label: 'Daily Reward', color: '#f9a825', path: '/rewards' },
    { id: 4, icon: '🛒', label: 'Shop', color: '#e91e63', path: '/shop' },
  ];

  useEffect(() => {
    const socket = socketService.getSocket();
    
    if (socket) {
      socket.on('online_count', (count: number) => {
        setOnlineCount(count);
      });
      
      socket.on('live_match_update', (match: any) => {
        setLiveMatches(prev => {
          const updated = [...prev];
          const index = updated.findIndex(m => m.id === match.id);
          if (index !== -1) {
            updated[index] = { ...updated[index], status: match.status };
          } else {
            updated.push(match);
          }
          return updated.slice(-3);
        });
      });
    }
    
    return () => {
      if (socket) {
        socket.off('online_count');
        socket.off('live_match_update');
      }
    };
  }, []);

  const handleQuickDuel = () => {
    navigate('/queue');
  };

  const handleCompleteQuest = (questId: number) => {
    setDailyQuests(prev => prev.map(quest => 
      quest.id === questId && quest.progress < quest.total
        ? { ...quest, progress: quest.progress + 1 }
        : quest
    ));
  };

  const handleViewMatch = (matchId: number) => {
    navigate(`/spectate/${matchId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-telegram-brand/10 via-white to-purple-50/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-2xl text-white mr-3">
              ⚡
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Like Duel</h1>
              <p className="text-sm text-gray-600">{onlineCount} players online</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-yellow-50 px-3 py-2 rounded-lg">
              <span className="text-xl mr-2">🪙</span>
              <span className="font-bold text-yellow-600">{stats.coins}</span>
            </div>
            <div 
              className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              {user.name.charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome back, {user.name}! 👋</h2>
              <p className="text-gray-600 mt-1">
                Rating: <span className="font-bold text-yellow-600">{stats.rating}</span>
              </p>
            </div>
            <div className="flex items-center bg-orange-50 px-3 py-2 rounded-lg">
              <span className="text-xl mr-2">🔥</span>
              <span className="font-bold text-orange-600">Day {stats.streakDays}</span>
            </div>
          </div>
        </div>

        {/* Quick Duel Button */}
        <button 
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl text-lg font-bold hover:opacity-90 transition shadow-lg flex items-center justify-center"
          onClick={handleQuickDuel}
        >
          <span className="text-2xl mr-3">🎮</span>
          Start Quick Duel
        </button>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(action => (
            <button
              key={action.id}
              className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => navigate(action.path)}
              style={{ borderLeftColor: action.color, borderLeftWidth: '4px' }}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">{action.icon}</span>
                <span className="font-semibold text-gray-800">{action.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">🏆</span>
              <span className="text-sm text-gray-600">Rank</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">#{stats.rank}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">📈</span>
              <span className="text-sm text-gray-600">Level</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.level}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">💖</span>
              <span className="text-sm text-gray-600">Super Likes</span>
            </div>
            <div className="text-2xl font-bold text-pink-600">{stats.dailySuperLikes}</div>
          </div>
        </div>

        {/* Daily Quests */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <span className="text-2xl mr-2">🎯</span>
              Daily Quests
            </h3>
            <span className="text-sm text-gray-500">Reset in 4h</span>
          </div>
          
          <div className="space-y-4">
            {dailyQuests.map(quest => (
              <div key={quest.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-2">{quest.title}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">
                    {quest.progress}/{quest.total}
                  </span>
                </div>
                <button
                  className={`ml-4 px-4 py-2 rounded-lg font-semibold ${
                    quest.progress >= quest.total 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                      : 'bg-gray-100 text-gray-400'
                  }`}
                  onClick={() => handleCompleteQuest(quest.id)}
                  disabled={quest.progress < quest.total}
                >
                  +{quest.reward}🪙
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Matches */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <span className="text-2xl mr-2">🔥</span>
              Live Matches
            </h3>
            <button 
              className="text-blue-500 font-semibold text-sm"
              onClick={() => navigate('/leaderboard')}
            >
              View All
            </button>
          </div>
          
          <div className="space-y-3">
            {liveMatches.map(match => (
              <div 
                key={match.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                onClick={() => handleViewMatch(match.id)}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    {match.player1.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-800">{match.player1}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold mb-1 ${
                    match.status === 'dueling' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {match.status === 'dueling' ? '⚔️ Dueling' : '⏳ Voting'}
                  </span>
                  <span className="text-xs text-gray-500">VS</span>
                </div>
                
                <div className="flex items-center">
                  <span className="font-semibold text-gray-800 mr-3">{match.player2}</span>
                  <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    {match.player2.charAt(0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;