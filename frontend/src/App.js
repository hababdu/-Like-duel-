// ============================================================
// App.js - TO'LIQ VERSION (TUZATILGAN - backend initData tekshiruviga mos)
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket';
import Profile from './components/Profile';
import DuelGame from './components/DuelGame';
import BotGame from './components/BotGame';
import Leaderboard from './components/Leaderboard';
import Referrals from './components/Referrals';
import Wallet from './components/Wallet';
import Shop from './components/Shop';
import './App.css';

// Backend endi /api/user/auth uchun XOM Telegram initData satrini talab qiladi
// va uni bot tokeni bilan imzo (hash) orqali tekshiradi. Bu tufayli:
//  - firstName/username/photoUrl kabi maydonlarni client bermaydi,
//    ular server tomonida verifikatsiyalangan initData'dan olinadi.
//  - Telegram WebApp tashqarisida (masalan localhost'da brauzerda)
//    haqiqiy autentifikatsiya bo'lishi MUMKIN EMAS, shu sabab shunday
//    holatda ilova aniq "dev/test rejimi" deb ogohlantiradi va faqat
//    UI'ni sinash uchun soxta (serverga saqlanmaydigan) profil ko'rsatadi.

function App() {
  // ======================
  // STATE
  // ======================
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // user state'ni socket eventlar ichida (closure eskirishisiz) o'qish uchun
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://telegram-bot-server-2-matj.onrender.com'
    : 'http://localhost:10000';

  // ======================
  // NOTIFICATION
  // ======================
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ======================
  // HAPTIC FEEDBACK
  // ======================
  const triggerHaptic = useCallback((type = 'light') => {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 80 : 35);
      }
    } catch (e) {}
  }, []);

  // ======================
  // SOCKETGA ULANISH XABARI (bitta joyda, tgId serverdan tasdiqlangandan keyin)
  // ======================
  const announceUserConnect = useCallback((userData) => {
    if (!userData?.tgId || !socket?.connected) return;
    socket.emit('user_connect', {
      tgId: String(userData.tgId),
      firstName: userData.firstName || "O'yinchi",
      username: userData.username || ''
    });
  }, []);

  // ======================
  // USER AUTH - endi xom initData satri bilan
  // ======================
  const authenticateUser = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const rawInitData = tg?.initData; // XOM, imzolangan satr (hash tekshiruvi uchun)
    const unsafeUser = tg?.initDataUnsafe?.user || null;

    setIsTelegramWebApp(!!tg);
    if (unsafeUser) setTelegramUser(unsafeUser);

    // ----------------------------------------------------------
    // DEV/TEST REJIMI: Telegram WebApp mavjud emas yoki initData bo'sh.
    // Bu holatda backend haqiqiy autentifikatsiyani rad etadi (to'g'ri ishlaydi),
    // shuning uchun serverga so'rov yubormasdan, faqat lokal (saqlanmaydigan)
    // sinov profili ko'rsatamiz va buni foydalanuvchiga ochiq aytamiz.
    // ----------------------------------------------------------
    if (!rawInitData) {
      console.warn('⚠️ Telegram initData topilmadi — dev/test rejimi.');
      setIsDevMode(true);
      setAuthError(null);
      const devUser = {
        tgId: 'dev_local_user',
        firstName: 'Test User',
        username: 'test_user',
        photoUrl: '',
        isPremium: false,
        coins: 100,
        rating: 100,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        maxWinStreak: 0,
        refCount: 0,
        refBonus: 0
      };
      setUser(devUser);
      showNotification('🧪 Dev rejimi: Telegram orqali kirilmadi, ma\'lumotlar saqlanmaydi.', 'warning');
      return devUser;
    }

    // ----------------------------------------------------------
    // HAQIQIY AUTENTifikATSIYA: faqat initData yuboriladi.
    // Server o'zi hash imzosini tekshirib, tgId/firstName/username/photoUrl'ni
    // O'ZI initData'dan chiqarib oladi — client bu maydonlarni yubormaydi,
    // chunki client aytgan gapga ishonish xavfsizlik teshigi edi.
    // ----------------------------------------------------------
    try {
      console.log('🔑 ===== AUTH START (Telegram initData) =====');

      const response = await fetch(`${API_URL}/api/user/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          initData: rawInitData,
          refParent: getRefParentFromUrl()
        })
      });

      console.log('📥 Response status:', response.status);

      if (response.status === 401) {
        throw new Error('Telegram autentifikatsiyasi rad etildi (imzo mos kelmadi yoki eskirgan)');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        const text = await response.text();
        console.error('❌ JSON parse error. Response text:', text);
        throw new Error('Server javobi noto\'g\'ri formatda');
      }

      if (!data.success || !data.user) {
        throw new Error(data.message || 'Auth muvaffaqiyatsiz');
      }

      const userData = {
        ...data.user,
        tgId: String(data.user.tgId)
      };

      console.log('✅ User authenticated:', userData.tgId);
      setUser(userData);
      setAuthError(null);
      setIsDevMode(false);
      announceUserConnect(userData);
      return userData;

    } catch (error) {
      console.error('❌ Auth error:', error);
      // MUHIM: Bu yerda soxta "offline" foydalanuvchi yaratmaymiz.
      // Chunki bu holat foydalanuvchiga u ro'yxatdan o'tgandek va coin/rating
      // egasidek ko'rsatib, keyin server bilan sinxron bo'lmagan holatga olib kelardi.
      // Buning o'rniga xatoni ochiq ko'rsatamiz va qayta urinish imkonini beramiz.
      setUser(null);
      setAuthError(error.message || 'Autentifikatsiya xatosi');
      showNotification('❌ Kirish muvaffaqiyatsiz: ' + (error.message || 'nomalum xato'), 'error');
      return null;
    }
  }, [API_URL, showNotification, announceUserConnect]);

  // URL'dan referal parentni olish (masalan ?start=ref_12345 yoki ?ref=12345)
  function getRefParentFromUrl() {
    try {
      const tg = window.Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;
      if (startParam) {
        const match = startParam.match(/ref_?(\d+)/i);
        if (match) return match[1];
        if (/^\d+$/.test(startParam)) return startParam;
      }
      const params = new URLSearchParams(window.location.search);
      return params.get('ref') || null;
    } catch {
      return null;
    }
  }

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 ===== INITIALIZING APP =====');

        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
          console.log('✅ Telegram WebApp ready');
        }

        await authenticateUser();

      } catch (error) {
        console.error('❌ Initialize error:', error);
        setAuthError(error.message || 'Ilovani ishga tushirishda xato');
      } finally {
        setLoading(false);
        console.log('✅ ===== INITIALIZATION COMPLETE =====');
      }
    };

    initializeApp();

    const onConnect = () => {
      console.log('✅ Socket connected! ID:', socket.id);
      setSocketConnected(true);
      announceUserConnect(userRef.current);
    };

    const onReconnect = (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setSocketConnected(true);
      announceUserConnect(userRef.current);
    };

    const onDisconnect = () => {
      console.log('❌ Socket disconnected');
      setSocketConnected(false);
    };

    const onConnectError = (error) => {
      console.error('❌ Socket connect error:', error);
      setSocketConnected(false);
    };

    const onUserConnected = (data) => {
      console.log('✅ User connected response:', data);
      if (data.success && data.user) {
        setUser(prev => ({ ...prev, ...data.user }));
      }
    };

    const onServerError = (data) => {
      console.error('⚠️ Server error event:', data);
      showNotification('⚠️ ' + (data?.message || 'Server xatoligi'), 'error');
    };

    // Xarid (Shop.js) yoki boshqa joydan hamyon yangilansa - global holatda ham
    // balansni sinxron ushlab turish uchun (foydalanuvchi Shop ekranida
    // bo'lmasa ham header'dagi tanga soni yangilanadi)
    const onWalletUpdated = (data) => {
      if (typeof data?.newBalance === 'number') {
        setUser(prev => (prev ? { ...prev, coins: data.newBalance } : prev));
      }
    };

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user_connected', onUserConnected);
    socket.on('error', onServerError);
    socket.on('wallet_updated', onWalletUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user_connected', onUserConnected);
      socket.off('error', onServerError);
      socket.off('wallet_updated', onWalletUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Like-Duel yuklanmoqda...</p>
      </div>
    );
  }

  // Haqiqiy Telegram muhitida auth muvaffaqiyatsiz bo'lsa - qayta urinish ekrani
  if (!user && authError && !isDevMode) {
    return (
      <div className="loading-screen">
        <p>❌ Kirishda xatolik: {authError}</p>
        <button
          onClick={async () => {
            setLoading(true);
            await authenticateUser();
            setLoading(false);
          }}
        >
          🔄 Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div className="header-left">
          <h1>💥 LIKE-DUEL</h1>
        </div>
        <div className="header-right">
          <div className="header-status">
            {socketConnected ? '🟢' : '🔴'}
          </div>
          <div className="header-coins">
            🪙 {user?.coins || 0}
          </div>
          <div className="header-rating">
            🏆 {user?.rating || 0}
          </div>
          <button
            className="header-profile"
            onClick={() => setCurrentScreen('profile')}
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" />
            ) : (
              <span>{user?.firstName?.charAt(0) || '?'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Telegram Debug Info */}
      <div className="telegram-debug">
        <div className="debug-row">
          <span>📱 Platform: {isTelegramWebApp ? 'Telegram WebApp' : 'Web Browser'}</span>
          <span>👤 User: {user?.firstName || 'No Name'}</span>
          <span>🆔 ID: {user?.tgId || 'No ID'}</span>
          {isDevMode && <span style={{ color: '#ffaa00' }}>🧪 DEV REJIMI — saqlanmaydi</span>}
        </div>
        {telegramUser && (
          <div className="debug-row" style={{ fontSize: '11px', color: '#888' }}>
            <span>📛 @{telegramUser.username || 'no_username'}</span>
            <span>⭐ {telegramUser.is_premium ? 'Premium' : 'Free'}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {currentScreen === 'menu' && (
          <div className="menu">
            <div className="menu-profile">
              <div className="menu-profile-avatar">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" />
                ) : (
                  <span>{user?.firstName?.charAt(0) || '?'}</span>
                )}
                {user?.isPremium && (
                  <div className="premium-badge">⭐</div>
                )}
              </div>
              <div className="menu-profile-info">
                <h2>{user?.firstName || 'User'}</h2>
                <p>@{user?.username || 'username'}</p>
                <div className="menu-profile-stats">
                  <span>🪙 {user?.coins || 0}</span>
                  <span>🏆 {user?.rating || 0}</span>
                  <span>📊 Level {user?.level || 1}</span>
                </div>
              </div>
            </div>

            <div className="menu-buttons">
              <button
                className="btn-play"
                onClick={() => {
                  if (!user?.tgId) {
                    showNotification('⚠️ Iltimos avval tizimga kiring!', 'warning');
                    return;
                  }
                  if (isDevMode) {
                    showNotification('⚠️ Dev rejimida onlayn duel ishlamaydi (haqiqiy Telegram kerak).', 'warning');
                    return;
                  }
                  setCurrentScreen('game');
                }}
              >
                ⚔️ Onlayn Duel
                <span className="badge">Jonli</span>
              </button>

              <button
                className="btn-bot"
                onClick={() => setCurrentScreen('bot')}
              >
                🤖 Bot bilan
                <span className="badge">AI</span>
              </button>

              <button
                className="btn-leaderboard"
                onClick={() => setCurrentScreen('leaderboard')}
              >
                🏆 Peshqadamlar
              </button>

              <button
                className="btn-wallet"
                onClick={() => setCurrentScreen('wallet')}
              >
                💰 Hamyonim
              </button>

              <button
                className="btn-shop"
                onClick={() => setCurrentScreen('shop')}
              >
                🛒 Tanga Do'koni
                <span className="badge">⭐ Stars</span>
              </button>

              <button
                className="btn-referrals"
                onClick={() => setCurrentScreen('referrals')}
              >
                👥 Do'stlarni taklif qilish
                <span className="badge">+50 🪙</span>
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'profile' && (
          <Profile
            user={user}
            onBack={() => setCurrentScreen('menu')}
            updateUser={setUser}
            API_URL={API_URL}
          />
        )}

        {currentScreen === 'game' && (
          <DuelGame
            user={user}
            setUser={setUser}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
            triggerHaptic={triggerHaptic}
            socket={socket}
          />
        )}

        {currentScreen === 'bot' && (
          <BotGame
            user={user}
            setUser={setUser}
            difficulty="medium"
            onBackToMenu={() => setCurrentScreen('menu')}
            showNotif={showNotification}
            triggerHaptic={triggerHaptic}
            API_URL={API_URL}
          />
        )}

        {currentScreen === 'leaderboard' && (
          <Leaderboard
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
          />
        )}

        {currentScreen === 'referrals' && (
          <Referrals
            user={user}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
          />
        )}

        {currentScreen === 'wallet' && (
          <Wallet
            user={user}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
          />
        )}

        {currentScreen === 'shop' && (
          <Shop
            user={user}
            setUser={setUser}
            API_URL={API_URL}
            onBack={() => setCurrentScreen('menu')}
            onNotification={showNotification}
            socket={socket}
          />
        )}
      </div>

      <style>{`
        .telegram-debug {
          background: rgba(0,0,0,0.5);
          border-radius: 8px;
          padding: 8px 12px;
          margin: 8px 0;
          font-size: 12px;
          font-family: monospace;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .debug-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: #888;
        }
        .debug-row span {
          color: #00ff88;
        }
        .premium-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          background: #ffaa00;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid #0f0c29;
        }
        .menu-profile-avatar {
          position: relative;
        }
      `}</style>
    </div>
  );
}

export default App;