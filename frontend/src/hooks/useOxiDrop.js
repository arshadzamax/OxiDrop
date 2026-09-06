import { useState, useEffect, useRef } from 'react';
import { useFileTransfer } from './useFileTransfer';
import { FEATURE_FLAGS } from '../config/features';

export function useOxiDrop() {
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('oxi_userId');
      if (stored) return stored;
      const newId = 'web-' + Math.random().toString(36).substr(2, 6);
      sessionStorage.setItem('oxi_userId', newId);
      return newId;
    }
    return 'web-' + Math.random().toString(36).substr(2, 6);
  });
  const [socketConnected, setSocketConnected] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  // Toast notifications state
  const [notifications, setNotifications] = useState([]);
  const addNotification = (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Room-based connection state
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [connectionError, setConnectionError] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);

  // WebRTC Diagnostics stats
  const [webrtcStats, setWebrtcStats] = useState({
    active: false,
    connectionState: 'new',
    iceConnectionState: 'new',
    localCandidateType: '—',
    remoteCandidateType: '—',
    connectionType: '—',
    rtt: null,
    bytesSent: 0,
    bytesReceived: 0
  });

  // Developer Console Logs state
  const [devLogs, setDevLogs] = useState([]);
  const addDevLog = (message, category = 'system') => {
    const time = new Date().toTimeString().split(' ')[0];
    setDevLogs(prev => [...prev.slice(-199), { time, message, category }]);
  };
  const clearDevLogs = () => setDevLogs([]);

  // WebRTC & File streaming refs
  const statsIntervalRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const peerIdRef = useRef('');
  const roomCodeRef = useRef('');
  const isHostRef = useRef(false);
  const remoteIceCandidatesQueueRef = useRef([]);
  const heartbeatIntervalRef = useRef(null);
  const resetTransferStateRef = useRef(null);
  const disconnectGraceTimeoutRef = useRef(null);
  const wakeLockRef = useRef(null);
  const iceConfigurationRef = useRef({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { iceConfigurationRef.current = iceConfiguration; }, [iceConfiguration]);

  // Host configuration resolution loaded automatically by Vite, fallback dynamically auto-detects protocol/domain in production
  const getHosts = () => {
    // If explicit env variables are provided, respect them
    if (import.meta.env.VITE_API_HOST && import.meta.env.VITE_WS_HOST) {
      return {
        api: import.meta.env.VITE_API_HOST,
        ws: import.meta.env.VITE_WS_HOST
      };
    }

    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
    const isLocalWeb = host.includes('localhost:5173') || host.includes('127.0.0.1:5173');

    // If running in local Vite dev server specifically without Tauri, use local 5000
    if (isLocalWeb) {
      return {
        api: 'http://localhost:5000',
        ws: 'ws://localhost:5000'
      };
    }

    // Default to the deployed production Render signaling server for Tauri Desktop & Production Web
    return {
      api: 'https://oxidrop-signaling-server.onrender.com',
      ws: 'wss://oxidrop-signaling-server.onrender.com'
    };
  };

  const { api: API_HOST, ws: WS_HOST } = getHosts();

  // Dynamic ICE server configurations
  const [iceConfiguration, setIceConfiguration] = useState({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const res = await fetch(`${API_HOST}/api/webrtc/ice-servers`);
        if (res.ok) {
          const config = await res.json();
          console.log('Fetched ICE servers from signaling server:', config.iceServers);
          const newConfig = { iceServers: config.iceServers };
          iceConfigurationRef.current = newConfig;
          setIceConfiguration(newConfig);

          // Verify if TURN servers were loaded successfully
          const servers = config.iceServers || [];
          const hasTurn = servers.some(s => {
            const urls = s.urls;
            if (Array.isArray(urls)) {
              return urls.some(u => u.startsWith('turn:') || u.startsWith('turns:'));
            }
            return typeof urls === 'string' && (urls.startsWith('turn:') || urls.startsWith('turns:'));
          });

          if (hasTurn) {
            addDevLog('ICE configurations loaded successfully (STUN + TURN active). Ready for mobile data transfers.', 'ice');
          } else {
            addDevLog('WARNING: WebRTC loaded STUN-only routes (TURN inactive). Cross-network/mobile connections will fail.', 'error');
          }
        }
      } catch (err) {
        addDevLog('Failed to fetch dynamic ICE configurations: ' + err.message, 'error');
        console.warn('Failed to load dynamic WebRTC ICE configurations, using local fallback.', err);
      }
    };
    fetchIceServers();
  }, [API_HOST]);

  useEffect(() => {
    document.documentElement.className = theme + '-theme';
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  const fileTransfer = useFileTransfer({
    dataChannelRef,
    addDevLog,
    addNotification,
    cleanupWebRTC
  });

  useEffect(() => {
    resetTransferStateRef.current = fileTransfer.resetTransferState;
  }, [fileTransfer.resetTransferState]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      cleanupWebRTC();
      clearConnectionTimeout();
    };
  }, []);

  // Listen to visibility and focus events to reconnect instantly on mobile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addDevLog('Tab became active. Verifying connection & Wake Lock...', 'signaling');

        // Re-acquire Screen Wake Lock if peer is connected (iOS Safari & Android drop lock on tab hide)
        if (peerConnected) {
          requestWakeLock();
        }

        // Reconnect WebSocket if closed while in background
        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED || socketRef.current.readyState === WebSocket.CLOSING) {
          addDevLog('Page became active. Reconnecting WebSocket immediately...', 'signaling');
          connectWebSocket();
        } else if (socketRef.current.readyState === WebSocket.OPEN) {
          // Immediately send keepalive ping to reset proxy idle timeouts
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
        }

        // Check if WebRTC failed while away and attempt ICE restart if Host
        const pc = peerConnRef.current;
        if (pc && pc.connectionState === 'failed' && FEATURE_FLAGS.ENABLE_ICE_RESTART_ON_FAILED && isHostRef.current && pc.signalingState === 'stable') {
          addDevLog('WebRTC marked failed while tab was hidden. Triggering automatic ICE restart...', 'webrtc');
          attemptIceRestart(pc);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [peerConnected]);


  const connectWebSocket = () => {
    // Clear any pending automatic reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Skip if already open or connecting to avoid double connections
    if (socketRef.current) {
      const state = socketRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        addDevLog('WebSocket is already open or connecting. Skipping initialization.', 'signaling');
        return;
      }
    }

    addDevLog('Initializing WebSocket connection to: ' + WS_HOST, 'signaling');
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;
    ws.onopen = () => {
      setSocketConnected(true);
      addDevLog('WebSocket connection opened. Registering user session: ' + userId, 'signaling');
      ws.send(JSON.stringify({ type: 'register_user', data: { userId } }));

      // Start client-to-server heartbeat to prevent Render/Heroku proxy idle timeout
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };
    ws.onmessage = async (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'room_created':
            addDevLog('Room created successfully. Room code: ' + data.roomCode, 'signaling');
            setRoomCode(data.roomCode);
            setIsHost(true);
            isHostRef.current = true; // Set synchronously to avoid peer_joined race condition
            break;
          case 'peer_joined':
            addDevLog('Peer joined the room: ' + data.peerId, 'signaling');
            setPeerId(data.peerId);
            setConnectionError(null);
            addNotification('Peer connected! Establishing P2P tunnel...', 'info');
            // Only the host initiates the WebRTC offer to avoid glare (both sides offering)
            if (isHostRef.current) {
              addDevLog('Initiating WebRTC handshake as Host...', 'webrtc');
              initiateWebRTC(data.peerId);
            } else {
              addDevLog('Waiting for remote SDP Offer from Host...', 'webrtc');
            }
            break;
          case 'peer_left':
            addDevLog('Peer left the room: ' + (data.peerId || 'unknown'), 'signaling');
            addNotification('Peer disconnected from the room.', 'error');
            setPeerConnected(false);
            setPeerId('');
            cleanupWebRTC();
            resetTransferState();
            break;
          case 'receive_offer':
            addDevLog('Received WebRTC SDP Offer from ' + data.fromUserId, 'signaling');
            handleReceiveOffer(data.offer, data.fromUserId);
            break;
          case 'receive_answer':
            addDevLog('Received WebRTC SDP Answer from peer.', 'signaling');
            handleReceiveAnswer(data.answer);
            break;
          case 'receive_ice_candidate':
            addDevLog('Received remote ICE candidate from signaling server.', 'ice');
            handleReceiveIceCandidate(data.candidate);
            break;
        }
      } catch (err) {
        addDevLog('WebSocket message parse error: ' + err.message, 'error');
        console.error('WS message parse error:', err);
      }
    };
    ws.onclose = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      setSocketConnected(false);
      addDevLog('WebSocket connection closed. Retrying connection in 3 seconds...', 'signaling');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };
  };

  const clearDisconnectGraceTimeout = () => {
    if (disconnectGraceTimeoutRef.current) {
      clearTimeout(disconnectGraceTimeoutRef.current);
      disconnectGraceTimeoutRef.current = null;
    }
  };

  const startDisconnectGraceTimeout = (callback, delayMs) => {
    clearDisconnectGraceTimeout();
    disconnectGraceTimeoutRef.current = setTimeout(callback, delayMs);
  };

  const requestWakeLock = async () => {
    if (!FEATURE_FLAGS.ENABLE_SCREEN_WAKE_LOCK) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!wakeLockRef.current || wakeLockRef.current.released) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        addDevLog('Screen Wake Lock acquired.', 'system');
        wakeLockRef.current.addEventListener('release', () => {
          addDevLog('Screen Wake Lock released.', 'system');
        });
      }
    } catch (err) {
      // Browser may reject if battery saver is on or tab is not active
      console.warn('Screen Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  };

  // Sync wake lock with peerConnected state
  useEffect(() => {
    if (peerConnected) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [peerConnected]);

  const resetTransferState = (options = {}) => {
    setChatMessages([]);
    if (resetTransferStateRef.current) {
      resetTransferStateRef.current(options);
    }
  };

  function cleanupWebRTC(options = {}) {
    clearDisconnectGraceTimeout();
    releaseWakeLock();
    remoteIceCandidatesQueueRef.current = [];
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setWebrtcStats({
      active: false,
      connectionState: 'closed',
      iceConnectionState: 'closed',
      localCandidateType: '—',
      remoteCandidateType: '—',
      connectionType: '—',
      rtt: null,
      bytesSent: 0,
      bytesReceived: 0
    });

    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch {}
      dataChannelRef.current = null;
    }
    if (peerConnRef.current) {
      try { peerConnRef.current.close(); } catch {}
      peerConnRef.current = null;
    }
    if (resetTransferStateRef.current) {
      resetTransferStateRef.current(options);
    }
  };

  const attemptIceRestart = async (pc) => {
    if (!FEATURE_FLAGS.ENABLE_ICE_RESTART_ON_FAILED) return false;
    if (!pc || pc.signalingState === 'closed') return false;
    try {
      addDevLog('Attempting in-place WebRTC ICE restart on failed state...', 'ice');
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && peerIdRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'send_offer',
          data: { toUserId: peerIdRef.current, offer: pc.localDescription.sdp }
        }));
        addDevLog('Dispatched ICE restart offer to peer.', 'ice');
        return true;
      }
    } catch (err) {
      addDevLog('ICE restart attempt failed: ' + err.message + '. Falling back to full teardown.', 'error');
    }
    return false;
  };

  const handleConnectionStateChange = async (pc) => {
    addDevLog('WebRTC Peer connection state changed: ' + pc.connectionState, 'webrtc');
    if (pc.connectionState === 'connected') {
      clearConnectionTimeout();
      clearDisconnectGraceTimeout();
      setConnectionError(null);
      setPeerConnected(true);
      requestWakeLock();
    } else if (pc.connectionState === 'disconnected') {
      if (FEATURE_FLAGS.WEBRTC_DISCONNECT_GRACE_PERIOD_MS > 0) {
        addDevLog(`Transient WebRTC disconnect detected. Entering ${FEATURE_FLAGS.WEBRTC_DISCONNECT_GRACE_PERIOD_MS}ms grace period...`, 'webrtc');
        startDisconnectGraceTimeout(() => {
          addDevLog('WebRTC disconnect grace period expired without recovery.', 'webrtc');
          cleanupWebRTC({ keepSelectedFile: true });
          setPeerConnected(false);
          setConnectionError('failed');
        }, FEATURE_FLAGS.WEBRTC_DISCONNECT_GRACE_PERIOD_MS);
      } else {
        clearConnectionTimeout();
        cleanupWebRTC({ keepSelectedFile: true });
        setPeerConnected(false);
        setConnectionError('failed');
      }
    } else if (pc.connectionState === 'failed') {
      clearConnectionTimeout();
      clearDisconnectGraceTimeout();
      let restarted = false;
      if (isHostRef.current && pc.signalingState === 'stable') {
        restarted = await attemptIceRestart(pc);
      }
      if (!restarted) {
        cleanupWebRTC({ keepSelectedFile: true });
        setPeerConnected(false);
        setConnectionError('failed');
      }
    } else if (pc.connectionState === 'closed') {
      clearConnectionTimeout();
      clearDisconnectGraceTimeout();
      cleanupWebRTC({ keepSelectedFile: true });
      setPeerConnected(false);
    }
  };

  // WebRTC connection timeouts to protect clients from hanging indefinitely
  const startConnectionTimeout = () => {
    clearConnectionTimeout();
    connectionTimeoutRef.current = setTimeout(() => {
      // Do not abort connection if user is currently backgrounded picking a file
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        addDevLog('Connection timeout deferred: tab is currently in background.', 'webrtc');
        return;
      }
      addDevLog('WebRTC connection establishment timed out (25s limit reached).', 'error');
      cleanupWebRTC({ keepSelectedFile: true });
      setPeerConnected(false);
      setConnectionError('timeout');
      addNotification('Connection timed out. Please check firewall or network compatibility.', 'error');
    }, 25000);
  };

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };


  const startStatsMonitoring = (pc) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.signalingState === 'closed') {
        clearInterval(statsIntervalRef.current);
        return;
      }
      try {
        const stats = await pc.getStats();
        let activePair = null;
        let localCand = null;
        let remoteCand = null;

        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            activePair = report;
          }
        });

        if (activePair) {
          const localId = activePair.localCandidateId;
          const remoteId = activePair.remoteCandidateId;
          stats.forEach(report => {
            if (report.id === localId) localCand = report;
            if (report.id === remoteId) remoteCand = report;
          });
        }

        const rtt = activePair && activePair.currentRoundTripTime !== undefined
          ? Math.round(activePair.currentRoundTripTime * 1000)
          : null;

        let connType = '—';
        if (localCand) {
          const type = localCand.candidateType;
          if (type === 'host') connType = 'Local LAN (Host)';
          else if (type === 'srflx') connType = 'Public P2P (STUN)';
          else if (type === 'relay') connType = 'Relay (TURN)';
          else if (type === 'prflx') connType = 'Peer Reflexive';
        }

        let bytesSent = 0;
        let bytesReceived = 0;
        stats.forEach(report => {
          if (report.type === 'transport') {
            bytesSent = report.bytesSent || 0;
            bytesReceived = report.bytesReceived || 0;
          }
        });

        setWebrtcStats({
          active: true,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          localCandidateType: localCand ? localCand.candidateType : '—',
          remoteCandidateType: remoteCand ? remoteCand.candidateType : '—',
          connectionType: connType,
          rtt,
          bytesSent,
          bytesReceived
        });
      } catch (err) {
        console.warn('Error reading WebRTC statistics:', err);
      }
    }, 1000);
  };

  // ── Room management ──
  const createRoom = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addNotification('WebSocket not connected. Please wait...', 'error');
      return;
    }
    setConnectionError(null);
    addDevLog('Requesting room creation...', 'signaling');
    socketRef.current.send(JSON.stringify({ type: 'create_room', data: { userId } }));
  };

  const joinRoom = (code) => {
    if (!code || code.trim().length !== 6) {
      addNotification('Invalid room code. Must be 6 alphanumeric characters.', 'error');
      return;
    }
    const cleanCode = code.trim().toLowerCase();
    addDevLog('Joining room: ' + cleanCode, 'signaling');
    setRoomCode(cleanCode);
    setIsHost(false);
    isHostRef.current = false; // Set synchronously to avoid peer_joined race condition
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'join_room', data: { userId, roomCode: cleanCode } }));
    }
  };

  const leaveRoom = () => {
    if (!roomCodeRef.current) return;
    addDevLog('Leaving room: ' + roomCodeRef.current, 'signaling');
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'leave_room', data: { userId, roomCode: roomCodeRef.current } }));
    }
    setRoomCode('');
    setIsHost(false);
    isHostRef.current = false;
    setPeerConnected(false);
    setPeerId('');
    cleanupWebRTC();
    addNotification('Disconnected from room.', 'info');
  };

  // ── WebRTC initiation (Host creates offer) ──
  const initiateWebRTC = async (targetPeerId) => {
    try {
      cleanupWebRTC();
      addDevLog('Creating RTCPeerConnection as host...', 'webrtc');
      const rtcConfig = {
        ...(iceConfigurationRef.current || iceConfiguration),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
      };
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnRef.current = pc;
      startConnectionTimeout();
      startStatsMonitoring(pc);

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candStr = event.candidate.candidate;
          const parts = candStr.split(' ');
          const ip = parts[4] || 'unknown';
          const candType = parts[7] || 'unknown';
          addDevLog(`Gathered local ICE candidate: type=${candType} IP=${ip}`, 'ice');
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'send_ice_candidate',
              data: { toUserId: targetPeerId, candidate: event.candidate }
            }));
          }
        }
      };

      pc.onconnectionstatechange = () => handleConnectionStateChange(pc);

      addDevLog('Creating WebRTC Data Channel: file-transfer', 'webrtc');
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dataChannelRef.current = dc;

      dc.onopen = () => {
        addDevLog('WebRTC Data Channel is open. P2P connection established!', 'webrtc');
        setPeerConnected(true);
        addNotification('P2P connection established! You can now send files.', 'success');
      };
      dc.onmessage = (e) => {
        handleDataChannelMessage(e, dc);
      };
      dc.onclose = () => {
        addDevLog('WebRTC Data Channel closed.', 'webrtc');
        setPeerConnected(false);
      };

      const offer = await pc.createOffer();
      addDevLog('Generated local WebRTC SDP Offer.', 'webrtc');
      await pc.setLocalDescription(offer);

      addDevLog('Sending SDP Offer to peer via signaling server.', 'signaling');
      socketRef.current.send(JSON.stringify({
        type: 'send_offer',
        data: { toUserId: targetPeerId, offer: pc.localDescription.sdp }
      }));
    } catch (err) {
      addDevLog('Failed to establish WebRTC connection: ' + err.message, 'error');
      console.error('Error in initiateWebRTC:', err);
      clearConnectionTimeout();
      setPeerConnected(false);
      addNotification('Failed to establish WebRTC connection: ' + err.message, 'error');
    }
  };

  const processQueuedIceCandidates = async () => {
    const pc = peerConnRef.current;
    if (!pc) return;
    const queue = remoteIceCandidatesQueueRef.current;
    if (queue.length > 0) {
      addDevLog(`Processing ${queue.length} queued remote ICE candidates...`, 'ice');
      while (queue.length > 0) {
        const candidate = queue.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          const candStr = candidate.candidate;
          const parts = candStr.split(' ');
          const ip = parts[4] || 'unknown';
          const candType = parts[7] || 'unknown';
          addDevLog(`Successfully added queued remote ICE candidate: type=${candType} IP=${ip}`, 'ice');
        } catch (err) {
          console.error('Error adding queued remote ICE candidate:', err);
        }
      }
    }
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    try {
      await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
      await processQueuedIceCandidates();
    } catch (err) {
      console.error('Error setting remote description:', err);
      clearConnectionTimeout();
      cleanupWebRTC();
      setPeerConnected(false);
    }
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    try {
      clearDisconnectGraceTimeout();
      const existingPc = peerConnRef.current;
      if (
        FEATURE_FLAGS.ENABLE_ICE_RESTART_ON_FAILED &&
        existingPc &&
        existingPc.signalingState === 'stable' &&
        peerIdRef.current === senderId
      ) {
        addDevLog('Applying ICE restart offer on existing RTCPeerConnection...', 'webrtc');
        await existingPc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
        await processQueuedIceCandidates();
        const answer = await existingPc.createAnswer();
        await existingPc.setLocalDescription(answer);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'send_answer', data: { toUserId: senderId, answer: existingPc.localDescription.sdp } }));
        }
        return;
      }

      cleanupWebRTC({ keepSelectedFile: true });
      addDevLog('Creating RTCPeerConnection as joiner...', 'webrtc');
      const rtcConfig = {
        ...(iceConfigurationRef.current || iceConfiguration),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
      };
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnRef.current = pc;
      startConnectionTimeout();
      startStatsMonitoring(pc);

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candStr = event.candidate.candidate;
          const parts = candStr.split(' ');
          const ip = parts[4] || 'unknown';
          const candType = parts[7] || 'unknown';
          addDevLog(`Gathered local ICE candidate: type=${candType} IP=${ip}`, 'ice');
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'send_ice_candidate',
              data: { toUserId: senderId, candidate: event.candidate }
            }));
          }
        }
      };

      pc.onconnectionstatechange = () => handleConnectionStateChange(pc);

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;
        addDevLog('Received WebRTC Data Channel creation event: ' + dc.label, 'webrtc');

        const onOpen = () => {
          addDevLog('WebRTC Data Channel is open. P2P connection established!', 'webrtc');
          setPeerConnected(true);
          addNotification('P2P connection established! You can now send files.', 'success');
        };
        if (dc.readyState === 'open') onOpen(); else dc.onopen = onOpen;

        dc.onmessage = (e) => {
          handleDataChannelMessage(e, dc);
        };
        dc.onclose = () => {
          addDevLog('WebRTC Data Channel closed.', 'webrtc');
          setPeerConnected(false);
        };
      };

      addDevLog('Setting remote WebRTC description (Offer)...', 'webrtc');
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
      await processQueuedIceCandidates();

      addDevLog('Creating WebRTC SDP Answer...', 'webrtc');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      addDevLog('Sending SDP Answer to peer via signaling server.', 'signaling');
      socketRef.current.send(JSON.stringify({ type: 'send_answer', data: { toUserId: senderId, answer: pc.localDescription.sdp } }));
    } catch (err) {
      addDevLog('Error setting up WebRTC connection: ' + err.message, 'error');
      console.error('Error in handleReceiveOffer:', err);
      clearConnectionTimeout();
      cleanupWebRTC({ keepSelectedFile: true });
      setPeerConnected(false);
      addNotification('Failed to establish WebRTC connection: ' + err.message, 'error');
    }
  };

  const handleReceiveIceCandidate = async (candidate) => {
    const pc = peerConnRef.current;
    if (!pc) return;

    if (!pc.remoteDescription) {
      addDevLog('Queueing remote ICE candidate (remoteDescription not set yet)', 'ice');
      remoteIceCandidatesQueueRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      const candStr = candidate.candidate;
      const parts = candStr.split(' ');
      const ip = parts[4] || 'unknown';
      const candType = parts[7] || 'unknown';
      addDevLog(`Added remote ICE candidate: type=${candType} IP=${ip}`, 'ice');
    } catch (err) {
      console.error('Error adding remote ICE candidate:', err);
    }
  };

  // ── DataChannel message router ──
  const handleDataChannelMessage = (e, dc) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'chat') {
        addDevLog(`Received P2P test message: "${msg.text}"`, 'stream');
        setChatMessages(prev => [...prev, {
          senderId: peerIdRef.current || 'Peer',
          text: msg.text,
          time: new Date().toTimeString().split(' ')[0]
        }]);
        addNotification(`P2P Message: "${msg.text}"`, 'info');
        return;
      }
    } catch {
      // Ignore parse error for binary chunks
    }

    fileTransfer.handleDataChannelMessage(e, dc);
  };

  const sendChatMessage = (text) => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') {
      addNotification('No active P2P connection to send messages.', 'error');
      return;
    }
    if (!text || !text.trim()) return;

    const cleanText = text.trim();
    addDevLog(`Sending P2P chat message: "${cleanText}"`, 'stream');
    dc.send(JSON.stringify({ type: 'chat', text: cleanText }));

    setChatMessages(prev => [...prev, {
      senderId: 'You',
      text: cleanText,
      time: new Date().toTimeString().split(' ')[0]
    }]);
  };

  return {
    userId,
    socketConnected,
    theme,
    toggleTheme,
    roomCode,
    isHost,
    peerConnected,
    peerId,
    connectionError,
    webrtcStats,
    devLogs,
    addDevLog,
    clearDevLogs,
    notifications,
    addNotification,
    iceConfiguration,
    createRoom,
    joinRoom,
    leaveRoom,
    chatMessages,
    sendChatMessage,
    ...fileTransfer
  };
}
