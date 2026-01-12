import { useLocation, useNavigate } from 'react-router-dom';
import { TELEGRAM } from '../utils/constants';

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const navItems = [
    { path: '/', icon: '🏠', label: 'Home', active: location.pathname === '/' },
    { path: '/leaderboard', icon: '🏆', label: 'Rank', active: location.pathname === '/leaderboard' },
    { path: '/queue', icon: '⚔️', label: 'Duel', active: location.pathname === '/queue' },
    { path: '/profile', icon: '👤', label: 'Profile', active: location.pathname === '/profile' },
    { path: '/settings', icon: '⚙️', label: 'Settings', active: location.pathname === '/settings' },
  ];

  return (
    <nav className="telegram-bottom-nav">
      <div className="nav-container">
        {navItems.map(item => (
          <button
            key={item.path}
            className={`nav-item ${item.active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.active && <div className="nav-indicator"></div>}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNavigation;