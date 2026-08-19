import { Share } from 'react-native';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export const decodeBase64 = (base64) => {
  if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);

  // Strip any newlines, carriage returns, or whitespace injected by Android/iOS Base64 encoders
  const clean = base64.replace(/[\r\n\s]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);

  let bufferLength = Math.floor(len * 0.75);
  if (clean[len - 1] === '=') {
    bufferLength--;
    if (clean[len - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = clean.charCodeAt(i);
    const c2 = clean.charCodeAt(i + 1);
    const c3 = clean.charCodeAt(i + 2);
    const c4 = clean.charCodeAt(i + 3);

    const encoded1 = lookup[c1] !== undefined ? lookup[c1] : 0;
    const encoded2 = lookup[c2] !== undefined ? lookup[c2] : 0;
    const encoded3 = lookup[c3] !== undefined ? lookup[c3] : 0;
    const encoded4 = lookup[c4] !== undefined ? lookup[c4] : 0;

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
};

export const encodeBase64 = (bytes) => {
  if (!bytes || bytes.length === 0) return '';
  let result = '';
  let i;
  const l = bytes.length;
  for (i = 0; i < l; i += 3) {
    const c1 = bytes[i];
    const c2 = i + 1 < l ? bytes[i + 1] : -1;
    const c3 = i + 2 < l ? bytes[i + 2] : -1;
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (c2 !== -1 ? c2 >> 4 : 0);
    const byte3 = c2 !== -1 ? ((c2 & 15) << 2) | (c3 !== -1 ? c3 >> 6 : 0) : -1;
    const byte4 = c3 !== -1 ? c3 & 63 : -1;
    result += chars[byte1] + chars[byte2] + (byte3 !== -1 ? chars[byte3] : '=') + (byte4 !== -1 ? chars[byte4] : '=');
  }
  return result;
};

export const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'download_file';
  const base = name.replace(/^.*[\\\/]/, '');
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
};

export const copyRoomCode = (code) => {
  Share.share({
    message: code,
    title: 'OxiDrop Room Code',
  });
};

export const copyToClipboard = (text) => {
  Share.share({
    message: text,
  });
};
