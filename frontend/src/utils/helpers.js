/**
 * Sanitizes filenames to prevent directory traversal and remove illegal OS characters.
 * @param {string} name - Raw filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'download_file';
  const base = name.replace(/^.*[\\\/]/, '');
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

/**
 * Formats size in bytes to a human-readable string.
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
};
