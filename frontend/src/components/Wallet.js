// ============================================================
// Wallet.js - HAMYON: balans va tranzaksiyalar tarixi
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';

// Har bir tranzaksiya turi uchun ikonka, o'zbekcha nom va rang
const TX_META = {
  signup_bonus:      { icon: '🎁', label: "Ro'yxatdan o'tish bonusi", color: '#43e97b' },
  referral_bonus:    { icon: '👥', label: "Do'st taklif qilingani uchun", color: '#43e97b' },
  game_stake_hold:   { icon: '🔒', label: 'Duel stavkasi ushlab turildi', color: '#ffaa00' },
  game_stake_refund: { icon: '↩️', label: 'Stavka qaytarildi', color: '#43e97b' },
  game_win:          { icon: '🏆', label: 'Duelda g\'alaba', color: '#43e97b' },
  game_lose:         { icon: '💥', label: 'Duelda mag\'lubiyat', color: '#ff4444' },
  game_draw_refund:  { icon: '🤝', label: 'Durang - stavka qaytarildi', color: '#43e97b' },
  purchase:          { icon: '⭐', label: 'Telegram Stars orqali xarid', color: '#43e97b' },
  admin_adjust:      { icon: '🛠️', label: 'Admin tuzatishi', color: '#888' }
};

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('uz-UZ', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function Wallet({ user, API_URL, onBack, onNotification }) {
  const [balance, setBalance] = useState(user?.coins ?? 0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = useCallback(async (isRefresh = false) => {
    if (!user?.tgId) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/user/${user.tgId}/wallet?limit=50`);
      const data = await response.json();

      if (data.success) {
        setBalance(data.balance);
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || 'Hamyon ma\'lumotlarini olishda xato');
      }
    } catch (err) {
      console.error('❌ Wallet load error:', err);
      setError('Serverga ulanishda xato');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, user?.tgId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleRefresh = () => {
    loadWallet(true);
    onNotification?.('🔄 Hamyon yangilanmoqda...', 'info');
  };

  return (
    <div className="wallet-screen">
      <button className="wallet-back-btn" onClick={onBack}>
        ⬅️ Menuga Qaytish
      </button>

      <div className="wallet-header">
        <h2>💰 Mening Hamyonim</h2>
        <button
          className="wallet-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '⏳' : '🔄'}
        </button>
      </div>

      <div className="wallet-balance-card">
        <span className="wallet-balance-label">Joriy balans</span>
        <span className="wallet-balance-value">🪙 {balance}</span>
      </div>

      <div className="wallet-history">
        <h3>📜 Tranzaksiyalar tarixi</h3>

        {loading && (
          <div className="wallet-loading">
            <div className="wallet-spinner"></div>
            <p>Yuklanmoqda...</p>
          </div>
        )}

        {!loading && error && (
          <div className="wallet-error">
            <p>⚠️ {error}</p>
            <button onClick={() => loadWallet()}>🔄 Qayta urinish</button>
          </div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="wallet-empty">
            <p>📭 Hozircha tranzaksiyalar yo'q</p>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className="wallet-tx-list">
            {transactions.map((tx) => {
              const meta = TX_META[tx.type] || { icon: '💠', label: tx.type, color: '#888' };
              const isPositive = tx.amount > 0;
              const isZero = tx.amount === 0;
              return (
                <div key={tx._id || `${tx.tgId}-${tx.createdAt}`} className="wallet-tx-item">
                  <div className="wallet-tx-icon" style={{ background: `${meta.color}22`, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="wallet-tx-info">
                    <div className="wallet-tx-label">{meta.label}</div>
                    {tx.description && (
                      <div className="wallet-tx-description">{tx.description}</div>
                    )}
                    <div className="wallet-tx-time">{formatDateTime(tx.createdAt)}</div>
                  </div>
                  <div className="wallet-tx-amounts">
                    <span
                      className="wallet-tx-amount"
                      style={{ color: isZero ? '#888' : isPositive ? '#43e97b' : '#ff4444' }}
                    >
                      {isZero ? '±0' : isPositive ? `+${tx.amount}` : tx.amount}
                    </span>
                    <span className="wallet-tx-balance-after">Qoldiq: {tx.balanceAfter}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .wallet-screen {
          padding: 12px 4px 40px;
          animation: walletFadeIn 0.3s ease-out;
        }
        @keyframes walletFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wallet-back-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #ccc;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
          margin-bottom: 16px;
        }
        .wallet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .wallet-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .wallet-refresh-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 16px;
        }
        .wallet-refresh-btn:disabled {
          opacity: 0.5;
        }
        .wallet-balance-card {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 18px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(102,126,234,0.3);
        }
        .wallet-balance-label {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
        }
        .wallet-balance-value {
          font-size: 32px;
          font-weight: 700;
          color: #fff;
        }
        .wallet-history h3 {
          font-size: 15px;
          color: #aaa;
          margin: 0 0 12px 4px;
        }
        .wallet-loading, .wallet-error, .wallet-empty {
          text-align: center;
          padding: 30px 0;
          color: #888;
        }
        .wallet-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #667eea;
          border-radius: 50%;
          margin: 0 auto 10px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .wallet-error button {
          margin-top: 10px;
          padding: 8px 16px;
          border-radius: 10px;
          border: none;
          background: #667eea;
          color: #fff;
          cursor: pointer;
        }
        .wallet-tx-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wallet-tx-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 12px 14px;
        }
        .wallet-tx-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .wallet-tx-info {
          flex: 1;
          min-width: 0;
        }
        .wallet-tx-label {
          font-size: 13px;
          color: #eee;
          font-weight: 600;
        }
        .wallet-tx-description {
          font-size: 11px;
          color: #888;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wallet-tx-time {
          font-size: 10px;
          color: #555;
          margin-top: 2px;
        }
        .wallet-tx-amounts {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .wallet-tx-amount {
          font-size: 15px;
          font-weight: 700;
        }
        .wallet-tx-balance-after {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

export default Wallet;