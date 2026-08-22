import { sanitizeFileName } from './helpers';

/**
 * Checks if Origin Private File System (OPFS) is supported by the browser.
 * @returns {boolean}
 */
export const isOpfsSupported = () => {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  );
};

/**
 * Creates a writable stream targeting a temporary file in the Origin Private File System.
 * @param {string} fileName - Original file name for reference
 * @returns {Promise<{writable: FileSystemWritableFileStream, handle: FileSystemFileHandle, tempFileName: string, root: FileSystemDirectoryHandle, fileName: string}>}
 */
export const createOpfsTempWriter = async (fileName) => {
  if (!isOpfsSupported()) {
    throw new Error('Origin Private File System is not supported in this environment.');
  }

  const root = await navigator.storage.getDirectory();
  const sanitized = sanitizeFileName(fileName || 'file');
  const tempFileName = `oxidrop_opfs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${sanitized}`;
  const handle = await root.getFileHandle(tempFileName, { create: true });

  if (typeof handle.createWritable !== 'function') {
    throw new Error('FileSystemFileHandle.createWritable is not supported.');
  }

  const writable = await handle.createWritable();

  return {
    writable,
    handle,
    tempFileName,
    root,
    fileName: sanitized,
  };
};

/**
 * Safely closes/aborts an active OPFS writer and deletes the temporary file from the sandboxed root.
 * @param {object|null} opfsContext
 * @returns {Promise<void>}
 */
export const cleanupOpfsTempFile = async (opfsContext) => {
  if (!opfsContext) return;
  const { writable, root, tempFileName } = opfsContext;

  if (writable) {
    try {
      await writable.abort();
    } catch {
      // Stream might already be closed or aborted
    }
  }

  if (root && tempFileName) {
    try {
      await root.removeEntry(tempFileName);
    } catch {
      // Entry might already be removed
    }
  }
};

/**
 * Triggers a browser download using a disk-backed File object from OPFS and removes the temporary file.
 * @param {object} opfsContext
 * @param {string} [targetFileName]
 * @returns {Promise<void>}
 */
export const saveOpfsFileToDownloads = async (opfsContext, targetFileName) => {
  if (!opfsContext || !opfsContext.handle) {
    throw new Error('Invalid OPFS context provided for download.');
  }

  const { handle, root, tempFileName, fileName } = opfsContext;
  const downloadName = sanitizeFileName(targetFileName || fileName);

  try {
    const diskFile = await handle.getFile();
    const url = URL.createObjectURL(diskFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } finally {
    if (root && tempFileName) {
      try {
        await root.removeEntry(tempFileName);
      } catch (err) {
        console.warn('Failed to remove temporary OPFS file after download:', err);
      }
    }
  }
};

/**
 * Scans the OPFS root directory and deletes any leftover temporary files from crashed or aborted sessions.
 * @returns {Promise<number>} Count of cleaned up files
 */
export const cleanStaleOpfsTempFiles = async () => {
  if (!isOpfsSupported()) return 0;
  let cleanedCount = 0;

  try {
    const root = await navigator.storage.getDirectory();
    if (root.values) {
      for await (const entry of root.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('oxidrop_opfs_')) {
          try {
            await root.removeEntry(entry.name);
            cleanedCount++;
          } catch {
            // Ignore single file deletion failures
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed cleaning stale OPFS temp files:', err);
  }

  return cleanedCount;
};
