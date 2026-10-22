import { getToken } from './session';

// Backend'ga so'rovlar uchun autentifikatsiya sarlavhalari:
// Telegram ichida - initData imzosi, ilovada - Bearer token.
export const authHeaders = () => {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) return { 'X-Telegram-Init-Data': initData };
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
