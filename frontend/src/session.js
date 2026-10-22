// Ilova (email/parol) sessiyasi: token localStorage'da saqlanadi.
// Telegram ichida bo'lsa initData ishlatiladi, token kerak emas.
const KEY = 'like_duel_token';

export const getToken = () => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};
export const setToken = (token) => {
  try { localStorage.setItem(KEY, token); } catch {}
};
export const clearToken = () => {
  try { localStorage.removeItem(KEY); } catch {}
};

// Haqiqiy Telegram Mini App ichidami (imzolangan initData bor)
export const inTelegram = () => !!window.Telegram?.WebApp?.initData;
