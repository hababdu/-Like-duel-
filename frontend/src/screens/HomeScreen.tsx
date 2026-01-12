// HomeScreen.tsx - TUZATILGAN VERSIYA
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import './HomeScreen.css';

interface User {
  id: string;
  name: string;
  username?: string;
  rating?: number;
  coins?: number;
  level?: number;
  dailySuperLikes?: number;
  wins?: number;
  losses?: number;
  streakDays?: number;
}

interface HomeScreenProps {
  user: User;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const navigate = useNavigate();
  
  // Default user agar user undefined bo'lsa
  const defaultUser = {
    id: 'guest',
    name: 'Guest',
    rating: 1500,
    coins: 100,
    level: 1,
    dailySuperLikes: 3,
    wins: 0,
    losses: 0,
    streakDays: 0,
  };

  // User undefined bo'lsa defaultUser ni ishlatamiz
  const currentUser = user || defaultUser;
  
  // State
  const [stats, setStats] = useState({
    rating: currentUser.rating || 1520,
    coins: currentUser.coins || 250,
    level: currentUser.level || 5,
    rank: 156,
    wins: currentUser.wins || 12,
    losses: currentUser.losses || 8,
    winRate: 60,
    dailySuperLikes: currentUser.dailySuperLikes || 3,
    streakDays: currentUser.streakDays || 7,
    matchesPlayed: 20,
    totalCoins: 1250,
  });
  
  const [onlineCount, setOnlineCount] = useState(245);
  const [liveMatches, setLiveMatches] = useState([
    { id: 1, player1: 'Alex', player2: 'Sam', status: 'voting' },
    { id: 2, player1: 'Mike', player2: 'John', status: 'dueling' },
    { id: 3, player1: 'Sarah', player2: 'Emma', status: 'waiting' },
  ]);
  
  const [dailyQuests, setDailyQuests] = useState([
    { id: 1, title: 'Play 3 duels', progress: 1, total: 3, reward: 50, completed: false },
    { id: 2, title: 'Win 2 matches', progress: 0, total: 2, reward: 100, completed: false },
    { id: 3, title: 'Use Super Like', progress: 0, total: 1, reward: 30, completed: false },
  ]);

  // Quick actions
  const quickActions = [
    { id: 1, icon: '⚔️', label: 'Quick Duel', color: '#0088cc', path: '/queue', description: 'Fast match' },
    { id: 2, icon: '👥', label: 'Friends', color: '#34a853', path: '/friends', description: 'Play together' },
    { id: 3, icon: '🎁', label: 'Daily Reward', color: '#f9a825', path: '/rewards', description: 'Claim bonus' },
    { id: 4, icon: '🛒', label: 'Shop', color: '#e91e63', path: '/shop', description: 'Buy items' },
  ];

  // Featured modes
  const featuredModes = [
    { id: 1, icon: '🎯', title: 'Practice', description: 'Train with bots', color: '#8b5cf6', path: '/practice' },
    { id: 2, icon: '🔥', title: 'Ranked', description: 'Compete for rating', color: '#ef4444', path: '/queue' },
    { id: 3, icon: '🤝', title: 'Friendly', description: 'Play with friends', color: '#10b981', path: '/friends' },
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
    
    // Add coins when quest is completed
    if (questId === 1) {
      setStats(prev => ({
        ...prev,
        coins: prev.coins + 50,
        totalCoins: prev.totalCoins + 50,
      }));
    }
  };

  const handleViewMatch = (matchId: number) => {
    navigate(`/spectate/${matchId}`);
  };

  const handleQuickAction = (path: string) => {
    navigate(path);
  };

  const getWinRate = () => {
    const totalMatches = stats.wins + stats.losses;
    return totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
  };

  // User avatar uchun xavfsiz funksiya
  const getUserAvatar = () => {
    if (!currentUser.name) return 'G';
    return currentUser.name.charAt(0);
  };

