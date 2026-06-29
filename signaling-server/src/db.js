import mongoose from 'mongoose';
import { MONGODB_URI } from './config.js';
import { logger } from './utils/logger.js';

// Setup Mongoose configuration events
mongoose.connection.on('connecting', () => {
  logger.info('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  logger.info('MongoDB successfully connected.');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected! Attempting automatic reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB connection restored.');
});

export const connectDB = async () => {
  try {
    const mongooseOpts = {
      maxPoolSize: 10,                 // Up to 10 connections in pool
      serverSelectionTimeoutMS: 5000,  // Keep trying for 5 seconds
      socketTimeoutMS: 45000,          // Close inactive socket after 45 seconds
      family: 4                        // Force IPv4
    };

    await mongoose.connect(MONGODB_URI, mongooseOpts);

    // Drop legacy/stale 'email_1' unique index to prevent E11000 socket session crashes
    try {
      await mongoose.connection.db.collection('users').dropIndex('email_1');
      logger.info('Cleaned up stale email_1 unique index constraint from database users collection.');
    } catch (indexErr) {
      // Safe to ignore if the index doesn't exist (Mongo code 27)
    }
  } catch (error) {
    logger.error('Failed to establish initial MongoDB connection:', error);
    process.exit(1); // Fatal exit
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed gracefully.');
  } catch (error) {
    logger.error('Error during MongoDB disconnect:', error);
  }
};
