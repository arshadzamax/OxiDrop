// Structured, production-ready logging utility.
// outputs single-line JSON log strings in production for cloud collectors (Datadog, Elastic, GCP)
// and clean human-readable logs in development mode.

const isProduction = process.env.NODE_ENV === 'production';

const formatLog = (level, message, meta = {}) => {
  const logObj = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta && Object.keys(meta).length > 0) {
    if (meta instanceof Error) {
      logObj.error = {
        message: meta.message,
        stack: meta.stack,
      };
    } else {
      logObj.meta = meta;
    }
  }

  return isProduction ? JSON.stringify(logObj) : consoleFormat(level, message, meta);
};

const consoleFormat = (level, message, meta = {}) => {
  let color = '\x1b[0m'; // Reset
  switch (level) {
    case 'INFO':
      color = '\x1b[36m'; // Cyan
      break;
    case 'WARN':
      color = '\x1b[33m'; // Yellow
      break;
    case 'ERROR':
      color = '\x1b[31m'; // Red
      break;
    case 'DEBUG':
      color = '\x1b[90m'; // Gray
      break;
  }

  const timestamp = new Date().toLocaleTimeString();
  const metaStr = Object.keys(meta).length > 0
    ? `\n  ${JSON.stringify(meta instanceof Error ? { message: meta.message, stack: meta.stack } : meta, null, 2)}`
    : '';

  return `${color}[${timestamp}] [${level}] ${message}\x1b[0m${metaStr}`;
};

export const logger = {
  info: (message, meta) => {
    console.log(formatLog('INFO', message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatLog('WARN', message, meta));
  },
  error: (message, meta) => {
    console.error(formatLog('ERROR', message, meta));
  },
  debug: (message, meta) => {
    if (!isProduction || process.env.DEBUG === 'true') {
      console.log(formatLog('DEBUG', message, meta));
    }
  }
};