  return (
    <div className="home-screen">
      {/* Main Content */}
      <div className="home-content">
        {/* Welcome Section */}
        <div className="welcome-card">
          <div className="welcome-content">
            <div className="user-info-header">
              <div className="user-avatar-large">
                {getUserAvatar()}
              </div>
              <div className="user-details">
                <h2 className="welcome-title">Welcome back, {currentUser.name}! 👋</h2>
                <div className="user-stats-row">
                  <span className="user-stat">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-value">{stats.rating}</span>
                    <span className="stat-label">Rating</span>
                  </span>
                  <span className="user-stat">
                    <span className="stat-icon">🏆</span>
                    <span className="stat-value">#{stats.rank}</span>
                    <span className="stat-label">Rank</span>
                  </span>
                  <span className="user-stat">
                    <span className="stat-icon">📈</span>
                    <span className="stat-value">{getWinRate()}%</span>
                    <span className="stat-label">Win Rate</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="streak-badge">
            <span className="streak-icon">🔥</span>
            <span className="streak-text">Day {stats.streakDays}</span>
            <span className="streak-desc">Login Streak</span>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="stats-summary">
          <div className="stat-item-summary">
            <div className="stat-icon-summary">🪙</div>
            <div className="stat-details-summary">
              <div className="stat-value-summary">{stats.coins}</div>
              <div className="stat-label-summary">Coins</div>
            </div>
          </div>
          <div className="stat-item-summary">
            <div className="stat-icon-summary">💖</div>
            <div className="stat-details-summary">
              <div className="stat-value-summary">{stats.dailySuperLikes}</div>
              <div className="stat-label-summary">Super Likes</div>
            </div>
          </div>
          <div className="stat-item-summary">
            <div className="stat-icon-summary">🎮</div>
            <div className="stat-details-summary">
              <div className="stat-value-summary">{stats.matchesPlayed}</div>
              <div className="stat-label-summary">Matches</div>
            </div>
          </div>
        </div>

        {/* Quick Duel Button */}
        <button 
          className="quick-duel-button"
          onClick={handleQuickDuel}
        >
          <span className="button-icon">🎮</span>
          <div className="button-content">
            <span className="button-text">Start Quick Duel</span>
            <span className="button-subtext">Find opponent in seconds</span>
          </div>
          <span className="button-arrow">→</span>
        </button>

        {/* Featured Game Modes */}
        <div className="featured-modes">
          <h3 className="section-title-home">
            <span className="title-icon">⚡</span>
            Game Modes
          </h3>
          <div className="modes-grid">
            {featuredModes.map(mode => (
              <div
                key={mode.id}
                className="mode-card"
                onClick={() => handleQuickAction(mode.path)}
                style={{ '--mode-color': mode.color } as React.CSSProperties}
              >
                <div className="mode-icon">{mode.icon}</div>
                <div className="mode-content">
                  <h4 className="mode-title">{mode.title}</h4>
                  <p className="mode-description">{mode.description}</p>
                </div>
                <div className="mode-action">
                  <span className="play-icon">▶</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="quick-actions-grid">
          {quickActions.map(action => (
            <button
              key={action.id}
              className="quick-action-button"
              onClick={() => handleQuickAction(action.path)}
              style={{ '--action-color': action.color } as React.CSSProperties}
            >
              <span className="action-icon">{action.icon}</span>
              <div className="action-content">
                <span className="action-label">{action.label}</span>
                <span className="action-description">{action.description}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Live Matches */}
        <div className="live-matches-section">
          <div className="section-header-home">
            <div className="section-title-with-icon">
              <span className="section-icon-home">🔥</span>
              <h3>Live Matches</h3>
            </div>
            <div className="online-status">
              <span className="status-dot"></span>
              <span className="online-count">{onlineCount} online</span>
            </div>
          </div>
          
          <div className="matches-list">
            {liveMatches.map(match => (
              <div 
                key={match.id} 
                className="match-item"
                onClick={() => handleViewMatch(match.id)}
              >
                <div className="match-players">
                  <div className="player-info-match">
                    <div className="player-avatar-match player1">
                      {match.player1?.charAt(0) || 'A'}
                    </div>
                    <span className="player-name-match">{match.player1}</span>
                  </div>
                  
                  <div className="match-center">
                    <div className={`match-status-indicator ${match.status}`}>
                      {match.status === 'dueling' ? '⚔️' : match.status === 'voting' ? '⏳' : '⌛'}
                    </div>
                    <span className="vs-text-match">VS</span>
                  </div>
                  
                  <div className="player-info-match">
                    <span className="player-name-match">{match.player2}</span>
                    <div className="player-avatar-match player2">
                      {match.player2?.charAt(0) || 'B'}
                    </div>
                  </div>
                </div>
                <div className="match-footer">
                  <span className="match-type">Quick Duel</span>
                  <span className="match-duration">2:30</span>
                </div>
              </div>
            ))}
          </div>
          
          <button 
            className="watch-all-button"
            onClick={() => navigate('/spectate')}
          >
            <span className="watch-icon">👁️</span>
            <span className="watch-text">Watch All Matches</span>
          </button>
        </div>

        {/* Daily Quests */}
        <div className="daily-quests-section">
          <div className="section-header-home">
            <div className="section-title-with-icon">
              <span className="section-icon-home">🎯</span>
              <h3>Daily Quests</h3>
            </div>
            <span className="quests-reset">Reset in 4h</span>
          </div>
          
          <div className="quests-grid">
            {dailyQuests.map(quest => (
              <div key={quest.id} className="quest-card">
                <div className="quest-header">
                  <div className="quest-icon">🎮</div>
                  <div className="quest-info-compact">
                    <h4 className="quest-title-compact">{quest.title}</h4>
                    <div className="quest-progress-compact">
                      <span className="progress-text-compact">
                        {quest.progress}/{quest.total}
                      </span>
                      <div className="progress-bar-compact">
                        <div 
                          className="progress-fill-compact"
                          style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className={`claim-button ${quest.progress >= quest.total ? 'active' : 'inactive'}`}
                  onClick={() => handleCompleteQuest(quest.id)}
                  disabled={quest.progress < quest.total}
                >
                  <span className="claim-icon">🪙</span>
                  <span className="claim-amount">+{quest.reward}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Player Stats Cards */}
        <div className="player-stats-cards">
          <div className="stats-card">
            <div className="stats-card-header">
              <div className="stats-card-icon">📊</div>
              <h4 className="stats-card-title">Performance</h4>
            </div>
            <div className="stats-card-content">
              <div className="stat-row-home">
                <span className="stat-label-home">Win Rate</span>
                <span className="stat-value-home">{getWinRate()}%</span>
              </div>
              <div className="stat-row-home">
                <span className="stat-label-home">Best Streak</span>
                <span className="stat-value-home">5 wins</span>
              </div>
              <div className="stat-row-home">
                <span className="stat-label-home">Avg. Match Time</span>
                <span className="stat-value-home">18s</span>
              </div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stats-card-header">
              <div className="stats-card-icon">💰</div>
              <h4 className="stats-card-title">Earnings</h4>
            </div>
            <div className="stats-card-content">
              <div className="stat-row-home">
                <span className="stat-label-home">Total Coins</span>
                <span className="stat-value-home">{stats.totalCoins}</span>
              </div>
              <div className="stat-row-home">
                <span className="stat-label-home">Today's Earnings</span>
                <span className="stat-value-home">+125</span>
              </div>
              <div className="stat-row-home">
                <span className="stat-label-home">Weekly Rewards</span>
                <span className="stat-value-home">500</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="quick-tips-section">
          <div className="tips-header">
            <span className="tips-icon">💡</span>
            <h3 className="tips-title">Quick Tips</h3>
          </div>
          <div className="tips-content">
            <div className="tip-item-home">
              <span className="tip-bullet-home">✓</span>
              <span className="tip-text-home">Use Super Likes for better match rewards</span>
            </div>
            <div className="tip-item-home">
              <span className="tip-bullet-home">✓</span>
              <span className="tip-text-home">Complete daily quests for bonus coins</span>
            </div>
            <div className="tip-item-home">
              <span className="tip-bullet-home">✓</span>
              <span className="tip-text-home">Higher rating = better matchmaking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;