// ============================================================
// Wallet.js - HAMYON VA TRANZAKSIYALAR TARIXI
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import './Wallet.css';

function Wallet({ user, setUser, API_URL, onBack, onNotification, triggerHaptic }) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'in', 'out'

  // Serverdan tranzaksiyalar tarixini yuklash
  const fetchTransactions = useCallback(async () => {
    if (!user?.tgId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/transactions/${user.tgId}`);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        onNotification?.(data.message || 'Tranzaksiyalarni yuklab bo\'lmadi', 'error');
      }
    } catch (err) {
      console.error('❌ Wallet transactions fetch error:', err);
      onNotification?.('Tarmoqda xatolik yuz berdi', 'error');
    } finally {
      setLoading(false);
    }
  }, [API_URL, user?.tgId, onNotification]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Tranzaksiya turlarini chiroyli formatlash
  const getTxDetails = (tx) => {
    const isPositive = tx.amount > 0;
    let icon = '🪙';
    let title = 'Tanga operatsiyasi';

    switch (tx.type) {
      case 'game_win':
        icon = '🏆';
        title = 'Duel g\'alabasi';
        break;
      case 'game_stake_hold':
        icon = '🔒';
        title = 'O\'yin stavkasi (escrow)';
        break;
      case 'game_draw_refund':
        icon = '🤝';
        title = 'Durang (stavka qaytarildi)';
        break;
      case 'shop_purchase':
        icon = '🛍️';
        title = 'Xarid qilindi';
        break;
      case 'ref_bonus':
        icon = '👥';
        title = 'Referal bonusi';
        break;
      case 'daily_reward':
        icon = '🎁';
        title = 'Kunlik bonus';
        break;
      default:
        icon = isPositive ? '📥' : '📤';
        title = tx.description || (isPositive ? 'Kirim' : 'Chiqim');
    }

    return { icon, title, isPositive };
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'in') return tx.amount > 0;
    if (filter === 'out') return tx.amount < 0;
    return true;
  });

  return (
    <div className="wallet-page">
      <button className="wallet-back-btn" onClick={onBack}>
        ⬅️ Orqaga
      </button>

      {/* Balance Card */}
      <div className="wallet-balance-card">
        <span className="wallet-balance-label">Joriy Balans</span>
        <div className="wallet-balance-amount">
          <span className="coin-icon">🪙</span>
          <h2>{user?.coins ?? 0}</h2>
        </div>
        <p className="wallet-id">ID: {user?.tgId || '—'}</p>
        
        <button 
          className="wallet-refresh-btn" 
          onClick={() => {
            triggerHaptic?.('light');
            fetchTransactions();
          }}
          disabled={loading}
        >
          {loading ? '⏳ Yuklanmoqda...' : '🔄 Balans va Tarixni Yangilash'}
        </button>
      </div>

      {/* Transactions Section */}
      <div className="wallet-history-section">
        <div className="wallet-history-header">
          <h3>📜 Tranzaksiyalar Tarixi</h3>
          <div className="wallet-filter-tabs">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Barchasi
            </button>
            <button 
              className={`filter-btn ${filter === 'in' ? 'active' : ''}`}
              onClick={() => setFilter('in')}
            >
              Kirim
            </button>
            <button 
              className={`filter-btn ${filter === 'out' ? 'active' : ''}`}
              onClick={() => setFilter('out')}
            >
              Chiqim
            </button>
          </div>
        </div>

        {loading && transactions.length === 0 ? (
          <div className="wallet-loading">⏳ Tranzaksiyalar yuklanmoqda...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="wallet-empty">
            <p>💭 Hozircha hech qanday tranzaksiya yo'q</p>
          </div>
        ) : (
          <div className="wallet-tx-list">
            {filteredTransactions.map((tx, idx) => {
              const { icon, title, isPositive } = getTxDetails(tx);
              const formattedDate = new Date(tx.createdAt || Date.now()).toLocaleString('uz-UZ', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={tx._id || idx} className="wallet-tx-item">
                  <div className="tx-icon">{icon}</div>
                  <div className="tx-info">
                    <span className="tx-title">{title}</span>
                    <span className="tx-date">{formattedDate}</span>
                  </div>
                  <div className={`tx-amount ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '+' : ''}{tx.amount} 🪙
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Wallet;