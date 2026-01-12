// src/screens/SettingsScreen.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Moon,
  Globe,
  Shield,
  HelpCircle,
  LogOut,
  UserPlus,
  Volume2,
  Eye,
  Key,
  Smartphone,
  Mail,
  Users,
  FileText,
  LucideIcon
} from 'lucide-react';

interface SettingsItem {
  icon: LucideIcon;
  label: string;
  type?: 'switch' | 'value';
  value?: any;
  onChange?: () => void;
  color: string;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const SettingsScreen = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    soundEffects: true,
    vibration: true,
    language: 'en',
    privacyMode: false,
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
        { icon: Users, label: 'Friends', value: '12', color: '#0088cc' },
        { icon: Mail, label: 'Invitations', value: '3', color: '#34a853' },
        { icon: FileText, label: 'Terms of Service', value: '', color: '#6b6b6b' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          type: 'switch',
          value: settings.notifications,
          onChange: () => setSettings({ ...settings, notifications: !settings.notifications }),
          color: '#ffc107'
        },
        {
          icon: Volume2,
          label: 'Sound Effects',
          type: 'switch',
          value: settings.soundEffects,
          onChange: () => setSettings({ ...settings, soundEffects: !settings.soundEffects }),
          color: '#e91e63'
        },
        {
          icon: Moon,
          label: 'Dark Mode',
          type: 'switch',
          value: settings.darkMode,
          onChange: () => setSettings({ ...settings, darkMode: !settings.darkMode }),
          color: '#673ab7'
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { icon: Shield, label: 'Privacy Policy', value: '', color: '#4caf50' },
        { 
          icon: Eye, 
          label: 'Privacy Mode', 
          type: 'switch', 
          value: settings.privacyMode, 
          onChange: () => setSettings({ ...settings, privacyMode: !settings.privacyMode }), 
          color: '#795548' 
        },
        { icon: Key, label: 'Change Password', value: '', color: '#ff9800' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help & Support', value: '', color: '#2196f3' },
        { icon: Smartphone, label: 'App Version', value: '1.0.0', color: '#9c27b0' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="sticky top-0 z-50 pt-safe">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e]/95 backdrop-blur-sm border-b border-[#2d2d2d]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center text-[#0088cc]"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="bg-[#1e1e1e] rounded-2xl border border-[#2d2d2d] overflow-hidden">
            <div className="p-3 border-b border-[#2d2d2d]">
              <h3 className="font-semibold text-white text-sm">{section.title}</h3>
            </div>
            
            <div className="divide-y divide-[#2d2d2d]">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={itemIndex}
                    className="flex items-center justify-between p-3 hover:bg-[#2d2d2d] transition-all active:bg-[#3d3d3d] cursor-pointer"
                    onClick={item.onChange}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        <Icon size={16} style={{ color: item.color }} />
                      </div>
                      <span className="font-medium text-white">{item.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {item.value && item.type !== 'switch' && (
                        <span className="text-sm text-[#6b6b6b]">{item.value}</span>
                      )}
                      
                      {item.type === 'switch' ? (
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={() => {}}
                            className="sr-only"
                            readOnly
                          />
                          <div 
                            className={`w-10 h-5 rounded-full transition-all ${
                              item.value ? 'bg-[#0088cc]' : 'bg-[#2d2d2d]'
                            }`}
                          >
                            <div 
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                item.value ? 'transform translate-x-5' : ''
                              }`}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#6b6b6b]">›</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="w-full bg-gradient-to-r from-[#e91e63] to-[#c2185b] text-white py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Log Out
        </button>

        <div className="text-center">
          <p className="text-xs text-[#6b6b6b]">
            Like Duel v1.0.0
          </p>
          <p className="text-xs text-[#6b6b6b] mt-1">
            Made for Telegram Mini Apps
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;