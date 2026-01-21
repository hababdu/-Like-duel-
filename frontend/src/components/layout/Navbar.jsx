import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

// Icons
import {
  FaBars,
  FaBell,
  FaUser,
  FaHome,
  FaGamepad,
  FaTrophy,
  FaRobot,
  FaComments,
  FaUsers,
  FaChartBar,
  FaSignOutAlt
} from 'react-icons/fa';

const Navbar = ({ 
  title, 
  user, 
  isConnected, 
  unreadCount,
  onMenuClick,
  onNotificationsClick,
  onProfileClick 
}) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Bosh sahifa', icon: <FaHome /> },
    { path: '/play', label: 'Multiplayer', icon: <FaGamepad /> },
    { path: '/bot', label: 'Bot bilan', icon: <FaRobot /> },
    { path: '/tournaments', label: 'Turnirlar', icon: <FaTrophy /> },
    { path: '/leaderboard', label: 'Reyting', icon: <FaChartBar /> },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left side - Menu button and title */}
        <div className="navbar-left">
          <button 
            className="menu-btn"
            onClick={onMenuClick}
            aria-label="Menyu"
          >
            <FaBars />
          </button>
          
          <Link to="/" className="navbar-brand">
            <span className="logo-icon">🎮</span>
            <span className="logo-text">TQQ</span>
          </Link>
          
          <h1 className="navbar-title">{title}</h1>
        </div>

        {/* Center - Navigation links (desktop) */}
        <div className="navbar-center desktop-only">
          <ul className="nav-links">
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right side - User actions */}
        <div className="navbar-right">
          {/* Connection status */}
          <div className="connection-status">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {isConnected ? 'Ulandi' : 'Uzilgan'}
            </span>
          </div>

          {/* Notifications */}
          <button 
            className="notification-btn"
            onClick={onNotificationsClick}
            aria-label="Bildirishnomalar"
          >
            <FaBell />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User profile */}
          {user ? (
            <button 
              className="user-btn"
              onClick={onProfileClick}
              aria-label="Profil"
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.firstName}
                  className="user-avatar"
                />
              ) : (
                <div className="user-avatar-fallback">
                  {user.firstName?.charAt(0) || 'U'}
                </div>
              )}
              <span className="user-name">{user.firstName}</span>
            </button>
          ) : (
            <Link to="/" className="btn-login">
              <FaUser /> Kirish
            </Link>
          )}
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="mobile-bottom-nav mobile-only">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;