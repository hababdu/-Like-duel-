import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const LoadingScreen = ({ message = 'Yuklanmoqda...' }) => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const loadingTips = [
    "Tosh qaychini yengadi",
    "Qaychi qog'ozni yengadi",
    "Qog'oz toshni yengadi",
    "Har bir g'alaba ELO reytingni oshiradi",
    "Turnirlarda katta sovrinlar yutib oling",
    "Do'stlaringizni taklif qilib o'ynang"
  ];

  const randomTip = loadingTips[Math.floor(Math.random() * loadingTips.length)];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="loading-screen"
    >
      <div className="loading-content">
        {/* Animated logo */}
        <div className="loading-logo">
          <motion.div
            className="logo-piece rock"
            animate={{
              rotate: [0, 10, 0, -10, 0],
              y: [0, -10, 0, 10, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            ✊
          </motion.div>
          
          <motion.div
            className="logo-piece paper"
            animate={{
              rotate: [0, -10, 0, 10, 0],
              y: [0, 10, 0, -10, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2
            }}
          >
            ✋
          </motion.div>
          
          <motion.div
            className="logo-piece scissors"
            animate={{
              rotate: [0, 10, 0, -10, 0],
              y: [0, -10, 0, 10, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.4
            }}
          >
            ✌️
          </motion.div>
        </div>

        {/* Loading message */}
        <div className="loading-text">
          <h2>{message}{dots}</h2>
          
          <motion.div
            className="loading-bar"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Tips */}
        <div className="loading-tip">
          <div className="tip-icon">💡</div>
          <p>{randomTip}</p>
        </div>

        {/* Stats preview */}
        <div className="loading-stats">
          <div className="stat-preview">
            <div className="stat-icon">🎮</div>
            <div className="stat-info">
              <div className="stat-value">1000+</div>
              <div className="stat-label">Online o'yinchi</div>
            </div>
          </div>
          
          <div className="stat-preview">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Turnirlar</div>
            </div>
          </div>
          
          <div className="stat-preview">
            <div className="stat-icon">⭐</div>
            <div className="stat-info">
              <div className="stat-value">7</div>
              <div className="stat-label">Darajalar</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;