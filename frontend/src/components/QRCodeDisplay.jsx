import React, { useMemo } from 'react';
import { generateQRMatrix } from '../utils/qrcode';

/**
 * QRCodeDisplay — Renders a QR code as an inline SVG.
 * Uses a pure-JS QR encoder (no npm dependencies).
 *
 * @param {string} value - The string to encode
 * @param {number} [size=180] - The SVG width/height in pixels
 */
export function QRCodeDisplay({ value, size = 180 }) {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix || matrix.length === 0) return null;

  const moduleCount = matrix.length;
  const quietZone = 2; // modules of padding
  const totalModules = moduleCount + quietZone * 2;
  const moduleSize = size / totalModules;
  const radius = moduleSize * 0.3; // rounded corners

  const rects = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row][col]) {
        rects.push(
          <rect
            key={`${row}-${col}`}
            x={(col + quietZone) * moduleSize}
            y={(row + quietZone) * moduleSize}
            width={moduleSize}
            height={moduleSize}
            rx={radius}
            ry={radius}
            fill="#0ea5e9"
          />
        );
      }
    }
  }

  // Center logo overlay — clear a small area and put "OxiDrop" text
  const centerX = size / 2;
  const centerY = size / 2;
  const labelW = moduleSize * 7;
  const labelH = moduleSize * 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Dark background */}
      <rect width={size} height={size} rx="8" ry="8" fill="#0a0e1a" />

      {/* QR modules */}
      {rects}

      {/* Center logo backing pill */}
      <rect
        x={centerX - labelW / 2}
        y={centerY - labelH / 2}
        width={labelW}
        height={labelH}
        rx={labelH / 2}
        ry={labelH / 2}
        fill="#0a0e1a"
      />

      {/* Logo text */}
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0ea5e9"
        fontSize={moduleSize * 1.6}
        fontWeight="700"
        fontFamily="'Outfit', 'Plus Jakarta Sans', sans-serif"
        letterSpacing="0.5"
      >
        OxiDrop
      </text>
    </svg>
  );
}
