/**
 * Minimal QR Code Generator — Version 1 (21×21), Error Correction Level M
 * Pure JavaScript, zero dependencies.
 * Designed for encoding short strings (e.g. 6-char room codes).
 *
 * Byte-mode encoding with Reed-Solomon ECC in GF(256).
 * Returns a 2D boolean matrix: true = dark module, false = light module.
 */

// ── GF(256) arithmetic for Reed-Solomon ──

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_LOG[val] = i;
    val <<= 1;
    if (val >= 256) val ^= 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data, eccCount) {
  // Build generator polynomial
  let gen = [1];
  for (let i = 0; i < eccCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }

  const msg = new Uint8Array(data.length + eccCount);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coeff = msg[i];
    if (coeff !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coeff);
      }
    }
  }

  return Array.from(msg.slice(data.length));
}

// ── QR Code Matrix Builder ──

const SIZE = 21; // Version 1

function createMatrix() {
  return Array.from({ length: SIZE }, () => new Uint8Array(SIZE));
}

function setModule(matrix, row, col, value) {
  if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
    matrix[row][col] = value ? 1 : 0;
  }
}

function addFinderPattern(matrix, reserved, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const pr = row + r, pc = col + c;
      if (pr < 0 || pr >= SIZE || pc < 0 || pc >= SIZE) continue;

      const isOuter = r === -1 || r === 7 || c === -1 || c === 7;
      const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;

      if (isOuter) {
        setModule(matrix, pr, pc, 0);
      } else if (isBorder || isInner) {
        setModule(matrix, pr, pc, 1);
      } else {
        setModule(matrix, pr, pc, 0);
      }
      reserved[pr][pc] = 1;
    }
  }
}

function addTimingPatterns(matrix, reserved) {
  for (let i = 8; i < SIZE - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (!reserved[6][i]) { matrix[6][i] = val; reserved[6][i] = 1; }
    if (!reserved[i][6]) { matrix[i][6] = val; reserved[i][6] = 1; }
  }
}

function reserveFormatInfo(reserved) {
  // Format info around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (i < SIZE) reserved[8][i] = 1;
    if (i < SIZE) reserved[i][8] = 1;
  }
  // Format info around other finders
  for (let i = 0; i < 8; i++) {
    reserved[8][SIZE - 1 - i] = 1;
    reserved[SIZE - 1 - i][8] = 1;
  }
  // Dark module
  reserved[SIZE - 8][8] = 1;
}

function encodeData(str) {
  // Version 1-M: 16 data codewords, 10 ECC codewords
  const dataCapacity = 16;
  const eccCount = 10;

  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }

  // Mode indicator (0100 = byte mode) + character count (8 bits for V1)
  const bits = [];
  const pushBits = (val, count) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, 8); // Count

  for (const b of bytes) {
    pushBits(b, 8);
  }

  // Terminator
  pushBits(0, Math.min(4, dataCapacity * 8 - bits.length));

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to codewords
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] || 0);
    codewords.push(val);
  }

  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < dataCapacity) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  const ecc = rsEncode(new Uint8Array(codewords), eccCount);
  return [...codewords, ...ecc];
}

function placeDataBits(matrix, reserved, allCodewords) {
  const bits = [];
  for (const cw of allCodewords) {
    for (let i = 7; i >= 0; i--) {
      bits.push((cw >> i) & 1);
    }
  }

  let bitIdx = 0;
  let col = SIZE - 1;

  while (col >= 0) {
    if (col === 6) col--; // Skip timing column

    for (let row = 0; row < SIZE; row++) {
      for (let c = 0; c < 2; c++) {
        const actualCol = col - c;
        const isUpward = Math.floor((SIZE - 1 - col + (col > 6 ? 1 : 0)) / 2) % 2 === 0;
        const actualRow = isUpward ? SIZE - 1 - row : row;

        if (actualCol >= 0 && !reserved[actualRow][actualCol]) {
          matrix[actualRow][actualCol] = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    col -= 2;
  }
}

function applyMask(matrix, reserved, maskId) {
  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ];

  const result = matrix.map(row => new Uint8Array(row));
  const fn = maskFns[maskId];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }
  return result;
}

function computePenalty(matrix) {
  let penalty = 0;

  // Rule 1: Runs of same color (5+)
  for (let r = 0; r < SIZE; r++) {
    let count = 1;
    for (let c = 1; c < SIZE; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else {
        count = 1;
      }
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let count = 1;
    for (let r = 1; r < SIZE; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else {
        count = 1;
      }
    }
  }

  // Rule 2: 2×2 blocks
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

// Format info bits for ECC level M (0b00) with mask patterns 0-7
const FORMAT_INFO = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

function placeFormatInfo(matrix, maskId) {
  const info = FORMAT_INFO[maskId];

  // Around top-left finder
  const positions = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3],
    [8, 2], [8, 1], [8, 0]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (info >> (14 - i)) & 1;
    const [r, c] = positions[i];
    matrix[r][c] = bit;
  }

  // Around bottom-left and top-right finders
  for (let i = 0; i < 7; i++) {
    const bit = (info >> (14 - i)) & 1;
    matrix[8][SIZE - 1 - i] = bit;
  }
  for (let i = 7; i < 15; i++) {
    const bit = (info >> (14 - i)) & 1;
    matrix[SIZE - 1 - (14 - i)][8] = bit;
  }

  // Dark module
  matrix[SIZE - 8][8] = 1;
}

/**
 * Generates a QR code matrix for the given input string.
 * @param {string} text - The text to encode (max ~14 bytes for Version 1-M)
 * @returns {boolean[][]} 2D array where true = dark module
 */
export function generateQRMatrix(text) {
  if (!text || text.length > 14) {
    throw new Error('Text must be 1-14 characters for QR Version 1');
  }

  const allCodewords = encodeData(text);

  // Build base matrix with finder patterns and timing
  const reserved = createMatrix();
  const baseMatrix = createMatrix();

  addFinderPattern(baseMatrix, reserved, 0, 0);
  addFinderPattern(baseMatrix, reserved, 0, SIZE - 7);
  addFinderPattern(baseMatrix, reserved, SIZE - 7, 0);
  addTimingPatterns(baseMatrix, reserved);
  reserveFormatInfo(reserved);

  // Place data bits
  placeDataBits(baseMatrix, reserved, allCodewords);

  // Try all masks and pick the best one
  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(baseMatrix, reserved, mask);
    placeFormatInfo(masked, mask);
    const penalty = computePenalty(masked);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
  }

  const finalMatrix = applyMask(baseMatrix, reserved, bestMask);
  placeFormatInfo(finalMatrix, bestMask);

  return finalMatrix.map(row => Array.from(row).map(v => v === 1));
}
