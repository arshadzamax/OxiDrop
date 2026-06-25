import { logger } from '../utils/logger.js';

// Centralized error handler middleware for Express REST API.
// Formats response object and prevents server details from leaking to clients.
export const errorHandler = (err, req, res, next) => {
  logger.error(`API Error on ${req.method} ${req.url}: ${err.message}`, err);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'An internal server error occurred';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// Async route wrapper to automatically catch promise rejections and forward to errorHandler.
// Crucial for Express 4.x as async/await errors otherwise crash node or get swallowed.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom operational error helper for API exceptions (e.g. invalid inputs, unauthorized)
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Marks the error as expected/handled operational issue
    Error.captureStackTrace(this, this.constructor);
  }
}
