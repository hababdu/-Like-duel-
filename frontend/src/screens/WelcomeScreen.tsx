// WelcomeScreen.tsx - TO'LIQ YANGI VERSIYA
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomeScreen.css';

// App.tsx bilan bir xil interface
interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId?: number;
  rating: number;
  coins: number;
  level: number;
  dailySuperLikes: number;
  wins?: number;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
}

interface WelcomeScreenProps {
  onUserAuthenticated?: (user: AppUser) => void;
}

const WelcomeScreen = ({ onUserAuthenticated }: WelcomeScreenProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const authenticateUser = async () => {
      // Check if user already exists in localStorage
      const savedUser = localStorage.getItem('like_duel_user');
      if (savedUser) {
        try {
          const parsedUser: AppUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // Automatically navigate to home if user exists
          setTimeout(() => {
            navigate('/home');
          }, 500);
          
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error parsing saved user:', error);
        }
      }

      // Mock authentication for development
      setTimeout(() => {
        const mockUser: AppUser = {
          id: `user-${Date.now()}`,
          name: 'Telegram User',
          username: 'telegramuser',
          telegramId: 123456789,
          rating: 1500,
          coins: 100,
          level: 1,
          dailySuperLikes: 3,
          wins: 0,
          bio: 'I love playing games!',
          gender: 'other'
        };
        
        setUser(mockUser);
        if (onUserAuthenticated) {
          onUserAuthenticated(mockUser);
        }
        setLoading(false);
      }, 1500);
    };

    authenticateUser();
  }, [onUserAuthenticated, navigate]);

  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(() => {
        setAnimationStep(prev => (prev + 1) % 4);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading, user]);

  const handleStartGame = () => {
    if (user) {
      navigate('/home');
    } else {
      alert('Please authenticate first');
    }
  };

  const handlePracticeMode = () => {
    navigate('/practice');
  };

  const handleQuickStart = () => {
    // Create a temporary guest user
    const guestUser: AppUser = {
      id: `guest-${Date.now()}`,
      name: 'Guest Player',
      rating: 1500,
      coins: 100,
      level: 1,
      dailySuperLikes: 3,
      wins: 0
    };
    
    setUser(guestUser);
    if (onUserAuthenticated) {
      onUserAuthenticated(guestUser);
    }
    
    setTimeout(() => {
      navigate('/home');
    }, 500);
  };

  const animationTexts = [
    'Find your perfect match!',
    'Like or Super Like?',
    'Earn coins with matches!',
    'Challenge friends!'
  ];

  if (loading) {
    return (
      <div className="welcome-loading">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring delay-1"></div>
            <div className="spinner-ring delay-2"></div>
            <div className="spinner-center">⚡</div>
          </div>
          <h2 className="loading-title">Connecting to Telegram</h2>
          <p className="loading-text">Please wait while we authenticate...</p>
          <div className="loading-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      {/* Animated Background */}
      <div className="welcome-background">
        <div className="bg-particle particle-1"></div>
        <div className="bg-particle particle-2"></div>
        <div className="bg-particle particle-3"></div>
        <div className="bg-particle particle-4"></div>
      </div>

      {/* Main Content */}
      <div className="welcome-content">
        {/* Header */}
        <div className="welcome-header">
          <div className="app-icon">
            <span className="app-icon-emoji">⚡</span>
          </div>
          <div className="app-title-section">
            <h1 className="app-title">Like Duel</h1>
            <p className="app-subtitle">The Ultimate Reaction Game</p>
          </div>
        </div>

        {/* Animated Tagline */}
        <div className="tagline-container">
          <div className="tagline-text">{animationTexts[animationStep]}</div>
          <div className="tagline-indicator">
            <div className={`indicator-dot ${animationStep === 0 ? 'active' : ''}`}></div>
            <div className={`indicator-dot ${animationStep === 1 ? 'active' : ''}`}></div>
            <div className={`indicator-dot ${animationStep === 2 ? 'active' : ''}`}></div>
            <div className={`indicator-dot ${animationStep === 3 ? 'active' : ''}`}></div>
          </div>
        </div>

        {user ? (
          <>
            {/* User Profile Card */}
            <div className="user-card">
              <div className="user-header">
                <div className="user-avatar-container">
                  <div className="user-avatar">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="user-badge">Lvl {user.level}</div>
                </div>
                <div className="user-info">
                  <h2 className="user-name">{user.name}</h2>
                  {user.username && (
                    <p className="user-username">@{user.username}</p>
                  )}
                  <div className="user-status">
                    <span className="status-dot"></span>
                    <span className="status-text">Ready to Duel</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-content">
                    <div className="stat-value">{user.rating}</div>
                    <div className="stat-label">Rating</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">🪙</div>
                  <div className="stat-content">
                    <div className="stat-value">{user.coins}</div>
                    <div className="stat-label">Coins</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <div className="stat-value">{user.wins || 0}</div>
                    <div className="stat-label">Wins</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">💖</div>
                  <div className="stat-content">
                    <div className="stat-value">{user.dailySuperLikes}</div>
                    <div className="stat-label">Super Likes</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button 
                  className="primary-button start-duel-button"
                  onClick={handleStartGame}
                >
                  <span className="button-icon">⚔️</span>
                  <span className="button-text">Enter App</span>
                  <span className="button-arrow">→</span>
                </button>
                
                <button 
                  className="secondary-button practice-button"
                  onClick={handlePracticeMode}
                >
                  <span className="button-icon">🎯</span>
                  <span className="button-text">Practice Mode</span>
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="quick-stat-icon">👥</span>
                <span className="quick-stat-value">245+</span>
                <span className="quick-stat-label">Online Players</span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-icon">⚡</span>
                <span className="quick-stat-value">12s</span>
                <span className="quick-stat-label">Avg. Match Time</span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-icon">🎮</span>
                <span className="quick-stat-value">1,542</span>
                <span className="quick-stat-label">Duels Today</span>
              </div>
            </div>

            {/* How to Play */}
            <div className="how-to-play">
              <h3 className="how-to-title">
                <span className="how-to-icon">🎮</span>
                How to Play
              </h3>
              <div className="steps-container">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <div className="step-title">Find Opponent</div>
                    <div className="step-description">Quick match with similar skill level</div>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <div className="step-title">Choose Reaction</div>
                    <div className="step-description">Like, Super Like, or Skip</div>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <div className="step-title">Earn Rewards</div>
                    <div className="step-description">Get coins for matches</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="authentication-card">
            <div className="auth-icon">🔐</div>
            <h2 className="auth-title">Welcome to Like Duel!</h2>
            <p className="auth-message">
              Start playing instantly or connect with Telegram for better experience
            </p>
            
            <div className="auth-options">
              <button 
                className="auth-button telegram-button"
                onClick={() => {
                  // Telegram login simulation
                  const mockUser: AppUser = {
                    id: `telegram-${Date.now()}`,
                    name: 'Telegram User',
                    username: 'telegramuser',
                    telegramId: Math.floor(Math.random() * 1000000),
                    rating: 1500,
                    coins: 200, // Telegram users get bonus coins
                    level: 1,
                    dailySuperLikes: 5, // Telegram users get more Super Likes
                    wins: 0
                  };
                  
                  setUser(mockUser);
                  if (onUserAuthenticated) {
                    onUserAuthenticated(mockUser);
                  }
                }}
              >
                <span className="auth-button-icon">📱</span>
                <span className="auth-button-text">Connect with Telegram</span>
              </button>
              
              <div className="auth-divider">
                <span className="divider-text">OR</span>
              </div>
              
              <button 
                className="auth-button guest-button"
                onClick={handleQuickStart}
              >
                <span className="auth-button-icon">🎮</span>
                <span className="auth-button-text">Continue as Guest</span>
              </button>
            </div>
            
            <div className="auth-warning">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">Guest progress is saved locally only</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="welcome-footer">
          <div className="footer-tagline">Built with ❤️ for Telegram Mini Apps</div>
          <div className="footer-features">
            <span className="feature-tag">⚡ Fast</span>
            <span className="feature-tag">🆓 Free</span>
            <span className="feature-tag">🎮 Fun</span>
            <span className="feature-tag">🔒 Secure</span>
          </div>
          <div className="footer-links">
            <button className="footer-link" onClick={() => navigate('/about')}>About</button>
            <span className="link-divider">•</span>
            <button className="footer-link" onClick={() => navigate('/help')}>Help</button>
            <span className="link-divider">•</span>
            <button className="footer-link" onClick={() => navigate('/privacy')}>Privacy</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;