import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import './LeaderboardScreen.css';

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
    <div className="leaderboard-screen">
      {/* Header */}
      <div className="leaderboard-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          <span className="back-icon">←</span>
          <span className="back-text">Back</span>
        </button>
        <h1 className="leaderboard-title">
          <span className="title-icon">🏆</span>
          Leaderboard
        </h1>
        <div className="header-right"></div>
      </div>

      {/* Time Filter Tabs */}
      <div className="time-filter-container">
        <div className="time-filter-tabs">
          {(['daily', 'weekly', 'all'] as const).map(filter => (
            <button
              key={filter}
              className={`time-filter-button ${timeFilter === filter ? 'active' : ''}`}
              onClick={() => setTimeFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="main-tabs-container">
        <div className="main-tabs">
          <button
            className={`main-tab-button ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            <span className="tab-icon">🌍</span>
            <span className="tab-label">Global</span>
            {activeTab === 'global' && <span className="active-indicator"></span>}
          </button>
          <button
            className={`main-tab-button ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Friends</span>
            {activeTab === 'friends' && <span className="active-indicator"></span>}
          </button>
        </div>
      </div>

      <div className="leaderboard-content">
        {activeTab === 'global' ? (
          <>
            {/* Top 3 Podium */}
            <div className="podium-section">
              <h2 className="podium-title">Top Players</h2>
              <div className="podium-container">
                {/* 2nd Place */}
                <div className="podium-card second-place">
                  <div className="podium-medal">🥈</div>
                  <div className="podium-avatar">
                    {globalPlayers[1].name.charAt(0)}
                  </div>
                  <h3 className="podium-name">{globalPlayers[1].name}</h3>
                  <div className="podium-rating">
                    <span className="rating-value">{globalPlayers[1].rating}</span>
                    <span className="rating-icon">⭐</span>
                  </div>
                  <div className="podium-level">Level {globalPlayers[1].level}</div>
                  {globalPlayers[1].online && <div className="online-dot"></div>}
                </div>

                {/* 1st Place */}
                <div className="podium-card first-place">
                  <div className="podium-medal">🥇</div>
                  <div className="podium-avatar">
                    {globalPlayers[0].name.charAt(0)}
                  </div>
                  <h3 className="podium-name">{globalPlayers[0].name}</h3>
                  <div className="podium-rating">
                    <span className="rating-value">{globalPlayers[0].rating}</span>
                    <span className="rating-icon">⭐</span>
                  </div>
                  <div className="podium-level">Level {globalPlayers[0].level}</div>
                  {globalPlayers[0].online && <div className="online-dot"></div>}
                  <div className="crown-icon">👑</div>
                </div>

                {/* 3rd Place */}
                <div className="podium-card third-place">
                  <div className="podium-medal">🥉</div>
                  <div className="podium-avatar">
                    {globalPlayers[2].name.charAt(0)}
                  </div>
                  <h3 className="podium-name">{globalPlayers[2].name}</h3>
                  <div className="podium-rating">
                    <span className="rating-value">{globalPlayers[2].rating}</span>
                    <span className="rating-icon">⭐</span>
                  </div>
                  <div className="podium-level">Level {globalPlayers[2].level}</div>
                  {globalPlayers[2].online && <div className="online-dot"></div>}
                </div>
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="leaderboard-list-section">
              <h2 className="list-title">Global Rankings</h2>
              <div className="leaderboard-list">
                {globalPlayers.slice(3).map(player => (
                  <div 
                    key={player.rank} 
                    className={`leaderboard-item ${player.name === 'You' ? 'current-user' : ''}`}
                    onClick={() => handleViewProfile(player.name)}
                  >
                    <div className="item-rank">
                      <span className="rank-number">{player.rank}</span>
                      <span className="rank-trend">
                        {player.rank < 6 ? '↗' : player.rank > 8 ? '↘' : '➡'}
                      </span>
                    </div>
                    
                    <div className="item-user">
                      <div className="user-avatar">
                        {player.name.charAt(0)}
                        {player.online && <div className="user-online"></div>}
                      </div>
                      <div className="user-info">
                        <div className="user-name">
                          {player.name}
                          {player.name === 'You' && <span className="you-badge">You</span>}
                        </div>
                        <div className="user-stats">
                          <span className="user-level">Lvl {player.level}</span>
                          <span className="user-wins">{player.wins} wins</span>
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
            </div>
          </>
        ) : (
          <div className="friends-section">
            <h2 className="friends-title">Your Friends</h2>
            <div className="friends-list">
              {friends.map(friend => (
                <div key={friend.id} className="friend-item">
                  <div className="friend-avatar-container">
                    <div className="friend-avatar">
                      {friend.name.charAt(0)}
                    </div>
                    <div className={`status-indicator ${friend.online ? 'online' : 'offline'}`}></div>
                  </div>
                  
                  <div className="friend-info">
                    <div className="friend-name">{friend.name}</div>
                    <div className="friend-status">
                      {friend.online ? (
                        <span className="online-status">
                          <span className="status-dot"></span>
                          Online
                        </span>
                      ) : (
                        <span className="offline-status">
                          Last seen {friend.lastSeen}
                        </span>
                      )}
                    </div>
                    <div className="friend-rating">
                      <span className="rating-icon">⭐</span>
                      <span className="rating-value">{friend.rating}</span>
                    </div>
                  </div>
                  
                  <div className="friend-actions">
                    <button 
                      className="chat-button"
                      onClick={() => navigate(`/chat/${friend.name}`)}
                      title="Chat"
                    >
                      <span className="chat-icon">💬</span>
                    </button>
                    <button 
                      className={`duel-button ${friend.online ? 'enabled' : 'disabled'}`}
                      onClick={() => friend.online && handleChallengeFriend(friend.name)}
                      disabled={!friend.online}
                      title={friend.online ? "Challenge to Duel" : "Offline"}
                    >
                      <span className="duel-icon">⚔️</span>
                      <span className="duel-text">Duel</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add Friends Section */}
            <div className="add-friends-card">
              <div className="add-friends-content">
                <div className="add-friends-icon">👋</div>
                <div className="add-friends-text">
                  <h3>Add Friends</h3>
                  <p>Invite friends to play together!</p>
                </div>
              </div>
              <button 
                className="invite-button"
                onClick={() => alert('Invite feature coming soon!')}
              >
                <span className="invite-icon">📨</span>
                <span className="invite-text">Invite</span>
              </button>
            </div>
          </div>
        )}

        {/* Your Stats Card */}
        <div className="your-stats-card">
          <div className="stats-header">
            <h3 className="stats-title">
              <span className="stats-icon">📊</span>
              Your Stats
            </h3>
            <div className="stats-update">Updated just now</div>
          </div>
          <div className="stats-content">
            <div className="stat-column">
              <div className="stat-value">#6</div>
              <div className="stat-label">Global Rank</div>
              <div className="stat-change up">+2</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-column">
              <div className="stat-value">1520</div>
              <div className="stat-label">Rating</div>
              <div className="stat-change up">+45</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-column">
              <div className="stat-value">60%</div>
              <div className="stat-label">Win Rate</div>
              <div className="stat-change down">-5%</div>
            </div>
          </div>
          <button 
            className="play-more-button"
            onClick={() => navigate('/queue')}
          >
            <span className="play-icon">🎮</span>
            <span className="play-text">Play More to Rank Up!</span>
            <span className="arrow-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardScreen;