// Backend'ga so'rovlar uchun Telegram imzosini (initData) sarlavhaga qo'shadi.
export const authHeaders = () => ({
  'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
});
