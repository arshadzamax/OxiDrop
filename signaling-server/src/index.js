import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { PORT, CORS_ORIGIN } from './config.js';
import { connectDB, disconnectDB } from './db.js';
import { router } from './routes.js';
import { initWebSocketServer, closeWebSocketServer } from './socket.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

// 1. Security Headers Middleware (Helmet)
app.use(helmet());

// 2. Trust Proxy (Crucial for rate limiters to get correct IP addresses behind Nginx/Cloudflare)
app.set('trust proxy', 1);

// 3. CORS Policy configuration
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Initialize Database connection
connectDB();

// Bind HTTP API routes
app.use('/api', router);

// Root Keep-Alive Health Check Endpoint (for monitors like UptimeRobot)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', service: 'OxiDrop Signaling Server' });
});

// Bind WebSocket server
initWebSocketServer(httpServer);

// 4. Centralized API error handling middleware (MUST be placed after all routes)
app.use(errorHandler);

// Boot HTTP Server
httpServer.listen(PORT, () => {
  logger.info(`OxiDrop Signaling Server (Room-Based Architecture) running on port ${PORT}`);
  logger.info('[Config] Architecture: Connection-First Room Pairing (devices pair first, files transfer over P2P data channel)');
  if (process.env.METERED_API_KEY) {
    logger.info('[Config] METERED_API_KEY is configured. Dynamic TURN server credentials active.');
  } else {
    logger.warn('[Config] METERED_API_KEY is missing! TURN server relay fallback will be inactive. Mobile-to-PC connections may fail.');
  }
});

// --- Graceful Shutdown Management ---

const gracefulShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown procedure...`);

  // Force shutdown timeout helper to prevent hanging processes
  const forceTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing server termination.');
    process.exit(1);
  }, 10000); // 10 seconds

  // Stop accepting new HTTP requests
  httpServer.close(() => {
    logger.info('HTTP server stopped accepting new connection streams.');
  });

  // Gracefully terminate WebSocket connections and heartbeats
  closeWebSocketServer();

  // Gracefully disconnect from database
  await disconnectDB();

  clearTimeout(forceTimeout);
  logger.info('Shutdown clean. Server terminated successfully.');
  process.exit(0);
};

// Listen to system signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capture uncaught exception crashes
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION CRASH:', err);
  // Fail-fast on uncaught exceptions as memory states might be corrupt
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION DETECTED:', new Error(String(reason)));
});
