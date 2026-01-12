// src/hooks/useTelegram.ts
import { useEffect, useState } from 'react';
import { TelegramUser, initTelegramWebApp, getTelegramUser } from '../utils/telegram';

export const useTelegram = () => {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [webApp, setWebApp] = useState<ReturnType<typeof initTelegramWebApp>>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const tg = initTelegramWebApp();
        if (tg) {
          setWebApp(tg);
          
          const telegramUser = getTelegramUser();
          if (telegramUser) {
            setUser(telegramUser);
            await sendUserToBackend(telegramUser);
          }
        }
      } catch (error) {
        console.error('Telegram initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const sendUserToBackend = async (userData: TelegramUser) => {
    try {
      const response = await fetch('https://your-backend.onrender.com/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: userData.id,
          firstName: userData.first_name,
          username: userData.username,
          photoUrl: userData.photo_url,
        }),
      });

      const data = await response.json();
      
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));
      }
    } catch (error) {
      console.error('Backend authentication error:', error);
    }
  };

  return {
    user,
    webApp,
    isLoading,
    isTelegram: !!webApp,
  };
};