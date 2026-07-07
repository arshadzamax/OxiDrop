import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

/**
 * QRScannerModal — A modern, premium webcam QR scanner modal.
 * Uses jsQR to decode QR codes in real-time from the video stream.
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onScanSuccess - Callback when a QR is successfully scanned
 */
export function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [hasPermission, setHasPermission] = useState(null); // null | 'granted' | 'denied'
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    setHasPermission(null);
    setErrorMsg('');
    setIsLoading(true);

    let active = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support camera access.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
          videoRef.current.play().catch(err => {
            console.error('Video play error:', err);
          });
        }

        setHasPermission('granted');
        setIsLoading(false);
        // Start scanning loop
        animationFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('Camera startup error:', err);
        if (!active) return;
        
        setIsLoading(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setHasPermission('denied');
          setErrorMsg('Camera permission denied. Please enable camera access in your browser settings.');
        } else {
          setHasPermission('denied');
          setErrorMsg(err.message || 'Unable to access camera.');
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Set canvas size matching the video feed
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to offscreen canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Attempt to decode
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // Success flash effect
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-overlay" id="qr-scanner-modal-overlay">
      <div className="qr-scanner-modal" id="qr-scanner-modal-container">
        <div className="qr-scanner-header">
          <div className="qr-scanner-title">
            <Camera size={16} className="text-accent" />
            <span>Scan Room QR Code</span>
          </div>
          <button className="qr-scanner-close-btn" onClick={onClose} id="qr-scanner-close-button">
            <X size={16} />
          </button>
        </div>

        <div className="qr-scanner-body">
          {isLoading && (
            <div className="qr-scanner-loader">
              <Loader2 size={32} className="spin text-accent" />
              <span>Starting camera...</span>
            </div>
          )}

          {hasPermission === 'denied' ? (
            <div className="qr-scanner-error">
              <AlertCircle size={32} className="text-red" />
              <p>{errorMsg}</p>
              <button className="btn btn-secondary btn-full" onClick={onClose}>
                Close Scanner
              </button>
            </div>
          ) : (
            <div className="qr-video-container" style={{ display: hasPermission === 'granted' ? 'block' : 'none' }}>
              <video ref={videoRef} className="qr-video-feed" />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              {/* Scan target overlay */}
              <div className="qr-scanner-target">
                <div className="qr-scanner-laser" />
                <div className="corner corner-tl" />
                <div className="corner corner-tr" />
                <div className="corner corner-bl" />
                <div className="corner corner-br" />
              </div>
            </div>
          )}
        </div>

        <div className="qr-scanner-footer">
          <span className="qr-scanner-hint">Align the OxiDrop QR code within the frame to join automatically</span>
        </div>
      </div>
    </div>
  );
}
