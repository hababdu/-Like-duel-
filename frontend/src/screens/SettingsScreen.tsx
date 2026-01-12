import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SettingsScreen.css';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface SettingsItem {
  icon: IconComponent;
  label: string;
  type?: 'switch' | 'value' | 'link';
  value?: any;
  onChange?: () => void;
  color: string;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

// SVG icon komponentlari (Lucide icon o'rniga)
const BellIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const MoonIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

const GlobeIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const ShieldIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const HelpCircleIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const LogOutIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

const UsersIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const MailIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const Volume2Icon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
  </svg>
);

const EyeIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const KeyIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const SmartphoneIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

const FileTextIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const UserPlusIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const ChevronRightIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SettingsScreen = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    soundEffects: true,
    vibration: true,
    language: 'en',
    privacyMode: false,
    showOnlineStatus: true,
    autoMatchmaking: true,
  });

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    navigate('/');
  };

  const settingsSections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        { 
          icon: UsersIcon, 
          label: 'Friends', 
          value: '12', 
          color: '#0088cc',
          type: 'value',
          onChange: () => navigate('/friends')
        },
        { 
          icon: UserPlusIcon, 
          label: 'Invite Friends', 
          value: '', 
          color: '#34a853',
          type: 'link',
          onChange: () => alert('Invite friends feature coming soon!')
        },
        { 
          icon: MailIcon, 
          label: 'Invitations', 
          value: '3', 
          color: '#ff9800',
          type: 'value',
          onChange: () => navigate('/invitations')
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: BellIcon,
          label: 'Notifications',
          type: 'switch',
          value: settings.notifications,
          onChange: () => setSettings({ ...settings, notifications: !settings.notifications }),
          color: '#ffc107'
        },
        {
          icon: Volume2Icon,
          label: 'Sound Effects',
          type: 'switch',
          value: settings.soundEffects,
          onChange: () => setSettings({ ...settings, soundEffects: !settings.soundEffects }),
          color: '#e91e63'
        },
        {
          icon: EyeIcon,
          label: 'Show Online Status',
          type: 'switch',
          value: settings.showOnlineStatus,
          onChange: () => setSettings({ ...settings, showOnlineStatus: !settings.showOnlineStatus }),
          color: '#4caf50'
        },
        {
          icon: MoonIcon,
          label: 'Dark Mode',
          type: 'switch',
          value: settings.darkMode,
          onChange: () => setSettings({ ...settings, darkMode: !settings.darkMode }),
          color: '#673ab7'
        },
      ],
    },
    {
      title: 'Game Settings',
      items: [
        {
          icon: GlobeIcon,
          label: 'Language',
          value: 'English',
          color: '#2196f3',
          type: 'value',
          onChange: () => alert('Language selection coming soon!')
        },
        {
          icon: ShieldIcon,
          label: 'Auto Matchmaking',
          type: 'switch',
          value: settings.autoMatchmaking,
          onChange: () => setSettings({ ...settings, autoMatchmaking: !settings.autoMatchmaking }),
          color: '#795548'
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { 
          icon: ShieldIcon, 
          label: 'Privacy Policy', 
          value: '', 
          color: '#4caf50',
          type: 'link',
          onChange: () => window.open('/privacy-policy', '_blank')
        },
        { 
          icon: EyeIcon, 
          label: 'Privacy Mode', 
          type: 'switch', 
          value: settings.privacyMode, 
          onChange: () => setSettings({ ...settings, privacyMode: !settings.privacyMode }), 
          color: '#9c27b0' 
        },
        { 
          icon: KeyIcon, 
          label: 'Change Password', 
          value: '', 
          color: '#ff9800',
          type: 'link',
          onChange: () => alert('Change password feature coming soon!')
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { 
          icon: HelpCircleIcon, 
          label: 'Help & Support', 
          value: '', 
          color: '#2196f3',
          type: 'link',
          onChange: () => window.open('mailto:support@likeduel.com')
        },
        { 
          icon: FileTextIcon, 
          label: 'Terms of Service', 
          value: '', 
          color: '#6b6b6b',
          type: 'link',
          onChange: () => window.open('/terms', '_blank')
        },
        { 
          icon: SmartphoneIcon, 
          label: 'App Version', 
          value: '1.0.0', 
          color: '#9c27b0',
          type: 'value'
        },
      ],
    },
  ];

  return (
    <div className="settings-screen">
      {/* Header */}
      <div className="settings-header">
        <button
          onClick={() => navigate(-1)}
          className="back-button"
        >
          <span className="back-icon">←</span>
          <span className="back-text">Back</span>
        </button>
        <h1 className="settings-title">
          <span className="settings-icon">⚙️</span>
          Settings
        </h1>
        <div className="header-right"></div>
      </div>

      <div className="settings-content">
        {/* User Profile Section */}
        <div className="profile-section">
          <div className="profile-avatar">
            <div className="avatar-initial">U</div>
          </div>
          <div className="profile-info">
            <h3 className="profile-name">User</h3>
            <p className="profile-status">Online</p>
          </div>
          <button 
            className="edit-profile-button"
            onClick={() => navigate('/profile')}
          >
            Edit
          </button>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="settings-section">
            <h3 className="section-title">{section.title}</h3>
            <div className="section-items">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={itemIndex}
                    className={`settings-item ${item.type === 'switch' ? 'interactive' : ''}`}
                    onClick={item.onChange}
                  >
                    <div className="item-left">
                      <div 
                        className="item-icon-container"
                        style={{ '--icon-color': item.color } as React.CSSProperties}
                      >
                        <Icon size={20} className="item-icon" />
                      </div>
                      <span className="item-label">{item.label}</span>
                    </div>
                    
                    <div className="item-right">
                      {item.type === 'switch' ? (
                        <div className="switch-container">
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={() => {}}
                            className="switch-input"
                            readOnly
                          />
                          <div className={`switch ${item.value ? 'active' : ''}`}>
                            <div className="switch-handle"></div>
                          </div>
                        </div>
                      ) : item.type === 'value' || item.value ? (
                        <div className="item-value-container">
                          <span className="item-value">{item.value}</span>
                          <ChevronRightIcon size={16} className="chevron-icon" />
                        </div>
                      ) : (
                        <ChevronRightIcon size={16} className="chevron-icon" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="logout-button"
        >
          <LogOutIcon size={20} className="logout-icon" />
          <span className="logout-text">Log Out</span>
        </button>

        {/* App Info */}
        <div className="app-info">
          <div className="app-version">
            <SmartphoneIcon size={16} className="app-icon" />
            <span>Like Duel v1.0.0</span>
          </div>
          <p className="app-tagline">Made for Telegram Mini Apps</p>
          <div className="app-links">
            <button className="app-link" onClick={() => window.open('/privacy', '_blank')}>
              Privacy Policy
            </button>
            <span className="link-divider">•</span>
            <button className="app-link" onClick={() => window.open('/terms', '_blank')}>
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;