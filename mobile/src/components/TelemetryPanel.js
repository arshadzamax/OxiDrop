import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BUILD_TAG = 'v2-0818';

export const TelemetryPanel = ({ colors, webrtcStats, peerConnected }) => {
  return (
    <View style={[styles.telemetryBar, { backgroundColor: colors.headerBg, borderColor: colors.inputBorder }]}>
      <View style={styles.telemetryItem}>
        <Text style={styles.telemetryLabel}>P2P RTT:</Text>
        <Text style={[styles.telemetryVal, { color: '#10b981' }]}>
          {webrtcStats?.rtt !== null ? `${webrtcStats.rtt}ms` : '--'}
        </Text>
      </View>
      <View style={styles.telemetryItem}>
        <Text style={styles.telemetryLabel}>ICE Candidate:</Text>
        <Text style={[styles.telemetryVal, { color: '#00a2ed' }]}>
          {webrtcStats?.candidateType ?? '--'}
        </Text>
      </View>
      <View style={styles.telemetryItem}>
        <Text style={styles.telemetryLabel}>State:</Text>
        <Text style={[styles.telemetryVal, { color: peerConnected ? '#10b981' : '#f59e0b' }]}>
          {webrtcStats?.connectionState 
            ? webrtcStats.connectionState.toUpperCase() 
            : peerConnected ? 'TUNNEL READY' : 'IDLE'}
        </Text>
      </View>
      <Text style={[styles.telemetryVal, { color: '#6366f1' }]}>{BUILD_TAG}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  telemetryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginRight: 4,
  },
  telemetryVal: {
    fontSize: 10,
    fontWeight: '700',
  },
});
