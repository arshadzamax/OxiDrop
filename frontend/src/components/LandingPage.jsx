import React from 'react';
import { motion } from 'framer-motion';
import { ThreeBackground } from './ThreeBackground';
import { P2PSimulator } from './P2PSimulator';
import { Zap, Shield, Cpu, Share2, Activity, ArrowRight } from 'lucide-react';

export function LandingPage({ onLaunch }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 80, damping: 15 } }
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

  return (
    <div className="landing-container" style={{ position: 'relative', width: '100%', minHeight: '100dvh', background: '#020306', overflowX: 'hidden', color: '#f8fafc' }}>
      
      {/* 3D WebGL Undulating Topography waves grid */}
      <ThreeBackground />

      {/* Cyberpunk Radial Ambient Backlight Glows */}
      <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(124, 58, 237, 0.05) 50%, transparent 100%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 80%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Floating dot grid background overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 0)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 1 }} />

      {/* Navigation Header */}
      <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '24px 20px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #7c3aed 100%)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)' }}>
            <Share2 size={16} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OxiDrop</span>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={onLaunch}
          style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Launch Portal
        </button>
      </header>

      {/* Hero Content */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '900px', margin: '90px auto 40px', padding: '0 24px', zIndex: 10 }}
      >
        <motion.div 
          variants={itemVariants} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 242, 254, 0.06)', border: '1px solid rgba(0, 242, 254, 0.15)', borderRadius: '30px', padding: '6px 14px', fontSize: '11px', fontWeight: '600', color: '#00f2fe', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}
        >
          <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00f2fe', boxShadow: '0 0 8px #00f2fe' }} />
          Ultra-Fast WebRTC P2P Data Tunnels
        </motion.div>

        <motion.h1
          variants={itemVariants}
          style={{ fontSize: 'clamp(36px, 5.5vw, 68px)', fontWeight: '800', fontFamily: 'var(--font-display)', lineHeight: '1.05', letterSpacing: '-2px', color: '#fff', marginBottom: '20px' }}
        >
          Share Files Privately <br />
          <span style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 30%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Directly Between Devices
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          style={{ fontSize: 'clamp(14px, 2.2vw, 18px)', color: 'var(--text-2)', maxWidth: '620px', lineHeight: '1.6', marginBottom: '36px' }}
        >
          OxiDrop pairs devices via localized rooms to establish secure WebRTC connections. Files stream directly between browsers without intermediate cloud uploads.
        </motion.p>

        <motion.div variants={itemVariants} style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(14, 165, 233, 0.45)' }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary"
            onClick={onLaunch}
            style={{ padding: '14px 32px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe 0%, #0ea5e9 100%)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Launch P2P Dashboard
            <ArrowRight size={16} />
          </motion.button>
        </motion.div>

        {/* Live P2P Connection Simulator */}
        <motion.div variants={itemVariants} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <P2PSimulator />
        </motion.div>
      </motion.main>

      {/* Modern Features Grid */}
      <section style={{ position: 'relative', maxWidth: '1100px', margin: '80px auto 100px', padding: '0 24px', zIndex: 10 }}>
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
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.06)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                {card.icon}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '10px', letterSpacing: '-0.3px' }}>{card.title}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Visual Timeline Section */}
      <section style={{ position: 'relative', maxWidth: '900px', margin: '40px auto 140px', padding: '0 24px', zIndex: 10, textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#fff', marginBottom: '12px', letterSpacing: '-0.5px' }}>Simple. Instant. Direct.</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '50px' }}>Establish secure, encrypted connections in three straightforward steps.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.06)', border: '1px solid rgba(0, 242, 254, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#00f2fe', fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>1</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>1. Pair Rooms</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Generate a 6-character room key and enter it on your secondary device to link up.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--green)', fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>2</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>2. Approve Offers</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Offer files over the open P2P channel. The recipient reviews names/sizes and explicitly approves.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#a855f7', fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>3</div>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>3. Stream Bytes</h4>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: '1.6', maxWidth: '240px', margin: '0 auto' }}>Watch direct P2P streaming speeds max out local connection bandwidth directly in-browser.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.02)', padding: '40px 20px', zIndex: 10, textAlign: 'center', background: 'rgba(3, 4, 8, 0.5)' }}>
        <p style={{ color: 'var(--text-3)', fontSize: '12px' }}>OxiDrop P2P System. 100% Client-Side. Engineered for privacy.</p>
      </footer>
    </div>
  );
}
