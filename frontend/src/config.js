// Backend manzili - BITTA joyda. Ilova (Capacitor) uchun .env da REACT_APP_API_URL bering.
export const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000');

// Google / Apple kirish (ilova uchun). Qiymatlar .env dan olinadi.
export const GOOGLE_WEB_CLIENT_ID = process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.REACT_APP_GOOGLE_IOS_CLIENT_ID || '';
export const APPLE_CLIENT_ID = process.env.REACT_APP_APPLE_CLIENT_ID || 'uz.likeduel.app';

// Do'kon (Google Play / App Store) build'i: karta orqali tanga sotuvi o'chiriladi
// (do'konlar faqat o'zlarining ichki xaridini ruxsat beradi). Yig'ishda REACT_APP_STORE_BUILD=true bering.
export const STORE_BUILD = process.env.REACT_APP_STORE_BUILD === 'true';
