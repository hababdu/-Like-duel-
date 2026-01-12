import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TELEGRAM } from '../utils/constants';
import { socketService } from '../utils/socket';
import { blob } from 'stream/consumers';

const LeaderboardScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'all'>('daily');

  // Global leaderboard data
  const globalPlayers = [
    { rank: 1, name: 'ProPlayer', rating: 2450, wins: 156, level: 25, online: true },
    { rank: 2, name: 'DuelMaster', rating: 2310, wins: 142, level: 22, online: true },
    { rank: 3, name: 'LikeKing', rating: 2250, wins: 138, level: 21, online: false },
    { rank: 4, name: 'MatchMaker', rating: 2180, wins: 129, level: 20, online: true },
    { rank: 5, name: 'SwiftChoice', rating: 2100, wins: 121, level: 19, online: true },
    { rank: 6, name: 'You', rating: 1520, wins: 12, level: 5, online: true },
    { rank: 7, name: 'QuickWin', rating: 1950, wins: 98, level: 17, online: false },
    { rank: 8, name: 'SuperLiker', rating: 1870, wins: 87, level: 16, online: true },
    { rank: 9, name: 'DuelDude', rating: 1750, wins: 76, level: 14, online: true },
    { rank: 10, name: 'NewPlayer', rating: 1520, wins: 12, level: 3, online: false },
  ];

  // Friends data
  const friends = [
    { id: 1, name: 'Alex', rating: 1800, online: true, lastSeen: '2 min ago' },
    { id: 2, name: 'Sam', rating: 1650, online: false, lastSeen: '1 hour ago' },
    { id: 3, name: 'Jordan', rating: 1580, online: true, lastSeen: 'online' },
    { id: 4, name: 'Taylor', rating: 1420, online: true, lastSeen: 'online' },
    { id: 5, name: 'Casey', rating: 1350, online: false, lastSeen: '3 hours ago' },
  ];

  const handleChallengeFriend = (friendName: string) => {
    socketService.getSocket()?.emit('challenge_friend', { friendName });
    alert(`Challenge sent to ${friendName}!`);
  };

  const handleViewProfile = (playerName: string) => {
    navigate(`/player/${playerName}`);
  };

  return (
    <div className="telegram-screen">
      {/* Header */}
      <div className="telegram-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          ←
        </button>
        <h1 className="screen-title">Leaderboard</h1>
        <div className="header-placeholder"></div>
      </div>

      {/* Time Filter Tabs */}
      <div className="time-filter-tabs">
        {(['daily', 'weekly', 'all'] as const).map(filter => (
          <button
            key={filter}
            className={`time-filter-button ${timeFilter === filter ? 'active' : ''}`}
            onClick={() => setTimeFilter(filter)}
            style={{ 
              background: timeFilter === filter ? TELEGRAM.BRAND_BLUE : 'transparent',
              color: timeFilter === filter ? '#fff' : TELEGRAM.TEXT_SECONDARY
            }}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Tabs */}
      <div className="main-tabs">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            <span className="tab-icon">🌍</span>
            <span className="tab-label">Global</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Friends</span>
          </button>
        </div>
      </div>

      <div className="telegram-content">
        {activeTab === 'global' ? (
          <>
            {/* Top 3 Podium */}
            <div className="podium-container">
              {globalPlayers.slice(0, 3).map(player => (
                <div 
                  key={player.rank} 
                  className={`podium-card ${player.rank === 1 ? 'first' : player.rank === 2 ? 'second' : 'third'}`}
                >
                  <div className="podium-rank">
                    {player.rank === 1 && '🥇'}
                    {player.rank === 2 && '🥈'}
                    {player.rank === 3 && '🥉'}
                  </div>
                  <div className="podium-avatar">
                    {player.name.charAt(0)}
                  </div>
                  <h3 className="podium-name">{player.name}</h3>
                  <div className="podium-rating">
                    <span className="rating-value">{player.rating}</span>
                    <span className="rating-icon">⭐</span>
                  </div>
                  <div className="podium-level">Level {player.level}</div>
                  {player.online && <div className="online-dot"></div>}
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="leaderboard-list">
              {globalPlayers.slice(3).map(player => (
                <div 
                  key={player.rank} 
                  className={`leaderboard-item ${player.name === 'You' ? 'current-user' : ''}`}
                  onClick={() => handleViewProfile(player.name)}
                >
                  <div className="item-rank">{player.rank}</div>
                  
                  <div className="item-user">
                    <div 
                      className="user-avatar"
                      style={{ 
                        background: player.name === 'You' 
                          ? TELEGRAM.GRADIENT_BLUE 
                          : TELEGRAM.BG_TERTIARY 
                      }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <div className="user-info">
                      <div className="user-name">
                        {player.name}
                        {player.online && <span className="online-indicator"></span>}
                      </div>
                      <div className="user-stats">
                        Level {player.level} • {player.wins} wins
                      </div>
                    </div>
                  </div>
                  
                  <div className="item-rating">
                    <div className="rating-value">{player.rating}</div>
                    <div className="rating-label">rating</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="friends-list">
            {friends.map(friend => (
              <div key={friend.id} className="friend-item">
                <div className="friend-avatar-container">
                  <div 
                    className="friend-avatar"
                    style={{ background: TELEGRAM.GRADIENT_BLUE }}
                  >
                    {friend.name.charAt(0)}
                  </div>
                  <div className={`status-dot ${friend.online ? 'online' : 'offline'}`}></div>
                </div>
                
                <div className="friend-info">
                  <div className="friend-name">{friend.name}</div>
                  <div className="friend-status">
                    {friend.online ? 'Online' : `Last seen ${friend.lastSeen}`}
                  </div>
                  <div className="friend-rating">
                    Rating: <span style={{ color: TELEGRAM.ACCENT_YELLOW }}>{friend.rating}</span>
                  </div>
                </div>
                
                <div className="friend-actions">
                  <button 
                    className="chat-button"
                    onClick={() => navigate(`/chat/${friend.name}`)}
                  >
                    💬
                  </button>
                  <button 
                    className="duel-button"
                    onClick={() => handleChallengeFriend(friend.name)}
                    style={{ 
                      background: friend.online ? TELEGRAM.BRAND_BLUE : TELEGRAM.BG_TERTIARY,
                      color: friend.online ? '#fff' : TELEGRAM.TEXT_TERTIARY
                    }}
                    disabled={!friend.online}
                  >
                    ⚔️
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add Friends Section */}
            <div className="add-friends-card">
              <div className="add-friends-content">
                <h3>👋 Add Friends</h3>
                <p>Invite friends to play together!</p>
              </div>
              <button 
                className="invite-button"
                style={{ background: TELEGRAM.BRAND_BLUE  }}
              >
                Invite Friends
              </button>
            </div>
          </div>
        )}

        {/* Your Stats Card */}
        <div className="your-stats-card">
          <div className="stats-header">
            <h3>Your Position</h3>
          </div>
          <div className="stats-content">
            <div className="stat-column">
              <div className="stat-value">#6</div>
              <div className="stat-label">Global Rank</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-column">
              <div className="stat-value" style={{ color: TELEGRAM.ACCENT_YELLOW }}>
                1520
              </div>
              <div className="stat-label">Rating</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-column">
              <div className="stat-value" style={{ color: TELEGRAM.ACCENT_PINK }}>
                60%
              </div>
              <div className="stat-label">Win Rate</div>
            </div>
          </div>
          <button 
            className="play-more-button"
            onClick={() => navigate('/queue')}
            style={{ background: TELEGRAM.GRADIENT_BLUE }}
          >
            🎮 Play More to Rank Up!
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardScreen;