// ============================================================
// Referrals.js - DO'STLARNI TAKLIF QILISH
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';

function Referrals({ user, API_URL, onBack, onNotification }) {
  // ======================
  // STATE
  // ======================
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refCount, setRefCount] = useState(0);
  const [refBonus, setRefBonus] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const BOT_USERNAME = 'like_duel_bot'; // O'zingizning bot username

  // ======================
  // REFERRAL LINK
  // ======================
  const getReferralLink = useCallback(() => {
    if (!user?.tgId) return '';
    return `https://t.me/${BOT_USERNAME}/app?startapp=${user.tgId}`;
  }, [user]);

  // ======================
  // FETCH REFERRALS
  // ======================
  const fetchReferrals = useCallback(async () => {
    if (!user?.tgId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/${user.tgId}/referrals`);
      const data = await response.json();
      
      if (data.success) {
        setReferrals(data.referrals || []);
        setRefCount(data.count || 0);
        setRefBonus(data.referrals?.reduce((sum, r) => sum + 100, 0) || 0);
      }
    } catch (error) {
      console.error('❌ Referrals fetch error:', error);
      onNotification?.('⚠️ Referal ma\'lumotlarini olishda xatolik', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, API_URL, onNotification]);

  // ======================
  // COPY LINK
  // ======================
  const copyReferralLink = useCallback(async () => {
    const link = getReferralLink();
    if (!link) {
      onNotification?.('⚠️ Referal link yaratishda xatolik', 'error');
      return;
    }

    try {
      // Telegram WebApp clipboard API
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '📋 Taklif havolasi',
          message: link,
          buttons: [{ type: 'ok' }]
        });
        setCopied(true);
        onNotification?.('✅ Havola nusxalandi!', 'success');
      } 
      // Browser clipboard API
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        onNotification?.('✅ Havola nusxalandi!', 'success');
      } 
      // Fallback
      else {
        // Linkni ko'rsatish
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        onNotification?.('✅ Havola nusxalandi!', 'success');
      }

      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('❌ Copy error:', error);
      onNotification?.('⚠️ Havolani nusxalashda xatolik', 'error');
    }
  }, [getReferralLink, onNotification]);

  // ======================
  // SHARE VIA TELEGRAM
  // ======================
  const shareViaTelegram = useCallback(() => {
    const link = getReferralLink();
    if (!link) {
      onNotification?.('⚠️ Referal link yaratishda xatolik', 'error');
      return;
    }

    setShareLoading(true);
    try {
      const shareText = `🎮 Men Like-Duel o'yinida! 
⚔️ Tosh, Qog'oz, Qaychi o'ynaymiz!
💥 Qo'shil va 100 tanga bonus ol!

🔗 ${link}`;

      // Telegram WebApp share
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '👥 Do\'stlarni taklif qilish',
          message: shareText,
          buttons: [
            { 
              id: 'share',
              type: 'default',
              text: '📤 Ulashish'
            },
            { type: 'cancel' }
          ]
        }, (buttonId) => {
          if (buttonId === 'share') {
            // Telegram orqali ulashish
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
          }
        });
      } 
      // Browser share
      else if (navigator.share) {
        navigator.share({
          title: 'Like-Duel o\'yiniga qo\'shiling!',
          text: shareText,
          url: link
        }).then(() => {
          onNotification?.('✅ Ulashildi!', 'success');
        }).catch(() => {
          // User cancel qilgan bo'lishi mumkin
        });
      } 
      // Fallback
      else {
        copyReferralLink();
      }
    } catch (error) {
      console.error('❌ Share error:', error);
      onNotification?.('⚠️ Ulashishda xatolik', 'error');
    } finally {
      setShareLoading(false);
    }
  }, [getReferralLink, onNotification, copyReferralLink]);

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  // ======================
  // FORMAT DATE
  // ======================
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Hozir';
    if (minutes < 60) return `${minutes} daqiqa oldin`;
    if (hours < 24) return `${hours} soat oldin`;
    if (days < 7) return `${days} kun oldin`;
    return d.toLocaleDateString('uz-UZ');
  };

  // ======================
  // RENDER
  // ======================
  return (
    <div className="referrals-page">
      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>
        ⬅️ Orqaga
      </button>

      <div className="referrals-container">
        {/* Header */}
        <div className="referrals-header">
          <h2>👥 Do'stlarni Taklif Qilish</h2>
          <p>Har bir taklif qilgan do'stingiz uchun <strong>100 tanga</strong> bonus!</p>
        </div>

        {/* Stats */}
        <div className="referrals-stats">
          <div className="referrals-stat">
            <span className="stat-icon">👥</span>
            <span className="stat-number">{refCount}</span>
            <span className="stat-label">Taklif qilinganlar</span>
          </div>
          <div className="referrals-stat">
            <span className="stat-icon">🪙</span>
            <span className="stat-number">+{refBonus}</span>
            <span className="stat-label">Bonus tanga</span>
          </div>
          <div className="referrals-stat">
            <span className="stat-icon">💰</span>
            <span className="stat-number">{user?.coins || 0}</span>
            <span className="stat-label">Jami tanga</span>
          </div>
        </div>

        {/* Share Section */}
        <div className="referrals-share">
          <div className="referrals-link-box">
            <div className="referrals-link-label">
              📋 Sizning taklif havolangiz:
            </div>
            <div className="referrals-link">
              <span className="link-text">{getReferralLink()}</span>
            </div>
          </div>

          <div className="referrals-buttons">
            <button 
              className={`referrals-btn-copy ${copied ? 'copied' : ''}`}
              onClick={copyReferralLink}
              disabled={copied}
            >
              {copied ? '✅ Nusxalandi!' : '📋 Nusxalash'}
            </button>

            <button 
              className="referrals-btn-share"
              onClick={shareViaTelegram}
              disabled={shareLoading}
            >
              {shareLoading ? '⏳ Yuklanmoqda...' : '📤 Ulashish'}
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="referrals-info">
          <h3>💡 Qanday ishlaydi?</h3>
          <div className="referrals-info-list">
            <div className="referrals-info-item">
              <span className="info-number">1</span>
              <div className="info-content">
                <span className="info-title">Havolani ulashing</span>
                <span className="info-desc">Do'stlaringizga taklif havolasini yuboring</span>
              </div>
            </div>
            <div className="referrals-info-item">
              <span className="info-number">2</span>
              <div className="info-content">
                <span className="info-title">Do'stingiz o'ynasin</span>
                <span className="info-desc">Do'stingiz bot orqali o'yinga kirsin</span>
              </div>
            </div>
            <div className="referrals-info-item">
              <span className="info-number">3</span>
              <div className="info-content">
                <span className="info-title">Bonus oling!</span>
                <span className="info-desc">Siz va do'stingiz 100 tangadan bonus olasiz!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Referrals List */}
        <div className="referrals-list-section">
          <h3>📋 Taklif qilingan do'stlar</h3>
          
          {loading ? (
            <div className="referrals-loading">
              <div className="spinner"></div>
              <p>Yuklanmoqda...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="referrals-empty">
              <span className="empty-icon">📭</span>
              <p>Hali hech kim taklif qilinmagan</p>
              <p className="empty-hint">Do'stlaringizni taklif qilishni boshlang!</p>
            </div>
          ) : (
            <div className="referrals-list">
              {referrals.map((ref, index) => (
                <div key={ref._id || index} className="referrals-item">
                  <div className="referrals-item-avatar">
                    {ref.photoUrl ? (
                      <img src={ref.photoUrl} alt={ref.firstName} />
                    ) : (
                      <span>{ref.firstName?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  <div className="referrals-item-info">
                    <span className="item-name">{ref.firstName}</span>
                    <span className="item-username">@{ref.username || 'username'}</span>
                  </div>
                  <div className="referrals-item-stats">
                    <span className="item-coins">🪙 {ref.coins || 0}</span>
                    <span className="item-rating">🏆 {ref.rating || 0}</span>
                  </div>
                  <div className="referrals-item-date">
                    {formatDate(ref.createdAt)}
                  </div>
                  <div className="referrals-item-bonus">
                    +100 🪙
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button 
          className="referrals-refresh-btn"
          onClick={fetchReferrals}
          disabled={loading}
        >
          {loading ? '⏳ Yangilanmoqda...' : '🔄 Yangilash'}
        </button>

        {/* Premium Tip */}
        {user?.isPremium && (
          <div className="referrals-premium-tip">
            ⭐ Premium foydalanuvchi sifatida har bir taklifdan <strong>200 tanga</strong> bonus olasiz!
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Referrals;