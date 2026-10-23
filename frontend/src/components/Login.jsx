import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import logoImg from '../assets/logo.png';
import { API_URL, GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, APPLE_CLIENT_ID } from '../config';
import { setToken } from '../session';
import './Login.css';

const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

// Ilova uchun kirish ekrani: Google (hamma joyda) va Apple (iOS'da)
export default function Login({ onSuccess, onDevMode }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await SocialLogin.initialize({
          google: { webClientId: GOOGLE_WEB_CLIENT_ID, iOSClientId: GOOGLE_IOS_CLIENT_ID, iOSServerClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' },
          ...(platform === 'ios' ? { apple: { clientId: APPLE_CLIENT_ID } } : {})
        });
        setReady(true);
      } catch (e) {
        console.error('SocialLogin init xatosi:', e);
        setError('Kirish tizimini ishga tushirib bo\'lmadi');
      }
    })();
  }, []);

  const signIn = async (provider) => {
    if (busy) return;
    setError('');
    setBusy(provider);
    try {
      const res = await SocialLogin.login(
        provider === 'google'
          ? { provider: 'google', options: {} }
          : { provider: 'apple', options: { scopes: ['name', 'email'] } }
      );
      const r = res.result || {};
      const idToken = r.idToken;
      if (!idToken) throw new Error('Kirish tokeni olinmadi');

      // Apple ismni faqat birinchi kirishda beradi
      const firstName = provider === 'apple' ? (r.profile?.givenName || '') : '';

      const resp = await fetch(`${API_URL}/api/auth/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idToken, firstName })
      });
      let data = null;
      try { data = await resp.json(); } catch { /* JSON emas */ }
      if (!resp.ok || !data?.success || !data.token) {
        throw new Error(data?.message || `Server xatosi (${resp.status})`);
      }
      setToken(data.token);
      onSuccess(data.user);
    } catch (err) {
      const msg = String(err?.message || err);
      // Foydalanuvchi oynani o'zi yopgan bo'lsa xato ko'rsatmaymiz
      if (/cancel|dismiss|1001|12501/i.test(msg)) return;
      setError(msg === 'Failed to fetch' ? "Serverga ulanib bo'lmadi. Internetni tekshiring." : msg);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <img className="login-logo-img" src={logoImg} alt="Like Duel" />
        <p className="login-sub">Kirish uchun akkauntingizni tanlang. Yangi o'yinchilarga 100 tanga bonus!</p>

        <div className="login-form">
          <button type="button" className="login-submit login-provider" disabled={!ready || !!busy} onClick={() => signIn('google')}>
            {busy === 'google' ? 'Kuting...' : 'Google bilan kirish'}
          </button>
          {platform === 'ios' && (
            <button type="button" className="login-submit login-provider login-apple" disabled={!ready || !!busy} onClick={() => signIn('apple')}>
              {busy === 'apple' ? 'Kuting...' : 'Apple bilan kirish'}
            </button>
          )}
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        {onDevMode && (
          <button type="button" className="login-switch login-dev" onClick={onDevMode}>
            🧪 Sinov rejimi (faqat dasturchilar uchun)
          </button>
        )}
      </div>
    </div>
  );
}
