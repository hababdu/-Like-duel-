import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import { TELEGRAM } from '../utils/constants';

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
    { id: 1, icon: '⚔️', label: 'Quick Duel', color: TELEGRAM.BRAND_BLUE, path: '/queue' },
    { id: 2, icon: '👥', label: 'Friends', color: TELEGRAM.ONLINE, path: '/friends' },
    { id: 3, icon: '🎁', label: 'Daily Reward', color: TELEGRAM.ACCENT_YELLOW, path: '/rewards' },
    { id: 4, icon: '🛒', label: 'Shop', color: TELEGRAM.ACCENT_PINK, path: '/shop' },
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
          return updated.slice(-3); // Keep only last 3 matches
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
    // Navigate to match spectator view
    navigate(`/spectate/${matchId}`);
  };

  return (
    <div className="telegram-screen">
      {/* Header */}
      <div className="telegram-header">
        <div className="header-left">
          <div className="app-icon" style={{ background: TELEGRAM.GRADIENT_BLUE }}>
            ⚡
          </div>
          <div>
            <h1 className="app-title">Like Duel</h1>
            <p className="online-count">{onlineCount} players online</p>
          </div>
        </div>
        <div className="header-right">
          <div className="coins-badge">
            <span className="coin-icon">🪙</span>
            <span className="coin-count">{stats.coins}</span>
          </div>
          <div 
            className="user-avatar"
            style={{ background: TELEGRAM.GRADIENT_BLUE }}
            onClick={() => navigate('/profile')}
          >
            {user.name.charAt(0)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="telegram-content">
        {/* Welcome Section */}
        <div className="welcome-card">
          <div className="welcome-content">
            <h2>Welcome back, {user.name}! 👋</h2>
            <p className="rating-display">
              Rating: <span style={{ color: TELEGRAM.ACCENT_YELLOW }}>{stats.rating}</span>
            </p>
          </div>
          <div className="streak-badge">
            <span className="streak-icon">🔥</span>
            <span className="streak-days">Day {stats.streakDays}</span>
          </div>
        </div>

        {/* Quick Duel Button */}
        <button 
          className="primary-button"
          onClick={handleQuickDuel}
          style={{ background: TELEGRAM.GRADIENT_BLUE }}
        >
          <span className="button-icon">🎮</span>
          Start Quick Duel
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
            <div className="stat-value" style={{ color: TELEGRAM.ACCENT_PINK }}>
              {stats.dailySuperLikes}
            </div>
          </div>
        </div>

        {/* Daily Quests */}
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">
              <span className="title-icon">🎯</span>
              Daily Quests
            </h3>
            <span className="section-subtitle">Reset in 4h</span>
          </div>
          
          <div className="quests-list">
            {dailyQuests.map(quest => (
              <div key={quest.id} className="quest-item">
                <div className="quest-info">
                  <h4 className="quest-title">{quest.title}</h4>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${(quest.progress / quest.total) * 100}%`,
                        background: TELEGRAM.GRADIENT_BLUE 
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {quest.progress}/{quest.total}
                  </span>
                </div>
                <button
                  className={`reward-button ${quest.progress >= quest.total ? 'completed' : ''}`}
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
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">
              <span className="title-icon">🔥</span>
              Live Matches
            </h3>
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
                  <div className="player-avatar" style={{ background: TELEGRAM.GRADIENT_BLUE }}>
                    {match.player1.charAt(0)}
                  </div>
                  <span className="player-name">{match.player1}</span>
                </div>
                
                <div className="match-status">
                  <span className={`status-badge ${match.status}`}>
                    {match.status === 'dueling' ? '⚔️' : '⏳'}
                  </span>
                  <span className="vs-text">VS</span>
                </div>
                
                <div className="player-info">
                  <span className="player-name">{match.player2}</span>
                  <div className="player-avatar" style={{ background: TELEGRAM.GRADIENT_PINK }}>
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