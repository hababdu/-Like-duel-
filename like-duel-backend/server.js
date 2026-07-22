// server.js
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { connectDB } from './src/config/database.js';
import { setupCORS } from './src/config/cors.js';
import { setupSocket } from './src/config/socket.js';
import routes from './src/routes/index.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { rateLimiter } from './src/middleware/rateLimit.js';
import logger from './src/utils/logger.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

// ======================
// MIDDLEWARE
// ======================
setupCORS(app);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ======================
// ROUTES
// ======================
app.use('/api', routes);

// ======================
// ERROR HANDLER
// ======================
app.use(errorHandler);

// ======================
// DATABASE
// ======================
await connectDB();

// ======================
// SOCKET.IO
// ======================
setupSocket(server);

// ======================
// START SERVER
// ======================
server.listen(PORT, () => {
  logger.info(`🚀 Server ${PORT}-portda ishga tushdi`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ======================
// UNHANDLED REJECTIONS
// ======================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});