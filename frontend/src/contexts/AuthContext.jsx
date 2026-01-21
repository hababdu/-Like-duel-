import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize Telegram Mini App authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if Telegram WebApp is available
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          
          // Initialize Telegram WebApp
          tg.ready();
          tg.expand();
          
          // Get user data from Telegram
          const initData = tg.initData;
          const userData = tg.initDataUnsafe.user;
          
          if (userData) {
            // Authenticate with server
            await authenticateTelegram(initData);
          } else {
            // User not authenticated in Telegram
            setIsAuthenticated(false);
          }
        } else {
          // Not in Telegram, check localStorage
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            setUser(JSON.parse(savedUser));
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Authenticate with Telegram
  const authenticateTelegram = async (initData) => {
    try {
      const deviceInfo = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          orientation: window.screen.orientation?.type
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser: {
          name: navigator.userAgentData?.brands?.[0]?.brand || 'Unknown',
          version: navigator.userAgentData?.brands?.[0]?.version || 'Unknown'
        }
      };

      // Store initData in localStorage for WebSocket auth
      localStorage.setItem('telegramInitData', initData);
      localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));

      // The actual authentication will happen through WebSocket
      // We'll just set the user data from Telegram for now
      const tg = window.Telegram.WebApp;
      const userData = tg.initDataUnsafe.user;
      
      const user = {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        languageCode: userData.language_code,
        isPremium: userData.is_premium || false,
        photoUrl: userData.photo_url,
        authDate: userData.auth_date,
        hash: userData.hash
      };
      
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success(`Xush kelibsiz, ${user.firstName}!`);
      
    } catch (error) {
      console.error('Telegram authentication error:', error);
      toast.error('Autentifikatsiya muvaffaqiyatsiz');
    }
  };

  // Manual login (for testing outside Telegram)
  const login = async (username, password) => {
    try {
      // Mock authentication for development
      const mockUser = {
        id: Date.now(),
        firstName: username,
        username: username.toLowerCase(),
        isPremium: false,
        languageCode: 'uz',
        deviceInfo: JSON.parse(localStorage.getItem('deviceInfo') || '{}')
      };
      
      setUser(mockUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      toast.success(`Xush kelibsiz, ${username}!`);
      
      return mockUser;
    } catch (error) {
      toast.error('Kirishda xatolik');
      throw error;
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('telegramInitData');
    localStorage.removeItem('currentGame');
    localStorage.removeItem('sessionId');
    
    toast('Xayr! Qaytib kelishingizni kutamiz 👋');
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      toast.success('Profil yangilandi');
      return updatedUser;
    } catch (error) {
      toast.error('Profilni yangilashda xatolik');
      throw error;
    }
  };

  // Get Telegram init data for WebSocket
  const getInitData = () => {
    return localStorage.getItem('telegramInitData');
  };

  // Get device info
  const getDeviceInfo = () => {
    try {
      return JSON.parse(localStorage.getItem('deviceInfo') || '{}');
    } catch {
      return {};
    }
  };

  const contextValue = {
    user,
    isAuthenticated,
    isLoading,
    authError,
    login,
    logout,
    updateProfile,
    getInitData,
    getDeviceInfo
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};