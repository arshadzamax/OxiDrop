import { WebSocketServer } from 'ws';
import { User } from './models/User.js';
import { File } from './models/File.js';
import { Request } from './models/Request.js';

// Map of userId -> WebSocket connection object (in-memory relay context)
const clients = new Map();

// Helper to deliver serialized JSON packets
const sendJson = (ws, type, data) => {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
};

export const initWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    let authenticatedUserId = null;
    console.log('WebSocket connection initialized');

    ws.on('message', async (messageStr) => {
      try {
        const message = JSON.parse(messageStr);
        const { type, data } = message;

        switch (type) {
          // 1. Client registers connection mapping
          case 'register_user': {
            const { userId } = data;
            if (!userId) return;

            authenticatedUserId = userId;
            clients.set(userId, ws);
            console.log(`User online registration: ${userId}`);

            await User.findOneAndUpdate(
              { userId },
              { socketId: 'ws_active', isOnline: true, lastSeen: new Date() },
              { upsert: true, new: true }
            );

            // Fetch and push pending requests automatically on login
            const userFiles = await File.find({ senderId: userId });
            const fileIds = userFiles.map(f => f.fileId);
            const pendingRequests = await Request.find({ fileId: { $in: fileIds }, status: 'PENDING' });

            if (pendingRequests.length > 0) {
              sendJson(ws, 'pending_requests_alert', pendingRequests);
            }
            break;
          }

          // 2. Receiver requests file access
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

            console.log(`Access request generated for file ${fileId} by receiver ${receiverId}. Status: ${initialStatus}`);

            // Send confirmation back to receiver
            sendJson(ws, 'request_status_update', { fileId, status: initialStatus, senderId: file.senderId });

            // Notify sender if online
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

          // 3. Sender approves access
          case 'approve_request': {
            const { fileId, receiverId } = data;
            if (!fileId || !receiverId) return;

            const file = await File.findOne({ fileId });
            if (!file) return;

            await Request.findOneAndUpdate(
              { fileId, receiverId },
              { status: 'APPROVED' }
            );

            console.log(`Access request approved by sender for file ${fileId} to receiver ${receiverId}`);

            // Forward approval status to receiver
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

          // --- WebRTC Signaling Pass-Through Relays ---

          // 4. Relay SDP Offer
          case 'send_offer': {
            const { toUserId, offer } = data;
            const targetWs = clients.get(toUserId);
            if (targetWs) {
              sendJson(targetWs, 'receive_offer', {
                fromUserId: authenticatedUserId,
                offer
              });
              console.log(`Relayed SDP Offer from ${authenticatedUserId} to ${toUserId}`);
            }
            break;
          }

          // 5. Relay SDP Answer
          case 'send_answer': {
            const { toUserId, answer } = data;
            const targetWs = clients.get(toUserId);
            if (targetWs) {
              sendJson(targetWs, 'receive_answer', {
                fromUserId: authenticatedUserId,
                answer
              });
              console.log(`Relayed SDP Answer from ${authenticatedUserId} to ${toUserId}`);
            }
            break;
          }

          // 6. Relay ICE Candidate
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

          // 7. Track completion
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
            console.log(`Unregistered WebSocket event type: ${type}`);
        }
      } catch (err) {
        console.error('Error processing Socket messaging packet:', err);
      }
    });

    ws.on('close', async () => {
      if (authenticatedUserId) {
        console.log(`User offline: ${authenticatedUserId}`);
        clients.delete(authenticatedUserId);

        await User.findOneAndUpdate(
          { userId: authenticatedUserId },
          { isOnline: false, socketId: null, lastSeen: new Date() }
        );
      }
    });
  });
};
