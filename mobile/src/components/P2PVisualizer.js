import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Line, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

export const P2PVisualizer = ({ isDark }) => {
  return (
    <View style={{ alignItems: 'center', marginVertical: 20 }}>
      <Svg width={300} height={130} viewBox="0 0 300 130">
        <Defs>
          <LinearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#7c3aed" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#00f2fe" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Pulse circles */}
        <Circle cx="50" cy="65" r="38" fill="rgba(0, 242, 254, 0.06)" stroke="rgba(0, 242, 254, 0.2)" strokeDasharray="4 4" />
        <Circle cx="250" cy="65" r="38" fill="rgba(124, 58, 237, 0.06)" stroke="rgba(124, 58, 237, 0.2)" strokeDasharray="4 4" />

        {/* Connection Line */}
        <Line x1="75" y1="65" x2="225" y2="65" stroke="url(#beamGrad)" strokeWidth="3" strokeDasharray="6 4" />
        
        {/* Animated signal dots */}
        <Circle cx="110" cy="65" r="4" fill="#00f2fe" />
        <Circle cx="150" cy="65" r="5" fill="#a855f7" />
        <Circle cx="190" cy="65" r="4" fill="#00f2fe" />

        {/* Node A (Sender) */}
        <G transform="translate(30, 45)">
          <Rect width={40} height={40} rx={10} fill={isDark ? "#1e293b" : "#e2e8f0"} stroke="#00f2fe" strokeWidth={2} />
          <SvgText x={20} y={24} fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} fontWeight="bold" textAnchor="middle">WEB</SvgText>
        </G>

        {/* Node B (Receiver) */}
        <G transform="translate(230, 45)">
          <Rect width={40} height={40} rx={10} fill={isDark ? "#1e293b" : "#e2e8f0"} stroke="#7c3aed" strokeWidth={2} />
          <SvgText x={20} y={24} fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} fontWeight="bold" textAnchor="middle">MOBILE</SvgText>
        </G>

        {/* Signaling Server Top Node */}
        <G transform="translate(130, 10)">
          <Rect width={40} height={24} rx={6} fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth={1} />
          <SvgText x={20} y={15} fill="#10b981" fontSize={8} fontWeight="bold" textAnchor="middle">SIGNAL</SvgText>
        </G>
        <Line x1="50" y1="45" x2="130" y2="22" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
        <Line x1="250" y1="45" x2="170" y2="22" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
      </Svg>
    </View>
  );
};
