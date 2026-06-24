import mongoose from 'mongoose';

// User Schema: Tracks active WebSocket sessions for peers.
// CONCEPT: In P2P systems, we must know if the target peer is currently online 
// to initiate WebRTC negotiations. The signaling server maintains this socket mapping.
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true // Indexed for fast lookups when routing signaling messages
  },
  socketId: {
    type: String,
    default: null // Will store the active socket connection ID when online
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

export const User = mongoose.model('User', userSchema);
