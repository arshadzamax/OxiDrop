import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const requiredEnv = ['MONGODB_URI'];

// Check required environments ONLY when running in production
if (process.env.NODE_ENV === 'production') {
  const missing = requiredEnv.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing crucial environment variables in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT || '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/oxidrop';

// CORS configuration (specify domain in production for security)
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// WebSocket configurations
export const MAX_MESSAGE_SIZE = parseInt(process.env.MAX_MESSAGE_SIZE || '65536', 10); // 64KB message payload limit
export const PING_INTERVAL = 30000; // 30 seconds connection test interval
export const PING_TIMEOUT = 10000; // 10 seconds wait time for client pong
