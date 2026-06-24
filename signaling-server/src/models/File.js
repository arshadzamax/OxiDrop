import mongoose from 'mongoose';

// File Schema: Stores metadata about the files being shared.
// SECURITY POINT: We never store the actual file content on our signaling server.
// Storing only metadata (name, size, sender) ensures privacy and zero storage costs.
const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true // The unique key/hash used in the shareable link (e.g. OxiDrop.com/share/fileId)
  },
  senderId: {
    type: String,
    required: true,
    index: true // Maps back to the User who is sharing the file
  },
  fileName: {
    type: String,
    required: true
  },
  sizeBytes: {
    type: Number,
    required: true
  },
  autoApprove: {
    type: Boolean,
    default: false // If true, the receiver can start the WebRTC connection without manual sender approval
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const File = mongoose.model('File', fileSchema);
