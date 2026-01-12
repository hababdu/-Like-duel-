// components/Layout.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  showNavbar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showNavbar = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState(3);
  
  // Top navbar navigation links
  const topNavItems = [
    { path: '/home', label: 'Home', icon: '🏠' },
    { path: '/queue', label: 'Queue', icon: '⚔️' },
    { path: '/leaderboard', label: 'Rank', icon: '🏆' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  const isActive = (path: string) => location.pathname === path;

  if (!showNavbar) {
    return <>{children}</>;
  }

  return (
    <div className="layout">
      {/* Top Header/Navbar */}
      <header className="top-header">
        <div className="header-left">
          <div className="app-logo" onClick={() => navigate('/home')}>
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Like Duel</span>
          </div>
        </div>
        
        <div className="header-center">
          <div className="nav-links">
            {topNavItems.map((item) => (
              <button
                key={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {isActive(item.path) && <span className="active-indicator"></span>}
              </button>
            ))}
          </div>
        </div>
        
        <div className="header-right">
          <button 
            className="notifications-btn"
            onClick={() => navigate('/notifications')}
          >
            <span className="bell-icon">🔔</span>
            {notifications > 0 && (
              <span className="notification-badge">{notifications}</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav">
        {topNavItems.map((item) => (
          <button
            key={item.path}
            className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;