import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThreeBackground } from './ThreeBackground';
import { P2PSimulator } from './P2PSimulator';
import { QRCodeDisplay } from './QRCodeDisplay';
import { 
  Zap, 
  Shield, 
  Cpu, 
  Share2, 
  Activity, 
  ArrowRight, 
  Smartphone, 
  Monitor, 
  Globe, 
  Download, 
  QrCode, 
  CheckCircle2, 
  Sparkles,
  HardDrive,
  Copy,
  Check,
  X
} from 'lucide-react';

export function LandingPage({ onLaunch }) {
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  const [showQRModal, setShowQRModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const apkDownloadUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/downloads/OxiDrop.apk` 
    : '/downloads/OxiDrop.apk';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(apkDownloadUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 85, damping: 16 } }
  };

  const featureCards = [
    {
      icon: <Shield size={22} style={{ color: 'var(--green)' }} />,
      title: "Direct Buffer-to-Buffer",
      desc: "Data streams locally from device memory directly to the peer. No servers store, parse, or keep history of your file contents."
    },
    {
      icon: <Cpu size={22} style={{ color: 'var(--accent)' }} />,
      title: "Optimized File Streamer",
      desc: "Engineered using native browser FileReader arrays and chunk-offset backpressure to guarantee smooth 10GB+ transfers."
    },
    {
      icon: <Zap size={22} style={{ color: 'var(--amber)' }} />,
      title: "Smart ICE Negotiation",
      desc: "Dynamically resolves STUN network mappings and auto-spawns secure TURN relay fallbacks to punch through cellular NAT limits."
    },
    {
      icon: <Activity size={22} style={{ color: '#a855f7' }} />,
      title: "Live Diagnostics Feed",
      desc: "Full telemetry suite displaying active candidate types, RTT ping delays, data channel logs, and bandwidth speed metrics."
    }
  ];

  const comparisonData = [
    { feature: "Direct Device-to-Device P2P", web: "Yes (WebRTC)", android: "Yes (WebRTC)", desktop: "Yes (WebRTC + Iroh)" },
    { feature: "Max Transfer Speed", web: "150 - 350 Mbps", android: "250 - 600 Mbps", desktop: "1+ Gbps (Line Rate)" },
    { feature: "Background Transfers", web: "Tab must stay open", android: "Full Background Service", desktop: "Persistent System Tray" },
    { feature: "Native File System Picker", web: "Standard Web API", android: "Native Android SAF", desktop: "Native OS Dialog" },
    { feature: "QR Code Camera Scanner", web: "WebCam API", android: "Instant Native Camera", desktop: "Screen & Webcam" },
    { feature: "Installation Size", web: "0 MB (Instant)", android: "~73 MB Standalone APK", desktop: "~2.1 MB Rust Setup" }
  ];

  const faqs = [
    {
      q: "How does OxiDrop transfer files without uploading to a server?",
      a: "OxiDrop uses WebRTC data channels and the Iroh peer-to-peer protocol. The signaling server only helps devices find and shake hands with each other. Once connected, your data flies directly across your local network or via encrypted peer tunnels."
    },
    {
      q: "Are my transfers secure and private?",
      a: "Yes, 100%. All peer-to-peer data streams are end-to-end encrypted using DTLS 1.3 and SRTP protocols. No intermediary server or third party has access to your decryption keys or file contents."
    },
    {
      q: "Why should I install the Android APK or Desktop App?",
      a: "While the Web app works in any browser, the Android app provides hardware camera QR scanning and background transfers. The Desktop app (Tauri/Rust) delivers line-rate speeds up to 1+ Gbps with zero browser memory overhead or tab suspension."
    },
    {
      q: "Is there any file size limit?",
      a: "There are no artificial file size caps. You can transfer gigabyte-sized video files, disk images, or entire folders without restrictions."
    }
  ];

  return (
    <div className="landing-container" style={{ position: 'relative', width: '100%', minHeight: '100dvh', background: '#020306', overflowX: 'hidden', color: '#f8fafc' }}>
      
      {/* 3D WebGL Undulating Topography waves grid */}
      <ThreeBackground />

      {/* Cyberpunk Radial Ambient Backlight Glows */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, rgba(124, 58, 237, 0.06) 50%, transparent 100%)', filter: 'blur(110px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', top: '55%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 80%)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Floating dot grid background overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 0)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 1 }} />

      {/* Navigation Header */}
      <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1240px', margin: '0 auto', padding: '20px 24px', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #7c3aed 100%)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}>
            <Share2 size={18} style={{ color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OxiDrop</span>
          </div>
        </div>

        {/* Desktop Quick Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {!isTauri && (
            <a href="#downloads" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: '600', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }} onMouseEnter={e => e.currentTarget.style.color = '#00f2fe'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
              <Download size={14} /> Downloads
            </a>
          )}
          <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: '600', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#00f2fe'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
            Features
          </a>
          {!isTauri && (
            <a href="#comparison" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: '600', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#00f2fe'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
              Platforms
            </a>
          )}
          <a href="#faq" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: '600', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#00f2fe'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
            FAQ
          </a>
        </nav>

        <button 
          className="btn btn-primary" 
          onClick={onLaunch}
          style={{ padding: '9px 20px', fontSize: '13px', fontWeight: '700', borderRadius: '10px', background: 'linear-gradient(135deg, #00f2fe 0%, #0ea5e9 100%)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)', transition: 'all 0.2s' }}
        >
          <span>{isTauri ? 'Open Dashboard' : 'Launch Web App'}</span>
          <ArrowRight size={14} />
        </button>
      </header>

      {/* Hero Content */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '960px', margin: '60px auto 40px', padding: '0 24px', zIndex: 10 }}
      >
        <motion.div 
          variants={itemVariants} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '30px', padding: '7px 16px', fontSize: '12px', fontWeight: '600', color: '#00f2fe', letterSpacing: '0.5px', marginBottom: '22px', backdropFilter: 'blur(8px)' }}
        >
          <span className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00f2fe', boxShadow: '0 0 10px #00f2fe' }} />
          <span>{isTauri ? 'Native High-Speed Engine • Iroh + WebRTC' : 'Next-Gen P2P Transfer • Web, Android & Desktop'}</span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          style={{ fontSize: 'clamp(38px, 6vw, 70px)', fontWeight: '800', fontFamily: 'var(--font-display)', lineHeight: '1.08', letterSpacing: '-2px', color: '#fff', marginBottom: '22px' }}
        >
          Share Files Privately <br />
          <span style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 30%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Directly Between Any Device
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          style={{ fontSize: 'clamp(15px, 2.3vw, 19px)', color: 'var(--text-2)', maxWidth: '680px', lineHeight: '1.6', marginBottom: '36px' }}
        >
          Zero cloud uploads, no file size caps, and military-grade encryption. Stream photos, 4K videos, and massive folders directly device-to-device at blazing local and global speeds.
        </motion.p>

        {/* Primary Call to Actions */}
        <motion.div variants={itemVariants} style={{ display: 'flex', gap: '14px', marginBottom: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(14, 165, 233, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary"
            onClick={onLaunch}
            style={{ padding: '15px 34px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe 0%, #0ea5e9 100%)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <Globe size={18} />
            <span>{isTauri ? 'Open Transfer Dashboard' : 'Launch Web Portal'}</span>
            <ArrowRight size={16} />
          </motion.button>

          {!isTauri ? (
            <motion.a
              href="#downloads"
              whileHover={{ scale: 1.04, borderColor: 'rgba(0, 242, 254, 0.4)', background: 'rgba(255, 255, 255, 0.05)' }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-secondary"
              style={{ padding: '15px 30px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', color: '#fff', textDecoration: 'none', cursor: 'pointer' }}
            >
              <Download size={18} style={{ color: '#00f2fe' }} />
              <span>Download Native Apps</span>
            </motion.a>
          ) : (
            <motion.a
              href="#features"
              whileHover={{ scale: 1.04, borderColor: 'rgba(0, 242, 254, 0.4)', background: 'rgba(255, 255, 255, 0.05)' }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-secondary"
              style={{ padding: '15px 30px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', color: '#fff', textDecoration: 'none', cursor: 'pointer' }}
            >
              <Sparkles size={18} style={{ color: '#00f2fe' }} />
              <span>Explore Features</span>
            </motion.a>
          )}
        </motion.div>

        {/* Live P2P Connection Simulator */}
        <motion.div variants={itemVariants} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <P2PSimulator />
        </motion.div>
      </motion.main>

      {/* =========================================================================
          DOWNLOADS & PLATFORMS SECTION (WEB ONLY - HIDDEN IN DESKTOP APP)
         ========================================================================= */}
      {!isTauri && (
        <>
          <section id="downloads" style={{ position: 'relative', maxWidth: '1200px', margin: '110px auto 70px', padding: '0 24px', zIndex: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                <Sparkles size={14} />
                CROSS-PLATFORM ECOSYSTEM
              </div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-1px', marginBottom: '14px' }}>
                Get OxiDrop on Every Device
              </h2>
              <p style={{ color: 'var(--text-2)', fontSize: '15px', maxWidth: '580px', margin: '0 auto' }}>
                Install native clients for dedicated background transfers, camera QR pairing, and 1+ Gbps line-rate performance.
              </p>
            </div>

            {/* 3 Platform Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
              
              {/* 1. ANDROID APP CARD */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, borderColor: 'rgba(16, 185, 129, 0.4)', boxShadow: '0 20px 40px rgba(16, 185, 129, 0.12)' }}
                style={{ 
                  position: 'relative', 
                  background: 'linear-gradient(180deg, rgba(13, 22, 28, 0.75) 0%, rgba(8, 12, 18, 0.85) 100%)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  borderRadius: '20px', 
                  padding: '32px 28px', 
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Top Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                    <Smartphone size={24} style={{ color: '#10b981' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '4px 10px', borderRadius: '20px' }}>
                    v1.0.0 Stable APK
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '8px' }}>
                    Android Mobile App
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '20px' }}>
                    Direct APK download optimized for Android phones, tablets, and smart TVs with camera scanning.
                  </p>

                  {/* Feature bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>Hardware camera QR scanner for instant room joining</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>Full background transfers & native document picker</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>Android 8.0+ compatible (No Google Play required)</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a
                    href="/downloads/OxiDrop.apk"
                    download="OxiDrop.apk"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '13px 20px', 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                      color: '#fff', 
                      textDecoration: 'none', 
                      fontWeight: '700', 
                      fontSize: '14px',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <Download size={16} />
                    <span>Download APK (~73.7 MB)</span>
                  </a>

                  <button
                    onClick={() => setShowQRModal(true)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '11px 18px', 
                      borderRadius: '12px', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      color: '#94a3b8', 
                      fontSize: '13px', 
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                  >
                    <QrCode size={15} style={{ color: '#10b981' }} />
                    <span>Scan QR to Install on Phone</span>
                  </button>
                </div>
              </motion.div>

              {/* 2. WINDOWS DESKTOP APP CARD */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, borderColor: 'rgba(14, 165, 233, 0.4)', boxShadow: '0 20px 40px rgba(14, 165, 233, 0.14)' }}
                style={{ 
                  position: 'relative', 
                  background: 'linear-gradient(180deg, rgba(13, 20, 32, 0.75) 0%, rgba(8, 12, 22, 0.85) 100%)', 
                  border: '1px solid rgba(14, 165, 233, 0.2)', 
                  borderRadius: '20px', 
                  padding: '32px 28px', 
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Top Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.3)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' }}>
                    <Monitor size={24} style={{ color: '#0ea5e9' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#00f2fe', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '4px 10px', borderRadius: '20px' }}>
                    v0.1.0 Tauri Release
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '8px' }}>
                    Windows Desktop App
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '20px' }}>
                    High-performance native client engineered with Rust, Tauri 2.0, and the Iroh P2P protocol.
                  </p>

                  {/* Feature bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                      <span>Native Iroh P2P protocol: Speeds exceeding 1+ Gbps</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                      <span>Zero browser tab sleep or memory throttling</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                      <span>Ultra-lightweight 2.1 MB installer (Windows 10 / 11)</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a
                    href="/downloads/OxiDrop-Desktop-Setup.exe"
                    download="OxiDrop-Desktop-Setup.exe"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '13px 20px', 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #00f2fe 0%, #0ea5e9 100%)', 
                      color: '#fff', 
                      textDecoration: 'none', 
                      fontWeight: '700', 
                      fontSize: '14px',
                      boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <Download size={16} />
                    <span>Download Windows Setup (.exe, 2.1 MB)</span>
                  </a>

                  <a
                    href="/downloads/OxiDrop-Desktop.msi"
                    download="OxiDrop-Desktop.msi"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '11px 18px', 
                      borderRadius: '12px', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      color: '#94a3b8', 
                      textDecoration: 'none', 
                      fontSize: '13px', 
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                  >
                    <HardDrive size={15} style={{ color: '#0ea5e9' }} />
                    <span>Alternative: MSI Package (.msi, 3.1 MB)</span>
                  </a>
                </div>
              </motion.div>

              {/* 3. WEB PORTAL CARD */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, borderColor: 'rgba(168, 85, 247, 0.4)', boxShadow: '0 20px 40px rgba(168, 85, 247, 0.12)' }}
                style={{ 
                  position: 'relative', 
                  background: 'linear-gradient(180deg, rgba(20, 14, 30, 0.75) 0%, rgba(10, 8, 18, 0.85) 100%)', 
                  border: '1px solid rgba(168, 85, 247, 0.2)', 
                  borderRadius: '20px', 
                  padding: '32px 28px', 
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Top Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)' }}>
                    <Globe size={24} style={{ color: '#a855f7' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '4px 10px', borderRadius: '20px' }}>
                    Zero Install
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '8px' }}>
                    Web Portal (Any Browser)
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '20px' }}>
                    Run instant peer transfers directly from Chrome, Firefox, Safari, Edge, or Brave without installing software.
                  </p>

                  {/* Feature bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#a855f7', flexShrink: 0 }} />
                      <span>Works on macOS, Linux, iOS, ChromeOS & Windows</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#a855f7', flexShrink: 0 }} />
                      <span>Instant room creation via 6-digit PIN code</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <CheckCircle2 size={15} style={{ color: '#a855f7', flexShrink: 0 }} />
                      <span>No login, no user registration, zero cloud storage</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={onLaunch}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '13px 20px', 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', 
                      color: '#fff', 
                      fontWeight: '700', 
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <Globe size={16} />
                    <span>Launch Web Portal Now</span>
                    <ArrowRight size={15} />
                  </button>

                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '11px 18px', 
                      fontSize: '12px', 
                      color: '#64748b' 
                    }}
                  >
                    Bookmark this URL for instant access
                  </div>
                </div>
              </motion.div>

            </div>
          </section>

          {/* =========================================================================
              PLATFORM COMPARISON MATRIX
             ========================================================================= */}
          <section id="comparison" style={{ position: 'relative', maxWidth: '1000px', margin: '70px auto 100px', padding: '0 24px', zIndex: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '10px' }}>
                Platform Feature Comparison
              </h2>
              <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
                Pick the best client for your device and performance requirements.
              </p>
            </div>

            <div style={{ overflowX: 'auto', background: 'rgba(13, 17, 28, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', backdropFilter: 'blur(16px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>Capability</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '700', color: '#c084fc' }}>Web Browser</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '700', color: '#10b981' }}>Android APK</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '700', color: '#00f2fe' }}>Windows Desktop</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: idx === comparisonData.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>{row.feature}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>{row.web}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#cbd5e1' }}>{row.android}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#00f2fe', fontWeight: '600' }}>{row.desktop}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* =========================================================================
          FEATURES GRID
         ========================================================================= */}
      <section id="features" style={{ position: 'relative', maxWidth: '1100px', margin: '40px auto 100px', padding: '0 24px', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: '#00f2fe', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            ENGINEERED FOR SPEED & PRIVACY
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff' }}>
            State-of-the-Art Architecture
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {featureCards.map((card, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6, scale: 1.02, borderColor: 'rgba(0, 242, 254, 0.35)', boxShadow: '0 12px 30px rgba(0,0,0,0.45)' }}
              style={{ background: 'rgba(13, 17, 28, 0.55)', border: '1px solid rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(16px)', borderRadius: '16px', padding: '28px', transition: 'border-color 0.25s, box-shadow 0.25s', cursor: 'default' }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.06)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                {card.icon}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '10px', letterSpacing: '-0.3px' }}>{card.title}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS (3-STEP PROCESS)
         ========================================================================= */}
      <section style={{ position: 'relative', maxWidth: '960px', margin: '40px auto 120px', padding: '0 24px', zIndex: 10, textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '12px', letterSpacing: '-0.5px' }}>Simple. Instant. Direct.</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '50px' }}>Establish secure, encrypted connections in three straightforward steps.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
          <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '30px 20px' }}>
            <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: '#00f2fe', fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>1</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>1. Pair Devices</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Generate a 6-character room key or scan the QR code with your mobile camera to link.</p>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '30px 20px' }}>
            <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--green)', fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>2</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>2. Approve Offer</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Select your files. The receiving peer checks file metadata and clicks to accept the stream.</p>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '30px 20px' }}>
            <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: '#a855f7', fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>3</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>3. Stream Bytes</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Chunks stream memory-to-memory over the direct encrypted data channel at line speed.</p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION
         ========================================================================= */}
      <section id="faq" style={{ position: 'relative', maxWidth: '850px', margin: '40px auto 130px', padding: '0 24px', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '8px' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>Everything you need to know about OxiDrop.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              style={{ background: 'rgba(13, 17, 28, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '14px', padding: '22px 26px', backdropFilter: 'blur(12px)' }}
            >
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>{faq.q}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          QR CODE MODAL FOR MOBILE SCAN
         ========================================================================= */}
      <AnimatePresence>
        {showQRModal && (
          <div 
            style={{ position: 'fixed', inset: 0, background: 'rgba(2, 3, 6, 0.85)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#0b0f19', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '24px', padding: '36px 32px', maxWidth: '400px', width: '100%', textAlign: 'center', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
            >
              <button 
                onClick={() => setShowQRModal(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: '#94a3b8', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>

              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#10b981' }}>
                <Smartphone size={24} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '8px' }}>
                Scan to Download APK
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
                Point your phone's camera at this QR code to download and install OxiDrop directly on your Android device.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', background: '#070a12', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <QRCodeDisplay value={apkDownloadUrl} size={200} />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={apkDownloadUrl} 
                  style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#94a3b8', outline: 'none' }}
                />
                <button
                  onClick={handleCopyLink}
                  style={{ background: copiedLink ? '#10b981' : 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.03)', padding: '40px 24px', zIndex: 10, textAlign: 'center', background: 'rgba(3, 4, 8, 0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #7c3aed 100%)', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={12} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff' }}>OxiDrop</span>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: '12px', maxWidth: '500px', margin: '0 auto 16px' }}>
          Zero-knowledge peer-to-peer data distribution framework. Direct buffer streaming, 100% client-side.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px', color: 'var(--text-2)' }}>
          {!isTauri && (
            <>
              <a href="#downloads" style={{ color: 'inherit', textDecoration: 'none' }}>Download Android APK</a>
              <span>•</span>
              <a href="#downloads" style={{ color: 'inherit', textDecoration: 'none' }}>Download Desktop Client</a>
              <span>•</span>
            </>
          )}
          <span style={{ cursor: 'pointer', color: '#00f2fe' }} onClick={onLaunch}>
            {isTauri ? 'Open Transfer Dashboard' : 'Web Dashboard'}
          </span>
        </div>
      </footer>
    </div>
  );
}
