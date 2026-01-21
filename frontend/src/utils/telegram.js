// src/utils/telegram.js
export const initTelegramWebApp = () => {
    return new Promise((resolve, reject) => {
      // Check if running in Telegram Web App
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Expand the Web App
        tg.expand();
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
        // Set theme
        document.body.classList.toggle('dark', tg.colorScheme === 'dark');
        
        // Get user data
        const user = tg.initDataUnsafe?.user;
        
        if (user) {
          resolve({
            ...user,
            initData: tg.initData,
            themeParams: tg.themeParams,
            platform: tg.platform
          });
        } else {
          reject(new Error('User data not available'));
        }
      } else {
        // Development mode - mock data
        const mockUser = {
          id: 123456789,
          first_name: 'Test',
          username: 'test_user',
          language_code: 'uz',
          is_premium: false
        };
        
        resolve({
          ...mockUser,
          initData: 'mock',
          themeParams: {},
          platform: 'web'
        });
      }
    });
  };