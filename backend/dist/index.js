"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 3000;
// CORS sozlamalari
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true
    }
});
// Asosiy route
app.get('/', (req, res) => {
    res.json({ message: 'Like Duel Backend API', version: '1.0.0' });
});
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Socket connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
// Serverni ishga tushirish
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
//# sourceMappingURL=index.js.map