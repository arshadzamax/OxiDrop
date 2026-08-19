import React from 'react';
import Svg, { Rect } from 'react-native-svg';

export const SimpleQrSvg = ({ value, size = 180, color = "#00a2ed", bg = "#090d16" }) => {
  const gridSize = 17;
  const cellSize = size / gridSize;
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  
  const matrix = Array(gridSize).fill(0).map((_, r) =>
    Array(gridSize).fill(0).map((_, c) => {
      if ((r < 5 && c < 5) || (r < 5 && c >= gridSize - 5) || (r >= gridSize - 5 && c < 5)) {
        if (r === 0 || r === 4 || c === 0 || c === 4 || (r >= 1 && r <= 3 && c >= 1 && c <= 3 && r !== 2 && c !== 2)) {
          return true;
        }
        return false;
      }
      const val = Math.abs(Math.sin(hash + r * 17 + c * 31));
      return val > 0.45;
    })
  );

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect width={size} height={size} fill={bg} rx={12} />
      {matrix.map((row, r) =>
        row.map((active, c) => (
          active ? (
            <Rect
              key={`${r}-${c}`}
              x={c * cellSize + 2}
              y={r * cellSize + 2}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={color}
              rx={1.5}
            />
          ) : null
        ))
      )}
    </Svg>
  );
};
