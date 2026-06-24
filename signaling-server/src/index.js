import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

// CORS configuration - allow localhost for dev
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Connect to Database
connectDB();

// --- HTTP API Endpoints ---

// 1. Register a File (Phase 1: Registration)
// Senders call this to declare a file is available for sharing.
app.post('/api/files', async (req, res) => {
  try {
    const { fileName, sizeBytes, autoApprove, senderId } = req.body;

    // SECURITY: Validate inputs to avoid database pollution and NoSQL injections
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      return res.status(400).json({ error: 'Invalid file size' });
    }
    if (!senderId || typeof senderId !== 'string') {
      return res.status(400).json({ error: 'Invalid sender ID' });
    }

    // Generate a unique 8-character string for the shareable link
    // CONCEPT: A shorter link is easier to share. 8 characters of cryptographically secure random bytes
    // hex encoded gives 16 hex characters, or we can slice it. Let's use 12 hex chars.
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
// Receivers call this to verify what file they are requesting.
app.get('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Prevent NoSQL injection by ensuring fileId is parsed strictly as a string
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

// 3. Fetch Pending requests for a Sender
app.get('/api/requests/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all files belonging to this sender
    const userFiles = await File.find({ senderId: userId });
    const fileIds = userFiles.map(f => f.fileId);

    // Find all pending requests for these files
    const pendingRequests = await Request.find({
      fileId: { $in: fileIds },
      status: 'PENDING'
    });

    // Populate file metadata for the frontend
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


// --- WebSockets / Signaling Server (Socket.io) ---

// WEBRTC SIGNALING PRINCIPLE: WebRTC establishes peer-to-peer connections directly, 
// but initially, peers don't know each other's IP addresses, firewalls, or codecs.
// The signaling server acts as a middleman to swap this connection info (SDP and ICE Candidates).
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Client identification
  socket.on('register_user', async ({ userId }) => {
    if (!userId) return;
    
    console.log(`User registered: ${userId} on socket ${socket.id}`);
    
    // Update or insert the user connection state
    await User.findOneAndUpdate(
      { userId },
      { socketId: socket.id, isOnline: true, lastSeen: new Date() },
      { upsert: true, new: true }
    );

    // Fetch and send user pending requests immediately on reconnection
    const userFiles = await File.find({ senderId: userId });
    const fileIds = userFiles.map(f => f.fileId);
    const pendingRequests = await Request.find({ fileId: { $in: fileIds }, status: 'PENDING' });
    
    if (pendingRequests.length > 0) {
      socket.emit('pending_requests_alert', pendingRequests);
    }
  });

  // 2. Receiver requests access to a file (Phase 2)
  socket.on('request_access', async ({ fileId, receiverId }) => {
    try {
      if (!fileId || !receiverId) return;

      const file = await File.findOne({ fileId });
      if (!file) {
        socket.emit('error_message', { message: 'File not found' });
        return;
      }

      // Upsert Request: status defaults to PENDING
      // If autoApprove is enabled, we set status to APPROVED immediately
      const initialStatus = file.autoApprove ? 'APPROVED' : 'PENDING';
      
      const request = await Request.findOneAndUpdate(
        { fileId, receiverId },
        { status: initialStatus, createdAt: new Date() },
        { upsert: true, new: true }
      );

      console.log(`Access request created for File: ${fileId} by Receiver: ${receiverId}. Status: ${initialStatus}`);

      // Notify the sender if they are online
      const sender = await User.findOne({ userId: file.senderId });
      if (sender && sender.isOnline && sender.socketId) {
        io.to(sender.socketId).emit('new_access_request', {
          requestId: request._id,
          fileId,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
          receiverId,
          autoApproved: file.autoApprove
        });
      }

      // If auto-approved, let the receiver know immediately they can prepare for WebRTC
      if (file.autoApprove) {
        socket.emit('request_status_update', { fileId, status: 'APPROVED' });
      } else {
        socket.emit('request_status_update', { fileId, status: 'PENDING' });
      }

    } catch (err) {
      console.error('Socket request_access error:', err);
      socket.emit('error_message', { message: 'Error processing access request' });
    }
  });

  // 3. Sender approves access (Phase 3: Handshake start)
  socket.on('approve_request', async ({ fileId, receiverId }) => {
    try {
      const file = await File.findOne({ fileId });
      if (!file) return;

      await Request.findOneAndUpdate(
        { fileId, receiverId },
        { status: 'APPROVED' }
      );

      console.log(`Sender approved file ${fileId} for receiver ${receiverId}`);

      // Notify receiver that their request has been approved
      const receiver = await User.findOne({ userId: receiverId });
      if (receiver && receiver.isOnline && receiver.socketId) {
        io.to(receiver.socketId).emit('request_status_update', {
          fileId,
          status: 'APPROVED',
          senderId: file.senderId
        });
      }
    } catch (err) {
      console.error('Socket approve_request error:', err);
    }
  });

  // --- WebRTC Signaling Pass-Through ---
  // WebRTC handshakes consist of exchanging SDP (Offers/Answers) and network configurations (ICE Candidates).
  // Signaling servers do not parse this data; they simply deliver it from Peer A to Peer B.

  // 4. Send WebRTC Offer
  socket.on('send_offer', async ({ toUserId, offer }) => {
    const targetUser = await User.findOne({ userId: toUserId });
    if (targetUser && targetUser.isOnline && targetUser.socketId) {
      io.to(targetUser.socketId).emit('receive_offer', {
        fromSocketId: socket.id,
        fromUserId: offer.fromUserId, // Custom attribute attached to trace sender
        offer: offer.sdp
      });
      console.log(`Forwarded WebRTC Offer to user ${toUserId}`);
    }
  });

  // 5. Send WebRTC Answer
  socket.on('send_answer', async ({ toUserId, answer }) => {
    const targetUser = await User.findOne({ userId: toUserId });
    if (targetUser && targetUser.isOnline && targetUser.socketId) {
      io.to(targetUser.socketId).emit('receive_answer', {
        fromSocketId: socket.id,
        answer: answer.sdp
      });
      console.log(`Forwarded WebRTC Answer to user ${toUserId}`);
    }
  });

  // 6. Send ICE Candidate
  // ICE Candidates are public-facing IP endpoints/ports that a client discovers using a STUN server.
  // Peers exchange ICE Candidates to test direct paths until they find the fastest direct route.
  socket.on('send_ice_candidate', async ({ toUserId, candidate }) => {
    const targetUser = await User.findOne({ userId: toUserId });
    if (targetUser && targetUser.isOnline && targetUser.socketId) {
      io.to(targetUser.socketId).emit('receive_ice_candidate', {
        fromSocketId: socket.id,
        candidate
      });
    }
  });

  // 7. Mark Request as Completed
  socket.on('transfer_completed', async ({ fileId, receiverId }) => {
    await Request.findOneAndUpdate(
      { fileId, receiverId },
      { status: 'COMPLETED' }
    );
    console.log(`Transfer of file ${fileId} to receiver ${receiverId} completed!`);
  });

  // 8. Handle Disconnection
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Set the user who had this socketId offline
    await User.findOneAndUpdate(
      { socketId: socket.id },
      { isOnline: false, socketId: null, lastSeen: new Date() }
    );
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
