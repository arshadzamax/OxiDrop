import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Room } from './models/Room.js';
import { asyncHandler, AppError } from './middleware/errorHandler.js';

export const router = express.Router();

// --- Production Rate Limiters ---

// Base api limiter to protect endpoints from scraping
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many requests, please try again later.'
  }
});

// Stricter limiter for room creation to prevent database flood
const roomCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 room creations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many room creations from this node, please try again later.'
  }
});

// Apply general rate limit to all routes
router.use(generalLimiter);

// --- Endpoints ---

// 1. Health Probe Route: Critical for container platforms (K8s, ECS, PM2)
router.get('/health', asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState;
  // readyState states: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbConnected = dbState === 1;

  const health = {
    status: dbConnected ? 'UP' : 'DOWN',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'CONNECTED' : 'DISCONNECTED'
    }
  };

  if (!dbConnected) {
    return res.status(503).json(health);
  }
  res.json(health);
}));

// 2. Fetch WebRTC ICE Servers configuration (STUN/TURN)
router.get('/webrtc/ice-servers', asyncHandler(async (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // If a Metered.ca API Key is present, dynamically fetch active TURN credentials
  if (process.env.METERED_API_KEY) {
    try {
      const response = await fetch(
        `https://oxidrop.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
      );
      if (response.ok) {
        const meteredServers = await response.json();
        if (Array.isArray(meteredServers)) {
          iceServers.push(...meteredServers);
        }
      } else {
        console.error('Metered.ca API returned error status:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch dynamic TURN credentials from Metered.ca:', err.message);
    }
  } else if (process.env.TURN_URL) {
    // Fallback to manual static TURN configuration if configured
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || ''
    });
  }

  res.json({ iceServers });
}));

// 3. Create a Room (Connection-First: pair devices before file selection)
router.post('/rooms', roomCreateLimiter, asyncHandler(async (req, res) => {
  const { hostId } = req.body;

  if (!hostId || typeof hostId !== 'string' || hostId.trim() === '') {
    throw new AppError('Host ID is required and must be a valid string', 400);
  }
  if (hostId.length > 64) {
    throw new AppError('Host ID exceeds safety limit of 64 characters', 400);
  }

  // Generate a unique 6-char hex room code
  const roomCode = crypto.randomBytes(3).toString('hex');

  const room = await Room.create({
    roomCode,
    hostId: hostId.trim()
  });

  res.status(201).json({
    status: 'success',
    roomCode: room.roomCode
  });
}));

// 4. Get Room Status
router.get('/rooms/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;

  if (!code || typeof code !== 'string' || code.length !== 6) {
    throw new AppError('Invalid room code format (must be 6 hex characters)', 400);
  }

  const room = await Room.findOne({ roomCode: code.toLowerCase() });
  if (!room) {
    throw new AppError('Room not found or expired', 404);
  }

  res.json({
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.guestId ? 'paired' : 'waiting'
  });
}));
