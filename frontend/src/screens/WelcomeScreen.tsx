// WelcomeScreen.tsx - TELEGRAM MINI APP VERSIYA
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomeScreen.css';

// Telegram Web App types
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

interface WebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    receiver?: TelegramUser;
    chat?: any;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  platform: string;
  colorScheme: string;
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isProgressVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    setText: (text: string) => void;
    setParams: (params: {
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: any, callback?: (button_id: string) => void) => void;
  showScanQrPopup: (params: any, callback?: (data: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (access: boolean) => void) => void;
  requestContact: (callback?: (contact: any) => void) => void;
  ready: () => void;
  expand: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: WebApp;
    };
  }
}

// App User Interface
interface AppUser {
  id: string;
  name: string;
  username?: string;
  telegramId: number;
  rating: number;
  coins: number;
  level: number;
  dailySuperLikes: number;
  wins?: number;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
  auth_date?: number;
}

interface WelcomeScreenProps {
  onUserAuthenticated?: (user: AppUser) => void;
}

const WelcomeScreen = ({ onUserAuthenticated }: WelcomeScreenProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [animationStep, setAnimationStep] = useState(0);
  const [isTelegramApp, setIsTelegramApp] = useState(false);
  const [telegramWebApp, setTelegramWebApp] = useState<WebApp | null>(null);

  // Telegram Web App'ni initializatsiya qilish
  useEffect(() => {
    const initTelegramWebApp = () => {
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        setTelegramWebApp(tg);
        setIsTelegramApp(true);
        
        // Web App'ni ready holatiga keltirish
        tg.ready();
        
        // Expand the Web App to full height
        tg.expand();
        
     
        
        console.log('📱 Telegram Web App detected:', {
          platform: tg.platform,
          user: tg.initDataUnsafe.user,
          colorScheme: tg.colorScheme,
          theme: tg.themeParams
        });
        
        return tg;
      }
      return null;
    };

    const tg = initTelegramWebApp();
    
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

      // If Telegram Web App is available, use Telegram user data
      if (tg && tg.initDataUnsafe.user) {
        const telegramUser = tg.initDataUnsafe.user;
        console.log('✅ Telegram user data received:', telegramUser);
        
        const appUser: AppUser = {
          id: `telegram-${telegramUser.id}`,
          name: `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}`,
          username: telegramUser.username,
          telegramId: telegramUser.id,
          rating: 1500,
          coins: telegramUser.is_premium ? 200 : 100, // Premium users get bonus coins
          level: 1,
          dailySuperLikes: telegramUser.is_premium ? 5 : 3, // Premium users get more Super Likes
          wins: 0,
          bio: 'Ready to duel! 🎮',
          gender: 'other',
          photo_url: telegramUser.photo_url,
          language_code: telegramUser.language_code,
          is_premium: telegramUser.is_premium,
          auth_date: tg.initDataUnsafe.auth_date
        };
        
        setUser(appUser);
        if (onUserAuthenticated) {
          onUserAuthenticated(appUser);
        }
        setLoading(false);
      } else {
        // Mock authentication for development (when not in Telegram)
        setTimeout(() => {
          const mockUser: AppUser = {
            id: `dev-${Date.now()}`,
            name: 'Test User',
            username: 'testuser',
            telegramId: 0,
            rating: 1500,
            coins: 100,
            level: 1,
            dailySuperLikes: 3,
            wins: 0,
            bio: 'Testing the app! 🎮',
            gender: 'other'
          };
          
          setUser(mockUser);
          if (onUserAuthenticated) {
            onUserAuthenticated(mockUser);
          }
          setLoading(false);
        }, 1500);
      }
    };

    authenticateUser();
  }, [onUserAuthenticated, navigate]);

  // Animation effect
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

  const handleTelegramLogin = () => {
    if (telegramWebApp) {
      // Show alert that we're already in Telegram
      telegramWebApp.showAlert('You are already authenticated via Telegram! 🎉', () => {
        handleStartGame();
      });
    } else {
      // Open Telegram bot for authentication
      const botUsername = 'LikeDuelBot'; // O'z bot username'ingizni qo'ying
      const appUrl = window.location.href;
      const telegramUrl = `https://t.me/${botUsername}?startapp=${btoa(appUrl)}`;
      window.open(telegramUrl, '_blank');
    }
  };

  const handleGuestLogin = () => {
    // Create a temporary guest user
    const guestUser: AppUser = {
      id: `guest-${Date.now()}`,
      name: 'Guest Player',
      telegramId: 0,
      rating: 1500,
      coins: 100,
      level: 1,
      dailySuperLikes: 3,
      wins: 0,
      bio: 'Playing as guest',
      gender: 'other'
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
            <div className="spinner-center">
              {isTelegramApp ? '📱' : '⚡'}
            </div>
          </div>
          <h2 className="loading-title">
            {isTelegramApp ? 'Connecting to Telegram...' : 'Loading Like Duel...'}
          </h2>
          <p className="loading-text">
            {isTelegramApp ? 'Getting your profile data...' : 'Please wait...'}
          </p>
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
            <span className="app-icon-emoji">{isTelegramApp ? '📱' : '⚡'}</span>
          </div>
          <div className="app-title-section">
            <h1 className="app-title">Like Duel</h1>
            <p className="app-subtitle">
              {isTelegramApp ? 'Telegram Mini App' : 'The Ultimate Reaction Game'}
            </p>
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
                  {user.photo_url ? (
                    <img 
                      src={user.photo_url} 
                      alt={user.name}
                      className="user-avatar-image"
                    />
                  ) : (
                    <div className="user-avatar">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="user-badge">Lvl {user.level}</div>
                  {user.is_premium && (
                    <div className="premium-badge">⭐</div>
                  )}
                </div>
                <div className="user-info">
                  <h2 className="user-name">{user.name}</h2>
                  {user.username && (
                    <p className="user-username">@{user.username}</p>
                  )}
                  <div className="user-status">
                    <span className="status-dot"></span>
                    <span className="status-text">
                      {isTelegramApp ? 'Connected via Telegram' : 'Ready to Duel'}
                      {user.is_premium && ' • Premium'}
                    </span>
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
                  <span className="button-icon">🎮</span>
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
            <div className="auth-icon">
              {isTelegramApp ? '📱' : '🔐'}
            </div>
            <h2 className="auth-title">
              {isTelegramApp ? 'Welcome to Like Duel!' : 'Get Started'}
            </h2>
            <p className="auth-message">
              {isTelegramApp 
                ? 'Your Telegram profile is ready to use!'
                : 'Start playing instantly or connect with Telegram for better experience'
              }
            </p>
            
            {!isTelegramApp && (
              <div className="auth-options">
                <button 
                  className="auth-button telegram-button"
                  onClick={handleTelegramLogin}
                >
                  <span className="auth-button-icon">📱</span>
                  <span className="auth-button-text">Connect with Telegram</span>
                </button>
                
                <div className="auth-divider">
                  <span className="divider-text">OR</span>
                </div>
                
                <button 
                  className="auth-button guest-button"
                  onClick={handleGuestLogin}
                >
                  <span className="auth-button-icon">🎮</span>
                  <span className="auth-button-text">Continue as Guest</span>
                </button>
              </div>
            )}
            
            <div className="auth-warning">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">
                {isTelegramApp 
                  ? 'Connected via Telegram Mini App'
                  : 'Guest progress is saved locally only'
                }
              </span>
            </div>
            
            {isTelegramApp && (
              <button 
                className="auth-button telegram-button"
                onClick={handleStartGame}
                style={{ marginTop: '1.5rem' }}
              >
                <span className="auth-button-icon">🎮</span>
                <span className="auth-button-text">Start Playing Now</span>
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="welcome-footer">
          <div className="footer-tagline">
            Built with ❤️ for Telegram Mini Apps
          </div>
          <div className="footer-features">
            <span className="feature-tag">⚡ Fast</span>
            <span className="feature-tag">🆓 Free</span>
            <span className="feature-tag">🎮 Fun</span>
            <span className="feature-tag">🔒 Secure</span>
          </div>
          {isTelegramApp && telegramWebApp && (
            <div className="telegram-info">
              <span className="telegram-platform">
                Platform: {telegramWebApp.platform}
              </span>
              <span className="telegram-theme">
                Theme: {telegramWebApp.colorScheme}
              </span>
            </div>
          )}
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