// Telegram typelari
export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  }
  
  // Window interface extension
  declare global {
    interface Window {
      Telegram?: {
        WebApp: {
          initData: string;
          initDataUnsafe: {
            query_id?: string;
            user?: TelegramUser;
            auth_date?: string;
            hash?: string;
          };
          platform: string;
          version: string;
          colorScheme: 'light' | 'dark';
          themeParams: {
            bg_color: string;
            text_color: string;
            hint_color: string;
            link_color: string;
            button_color: string;
            button_text_color: string;
          };
          isExpanded: boolean;
          viewportHeight: number;
          viewportStableHeight: number;
          
          ready: () => void;
          expand: () => void;
          close: () => void;
          sendData: (data: string) => void;
          onEvent: (eventType: string, eventHandler: () => void) => void;
          offEvent: (eventType: string, eventHandler: () => void) => void;
        };
      };
    }
  }
  
  // Telegram WebApp ni ishga tushirish
  export const initTelegramWebApp = () => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      console.warn('Telegram WebApp mavjud emas');
      return null;
    }
  
    const tg = window.Telegram.WebApp;
    
    // WebApp'ni ishga tushirish
    tg.ready();
    
    // Ekranni kengaytirish
    if (!tg.isExpanded) {
      tg.expand();
    }
    
    return tg;
  };
  
  // Telegram user'ini olish
  export const getTelegramUser = (): TelegramUser | null => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      return null;
    }
    
    return window.Telegram.WebApp.initDataUnsafe.user || null;
  };
  
  // Telegram WebApp mavjudligini tekshirish
  export const isTelegramWebApp = (): boolean => {
    return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
  };