import React, { useState, useEffect } from 'react';
import OrderForm from './components/OrderForm';
import './App.css';

function App() {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [currentProduct, setCurrentProduct] = useState({
    id: 1,
    name: 'iPhone 15 Pro',
    price: 12000000,
    description: '128GB, Titanium'
  });

  useEffect(() => {
    // Telegram WebApp mavjudligini tekshirish
    if (window.Telegram && window.Telegram.WebApp) {
      const telegramApp = window.Telegram.WebApp;
      setTg(telegramApp);
      
      telegramApp.ready();
      telegramApp.expand();
      
      // Foydalanuvchi ma'lumotlari
      const userData = telegramApp.initDataUnsafe?.user;
      setUser(userData);
      
      console.log('Telegram WebApp:', telegramApp);
      console.log('Foydalanuvchi:', userData);
      console.log('Tema:', telegramApp.themeParams);
    } else {
      console.warn('Telegram WebApp mavjud emas. Brauzerda ochilgan.');
    }
  }, []);

  // Bu funksiya App.js ichida ham bo'lishi mumkin
  const sendTestData = () => {
    if (!tg) return;
    
    const testData = {
      type: 'test_order',
      userName: user?.first_name || 'Test mijoz',
      phone: '+998901234567',
      productName: currentProduct.name,
      quantity: 1,
      totalPrice: currentProduct.price
    };
    
    tg.sendData(JSON.stringify(testData));
    tg.showAlert('Test ma\'lumot yuborildi!');
    
    // App'ni yopish
    setTimeout(() => {
      tg.close();
    }, 1500);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛍️ Mening Do'konim</h1>
        {user && (
          <div className="user-info">
            👤 {user.first_name} {user.last_name || ''}
            {user.username && <span> (@{user.username})</span>}
          </div>
        )}
      </header>

      <main className="app-main">
        {/* Mahsulot ko'rinishi */}
        <div className="product-card">
          <div className="product-image">
            {currentProduct.name.includes('iPhone') ? '📱' : '📦'}
          </div>
          <h2>{currentProduct.name}</h2>
          <p className="product-description">{currentProduct.description}</p>
          <p className="product-price">
            {currentProduct.price.toLocaleString()} so'm
          </p>
          <button 
            className="select-product-btn"
            onClick={() => tg?.showAlert(`"${currentProduct.name}" tanlandi`)}
          >
            Tanlash
          </button>
        </div>

        {/* Buyurtma formasi */}
        <OrderForm product={currentProduct} />

        {/* Test tugmasi */}
        <div className="test-section">
          <button 
            className="test-button"
            onClick={sendTestData}
          >
            🔄 Test ma'lumot yuborish
          </button>
          <p className="test-notice">
            Ushbu tugma faqat test uchun. Aslida formani to'ldiring.
          </p>
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2024 Mening Telegram Do'konim</p>
        <p>Bot: @my_shop_bot</p>
      </footer>
    </div>
  );
}

export default App;