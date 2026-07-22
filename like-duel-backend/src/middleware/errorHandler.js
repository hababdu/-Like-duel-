// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Xatolik:', err.message);
    console.error(err.stack);
  
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Serverda xatolik yuz berdi';
  
    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };