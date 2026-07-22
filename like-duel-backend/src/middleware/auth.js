// src/middleware/auth.js
export const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
    const expectedKey = process.env.ADMIN_TOKEN || 'admin-secret-key';
    
    if (!adminKey || adminKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        message: "Admin ruxsati yo'q",
        error: 'FORBIDDEN'
      });
    }
    
    next();
  };