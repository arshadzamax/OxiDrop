import { WebSocketServer } from 'ws';
import { User } from './models/User.js';
import { File } from './models/File.js';
import { Request } from './models/Request.js';
import { logger } from './utils/logger.js';
import { MAX_MESSAGE_SIZE, PING_INTERVAL } from './config.js';

// Map of userId -> WebSocket connection object (in-memory relay context)
const clients = new Map();
let heartbeatInterval = null;

// Helper to deliver serialized JSON packets
const sendJson = (ws, type, data) => {
  if (ws && ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify({ type, data }));
    } catch (err) {
      logger.error(`Failed to send WebSocket JSON message: ${err.message}`, err);
    }
  }
};

export const initWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({ 
    server: httpServer,
    // Prevent client resource starvation by enforcing limits
    maxPayload: MAX_MESSAGE_SIZE
  });

  // 1. Establish Heartbeat (Ping-Pong) Loop to detect dead/silent sockets
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.warn('Terminating unresponsive zombie WebSocket connection.');
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        logger.error(`Error sending heartbeat ping: ${err.message}`);
        ws.terminate();
      }
    });
  }, PING_INTERVAL);

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    ws.isAlive = true;
    let authenticatedUserId = null;

    logger.info(`New WebSocket socket handshake initialized from IP: ${clientIp}`);

    // Register active pong handler
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (messageStr) => {
      // Safety mark: mark connection alive on any incoming message
      ws.isAlive = true;

      // Protection: Enforce maximum message length check
      if (messageStr.length > MAX_MESSAGE_SIZE) {
        logger.warn(`Message payload overflow: ${messageStr.length} bytes from ${authenticatedUserId || clientIp}. Connection closed.`);
        ws.close(1009, 'Message size limit exceeded');
        return;
      }

      try {
        const message = JSON.parse(messageStr);
        const { type, data } = message;

        if (!type || typeof type !== 'string') {
          logger.warn(`Received message without type string from ${authenticatedUserId || clientIp}`);
          return;
        }

        switch (type) {
          // A. Client registers connection mapping
          case 'register_user': {
            const { userId } = data || {};
            if (!userId || typeof userId !== 'string' || userId.trim() === '') {
              logger.warn(`Registration attempt without valid userId from IP ${clientIp}`);
              return;
            }

            const cleanUserId = userId.trim();
            if (cleanUserId.length > 64) {
              logger.warn(`Registration rejected: userId too long from IP ${clientIp}`);
              return;
            }

            authenticatedUserId = cleanUserId;
            clients.set(cleanUserId, ws);
            logger.info(`User online registration: ${cleanUserId}`);

            await User.findOneAndUpdate(
              { userId: cleanUserId },
              { socketId: 'ws_active', isOnline: true, lastSeen: new Date() },
              { upsert: true, new: true }
            );

            // Fetch and push pending requests automatically on login
            const userFiles = await File.find({ senderId: cleanUserId });
            const fileIds = userFiles.map(f => f.fileId);
            const pendingRequests = await Request.find({ fileId: { $in: fileIds }, status: 'PENDING' });

            if (pendingRequests.length > 0) {
              sendJson(ws, 'pending_requests_alert', pendingRequests);
            }
            break;
          }

          // B. Receiver requests file access
          case 'request_access': {
            const { fileId, receiverId } = data || {};
            if (!fileId || typeof fileId !== 'string' || !receiverId || typeof receiverId !== 'string') {
              logger.warn('Received invalid request_access payload parameters.');
              return;
            }

            const cleanFileId = fileId.trim().toLowerCase();
            const cleanReceiverId = receiverId.trim();

            const file = await File.findOne({ fileId: cleanFileId });
            if (!file) {
              sendJson(ws, 'error_message', { message: 'File not found or tunnel closed' });
              return;
            }

            const initialStatus = file.autoApprove ? 'APPROVED' : 'PENDING';
            const request = await Request.findOneAndUpdate(
              { fileId: cleanFileId, receiverId: cleanReceiverId },
              { status: initialStatus, createdAt: new Date() },
              { upsert: true, new: true }
            );

            logger.info(`Access request for file ${cleanFileId} by receiver ${cleanReceiverId}. Status: ${initialStatus}`);

            // Send confirmation back to receiver
            sendJson(ws, 'request_status_update', { fileId: cleanFileId, status: initialStatus, senderId: file.senderId });

            // Notify sender if online
            const senderWs = clients.get(file.senderId);
            if (senderWs) {
              sendJson(senderWs, 'new_access_request', {
                requestId: request._id,
                fileId: cleanFileId,
                fileName: file.fileName,
                sizeBytes: file.sizeBytes,
                receiverId: cleanReceiverId,
                autoApproved: file.autoApprove
              });
            }
            break;
          }

          // C. Sender approves access
          case 'approve_request': {
            const { fileId, receiverId } = data || {};
            if (!fileId || typeof fileId !== 'string' || !receiverId || typeof receiverId !== 'string') {
              return;
            }

            const cleanFileId = fileId.trim().toLowerCase();
            const cleanReceiverId = receiverId.trim();

            const file = await File.findOne({ fileId: cleanFileId });
            if (!file) return;

            // Verify sender authentication
            if (file.senderId !== authenticatedUserId) {
              logger.warn(`Unauthorized approve_request attempt on file ${cleanFileId} by user ${authenticatedUserId}`);
              return;
            }

            await Request.findOneAndUpdate(
              { fileId: cleanFileId, receiverId: cleanReceiverId },
              { status: 'APPROVED' }
            );

            logger.info(`Access approved by sender for file ${cleanFileId} to receiver ${cleanReceiverId}`);

            // Forward approval status to receiver
            const receiverWs = clients.get(cleanReceiverId);
            if (receiverWs) {
              sendJson(receiverWs, 'request_status_update', {
                fileId: cleanFileId,
                status: 'APPROVED',
                senderId: file.senderId
              });
            }
            break;
          }

          // D. Relay SDP Offer
          case 'send_offer': {
            const { toUserId, offer } = data || {};
            if (!toUserId || typeof toUserId !== 'string' || !offer || typeof offer !== 'string') return;

            const targetWs = clients.get(toUserId);
            if (targetWs) {
              sendJson(targetWs, 'receive_offer', {
                fromUserId: authenticatedUserId,
                offer
              });
              logger.debug(`Relayed SDP Offer from ${authenticatedUserId} to ${toUserId}`);
            }
            break;
          }

          // E. Relay SDP Answer
          case 'send_answer': {
            const { toUserId, answer } = data || {};
            if (!toUserId || typeof toUserId !== 'string' || !answer || typeof answer !== 'string') return;

            const targetWs = clients.get(toUserId);
            if (targetWs) {
              sendJson(targetWs, 'receive_answer', {
                fromUserId: authenticatedUserId,
                answer
              });
              logger.debug(`Relayed SDP Answer from ${authenticatedUserId} to ${toUserId}`);
            }
            break;
          }

          // F. Relay ICE Candidate
          case 'send_ice_candidate': {
            const { toUserId, candidate } = data || {};
            if (!toUserId || typeof toUserId !== 'string' || !candidate) return;

            const targetWs = clients.get(toUserId);
            if (targetWs) {
              sendJson(targetWs, 'receive_ice_candidate', {
                fromUserId: authenticatedUserId,
                candidate
              });
            }
            break;
          }

          // G. Track completion
          case 'transfer_completed': {
            const { fileId, receiverId } = data || {};
            if (!fileId || typeof fileId !== 'string' || !receiverId || typeof receiverId !== 'string') return;

            const cleanFileId = fileId.trim().toLowerCase();
            const cleanReceiverId = receiverId.trim();

            await Request.findOneAndUpdate(
              { fileId: cleanFileId, receiverId: cleanReceiverId },
              { status: 'COMPLETED' }
            );
            logger.info(`Transfer of file ${cleanFileId} to receiver ${cleanReceiverId} completed successfully.`);
            break;
          }

          default:
            logger.warn(`Unregistered WebSocket event type parsed: ${type}`);
        }
      } catch (err) {
        logger.error('Error parsing Socket message packet:', err);
      }
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket socket error for ${authenticatedUserId || clientIp}: ${err.message}`, err);
    });

    ws.on('close', async (code, reason) => {
      logger.info(`WebSocket closed connection for ${authenticatedUserId || clientIp}. Code: ${code}, Reason: ${reason}`);
      
      if (authenticatedUserId) {
        clients.delete(authenticatedUserId);

        try {
          await User.findOneAndUpdate(
            { userId: authenticatedUserId },
            { isOnline: false, socketId: null, lastSeen: new Date() }
          );
          
          // Removed instant pruning of offline sender sessions to allow persistence across page reloads.
          // Files will eventually expire according to their TTL (4 hours).
          // const userFiles = await File.find({ senderId: authenticatedUserId });
          // const fileIds = userFiles.map(f => f.fileId);
          // if (fileIds.length > 0) {
          //   await File.deleteMany({ senderId: authenticatedUserId });
          //   await Request.deleteMany({ fileId: { $in: fileIds } });
          //   logger.info(`Pruned offline sender session details: ${fileIds.length} files removed.`);
          // }
        } catch (err) {
          logger.error(`Database error during session pruning for user ${authenticatedUserId}: ${err.message}`);
        }
      }
    });
  });
};

// Graceful closing of all connections and timers on shutdown
export const closeWebSocketServer = () => {
  logger.info('Stopping WebSocket signaling heartbeats...');
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  logger.info(`Closing active socket streams for ${clients.size} clients...`);
  for (const [userId, ws] of clients.entries()) {
    try {
      ws.close(1001, 'Server shutting down');
    } catch (e) {
      ws.terminate();
    }
  }
  clients.clear();
};
