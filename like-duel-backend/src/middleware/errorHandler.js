// src/middleware/errorHandler.js
import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('❌ Xatolik:', err.message);
  logger.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Serverda xatolik yuz berdi';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
