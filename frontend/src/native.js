// Faqat Capacitor (Android/iOS) ichida ishlaydi; brauzer va Telegram'da hech narsa qilmaydi.
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function initNative() {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0c0c0e' });
    }
  } catch { /* status bar mavjud emas */ }

  // Android "orqaga" tugmasi: bosh sahifada ilovadan chiqadi, aks holda tarixda orqaga
  // App.js 'app:back' hodisasini tinglaydi; ekran menyuda bo'lsa (detail.handled=false) ilovadan chiqamiz
  CapApp.addListener('backButton', () => {
    const detail = { handled: false };
    window.dispatchEvent(new CustomEvent('app:back', { detail }));
    if (!detail.handled) CapApp.exitApp();
  });

  try { await SplashScreen.hide(); } catch { /* ignore */ }
}
