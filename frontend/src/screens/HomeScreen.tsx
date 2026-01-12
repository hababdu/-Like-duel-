import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import './HomeScreen.css';

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
    <div className="home-screen">
      {/* Header */}
      <div className="home-header">
        <div className="header-content">
          <div className="app-info">
            <div className="app-icon">
              <span className="app-icon-emoji">⚡</span>
            </div>
            <div className="app-title-section">
              <h1 className="app-title">Like Duel</h1>
              <p className="online-count">{onlineCount} players online</p>
            </div>
          </div>
          <div className="user-section">
            <div className="coins-badge">
              <span className="coin-icon">🪙</span>
              <span className="coin-amount">{stats.coins}</span>
            </div>
            <div 
              className="user-avatar"
              onClick={() => navigate('/profile')}
            >
              {user.name.charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="home-content">
        {/* Welcome Section */}
        <div className="welcome-card">
          <div className="welcome-content">
            <h2 className="welcome-title">Welcome back, {user.name}! 👋</h2>
            <p className="welcome-rating">
              Rating: <span className="rating-value">{stats.rating}</span>
            </p>
          </div>
          <div className="streak-badge">
            <span className="streak-icon">🔥</span>
            <span className="streak-text">Day {stats.streakDays}</span>
          </div>
        </div>

        {/* Quick Duel Button */}
        <button 
          className="quick-duel-button"
          onClick={handleQuickDuel}
        >
          <span className="button-icon">🎮</span>
          <span className="button-text">Start Quick Duel</span>
        </button>

        {/* Quick Actions Grid */}
        <div className="quick-actions-grid">
          {quickActions.map(action => (
            <button
              key={action.id}
              className="quick-action-button"
              onClick={() => navigate(action.path)}
              style={{ '--action-color': action.color } as React.CSSProperties}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">🏆</span>
              <span className="stat-title">Rank</span>
            </div>
            <div className="stat-value">#{stats.rank}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">📈</span>
              <span className="stat-title">Level</span>
            </div>
            <div className="stat-value">{stats.level}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">💖</span>
              <span className="stat-title">Super Likes</span>
            </div>
            <div className="stat-value super-likes">{stats.dailySuperLikes}</div>
          </div>
        </div>

        {/* Daily Quests */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
              <span className="title-icon">🎯</span>
              <h3>Daily Quests</h3>
            </div>
            <span className="section-subtitle">Reset in 4h</span>
          </div>
          
          <div className="quests-list">
            {dailyQuests.map(quest => (
              <div key={quest.id} className="quest-item">
                <div className="quest-info">
                  <h4 className="quest-title">{quest.title}</h4>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {quest.progress}/{quest.total}
                    </span>
                  </div>
                </div>
                <button
                  className={`reward-button ${quest.progress >= quest.total ? 'completed' : 'incomplete'}`}
                  onClick={() => handleCompleteQuest(quest.id)}
                  disabled={quest.progress < quest.total}
                >
                  <span className="reward-amount">+{quest.reward}</span>
                  <span className="reward-icon">🪙</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Matches */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
              <span className="title-icon">🔥</span>
              <h3>Live Matches</h3>
            </div>
            <button 
              className="view-all-button"
              onClick={() => navigate('/leaderboard')}
            >
              View All
            </button>
          </div>
          
          <div className="matches-list">
            {liveMatches.map(match => (
              <div 
                key={match.id} 
                className="match-item"
                onClick={() => handleViewMatch(match.id)}
              >
                <div className="player-info">
                  <div className="player-avatar player1">
                    {match.player1.charAt(0)}
                  </div>
                  <span className="player-name">{match.player1}</span>
                </div>
                
                <div className="match-status">
                  <span className={`status-badge ${match.status}`}>
                    {match.status === 'dueling' ? '⚔️' : '⏳'}
                    <span className="status-text">
                      {match.status === 'dueling' ? 'Dueling' : 'Voting'}
                    </span>
                  </span>
                  <span className="vs-text">VS</span>
                </div>
                
                <div className="player-info">
                  <span className="player-name">{match.player2}</span>
                  <div className="player-avatar player2">
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