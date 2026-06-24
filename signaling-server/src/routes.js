import express from 'express';
import crypto from 'crypto';
import { File } from './models/File.js';
import { Request } from './models/Request.js';
import { User } from './models/User.js';

export const router = express.Router();

// 1. Register a File (Phase 1: Registration)
router.post('/files', async (req, res) => {
  try {
    const { fileName, sizeBytes, autoApprove, senderId } = req.body;

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      return res.status(400).json({ error: 'Invalid file size' });
    }
    if (!senderId || typeof senderId !== 'string') {
      return res.status(400).json({ error: 'Invalid sender ID' });
    }

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
    console.error('File registration HTTP error:', error);
    res.status(500).json({ error: 'Server error during file registration' });
  }
});

// 2. Fetch File Metadata (Phase 2: Metadata Check)
router.get('/files/:fileId', async (req, res) => {
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
    console.error('Fetch file metadata HTTP error:', error);
    res.status(500).json({ error: 'Server error fetching file metadata' });
  }
});

// 3. Fetch Pending requests for a Sender
router.get('/requests/pending/:userId', async (req, res) => {
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
    console.error('Fetch pending requests HTTP error:', error);
    res.status(500).json({ error: 'Server error fetching pending requests' });
  }
});
