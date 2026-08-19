import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ThreeCanvas = () => {
  const [t, setT] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame += 0.02;
      setT(frame);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // 3D Perspective Wave Grid calculation
  const COLS = 12;
  const ROWS = 10;
  const SPACING = 30;
  const FOV = 240;
  const horizonY = SCREEN_HEIGHT * 0.36;

  // Compute 3D projected points
  const grid = [];
  for (let j = 0; j < ROWS; j++) {
    const row = [];
    for (let i = 0; i < COLS; i++) {
      const gx = (i - COLS / 2) * SPACING;
      const gy = (j - 1) * SPACING;

      // 3D Wave elevation formula
      const dist = Math.sqrt(gx * gx + gy * gy) * 0.04;
      const gz = Math.sin(gx * 0.05 + t) * Math.cos(gy * 0.05 + t * 0.8) * 12 + Math.sin(dist - t) * 8;

      // Tilt around X-axis (~65 deg)
      const tilt = 1.15;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const rotY = gy * cosT - gz * sinT;
      const rotZ = gy * sinT + gz * cosT + 220;

      const scale = FOV / rotZ;
      const projX = SCREEN_WIDTH / 2 + gx * scale;
      const projY = horizonY + rotY * scale;

      row.push({ x: projX, y: projY, scale, ratio: i / COLS });
    }
    grid.push(row);
  }

  // Build SVG Path strings for horizontal and vertical wave lines
  let horizontalPaths = '';
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const p = grid[j][i];
      if (i === 0) {
        horizontalPaths += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      } else {
        horizontalPaths += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      }
    }
  }

  let verticalPaths = '';
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const p = grid[j][i];
      if (j === 0) {
        verticalPaths += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      } else {
        verticalPaths += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      }
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Cyan Ambient Radial Glow */}
      <View style={styles.ambientCyanGlow} />

      {/* Purple Ambient Radial Glow */}
      <View style={styles.ambientPurpleGlow} />

      {/* 3D Wave Topography Grid */}
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00f2fe" stopOpacity="0.35" />
            <Stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0.35" />
          </LinearGradient>
        </Defs>

        {/* Wave wireframe mesh lines */}
        <Path d={horizontalPaths} stroke="url(#gridGradient)" strokeWidth="0.8" fill="none" opacity={0.6} />
        <Path d={verticalPaths} stroke="url(#gridGradient)" strokeWidth="0.8" fill="none" opacity={0.45} />

        {/* Wave junction glow dots */}
        {grid.map((row, rIdx) =>
          row.map((p, cIdx) => {
            if ((rIdx + cIdx) % 2 === 0) {
              return (
                <Circle
                  key={`${rIdx}-${cIdx}`}
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(1, p.scale * 1.8)}
                  fill={p.ratio < 0.5 ? '#00f2fe' : '#7c3aed'}
                  opacity={Math.min(0.7, p.scale * 0.9)}
                />
              );
            }
            return null;
          })
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  ambientCyanGlow: {
    position: 'absolute',
    top: '18%',
    left: '50%',
    marginLeft: -140,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
  },
  ambientPurpleGlow: {
    position: 'absolute',
    top: '32%',
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
});
