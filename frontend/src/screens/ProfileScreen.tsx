import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileScreen.css';

interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId?: number;
  rating?: number;
  coins?: number;
}

interface ProfileScreenProps {
  user: AppUser;
  onUserUpdate?: (updatedUser: AppUser) => void;
}

const ProfileScreen = ({ user: propUser, onUserUpdate }: ProfileScreenProps) => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState({
    name: propUser.name || 'Player',
    gender: 'other' as 'male' | 'female' | 'other',
    bio: 'I love playing games! Let\'s duel! 🎮',
    rating: propUser.rating || 1500,
    coins: propUser.coins || 100,
    level: 1,
    wins: 0,
    losses: 0,
    streakDays: 0,
    dailySuperLikes: 3,
  });
  
  const [isEditing, setIsEditing] = useState(false);

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
    { id: 4, title: 'Super Liker', icon: '💖', unlocked: false },
    { id: 5, title: 'Win Streak', icon: '🔥', unlocked: false },
    { id: 6, title: 'Socializer', icon: '👥', unlocked: false },
  ];

  const handleSave = () => {
    setIsEditing(false);
    
    if (onUserUpdate) {
      const updatedUser: AppUser = {
        ...propUser,
        name: user.name,
        rating: user.rating,
        coins: user.coins,
      };
      onUserUpdate(updatedUser);
    }
    
    console.log('Saving user changes:', user);
  };

  return (
    <div className="profile-screen">
      {/* Header */}
      <div className="profile-header">
        <button
          onClick={() => navigate('/')}
          className="back-button"
        >
          <span className="back-icon">←</span>
          <span className="back-text">Back</span>
        </button>
        <h1 className="profile-title">
          <span className="title-icon">👤</span>
          Profile
        </h1>
        <div className="header-right"></div>
      </div>

      {/* Main Content */}
      <div className="profile-content">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-header-section">
            <div className="avatar-container">
              <div className="profile-avatar">
                {user.name.charAt(0)}
              </div>
              <div className="online-badge"></div>
            </div>
            
            <div className="profile-info">
              {isEditing ? (
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className="profile-name-input"
                  autoFocus
                  placeholder="Enter your name"
                />
              ) : (
                <h2 className="profile-name">{user.name}</h2>
              )}
              
              <div className="profile-meta">
                <span className="level-badge">
                  <span className="level-icon">⭐</span>
                  Level {user.level}
                </span>
                <span className="meta-divider">•</span>
                <span className="status-text">Active Player</span>
              </div>
            </div>
            
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="edit-button"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {/* Telegram Username */}
          {propUser.username && (
            <div className="telegram-section">
              <span className="telegram-label">Telegram</span>
              <span className="telegram-username">@{propUser.username}</span>
            </div>
          )}

          {/* Bio Section */}
          <div className="bio-section">
            <h3 className="section-title">Bio</h3>
            {isEditing ? (
              <textarea
                value={user.bio}
                onChange={(e) => setUser({ ...user, bio: e.target.value })}
                className="bio-input"
                rows={3}
                placeholder="Tell us about yourself..."
              />
            ) : (
              <p className="bio-text">{user.bio}</p>
            )}
          </div>

          {/* Gender Selection */}
          <div className="gender-section">
            <h3 className="section-title">Gender</h3>
            <div className="gender-options">
              {(['male', 'female', 'other'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => isEditing && setUser({ ...user, gender })}
                  className={`gender-button ${user.gender === gender ? 'selected' : ''} ${!isEditing ? 'disabled' : ''}`}
                  disabled={!isEditing}
                  data-gender={gender}
                >
                  {gender === 'male' && '👨 Male'}
                  {gender === 'female' && '👩 Female'}
                  {gender === 'other' && '⚧ Other'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card rating-card">
              <div className="stat-icon rating-icon">⭐</div>
              <div className="stat-content">
                <div className="stat-value">{user.rating}</div>
                <div className="stat-label">Rating</div>
              </div>
            </div>
            
            <div className="stat-card coins-card">
              <div className="stat-icon coins-icon">🪙</div>
              <div className="stat-content">
                <div className="stat-value">{user.coins}</div>
                <div className="stat-label">Coins</div>
              </div>
            </div>
            
            <div className="stat-card winrate-card">
              <div className="stat-icon winrate-icon">📈</div>
              <div className="stat-content">
                <div className="stat-value">
                  {user.wins + user.losses > 0 
                    ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
                    : 0}%
                </div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
            
            <div className="stat-card superlikes-card">
              <div className="stat-icon superlikes-icon">💖</div>
              <div className="stat-content">
                <div className="stat-value">{user.dailySuperLikes}</div>
                <div className="stat-label">Super Likes</div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && (
            <button
              onClick={handleSave}
              className="save-button"
            >
              <span className="save-icon">💾</span>
              <span className="save-text">Save Changes</span>
            </button>
          )}
        </div>

        {/* Daily Quests */}
        <div className="quests-section">
          <div className="section-header">
            <h3 className="section-title">
              <span className="section-icon">🎯</span>
              Daily Quests
            </h3>
            <span className="quests-timer">Reset in 4h</span>
          </div>
          
          <div className="quests-list">
            {quests.map((quest) => (
              <div key={quest.id} className="quest-item">
                <div className="quest-info">
                  <h4 className="quest-title">{quest.title}</h4>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(quest.progress / quest.goal) * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {quest.progress}/{quest.goal}
                    </span>
                  </div>
                </div>
                <button
                  className={`reward-button ${quest.progress >= quest.goal ? 'completed' : 'incomplete'}`}
                  onClick={() => quest.progress >= quest.goal && console.log('Claim reward:', quest.reward)}
                  disabled={quest.progress < quest.goal}
                >
                  <span className="reward-amount">+{quest.reward}</span>
                  <span className="reward-icon">🪙</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="achievements-section">
          <div className="section-header">
            <h3 className="section-title">
              <span className="section-icon">🏆</span>
              Achievements
            </h3>
            <span className="achievements-count">
              {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </span>
          </div>
          
          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                title={achievement.unlocked ? achievement.title : 'Locked'}
              >
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-title">
                  {achievement.unlocked ? achievement.title : '???'}
                </div>
                <div className="achievement-status">
                  {achievement.unlocked ? '✓' : '🔒'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="action-button duel-button"
            onClick={() => navigate('/queue')}
          >
            <span className="action-icon">⚔️</span>
            <span className="action-text">Start Duel</span>
          </button>
          
          <button 
            className="action-button leaderboard-button"
            onClick={() => navigate('/leaderboard')}
          >
            <span className="action-icon">🏆</span>
            <span className="action-text">View Leaderboard</span>
          </button>
          
          <button 
            className="action-button settings-button"
            onClick={() => navigate('/settings')}
          >
            <span className="action-icon">⚙️</span>
            <span className="action-text">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;