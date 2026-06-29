import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Laptop, Smartphone, File, CheckCircle, Loader2 } from 'lucide-react';

export function P2PSimulator() {
  const [phase, setPhase] = useState('pairing'); // 'pairing' | 'connecting' | 'transferring' | 'complete'
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    if (phase === 'pairing') {
      // Show code typing
      timer = setTimeout(() => setPhase('connecting'), 3500);
    } else if (phase === 'connecting') {
      // Show WebRTC handshaking
      timer = setTimeout(() => setPhase('transferring'), 2200);
    } else if (phase === 'transferring') {
      // Animate progress bar from 0 to 100
      let cur = 0;
      const interval = setInterval(() => {
        cur += 5;
        setProgress(cur);
        if (cur >= 100) {
          clearInterval(interval);
          setPhase('complete');
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (phase === 'complete') {
      // Loop back to start after a delay
      timer = setTimeout(() => {
        setProgress(0);
        setPhase('pairing');
      }, 4000);
    }

    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div style={{
      width: '100%',
      maxWidth: '680px',
      margin: '40px auto 0',
      background: 'rgba(13, 17, 28, 0.45)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
      backdropFilter: 'blur(16px)',
      borderRadius: '20px',
      padding: '30px 24px',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background neon grid highlight */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.04) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '30px', position: 'relative', zIndex: 2 }}>
        <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#00f2fe', margin: 0 }}>
          Interactive Handshake Simulator
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px', margin: 0 }}>
          Demonstrating client-side signaling and serverless WebRTC data transfer.
        </p>
      </div>

      {/* Simulator Field */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        height: '200px',
        zIndex: 2
      }}>
        {/* SENDER LAPTOP */}
        <div style={{
          width: '150px',
          height: '110px',
          background: 'rgba(6, 8, 14, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <Laptop size={12} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '9px', fontWeight: '700', color: '#fff' }}>Laptop (Host)</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {phase === 'pairing' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'var(--text-3)', marginBottom: '2px' }}>ROOM CODE</div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '1px' }}>12853f</div>
              </div>
            )}

            {phase === 'connecting' && (
              <div style={{ textAlign: 'center', color: 'var(--amber)' }}>
                <Loader2 size={16} className="spin" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '7px', fontWeight: '600' }}>SDP Offer Sent</div>
              </div>
            )}

            {phase === 'transferring' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'var(--text-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>sending: photo.jpg</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#fff', margin: '4px 0' }}>{progress}%</div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
              </div>
            )}

            {phase === 'complete' && (
              <div style={{ textAlign: 'center', color: 'var(--green)' }}>
                <CheckCircle size={20} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '8px', fontWeight: '600' }}>Sent Successfully</div>
              </div>
            )}
          </div>
        </div>

        {/* CONNECTION TUBE & CHANNELS */}
        <div style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Base Connection Dotted Line */}
          <div style={{
            position: 'absolute',
            left: '10px',
            right: '10px',
            height: '1px',
            borderTop: '2px dotted rgba(255, 255, 255, 0.08)',
            zIndex: 1
          }} />

          {/* WebRTC Laser/Beam line when active */}
          {(phase === 'connecting' || phase === 'transferring' || phase === 'complete') && (
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1 }}
              style={{
                position: 'absolute',
                left: '10px',
                right: '10px',
                height: '2px',
                background: phase === 'complete' ? 'var(--green)' : 'linear-gradient(90deg, var(--accent) 0%, #a855f7 100%)',
                boxShadow: phase === 'complete' ? '0 0 10px var(--green)' : '0 0 12px var(--accent)',
                zIndex: 2,
                originX: 0
              }}
            />
          )}

          {/* Animating file node particle during transfer */}
          {phase === 'transferring' && (
            <motion.div
              animate={{ x: [-80, 80] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              style={{
                position: 'absolute',
                zIndex: 3,
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px var(--accent)'
              }}
            >
              <File size={10} style={{ color: '#fff' }} />
            </motion.div>
          )}

          {/* Pulsing signal rings during handshake */}
          {phase === 'connecting' && (
            <>
              <motion.div
                animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--amber)', zIndex: 2 }}
              />
              <motion.div
                animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.75, ease: 'easeOut' }}
                style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #7c3aed', zIndex: 2 }}
              />
            </>
          )}
        </div>

        {/* RECEIVER PHONE */}
        <div style={{
          width: '90px',
          height: '145px',
          background: 'rgba(6, 8, 14, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Phone Top Notch */}
          <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', margin: '0 auto 6px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <Smartphone size={10} style={{ color: '#7c3aed' }} />
            <span style={{ fontSize: '8px', fontWeight: '700', color: '#fff' }}>Phone (Guest)</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {phase === 'pairing' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: '7px', color: 'var(--text-3)', marginBottom: '4px' }}>entering code</div>
                <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                  {['1','2','8','5','3','f'].map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.4 }}
                      style={{ fontSize: '10px', fontWeight: '700', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '3px', width: '9px', height: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}

            {phase === 'connecting' && (
              <div style={{ textAlign: 'center', color: 'var(--amber)' }}>
                <Loader2 size={14} className="spin" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '6px', fontWeight: '600' }}>SDP Answer Sent</div>
              </div>
            )}

            {phase === 'transferring' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'var(--text-2)' }}>receiving: photo.jpg</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#fff', margin: '4px 0' }}>{progress}%</div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: '#7c3aed' }} />
                </div>
              </div>
            )}

            {phase === 'complete' && (
              <div style={{ textAlign: 'center', color: 'var(--green)' }}>
                <CheckCircle size={18} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '7px', fontWeight: '600' }}>File Received</div>
              </div>
            )}
          </div>

          {/* Home Indicator */}
          <div style={{ width: '30px', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', margin: '6px auto 0' }} />
        </div>
      </div>

      {/* Simulator Caption */}
      <div style={{ textAlign: 'center', marginTop: '16px', position: 'relative', zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {phase === 'pairing' && (
            <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '500' }}>
              Step 1: Devices pair atomically via 6-digit room code
            </motion.span>
          )}
          {phase === 'connecting' && (
            <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: '500' }}>
              Step 2: Signaler exchanges SDP Offers & WebRTC handshakes
            </motion.span>
          )}
          {phase === 'transferring' && (
            <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} style={{ fontSize: '11px', color: '#a855f7', fontWeight: '500' }}>
              Step 3: Direct WebRTC Data Channel streaming is opened
            </motion.span>
          )}
          {phase === 'complete' && (
            <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '500' }}>
              Complete: P2P transfer finishes. No server buffers were used!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
