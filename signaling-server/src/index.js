import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { connectDB } from './db.js';
import { User } from './models/User.js';
import { File } from './models/File.js';
import { Request } from './models/Request.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS Configuration: Allows clients to register files and get metadata via standard REST HTTP.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Establish connection to MongoDB
connectDB();

// --- HTTP API Endpoints ---

// 1. Register a File (Phase 1: Registration)
app.post('/api/files', async (req, res) => {
  try {
    const { fileName, sizeBytes, autoApprove, senderId } = req.body;

    // Security: Strict validation prevents malformed metadata insertion and injection attacks
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      return res.status(400).json({ error: 'Invalid file size' });
    }
    if (!senderId || typeof senderId !== 'string') {
      return res.status(400).json({ error: 'Invalid sender ID' });
    }

    // Generate unique 12-char hex file identifier for the shareable link
    const fileId = crypto.randomBytes(6).toString('hex');

    const newFile = await File.create({
      fileId,
      senderId,
      fileName,
      sizeBytes,
      autoApprove: !!autoApprove
    });

    res.status(201).json({
      message: 'File registered successfully',
      fileId: newFile.fileId,
      shareLink: `/share/${newFile.fileId}`
    });
  } catch (error) {
    console.error('File registration error:', error);
    res.status(500).json({ error: 'Server error during file registration' });
  }
});

// 2. Fetch File Metadata (Phase 2: Metadata Check)
app.get('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (typeof fileId !== 'string') {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await File.findOne({ fileId });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      fileId: file.fileId,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      senderId: file.senderId,
      autoApprove: file.autoApprove
    });
  } catch (error) {
    console.error('Fetch file metadata error:', error);
    res.status(500).json({ error: 'Server error fetching file metadata' });
  }
});

// 3. Fetch Pending Requests for a Sender (Polling fallback)
app.get('/api/requests/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

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
  } catch (error) {
    console.error('Fetch pending requests error:', error);
    res.status(500).json({ error: 'Server error fetching pending requests' });
  }
});


// --- Standard WebSockets Server (Signaling plane) ---

// Map of userId -> WebSocket connection object.
// Helps route WebRTC messages to specific online peers instantly.
const clients = new Map();

// Attach standard WebSocket server to our HTTP server
const wss = new WebSocketServer({ server: httpServer });

// Utility to send JSON messages safely
const sendJson = (ws, type, data) => {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
};

wss.on('connection', (ws) => {
  let authenticatedUserId = null;
  console.log('New WebSocket connection established');

  ws.on('message', async (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      const { type, data } = message;

      switch (type) {
        // 1. Client registers their ID upon establishing connection
        case 'register_user': {
          const { userId } = data;
          if (!userId) return;

          authenticatedUserId = userId;
          clients.set(userId, ws);
          console.log(`User registered on WS: ${userId}`);

          // Update MongoDB connection state
          await User.findOneAndUpdate(
            { userId },
            { socketId: 'ws_active', isOnline: true, lastSeen: new Date() },
            { upsert: true, new: true }
          );

          // Proactively fetch pending requests and send them to the reconnected sender
          const userFiles = await File.find({ senderId: userId });
          const fileIds = userFiles.map(f => f.fileId);
          const pendingRequests = await Request.find({ fileId: { $in: fileIds }, status: 'PENDING' });

          if (pendingRequests.length > 0) {
            sendJson(ws, 'pending_requests_alert', pendingRequests);
          }
          break;
        }

        // 2. Receiver requests access to a file
        case 'request_access': {
          const { fileId, receiverId } = data;
          if (!fileId || !receiverId) return;

          const file = await File.findOne({ fileId });
          if (!file) {
            sendJson(ws, 'error_message', { message: 'File not found' });
            return;
          }

          const initialStatus = file.autoApprove ? 'APPROVED' : 'PENDING';
          const request = await Request.findOneAndUpdate(
            { fileId, receiverId },
            { status: initialStatus, createdAt: new Date() },
            { upsert: true, new: true }
          );

          console.log(`Access request created for File: ${fileId} by Receiver: ${receiverId}. Status: ${initialStatus}`);

          // Notify receiver of current state
          sendJson(ws, 'request_status_update', { fileId, status: initialStatus, senderId: file.senderId });

          // Forward to Sender if online
          const senderWs = clients.get(file.senderId);
          if (senderWs) {
            sendJson(senderWs, 'new_access_request', {
              requestId: request._id,
              fileId,
              fileName: file.fileName,
              sizeBytes: file.sizeBytes,
              receiverId,
              autoApproved: file.autoApprove
            });
          }
          break;
        }

        // 3. Sender approves a request
        case 'approve_request': {
          const { fileId, receiverId } = data;
          if (!fileId || !receiverId) return;

          const file = await File.findOne({ fileId });
          if (!file) return;

          await Request.findOneAndUpdate(
            { fileId, receiverId },
            { status: 'APPROVED' }
          );

          console.log(`Sender approved file ${fileId} for receiver ${receiverId}`);

          // Notify receiver
          const receiverWs = clients.get(receiverId);
          if (receiverWs) {
            sendJson(receiverWs, 'request_status_update', {
              fileId,
              status: 'APPROVED',
              senderId: file.senderId
            });
          }
          break;
        }

        // --- WebRTC Signaling Pass-Through ---
        // Exchanging Session Description Protocol (SDP) and ICE candidates.
        
        // 4. Forward Offer
        case 'send_offer': {
          const { toUserId, offer } = data;
          const targetWs = clients.get(toUserId);
          if (targetWs) {
            sendJson(targetWs, 'receive_offer', {
              fromUserId: authenticatedUserId,
              offer
            });
            console.log(`Forwarded SDP Offer from ${authenticatedUserId} to ${toUserId}`);
          }
          break;
        }

        // 5. Forward Answer
        case 'send_answer': {
          const { toUserId, answer } = data;
          const targetWs = clients.get(toUserId);
          if (targetWs) {
            sendJson(targetWs, 'receive_answer', {
              fromUserId: authenticatedUserId,
              answer
            });
            console.log(`Forwarded SDP Answer from ${authenticatedUserId} to ${toUserId}`);
          }
          break;
        }

        // 6. Forward ICE Candidate
        case 'send_ice_candidate': {
          const { toUserId, candidate } = data;
          const targetWs = clients.get(toUserId);
          if (targetWs) {
            sendJson(targetWs, 'receive_ice_candidate', {
              fromUserId: authenticatedUserId,
              candidate
            });
          }
          break;
        }

        // 7. Mark file transfer as complete
        case 'transfer_completed': {
          const { fileId, receiverId } = data;
          if (!fileId || !receiverId) return;

          await Request.findOneAndUpdate(
            { fileId, receiverId },
            { status: 'COMPLETED' }
          );
          console.log(`Transfer of file ${fileId} to receiver ${receiverId} completed!`);
          break;
        }

        default:
          console.log(`Unknown message type: ${type}`);
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', async () => {
    if (authenticatedUserId) {
      console.log(`User offline: ${authenticatedUserId}`);
      clients.delete(authenticatedUserId);

      // Reflect offline status in DB
      await User.findOneAndUpdate(
        { userId: authenticatedUserId },
        { isOnline: false, socketId: null, lastSeen: new Date() }
      );
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
