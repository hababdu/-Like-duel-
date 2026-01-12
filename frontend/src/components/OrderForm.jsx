import React, { useState, useEffect } from 'react';
import './OrderForm.css';

const OrderForm = ({ product }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    quantity: 1
  });
  
  // Telegram WebApp ob'ektini olish
  const tg = window.Telegram.WebApp;
  
  // Formani yuborish funksiyasi
  const sendDataToBot = () => {
    const orderData = {
      type: 'order',
      userName: formData.name || tg.initDataUnsafe.user?.first_name || 'Mijoz',
      phone: formData.phone,
      address: formData.address,
      productName: product?.name || 'Mahsulot',
      quantity: formData.quantity,
      totalPrice: (product?.price || 0) * formData.quantity,
      orderId: Date.now(), // Unique ID
      timestamp: new Date().toISOString()
    };
    
    console.log('Yuborilayotgan ma\'lumot:', orderData);
    
    // Bot'ga ma'lumot yuborish
    tg.sendData(JSON.stringify(orderData));
    
    // Foydalanuvchiga xabar
    tg.showAlert('✅ Buyurtmangiz qabul qilindi!');
    
    // 2 soniyadan so'ng app'ni yopish
    setTimeout(() => {
      tg.close();
    }, 2000);
  };
  
  // MainButton ni sozlash
  useEffect(() => {
    if (tg && tg.MainButton) {
      tg.MainButton.setText(`Buyurtma berish (${formData.quantity} ta)`);
      tg.MainButton.color = '#3390ec';
      tg.MainButton.show();
      
      // Tugma bosilganda sendDataToBot ishga tushsin
      tg.MainButton.onClick(sendDataToBot);
      
      return () => {
        tg.MainButton.offClick(sendDataToBot);
      };
    }
  }, [formData.quantity, product]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const increaseQuantity = () => {
    setFormData({ ...formData, quantity: formData.quantity + 1 });
  };
  
  const decreaseQuantity = () => {
    if (formData.quantity > 1) {
      setFormData({ ...formData, quantity: formData.quantity - 1 });
    }
  };
  
  return (
    <div className="order-form">
      <h3>Buyurtma formasi</h3>
      
      <div className="form-group">
        <label>Ismingiz *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Ism familiya"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Telefon raqamingiz *</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder="+998901234567"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Yetkazib berish manzili</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="Shahar, tuman, ko'cha, uy"
          rows="3"
        />
      </div>
      
      <div className="form-group">
        <label>Miqdor</label>
        <div className="quantity-selector">
          <button onClick={decreaseQuantity} type="button">-</button>
          <span>{formData.quantity}</span>
          <button onClick={increaseQuantity} type="button">+</button>
        </div>
      </div>
      
      {product && (
        <div className="order-summary">
          <h4>Buyurtma xulosasi:</h4>
          <p><strong>Mahsulot:</strong> {product.name}</p>
          <p><strong>Narx:</strong> {product.price.toLocaleString()} so'm</p>
          <p><strong>Jami:</strong> {(product.price * formData.quantity).toLocaleString()} so'm</p>
        </div>
      )}
      
      <div className="form-notice">
        <p>* Tugmani bosganingizda buyurtma bot'ga yuboriladi va app yopiladi.</p>
      </div>
    </div>
  );
};

export default OrderForm;