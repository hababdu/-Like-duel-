// src/config/database.js
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;

export const connectDB = async () => {
  // Agar allaqachon ulangan bo'lsa
  if (isConnected) {
    logger.info('📊 MongoDB allaqachon ulangan');
    return;
  }

  // Maksimal urinishlar soni
  if (retryCount >= MAX_RETRIES) {
    logger.error(`❌ MongoDB ulanish ${MAX_RETRIES} marta urinildi va muvaffaqiyatsiz tugadi`);
    return;
  }

  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    logger.info(`🔄 MongoDB ulanishga urinish ${retryCount + 1}/${MAX_RETRIES}...`);

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    isConnected = true;
    retryCount = 0;
    logger.info('💾 MongoDB muvaffaqiyatli ulandi');
    logger.info(`📊 Database: ${mongoose.connection.name}`);

    // MongoDB event'lar
    mongoose.connection.on('error', (err) => {
      logger.error('🔴 MongoDB xatolik:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🟡 MongoDB uzildi');
      isConnected = false;
      // 5 sekunddan keyin qayta ulanish
      setTimeout(() => {
        if (!isConnected) {
          connectDB();
        }
      }, 5000);
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🟢 MongoDB qayta ulandi');
      isConnected = true;
    });

  } catch (error) {
    logger.error('🔴 MongoDB ulanish xatoligi:', error.message);
    isConnected = false;
    retryCount++;
    
    if (retryCount < MAX_RETRIES) {
      logger.info(`⏳ 5 sekunddan keyin qayta urinish (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connectDB, 5000);
    } else {
      logger.error(`❌ MongoDB ulanish ${MAX_RETRIES} marta urinildi va muvaffaqiyatsiz tugadi`);
    }
    
    throw error;
  }
};

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    retryCount = 0;
    logger.info('📊 MongoDB uzildi');
  }
};

export const getConnectionStatus = () => isConnected;