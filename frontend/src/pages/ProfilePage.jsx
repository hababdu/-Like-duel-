import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import toast from 'react-hot-toast';

// Components
import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileStats from '../components/profile/ProfileStats';
import ProfileAchievements from '../components/profile/ProfileAchievements';
import ProfileFriends from '../components/profile/ProfileFriends';
import ProfileSettings from '../components/profile/ProfileSettings';
import EditProfileModal from '../components/profile/EditProfileModal';

// Icons
import {
  FaUser,
  FaChartBar,
  FaTrophy,
  FaUsers,
  FaCog,
  FaHistory,
  FaEdit,
  FaSignOutAlt,
  FaCoins,
  FaGem
} from 'react-icons/fa';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const { stats, achievements, gameHistory } = useGame();
  
  const [activeTab, setActiveTab] = useState('stats');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    username: '',
    bio: '',
    avatar: '',
    theme: 'dark',
    soundEnabled: true,
    notifications: true
  });

  // Load profile data
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        username: user.username || '',
        bio: user.bio || '',
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}&background=random`,
        theme: user.theme || 'dark',
        soundEnabled: user.soundEnabled !== false,
        notifications: user.notifications !== false
      });
    }
  }, [user]);

  // Handle logout
  const handleLogout = () => {
    if (window.confirm('Rostan ham chiqmoqchimisiz?')) {
      logout();
      navigate('/');
    }
  };

  // Handle profile update
  const handleUpdateProfile = async (updatedData) => {
    try {
      setIsLoading(true);
      
      await updateProfile(updatedData);
      
      toast.success('Profil muvaffaqiyatli yangilandi');
      setShowEditModal(false);
    } catch (error) {
      toast.error('Profilni yangilashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return <ProfileStats stats={stats} />;
        
      case 'achievements':
        return <ProfileAchievements achievements={achievements} />;
        
      case 'friends':
        return <ProfileFriends />;
        
      case 'history':
        return (
          <div className="game-history-tab">
            <h3>O'yinlar tarixi</h3>
            {gameHistory.length > 0 ? (
              <div className="history-list">
                {gameHistory.map(game => (
                  <div key={game.id} className="history-item">
                    {/* History item content */}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Hozircha o'yinlar yo'q</p>
              </div>
            )}
          </div>
        );
        
      case 'settings':
        return (
          <ProfileSettings
            settings={profileData}
            onUpdate={handleUpdateProfile}
          />
        );
        
      default:
        return <ProfileStats stats={stats} />;
    }
  };

  // Tab definitions
  const tabs = [
    { id: 'stats', label: 'Statistika', icon: <FaChartBar /> },
    { id: 'achievements', label: 'Yutuqlar', icon: <FaTrophy /> },
    { id: 'friends', label: 'Do\'stlar', icon: <FaUsers /> },
    { id: 'history', label: 'Tarix', icon: <FaHistory /> },
    { id: 'settings', label: 'Sozlamalar', icon: <FaCog /> }
  ];

  if (!user) {
    return (
      <div className="profile-not-authenticated">
        <div className="auth-prompt">
          <FaUser size={64} />
          <h2>Profilni ko'rish uchun kiring</h2>
          <p>Statistikangizni kuzatish va profilni sozlash uchun tizimga kiring</p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            Kirish
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="profile-page"
    >
      <div className="profile-container">
        {/* Profile header */}
        <ProfileHeader
          user={user}
          stats={stats}
          onEdit={() => setShowEditModal(true)}
          onLogout={handleLogout}
        />

        {/* Inventory */}
        <div className="inventory-section">
          <div className="inventory-item">
            <FaCoins />
            <div className="inventory-info">
              <span className="inventory-label">Coins</span>
              <span className="inventory-value">
                {user.coins || 1500}
              </span>
            </div>
          </div>
          
          <div className="inventory-item">
            <FaGem />
            <div className="inventory-info">
              <span className="inventory-label">Gems</span>
              <span className="inventory-value">
                {user.gems || 10}
              </span>
            </div>
          </div>
          
          <div className="inventory-item">
            <FaTrophy />
            <div className="inventory-info">
              <span className="inventory-label">Daraja</span>
              <span className="inventory-value">
                {stats.rank || 'Bronze'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="profile-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {renderTabContent()}
        </div>

        {/* Quick actions */}
        <div className="profile-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate('/play')}
          >
            O'ynash
          </button>
          
          <button
            className="btn-outline"
            onClick={() => navigate('/leaderboard')}
          >
            Reyting
          </button>
          
          <button
            className="btn-outline"
            onClick={() => navigate('/friends')}
          >
            Do'stlar
          </button>
        </div>
      </div>

      {/* Edit profile modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={profileData}
        onSave={handleUpdateProfile}
        isLoading={isLoading}
      />
    </motion.div>
  );
};

export default ProfilePage;