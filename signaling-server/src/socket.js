import { WebSocketServer } from 'ws';
import { User } from './models/User.js';
import { Room } from './models/Room.js';
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
            logger.info(`[Socket Registry] User online: ${cleanUserId}`);

            await User.findOneAndUpdate(
               { userId: cleanUserId },
               { socketId: 'ws_active', isOnline: true, lastSeen: new Date() },
               { upsert: true, new: true }
             );
 
             sendJson(ws, 'registered', { userId: cleanUserId });
 
             try {
               // 1. If this reconnected user is a Host and a Guest is already in the room
               const hostRoom = await Room.findOne({ hostId: cleanUserId });
               if (hostRoom && hostRoom.guestId) {
                 logger.info(`[Reconnect Sync] Host ${cleanUserId} recovered connection. Notifying Host about existing Guest ${hostRoom.guestId}`);
                 sendJson(ws, 'peer_joined', { peerId: hostRoom.guestId, roomCode: hostRoom.roomCode });
               }
 
               // 2. If this reconnected user is a Guest and is already paired in a room
               const guestRoom = await Room.findOne({ guestId: cleanUserId });
               if (guestRoom) {
                 logger.info(`[Reconnect Sync] Guest ${cleanUserId} recovered connection. Notifying Host ${guestRoom.hostId} to restart handshake`);
                 const hostWs = clients.get(guestRoom.hostId);
                 if (hostWs) {
                   sendJson(hostWs, 'peer_joined', { peerId: cleanUserId, roomCode: guestRoom.roomCode });
                 }
               }
             } catch (err) {
               logger.error(`[Reconnect Sync] Error during state recovery for ${cleanUserId}: ${err.message}`, err);
             }
             break;
          }

          // B. Host creates a new room for pairing
          case 'create_room': {
            const { userId } = data || {};
            if (!userId || typeof userId !== 'string' || userId.trim() === '') {
              sendJson(ws, 'error_message', { message: 'Valid userId is required to create a room' });
              return;
            }

            const cleanUserId = userId.trim();
            const crypto = await import('crypto');
            const roomCode = crypto.randomBytes(3).toString('hex');

            try {
              await Room.create({
                roomCode,
                hostId: cleanUserId
              });

              logger.info(`[Room] Created room ${roomCode} by host ${cleanUserId}`);
              sendJson(ws, 'room_created', { roomCode });
            } catch (err) {
              logger.error(`[Room] Failed to create room: ${err.message}`, err);
              sendJson(ws, 'error_message', { message: 'Failed to create room, please try again' });
            }
            break;
          }

          // C. Guest joins an existing room by code
          case 'join_room': {
            const { roomCode, userId } = data || {};
            if (!roomCode || typeof roomCode !== 'string' || roomCode.trim().length !== 6) {
              sendJson(ws, 'error_message', { message: 'Invalid room code format (must be 6 hex characters)' });
              return;
            }
            if (!userId || typeof userId !== 'string' || userId.trim() === '') {
              sendJson(ws, 'error_message', { message: 'Valid userId is required to join a room' });
              return;
            }

            const cleanRoomCode = roomCode.trim().toLowerCase();
            const cleanUserId = userId.trim();

            // First check if the room exists
            const existingRoom = await Room.findOne({ roomCode: cleanRoomCode });
            if (!existingRoom) {
              sendJson(ws, 'error_message', { message: 'Room not found or expired' });
              return;
            }

            if (existingRoom.hostId === cleanUserId) {
              sendJson(ws, 'error_message', { message: 'Cannot join your own room' });
              return;
            }

            // Atomically pair the guest into the room only if guestId is currently null
            const room = await Room.findOneAndUpdate(
              { roomCode: cleanRoomCode, guestId: null },
              { guestId: cleanUserId },
              { new: true }
            );

            if (!room) {
              // If we couldn't pair because guestId is no longer null (someone else joined first)
              sendJson(ws, 'error_message', { message: 'Room is already full' });
              return;
            }

            logger.info(`[Room] Guest ${cleanUserId} joined room ${cleanRoomCode} (host: ${room.hostId})`);

            // Notify the guest that they've joined
            sendJson(ws, 'peer_joined', { peerId: room.hostId, roomCode: cleanRoomCode });

            // Notify the host that a guest has joined
            const hostWs = clients.get(room.hostId);
            if (hostWs) {
              sendJson(hostWs, 'peer_joined', { peerId: cleanUserId, roomCode: cleanRoomCode });
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

          // G. Leave room and notify peer
          case 'leave_room': {
            const { roomCode } = data || {};
            if (!roomCode || typeof roomCode !== 'string') return;

            const cleanRoomCode = roomCode.trim().toLowerCase();
            const room = await Room.findOne({ roomCode: cleanRoomCode });

            if (room) {
              // Determine who the peer is (the other user in the room)
              const peerId = room.hostId === authenticatedUserId ? room.guestId : room.hostId;

              // Delete the room from database
              await Room.deleteOne({ roomCode: cleanRoomCode });
              logger.info(`[Room] Room ${cleanRoomCode} deleted by ${authenticatedUserId}`);

              // Notify the peer if they are online
              if (peerId) {
                const peerWs = clients.get(peerId);
                if (peerWs) {
                  sendJson(peerWs, 'peer_left', { peerId: authenticatedUserId });
                }
              }
            }
            break;
          }

          // H. Client heartbeat ping
          case 'ping': {
            sendJson(ws, 'pong', {});
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
        } catch (err) {
          logger.error(`Database error during session cleanup for user ${authenticatedUserId}: ${err.message}`);
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
