import React, { useState } from 'react';
import Icon from '../Icon';
import { API_URL } from '../config';
import { setToken } from '../session';
import './Login.css';

// Ilova uchun kirish / ro'yxatdan o'tish ekrani (Telegram'siz)
export default function Login({ onSuccess, onDevMode }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (isRegister && password.length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo'lsin");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password, firstName })
      });
      let data = null;
      try { data = await res.json(); } catch { /* javob JSON emas */ }

      if (!res.ok || !data?.success || !data.token) {
        throw new Error(data?.message || `Server xatosi (${res.status})`);
      }
      setToken(data.token);
      onSuccess(data.user);
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? "Serverga ulanib bo'lmadi. Internetni tekshiring."
        : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <h1 className="login-logo"><Icon name="zap" /> LIKE-DUEL</h1>
        <p className="login-sub">
          {isRegister ? "Yangi akkaunt yarating va 100 tanga bonus oling" : 'Akkauntingizga kiring'}
        </p>

        <form onSubmit={submit} className="login-form">
          {isRegister && (
            <label>
              <span>Ism</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                maxLength={32}
                required
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <label>
            <span>Parol</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </label>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Kuting...' : isRegister ? "Ro'yxatdan o'tish" : 'Kirish'}
          </button>
        </form>

        <button
          type="button"
          className="login-switch"
          onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
        >
          {isRegister ? 'Akkauntim bor — kirish' : "Akkauntim yo'q — ro'yxatdan o'tish"}
        </button>

        {onDevMode && (
          <button type="button" className="login-switch login-dev" onClick={onDevMode}>
            🧪 Sinov rejimi (faqat dasturchilar uchun)
          </button>
        )}
      </div>
    </div>
  );
}
