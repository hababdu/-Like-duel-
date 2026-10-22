// Backend manzili - BITTA joyda. Ilova (Capacitor) uchun .env da REACT_APP_API_URL bering.
export const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000');
