import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Laptop, Smartphone, File, CheckCircle2, Loader2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const P2PSimulator = () => {
  const [phase, setPhase] = useState('pairing'); // 'pairing' | 'connecting' | 'transferring' | 'complete'
  const [progress, setProgress] = useState(0);
  const [typedCode, setTypedCode] = useState('');

  const packetAnim = useRef(new Animated.Value(0)).current;

  // Code typing simulation for phone guest
  useEffect(() => {
    let timer;
    if (phase === 'pairing') {
      const fullCode = '12853f';
      let i = 0;
      setTypedCode('');
      const typeInterval = setInterval(() => {
        i++;
        setTypedCode(fullCode.slice(0, i).split('').join(' '));
        if (i >= fullCode.length) {
          clearInterval(typeInterval);
        }
      }, 350);

      timer = setTimeout(() => {
        clearInterval(typeInterval);
        setPhase('connecting');
      }, 3500);

      return () => {
        clearInterval(typeInterval);
        clearTimeout(timer);
      };
    } else if (phase === 'connecting') {
      timer = setTimeout(() => setPhase('transferring'), 2200);
      return () => clearTimeout(timer);
    } else if (phase === 'transferring') {
      let cur = 0;
      const interval = setInterval(() => {
        cur += 5;
        setProgress(cur);
        if (cur >= 100) {
          clearInterval(interval);
          setPhase('complete');
        }
      }, 110);

      // Animate packet loop
      Animated.loop(
        Animated.timing(packetAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();

      return () => {
        clearInterval(interval);
        packetAnim.stopAnimation();
      };
    } else if (phase === 'complete') {
      timer = setTimeout(() => {
        setProgress(0);
        setPhase('pairing');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const stepDescriptions = {
    pairing: 'Step 1: Devices pair atomically via 6-digit room code',
    connecting: 'Step 2: WebRTC SDP offer/answer & ICE handshake',
    transferring: 'Step 3: Direct peer-to-peer byte streaming',
    complete: 'Step 4: Transfer complete! Direct buffer received'
  };

  const packetTranslateX = packetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-35, 35],
  });

  return (
    <View style={styles.simulatorCard}>
      {/* Background neon radial highlight */}
      <View style={styles.radialHighlight} pointerEvents="none" />

      {/* Header Title */}
      <View style={styles.titleBox}>
        <Text style={styles.subtitle}>INTERACTIVE HANDSHAKE SIMULATOR</Text>
        <Text style={styles.subtext}>
          Demonstrating client-side signaling and serverless WebRTC data transfer.
        </Text>
      </View>

      {/* Simulator Field */}
      <View style={styles.devicesRow}>
        {/* SENDER LAPTOP */}
        <View style={styles.deviceBox}>
          <View style={styles.deviceHeader}>
            <Laptop size={11} color="#0ea5e9" style={{ marginRight: 4 }} />
            <Text style={styles.deviceTitle}>Laptop (Host)</Text>
          </View>

          <View style={styles.deviceBody}>
            {phase === 'pairing' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.codeLabel}>ROOM CODE</Text>
                <Text style={styles.roomCodeText}>12853f</Text>
              </View>
            )}

            {phase === 'connecting' && (
              <View style={{ alignItems: 'center' }}>
                <Loader2 size={14} color="#f59e0b" style={{ marginBottom: 3 }} />
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#f59e0b' }}>SDP Offer Sent</Text>
              </View>
            )}

            {phase === 'transferring' && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.transferringFileText} numberOfLines={1}>photo.jpg</Text>
                <Text style={styles.transferringPercentText}>{progress}%</Text>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${progress}%`, backgroundColor: '#0ea5e9' }]} />
                </View>
              </View>
            )}

            {phase === 'complete' && (
              <View style={{ alignItems: 'center' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ marginBottom: 2 }} />
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#10b981' }}>Sent Successfully</Text>
              </View>
            )}
          </View>
        </View>

        {/* CONNECTION BRIDGE */}
        <View style={styles.bridgeContainer}>
          {/* Dotted base line */}
          <View style={styles.bridgeDottedLine} />

          {/* WebRTC Laser Beam */}
          {(phase === 'connecting' || phase === 'transferring' || phase === 'complete') && (
            <View
              style={[
                styles.laserBeam,
                {
                  backgroundColor: phase === 'complete' ? '#10b981' : '#0ea5e9',
                  shadowColor: phase === 'complete' ? '#10b981' : '#0ea5e9',
                }
              ]}
            />
          )}

          {/* Animated data packet */}
          {phase === 'transferring' && (
            <Animated.View
              style={[
                styles.flyingPacket,
                {
                  transform: [{ translateX: packetTranslateX }],
                }
              ]}
            >
              <File size={10} color="#00f2fe" />
            </Animated.View>
          )}
        </View>

        {/* RECEIVER PHONE */}
        <View style={styles.deviceBox}>
          <View style={styles.deviceHeader}>
            <Smartphone size={11} color="#a855f7" style={{ marginRight: 4 }} />
            <Text style={styles.deviceTitle}>Phone (Guest)</Text>
          </View>

          <View style={styles.deviceBody}>
            {phase === 'pairing' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.codeLabel}>ENTERING CODE</Text>
                <Text style={[styles.roomCodeText, { color: '#a855f7' }]}>
                  {typedCode || '•'}
                </Text>
              </View>
            )}

            {phase === 'connecting' && (
              <View style={{ alignItems: 'center' }}>
                <Loader2 size={14} color="#00f2fe" style={{ marginBottom: 3 }} />
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#00f2fe' }}>ICE Handshake</Text>
              </View>
            )}

            {phase === 'transferring' && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.transferringFileText} numberOfLines={1}>photo.jpg</Text>
                <Text style={[styles.transferringPercentText, { color: '#a855f7' }]}>{progress}%</Text>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${progress}%`, backgroundColor: '#a855f7' }]} />
                </View>
              </View>
            )}

            {phase === 'complete' && (
              <View style={{ alignItems: 'center' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ marginBottom: 2 }} />
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#10b981' }}>Downloaded</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* STEP INDICATOR TEXT matching web */}
      <View style={styles.stepFooter}>
        <Text style={styles.stepText}>{stepDescriptions[phase]}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  simulatorCard: {
    width: '100%',
    backgroundColor: 'rgba(13, 17, 28, 0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginVertical: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  radialHighlight: {
    position: 'absolute',
    top: '-30%',
    left: '-20%',
    width: '140%',
    height: '160%',
    backgroundColor: 'rgba(14, 165, 233, 0.04)',
    borderRadius: 200,
  },
  titleBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#00f2fe',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtext: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 3,
    textAlign: 'center',
  },
  devicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  deviceBox: {
    width: '38%',
    backgroundColor: 'rgba(6, 8, 14, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 9,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 4,
  },
  deviceTitle: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  deviceBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  codeLabel: {
    fontSize: 7,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  roomCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  transferringFileText: {
    fontSize: 7.5,
    color: '#94a3b8',
    marginBottom: 2,
  },
  transferringPercentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 3,
  },
  miniTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
  },
  bridgeContainer: {
    width: '20%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bridgeDottedLine: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dotted',
  },
  laserBeam: {
    position: 'absolute',
    width: '100%',
    height: 2,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  flyingPacket: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderWidth: 1,
    borderColor: '#00f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#00f2fe',
    textAlign: 'center',
  },
});
