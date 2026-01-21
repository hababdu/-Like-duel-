import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

// Components
import Navbar from './layout/Navbar';
import Sidebar from './layout/Sidebar';
import Footer from './layout/Footer';
import ConnectionStatus from './common/ConnectionStatus';
import NotificationCenter from './notifications/NotificationCenter';
import QuickActions from './layout/QuickActions';

// Icons
import {
  FaHome,
  FaGamepad,
  FaRobot,
  FaTrophy,
  FaUser,
  FaUsers,
  FaComments,
  FaChartBar,
  FaCog,
  FaBell,
  FaBars,
  FaTimes
} from 'react-icons/fa';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { isConnected, connectionStatus } = useSocket();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Check mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load unread notifications
  useEffect(() => {
    const loadNotifications = () => {
      const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
      const unread = notifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    };
    
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Navigation items
  const navItems = [
    { path: '/', label: 'Bosh sahifa', icon: <FaHome /> },
    { path: '/play', label: 'Multiplayer', icon: <FaGamepad /> },
    { path: '/bot', label: 'Bot bilan', icon: <FaRobot /> },
    { path: '/tournaments', label: 'Turnirlar', icon: <FaTrophy /> },
    { path: '/profile', label: 'Profil', icon: <FaUser />, auth: true },
    { path: '/friends', label: 'Do\'stlar', icon: <FaUsers />, auth: true },
    { path: '/chat', label: 'Chat', icon: <FaComments />, auth: true },
    { path: '/leaderboard', label: 'Reyting', icon: <FaChartBar /> },
    { path: '/admin', label: 'Admin', icon: <FaCog />, admin: true }
  ];

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Toggle notifications
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Handle navigation
  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Get current page title
  const getPageTitle = () => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    if (currentItem) return currentItem.label;
    
    if (location.pathname.startsWith('/game/')) return 'Oʻyin';
    if (location.pathname.startsWith('/tournament/')) return 'Turnir';
    return 'Tosh-Qaychi-Qogʻoz';
  };

  // Don't show layout for game rooms
  const isGameRoom = location.pathname.startsWith('/game/') || 
                     location.pathname.startsWith('/tournament/');

  if (isGameRoom) {
    return <Outlet />;
  }

  return (
    <div className="layout">
      {/* Navbar */}
      <Navbar
        title={getPageTitle()}
        user={user}
        isConnected={isConnected}
        unreadCount={unreadCount}
        onMenuClick={toggleSidebar}
        onNotificationsClick={toggleNotifications}
        onProfileClick={() => navigate('/profile')}
      />

      {/* Main content */}
      <div className="layout-container">
        {/* Sidebar for desktop */}
        {!isMobile && (
          <Sidebar
            items={navItems}
            currentPath={location.pathname}
            onNavigate={handleNavigation}
            isAuthenticated={isAuthenticated}
            user={user}
          />
        )}

        {/* Mobile sidebar */}
        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              className="mobile-sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
            >
              <motion.div
                className="mobile-sidebar"
                onClick={e => e.stopPropagation()}
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
              >
                <div className="sidebar-header">
                  <h3>Menyu</h3>
                  <button 
                    className="close-btn"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FaTimes />
                  </button>
                </div>
                
                <Sidebar
                  items={navItems}
                  currentPath={location.pathname}
                  onNavigate={handleNavigation}
                  isAuthenticated={isAuthenticated}
                  user={user}
                  mobile={true}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <main className="main-content">
          {/* Connection status */}
          <ConnectionStatus 
            isConnected={isConnected}
            status={connectionStatus}
          />

          {/* Page content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="page-content"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {/* Quick actions for mobile */}
          {isMobile && (
            <QuickActions
              onPlay={() => navigate('/play')}
              onBot={() => navigate('/bot')}
              onTournament={() => navigate('/tournaments')}
            />
          )}
        </main>

        {/* Notifications panel */}
        <AnimatePresence>
          {showNotifications && (
            <NotificationCenter
              onClose={() => setShowNotifications(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;