// ============================================================
// Shop.js - DO'KON: Telegram Stars orqali tanga sotib olish
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';

function Shop({ user, setUser, API_URL, onBack, onNotification, socket }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);
  const [error, setError] = useState(null);

  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  const canPurchase = !!tg?.initData; // faqat haqiqiy Telegram muhitida xarid mumkin

  // ======================
  // PAKETLARNI YUKLASH
  // ======================
  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/shop/packages`);
        const data = await response.json();
        if (data.success) {
          setPackages(data.packages || []);
        } else {
          setError(data.message || 'Paketlarni yuklashda xato');
        }
      } catch (err) {
        console.error('❌ Shop packages error:', err);
        setError('Serverga ulanishda xato');
      } finally {
        setLoading(false);
      }
    };
    loadPackages();
  }, [API_URL]);

  // ======================
  // XARID QILINGANDAN KEYIN BALANSNI YANGILASH
  // ======================
  useEffect(() => {
    if (!socket) return;

    const onWalletUpdated = (data) => {
      if (data?.reason === 'purchase') {
        onNotification?.(`✅ +${data.coinsAwarded} 🪙 hamyoningizga qo'shildi!`, 'success');
        if (setUser && typeof data.newBalance === 'number') {
          setUser(prev => ({ ...prev, coins: data.newBalance }));
        }
        setPurchasingId(null);
      }
    };

    socket.on('wallet_updated', onWalletUpdated);
    return () => socket.off('wallet_updated', onWalletUpdated);
  }, [socket, setUser, onNotification]);

  // ======================
  // XARID QILISH
  // ======================
  const handlePurchase = useCallback(async (pkg) => {
    if (!canPurchase) {
      onNotification?.('⚠️ Xarid faqat Telegram ilovasi ichida mumkin', 'warning');
      return;
    }

    setPurchasingId(pkg.id);

    try {
      const response = await fetch(`${API_URL}/api/shop/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg.initData,
          packageId: pkg.id
        })
      });

      const data = await response.json();

      if (!data.success || !data.invoiceLink) {
        throw new Error(data.message || 'Invoys yaratishda xato');
      }

      // Telegram ichki to'lov oynasini ochamiz (Stars orqali)
      tg.openInvoice(data.invoiceLink, (status) => {
        // status: 'paid' | 'cancelled' | 'failed' | 'pending'
        if (status === 'paid') {
          onNotification?.('⏳ To\'lov qabul qilindi, tangalar hisoblanmoqda...', 'info');
          // Yakuniy tasdiq va balans yangilanishi 'wallet_updated' socket
          // eventi orqali serverdan keladi (Telegram webhook orqali).
          // Ehtiyot chorasi sifatida bir necha soniyadan keyin profilni
          // qayta so'raymiz - agar socket voqeasi biror sababga ko'ra
          // yetib kelmasa ham, balans sinxron bo'lib qoladi.
          setTimeout(async () => {
            try {
              const profileRes = await fetch(`${API_URL}/api/user/${user.tgId}`);
              const profileData = await profileRes.json();
              if (profileData.success && setUser) {
                setUser(prev => ({ ...prev, coins: profileData.user.coins }));
              }
            } catch (e) {
              console.error('❌ Xarid tasdig\'idan keyin profil yangilashda xato:', e);
            } finally {
              setPurchasingId(null);
            }
          }, 3000);
        } else if (status === 'cancelled') {
          onNotification?.('❌ Xarid bekor qilindi', 'info');
          setPurchasingId(null);
        } else {
          onNotification?.('⚠️ To\'lov amalga oshmadi', 'error');
          setPurchasingId(null);
        }
      });

    } catch (err) {
      console.error('❌ Purchase error:', err);
      onNotification?.(`⚠️ ${err.message || 'Xaridda xatolik'}`, 'error');
      setPurchasingId(null);
    }
  }, [API_URL, canPurchase, tg, user, setUser, onNotification]);

  return (
    <div className="shop-screen">
      <button className="shop-back-btn" onClick={onBack}>
        ⬅️ Menuga Qaytish
      </button>

      <div className="shop-header">
        <h2>🛒 Tanga Do'koni</h2>
        <p>Telegram Stars ⭐ orqali xavfsiz va tezkor to'lov</p>
      </div>

      <div className="shop-balance">
        <span>🪙 Joriy balans</span>
        <span className="shop-balance-value">{user?.coins || 0}</span>
      </div>

      {!canPurchase && (
        <div className="shop-warning">
          ⚠️ Xarid qilish faqat Telegram ilovasi ichida ishlaydi (dev rejimida emas).
        </div>
      )}

      {loading && (
        <div className="shop-loading">
          <div className="shop-spinner"></div>
          <p>Paketlar yuklanmoqda...</p>
        </div>
      )}

      {!loading && error && (
        <div className="shop-error">⚠️ {error}</div>
      )}

      {!loading && !error && (
        <div className="shop-packages">
          {packages.map((pkg) => (
            <div key={pkg.id} className="shop-package-card">
              <div className="shop-package-coins">🪙 {pkg.coins}</div>
              <div className="shop-package-title">{pkg.title}</div>
              <button
                className="shop-buy-btn"
                onClick={() => handlePurchase(pkg)}
                disabled={!canPurchase || purchasingId === pkg.id}
              >
                {purchasingId === pkg.id ? '⏳ Kutilmoqda...' : `⭐ ${pkg.stars} Stars`}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="shop-footer-note">
        💡 To'lovlar Telegram Stars orqali amalga oshiriladi - bank kartasi kerak emas.
        Tangalar hisobingizga bir necha soniya ichida qo'shiladi.
      </p>

      <style>{`
        .shop-screen {
          padding: 12px 4px 40px;
          animation: shopFadeIn 0.3s ease-out;
        }
        @keyframes shopFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shop-back-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #ccc;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
          margin-bottom: 16px;
        }
        .shop-header {
          text-align: center;
          margin-bottom: 18px;
        }
        .shop-header h2 {
          margin: 0 0 4px;
          font-size: 22px;
        }
        .shop-header p {
          margin: 0;
          font-size: 13px;
          color: #888;
        }
        .shop-balance {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px 18px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #aaa;
        }
        .shop-balance-value {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }
        .shop-warning {
          background: rgba(255,170,0,0.1);
          border: 1px solid rgba(255,170,0,0.3);
          color: #ffaa00;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 12px;
          margin-bottom: 16px;
          text-align: center;
        }
        .shop-loading, .shop-error {
          text-align: center;
          padding: 30px 0;
          color: #888;
        }
        .shop-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #667eea;
          border-radius: 50%;
          margin: 0 auto 10px;
          animation: shopSpin 0.8s linear infinite;
        }
        @keyframes shopSpin {
          to { transform: rotate(360deg); }
        }
        .shop-packages {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .shop-package-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s;
        }
        .shop-package-card:hover {
          transform: translateY(-2px);
        }
        .shop-package-coins {
          font-size: 20px;
          font-weight: 700;
        }
        .shop-package-title {
          font-size: 11px;
          color: #888;
          text-align: center;
          min-height: 28px;
        }
        .shop-buy-btn {
          width: 100%;
          padding: 10px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #ffaa00, #ff7a00);
          color: #1a1a1a;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .shop-buy-btn:hover:not(:disabled) {
          box-shadow: 0 6px 18px rgba(255,170,0,0.35);
        }
        .shop-buy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .shop-footer-note {
          font-size: 11px;
          color: #666;
          text-align: center;
          margin-top: 20px;
          line-height: 1.6;
          padding: 0 12px;
        }
        @media (max-width: 380px) {
          .shop-packages {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default Shop;