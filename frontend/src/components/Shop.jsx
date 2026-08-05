// ============================================================
// Shop.js - DO'KON VA XARID QILISH
// ============================================================
import React, { useState, useCallback } from 'react';
import './Shop.css';

function Shop({ user, setUser, API_URL, onBack, onNotification, triggerHaptic }) {
  const [buyingId, setBuyingId] = useState(null);

  // Do'konda mavjud buyumlar ro'yxati
  const shopItems = [
    {
      id: 'frame_gold',
      name: 'Oltin Ramka',
      type: 'frame',
      price: 150,
      icon: '🖼️',
      description: 'Profil avataringiz uchun oltin rangli ramka.'
    },
    {
      id: 'frame_neon',
      name: 'Neon Ramka',
      type: 'frame',
      price: 300,
      icon: '⚡',
      description: 'Profil avataringiz uchun yorqin neon ramka.'
    },
    {
      id: 'title_pro',
      name: 'PRO Unvoni',
      type: 'title',
      price: 500,
      icon: '👑',
      description: 'Ismingiz yonida PRO belgisi paydo bo\'ladi.'
    },
    {
      id: 'boost_xp',
      name: '2x XP Boost (1 soat)',
      type: 'booster',
      price: 200,
      icon: '🚀',
      description: '1 soat davomida o\'yinlardan 2 barobar ko\'p XP oling.'
    }
  ];

  // Buyumni sotib olish funksiyasi (Server Ledger orqali)
  const handleBuyItem = useCallback(async (item) => {
    if (!user?.tgId) {
      onNotification?.('⚠️ Tizimga kirmagansiz!', 'error');
      return;
    }

    if ((user?.coins || 0) < item.price) {
      triggerHaptic?.('error');
      onNotification?.(`⚠️ Yetarli tanga yo'q! Sizga ${item.price} 🪙 kerak.`, 'error');
      return;
    }

    setBuyingId(item.id);
    triggerHaptic?.('medium');

    try {
      const response = await fetch(`${API_URL}/api/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgId: user.tgId,
          itemId: item.id,
          price: item.price
        })
      });

      const data = await response.json();

      if (data.success) {
        triggerHaptic?.('heavy');
        onNotification?.(`🎉 ${item.name} muvaffaqiyatli xarid qilindi!`, 'success');

        // Serverdan kelgan yangi balans bilan setUser'ni yangilaymiz
        if (setUser) {
          setUser(prev => ({
            ...prev,
            coins: data.newCoins ?? (prev.coins - item.price),
            inventory: [...(prev.inventory || []), item.id]
          }));
        }
      } else {
        triggerHaptic?.('error');
        onNotification?.(`❌ ${data.message || 'Xarid amalga oshmadi'}`, 'error');
      }
    } catch (err) {
      console.error('❌ Buy item error:', err);
      onNotification?.('⚠️ Tarmoqda xatolik yuz berdi!', 'error');
    } finally {
      setBuyingId(null);
    }
  }, [user, setUser, API_URL, onNotification, triggerHaptic]);

  const hasItem = (itemId) => {
    return user?.inventory?.includes(itemId);
  };

  return (
    <div className="shop-page">
      <button className="shop-back-btn" onClick={onBack}>
        ⬅️ Orqaga
      </button>

      {/* Shop Header */}
      <div className="shop-header">
        <h2>🛍️ Do'kon</h2>
        <div className="shop-user-coins">
          <span>Sizning balansingiz:</span>
          <strong>🪙 {user?.coins ?? 0}</strong>
        </div>
      </div>

      {/* Shop Items Grid */}
      <div className="shop-items-grid">
        {shopItems.map(item => {
          const isOwned = hasItem(item.id);
          const isAffordable = (user?.coins || 0) >= item.price;
          const isProcessing = buyingId === item.id;

          return (
            <div key={item.id} className={`shop-item-card ${isOwned ? 'owned' : ''}`}>
              <div className="shop-item-icon">{item.icon}</div>
              <h3 className="shop-item-title">{item.name}</h3>
              <p className="shop-item-desc">{item.description}</p>
              
              <div className="shop-item-footer">
                <span className="shop-item-price">🪙 {item.price}</span>
                
                {isOwned ? (
                  <button className="shop-buy-btn owned" disabled>
                    ✅ Olindi
                  </button>
                ) : (
                  <button
                    className="shop-buy-btn"
                    onClick={() => handleBuyItem(item)}
                    disabled={!isAffordable || isProcessing}
                  >
                    {isProcessing ? '⏳...' : 'Sotib olish'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Shop;