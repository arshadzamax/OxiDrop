import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import {
  Canvas,
  Rect,
  Skia,
  Shader,
  useValue,
  useComputedValue
} from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 3D Undulating Wave Topography SkSL (Skia Shading Language) Shader
const skslSource = `
uniform vec2 u_resolution;
uniform float u_time;

vec4 main(vec2 xy) {
    vec2 uv = (xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    
    // 3D Perspective Tilt Transform
    float y_persp = uv.y + 0.25;
    float depth = max(0.08, 1.0 - y_persp * 1.5);
    vec2 p = vec2(uv.x * depth * 3.8, y_persp * depth * 3.8);
    
    // 3D Sine-Cosine Undulating Wave Elevation matching Three.js
    float wave = sin(p.x * 3.2 + u_time * 0.9) * cos(p.y * 3.2 + u_time * 0.75) * 0.5;
    wave += sin(length(p) * 4.0 - u_time * 1.1) * 0.25;
    
    // Procedural Topography Grid Lines
    vec2 grid = abs(fract(p * 2.6 + wave * 0.25) - 0.5);
    float line = smoothstep(0.05, 0.0, min(grid.x, grid.y));
    
    // Glowing Nodes at grid intersections
    float node = smoothstep(0.12, 0.0, length(grid));
    
    // Color Gradient (Cyan #00f2fe to Purple #7c3aed)
    vec3 cyan = vec3(0.0, 0.949, 0.996);
    vec3 purple = vec3(0.486, 0.227, 0.929);
    float colorMix = clamp(uv.x * 0.7 + 0.5, 0.0, 1.0);
    vec3 baseColor = mix(cyan, purple, colorMix);
    
    // Radial ambient backlight glow in center and bottom
    float radialGlow = max(0.0, 1.0 - length(uv * vec2(1.0, 1.4)) * 1.1) * 0.28;
    
    // Composite onto deep space black (#020306)
    vec3 finalColor = vec3(0.008, 0.012, 0.024);
    finalColor += baseColor * (line * 0.35 + node * 0.85 + radialGlow);
    
    return vec4(finalColor, 1.0);
}
`;

const waveEffect = Skia.RuntimeEffect.Make(skslSource);

export const SkiaWaveBackground = () => {
  const time = useValue(0);

  useEffect(() => {
    let animId;
    const start = performance.now();
    const loop = () => {
      time.current = (performance.now() - start) / 1000;
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [time]);

  const uniforms = useComputedValue(() => {
    return {
      u_resolution: [SCREEN_WIDTH, SCREEN_HEIGHT],
      u_time: time.current,
    };
  }, [time]);

  if (!waveEffect) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#020306' }]} />;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <Shader source={waveEffect} uniforms={uniforms} />
      </Rect>
    </Canvas>
  );
};
