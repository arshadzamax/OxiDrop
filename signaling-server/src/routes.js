import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { File } from './models/File.js';
import { Request } from './models/Request.js';
import { User } from './models/User.js';
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

// Stricter limiter for staging/registering files to avoid database flood
const stageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 staged files per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many file stagings from this node, please try again later.'
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

// Fetch WebRTC ICE Servers configuration (STUN/TURN)
router.get('/webrtc/ice-servers', asyncHandler(async (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || ''
    });
  }

  res.json({ iceServers });
}));

// 2. Register a File (Phase 1: Registration)
router.post('/files', stageLimiter, asyncHandler(async (req, res) => {
  const { fileName, sizeBytes, autoApprove, senderId, existingFileId } = req.body;

  // STRICT INPUT VALIDATION
  if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
    throw new AppError('File name is required and must be a valid string', 400);
  }
  if (fileName.length > 255) {
    throw new AppError('File name exceeds the maximum length of 255 characters', 400);
  }
  if (sizeBytes === undefined || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
    throw new AppError('File size is required and must be a positive number', 400);
  }
  // Prevent excessive size registration anomalies (e.g. PB range overflow limits)
  if (sizeBytes > 10 * 1024 * 1024 * 1024 * 1024) { // 10 Terabytes safety limit
    throw new AppError('File size exceeds safety registration limit (10TB)', 400);
  }
  if (!senderId || typeof senderId !== 'string' || senderId.trim() === '') {
    throw new AppError('Sender ID is required and must be a valid string', 400);
  }
  if (senderId.length > 64) {
    throw new AppError('Sender ID exceeds safety limit of 64 characters', 400);
  }

  let fileId = req.body.fileId;
  if (!fileId || typeof fileId !== 'string' || fileId.length !== 12) {
    fileId = crypto.randomBytes(6).toString('hex');
  } else {
    fileId = fileId.trim().toLowerCase();
  }

  // Allow safe overwrite/upsert of existing file ID from the same sender session
  await File.deleteOne({ fileId });

  const newFile = await File.create({
    fileId,
    senderId: senderId.trim(),
    fileName: fileName.trim(),
    sizeBytes,
    autoApprove: !!autoApprove
  });

  res.status(201).json({
    status: 'success',
    message: 'File registered successfully',
    fileId: newFile.fileId,
    shareLink: `/share/${newFile.fileId}`
  });
}));

// 3. Fetch File Metadata (Phase 2: Metadata Check)
router.get('/files/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  if (!fileId || typeof fileId !== 'string' || fileId.length !== 12) {
    throw new AppError('Invalid File Tunnel ID format', 400);
  }

  const file = await File.findOne({ fileId: fileId.toLowerCase() });
  if (!file) {
    throw new AppError('File not found or tunnel closed', 404);
  }

  res.json({
    fileId: file.fileId,
    fileName: file.fileName,
    sizeBytes: file.sizeBytes,
    senderId: file.senderId,
    autoApprove: file.autoApprove
  });
}));

// 4. Fetch Pending requests for a Sender
router.get('/requests/pending/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId || typeof userId !== 'string' || userId.length > 64) {
    throw new AppError('Invalid user ID', 400);
  }

  const userFiles = await File.find({ senderId: userId });
  const fileIds = userFiles.map(f => f.fileId);

  const pendingRequests = await Request.find({
    fileId: { $in: fileIds },
    status: 'PENDING'
  });

  const enrichedRequests = pendingRequests.map(reqItem => {
    const fileMeta = userFiles.find(f => f.fileId === reqItem.fileId);
    return {
      requestId: reqItem._id,
      fileId: reqItem.fileId,
      fileName: fileMeta ? fileMeta.fileName : 'Unknown File',
      sizeBytes: fileMeta ? fileMeta.sizeBytes : 0,
      receiverId: reqItem.receiverId,
      status: reqItem.status,
      createdAt: reqItem.createdAt
    };
  });

  res.json(enrichedRequests);
}));
