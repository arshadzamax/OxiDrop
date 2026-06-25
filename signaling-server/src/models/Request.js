import mongoose from 'mongoose';

// Request Schema: The core of the "Asynchronous" P2P queue.
// CONCEPT: Standard WebRTC is real-time (both peers must be online at the same time).
// To solve the "offline sender" problem, receivers record their intent in this database collection.
// When the sender comes online, they poll/listen for these requests and trigger the WebRTC handshake.
const requestSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    index: true // Maps to the file being requested
  },
  receiverId: {
    type: String,
    required: true,
    index: true // The user requesting access
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    default: 'PENDING'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 14400 // Expire requests automatically after 4 hours (14400 seconds) as a safety net for ungraceful exits
  }
});

// Create index for compound query if needed (e.g. checking pending request for a receiver and file)
requestSchema.index({ fileId: 1, receiverId: 1 }, { unique: true });

export const Request = mongoose.model('Request', requestSchema);
