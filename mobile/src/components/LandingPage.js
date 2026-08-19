import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Shield, Cpu, Zap, Activity, ArrowRight, Share2 } from 'lucide-react-native';
import { SkiaWaveBackground } from './SkiaWaveBackground';
import { P2PSimulator } from './P2PSimulator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LandingPage = ({ colors, isDark, onLaunch }) => {
  const featureCards = [
    {
      icon: <Shield size={22} color="#10b981" />,
      title: "Direct Buffer-to-Buffer",
      desc: "Data streams locally from device memory directly to the peer. No servers store, parse, or keep history of your files."
    },
    {
      icon: <Cpu size={22} color="#0ea5e9" />,
      title: "Optimized File Streamer",
      desc: "Engineered with native memory chunking and backpressure control to guarantee smooth 10GB+ file transfers."
    },
    {
      icon: <Zap size={22} color="#f59e0b" />,
      title: "Smart ICE Negotiation",
      desc: "Dynamically resolves STUN network mappings and auto-spawns secure TURN relay fallbacks to punch through NAT limits."
    },
    {
      icon: <Activity size={22} color="#a855f7" />,
      title: "Live Diagnostics Feed",
      desc: "Full telemetry suite displaying active candidate types, RTT ping delays, data channel logs, and bandwidth speed metrics."
    }
  ];

  const steps = [
    {
      num: "1",
      title: "1. Pair Rooms",
      desc: "Generate a 6-character room key and enter it on your secondary device to link up."
    },
    {
      num: "2",
      title: "2. Approve Offers",
      desc: "Offer files over the open P2P channel. The recipient reviews names/sizes and explicitly approves."
    },
    {
      num: "3",
      title: "3. Stream Bytes",
      desc: "Watch direct P2P streaming speeds max out local connection bandwidth directly in-app."
    }
  ];

  return (
    <View style={styles.outerContainer}>
      {/* Real GPU Skia 3D Wave Shader Background */}
      <SkiaWaveBackground />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconBox}>
              <Share2 size={16} color="#ffffff" />
            </View>
            <Text style={styles.brandTitle}>OxiDrop</Text>
          </View>

          <Pressable style={styles.launchPortalBtn} onPress={onLaunch}>
            <Text style={styles.launchPortalBtnText}>Launch Portal</Text>
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroTagline}>
            <View style={styles.pulseDot} />
            <Text style={styles.heroTaglineText}>ULTRA-FAST WEBRTC P2P DATA TUNNELS</Text>
          </View>

          <Text style={styles.heroHeadingWhite}>Share Files Privately</Text>
          <Text style={styles.heroHeadingCyan}>Directly Between Devices</Text>

          <Text style={styles.heroDesc}>
            OxiDrop pairs devices via localized rooms to establish secure WebRTC connections. Files stream directly between devices without intermediate cloud uploads.
          </Text>

          <Pressable style={styles.primaryActionBtn} onPress={onLaunch}>
            <Text style={styles.primaryActionBtnText}>Launch P2P Dashboard</Text>
            <ArrowRight size={16} color="#ffffff" style={{ marginLeft: 8 }} />
          </Pressable>
        </View>

        {/* Live Interactive P2P Handshake Simulator */}
        <P2PSimulator />

        {/* Modern Features Grid */}
        <View style={styles.featuresSection}>
          {featureCards.map((card, idx) => (
            <View key={idx} style={styles.featureCard}>
              <View style={styles.featureIconBox}>{card.icon}</View>
              <Text style={styles.featureCardTitle}>{card.title}</Text>
              <Text style={styles.featureCardDesc}>{card.desc}</Text>
            </View>
          ))}
        </View>

        {/* 3-Step Section */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsMainHeading}>Simple. Instant. Direct.</Text>
          <Text style={styles.stepsSubHeading}>
            Establish secure, encrypted connections in three straightforward steps.
          </Text>

          <View style={styles.stepsList}>
            {steps.map((s, idx) => (
              <View key={idx} style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleNum}>{s.num}</Text>
                </View>
                <Text style={styles.stepItemTitle}>{s.title}</Text>
                <Text style={styles.stepItemDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            OxiDrop P2P System. 100% Client-Side. Engineered for privacy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#020306',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 60,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  launchPortalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  launchPortalBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  heroTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 30,
    marginBottom: 18,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f2fe',
    marginRight: 8,
    shadowColor: '#00f2fe',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  heroTaglineText: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroHeadingWhite: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -1,
  },
  heroHeadingCyan: {
    fontSize: 30,
    fontWeight: '900',
    color: '#00f2fe',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -1,
    marginTop: 2,
  },
  heroDesc: {
    fontSize: 13.5,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginTop: 12,
    marginBottom: 24,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryActionBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  featuresSection: {
    marginTop: 16,
    gap: 12,
  },
  featureCard: {
    backgroundColor: 'rgba(13, 17, 28, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  featureIconBox: {
    marginBottom: 10,
  },
  featureCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  featureCardDesc: {
    fontSize: 12.5,
    color: '#94a3b8',
    lineHeight: 18,
  },
  stepsSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  stepsMainHeading: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  stepsSubHeading: {
    fontSize: 12.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 26,
    maxWidth: 300,
  },
  stepsList: {
    width: '100%',
    gap: 20,
  },
  stepItem: {
    alignItems: 'center',
    textAlign: 'center',
  },
  stepCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepCircleNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00f2fe',
  },
  stepItemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  stepItemDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  footer: {
    marginTop: 30,
    paddingVertical: 18,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10.5,
    color: '#64748b',
    textAlign: 'center',
  },
});
