import mongoose from 'mongoose';

// Room Schema: Represents a pairing session between two devices.
// A host creates a room and receives a 6-char hex code.
// A guest joins using that code, and once paired, WebRTC negotiation begins.
// Rooms auto-expire after 1 hour via MongoDB TTL index.
const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true // 6-char hex code for room pairing (e.g. "a3f1b2")
  },
  hostId: {
    type: String,
    required: true // userId of the device that created the room
  },
  guestId: {
    type: String,
    default: null // userId of the device that joined; null until paired
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Auto-expire rooms after 1 hour (3600 seconds) via TTL index
  }
});

export const Room = mongoose.model('Room', roomSchema);
