import React, { useEffect, useState, useCallback } from 'react';
import './App.css';

function App() {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);

  // sendDataToBot funksiyasini useCallback ichiga olish
  const sendDataToBot = useCallback(() => {
    if (!tg) return;
    
    const orderData = {
      type: 'order',
      userName: user?.first_name || 'Mijoz',
      phone: '+998901234567',
      productName: 'iPhone 15',
      quantity: 1,
      totalPrice: 12000000
    };
    
    tg.sendData(JSON.stringify(orderData));
    tg.close();
  }, [tg, user]);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const telegram = window.Telegram.WebApp;
      telegram.ready();
      telegram.expand();
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user);
      
      // MainButton sozlash
      telegram.MainButton.setText("Buyurtma berish");
      telegram.MainButton.color = "#3390ec";
      telegram.MainButton.show();
      telegram.MainButton.onClick(sendDataToBot);
      
      return () => {
        telegram.MainButton.offClick(sendDataToBot);
      };
    }
  }, [sendDataToBot]); // ← sendDataToBot ni dependency qo'shing

  return (
    <div className="App">
      <header className="App-header">
        <h1>Telegram Mini App</h1>
        {user && (
          <div className="user-info">
            <p>👤 {user.first_name}</p>
            <p className="user-id">ID: {user.id}</p>
          </div>
        )}
      </header>
      
      <main className="App-main">
        <div className="product-card">
          <h3>iPhone 15 Pro</h3>
          <p>128GB, Titanium</p>
          <p className="price">12,000,000 so'm</p>
          <button 
            className="buy-btn"
            onClick={sendDataToBot}
          >
            🛒 Sotib olish
          </button>
        </div>
      </main>
      
      <footer className="App-footer">
        <p>© 2024 Mening Do'konim</p>
      </footer>
    </div>
  );
}

export default App;