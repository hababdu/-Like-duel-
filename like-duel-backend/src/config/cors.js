// src/config/cors.js
import cors from 'cors';

const allowedOrigins = [
  'https://telegram-mini-app-gsny.onrender.com',
  'https://like-admin-m9j1n851q-habibulloabdumutallibovs-projects.vercel.app',
  'https://like-admin-*.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://telegram-bot-server-2-matj.onrender.com'
];

export const setupCORS = (app) => {
  // Custom CORS middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const NODE_ENV = process.env.NODE_ENV || 'production';
    
    if (NODE_ENV === 'development') {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (origin) {
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return allowed === origin;
      });
      
      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-admin-key, X-Requested-With, x-telegram-init-data');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // Alternativ cors package
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      
      const NODE_ENV = process.env.NODE_ENV || 'production';
      
      if (NODE_ENV === 'development') {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-admin-key', 'X-Requested-With', 'x-telegram-init-data'],
    maxAge: 86400
  }));

  console.log('✅ CORS sozlamalari faollashtirildi');
};