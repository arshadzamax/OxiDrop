import { useState, useEffect, useRef } from 'react';
import { sanitizeFileName, formatBytes } from '../utils/helpers';

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

  // Sender state
  const [selectedFile, setSelectedFile] = useState(null);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderTransferSpeed, setSenderTransferSpeed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Receiver state
  const [receiverFileMeta, setReceiverFileMeta] = useState(null);
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverTransferSpeed, setReceiverTransferSpeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // P2P file request/approval states
  const [incomingFileOffer, setIncomingFileOffer] = useState(null);
  const [fileOfferPending, setFileOfferPending] = useState(false);
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
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);
  const fileWritableRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const peerIdRef = useRef('');
  const roomCodeRef = useRef('');
  const isHostRef = useRef(false);
  const remoteIceCandidatesQueueRef = useRef([]);

  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

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
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';

    // If running locally in development, default to local port 5000
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return {
        api: import.meta.env.VITE_API_HOST || 'http://localhost:5000',
        ws: import.meta.env.VITE_WS_HOST || 'ws://localhost:5000'
      };
    }

    // In production, default to co-locating with the current domain and match HTTPS/WSS secure protocols
    return {
      api: import.meta.env.VITE_API_HOST || `${window.location.protocol}//${host}`,
      ws: import.meta.env.VITE_WS_HOST || `${isSecure ? 'wss:' : 'ws:'}//${host}`
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
          setIceConfiguration({ iceServers: config.iceServers });

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

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      cleanupWebRTC();
      clearConnectionTimeout();
    };
  }, []);

  // Listen to visibility and focus events to reconnect instantly on mobile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED || socketRef.current.readyState === WebSocket.CLOSING) {
          addDevLog('Page became active. Reconnecting WebSocket immediately...', 'signaling');
          connectWebSocket();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

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
      setSocketConnected(false);
      addDevLog('WebSocket connection closed. Retrying connection in 3 seconds...', 'signaling');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };
  };

  const resetTransferState = () => {
    setSelectedFile(null);
    setSenderProgress(0);
    setSenderTransferSpeed(0);
    setIsUploading(false);
    setReceiverFileMeta(null);
    setReceiverProgress(0);
    setReceiverTransferSpeed(0);
    setIsDownloading(false);
    setIncomingFileOffer(null);
    setFileOfferPending(false);
    setChatMessages([]);
  };

  const cleanupWebRTC = () => {
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
    if (fileWritableRef.current) {
      try { fileWritableRef.current.close(); } catch {}
      fileWritableRef.current = null;
    }
  };

  // WebRTC connection timeouts to protect clients from hanging indefinitely
  const startConnectionTimeout = () => {
    clearConnectionTimeout();
    connectionTimeoutRef.current = setTimeout(() => {
      if (peerConnRef.current && peerConnRef.current.connectionState !== 'connected') {
        cleanupWebRTC();
        setPeerConnected(false);
        setIsUploading(false);
        setIsDownloading(false);
        setSenderTransferSpeed(0);
        setReceiverTransferSpeed(0);
        addNotification('WebRTC connection setup timed out. The peer might be offline or behind a restrictive NAT/Firewall.', 'error');
      }
    }, 25000);
  };

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  const startStatsMonitoring = (pc) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    setWebrtcStats(prev => ({ ...prev, active: true }));

    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.connectionState === 'closed') {
        clearInterval(statsIntervalRef.current);
        return;
      }

      try {
        const stats = await pc.getStats();
        let localCand = null;
        let remoteCand = null;
        let activePair = null;

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

        setWebrtcStats({
          active: true,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          localCandidateType: localCand ? localCand.candidateType : '—',
          remoteCandidateType: remoteCand ? remoteCand.candidateType : '—',
          connectionType: connType,
          rtt,
          bytesSent: activePair ? activePair.bytesSent : 0,
          bytesReceived: activePair ? activePair.bytesReceived : 0
        });
      } catch (err) {
        console.warn('Failed to fetch WebRTC connection stats:', err);
      }
    }, 1000);
  };

  // ── Room management ──
  const createRoom = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addNotification('WebSocket not connected. Please wait...', 'error');
      return;
    }
    addDevLog('Requesting room creation...', 'signaling');
    socketRef.current.send(JSON.stringify({ type: 'create_room', data: { userId } }));
  };

  const joinRoom = (code) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addNotification('WebSocket not connected. Please wait...', 'error');
      return;
    }
    if (!code || !code.trim()) {
      addNotification('Please enter a room code.', 'error');
      return;
    }
    addDevLog('Joining room: ' + code.trim(), 'signaling');
    setRoomCode(code.trim());
    setIsHost(false);
    isHostRef.current = false; // Set synchronously
    socketRef.current.send(JSON.stringify({ type: 'join_room', data: { userId, roomCode: code.trim() } }));
  };

  const leaveRoom = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && roomCodeRef.current) {
      addDevLog('Leaving room: ' + roomCodeRef.current, 'signaling');
      socketRef.current.send(JSON.stringify({ type: 'leave_room', data: { userId, roomCode: roomCodeRef.current } }));
    }
    cleanupWebRTC();
    clearConnectionTimeout();
    setPeerConnected(false);
    setPeerId('');
    setRoomCode('');
    setIsHost(false);
    isHostRef.current = false; // Set synchronously
    resetTransferState();
    addNotification('Disconnected from room.', 'info');
  };

  // ── WebRTC initiation (Host creates offer) ──
  const initiateWebRTC = async (targetPeerId) => {
    try {
      cleanupWebRTC();
      addDevLog('Creating RTCPeerConnection as host...', 'webrtc');
      const pc = new RTCPeerConnection(iceConfiguration);
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

      pc.onconnectionstatechange = () => {
        addDevLog('WebRTC Peer connection state changed: ' + pc.connectionState, 'webrtc');
        if (pc.connectionState === 'connected') {
          clearConnectionTimeout();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          clearConnectionTimeout();
          cleanupWebRTC();
          setPeerConnected(false);
          setIsUploading(false);
          setIsDownloading(false);
          setSenderTransferSpeed(0);
          setReceiverTransferSpeed(0);
        }
      };

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
        setIsUploading(false);
        setIsDownloading(false);
        setSenderTransferSpeed(0);
        setReceiverTransferSpeed(0);
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
      setIsUploading(false);
      setSenderTransferSpeed(0);
    }
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    try {
      cleanupWebRTC();
      addDevLog('Creating RTCPeerConnection as joiner...', 'webrtc');
      const pc = new RTCPeerConnection(iceConfiguration);
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

      pc.onconnectionstatechange = () => {
        addDevLog('WebRTC Peer connection state changed: ' + pc.connectionState, 'webrtc');
        if (pc.connectionState === 'connected') {
          clearConnectionTimeout();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          clearConnectionTimeout();
          cleanupWebRTC();
          setPeerConnected(false);
          setIsDownloading(false);
          setIsUploading(false);
          setReceiverTransferSpeed(0);
          setSenderTransferSpeed(0);
        }
      };

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
          setIsUploading(false);
          setIsDownloading(false);
          setSenderTransferSpeed(0);
          setReceiverTransferSpeed(0);
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
      cleanupWebRTC();
      setPeerConnected(false);
      setIsDownloading(false);
      setReceiverTransferSpeed(0);
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

  // ── DataChannel protocol handler ──
  const handleDataChannelMessage = (e, dc) => {
    // Binary data = file chunk
    if (e.data instanceof ArrayBuffer) {
      handleReceiveChunk(e.data);
      return;
    }

    // JSON control messages
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'chat':
          addDevLog(`Received P2P test message: "${msg.text}"`, 'stream');
          setChatMessages(prev => [...prev, {
            senderId: peerIdRef.current || 'Peer',
            text: msg.text,
            time: new Date().toTimeString().split(' ')[0]
          }]);
          addNotification(`P2P Message: "${msg.text}"`, 'info');
          break;
        case 'file_offer':
          addDevLog(`Received file offer from peer: ${msg.name} (${formatBytes(msg.size)})`, 'stream');
          setIncomingFileOffer({ name: msg.name, size: msg.size });
          break;
        case 'file_accept':
          addDevLog('Peer accepted file offer. Starting file stream...', 'stream');
          setFileOfferPending(false);
          startFileStreaming(dc);
          break;
        case 'file_reject':
          addDevLog('Peer declined file offer.', 'stream');
          setFileOfferPending(false);
          setSelectedFile(null);
          addNotification('File transfer request was declined by the receiver.', 'error');
          break;
        case 'file_complete':
          addDevLog('Received file_complete signal from sender.', 'stream');
          finalizeReceivedFile();
          break;
      }
    } catch {
      // Ignore non-JSON, non-binary messages
    }
  };

  // ── Receiver: chunk accumulation ──
  const receiverBufRef = useRef([]);
  const receiverBytesRef = useRef(0);
  const receiverSpeedBytesRef = useRef(0);
  const receiverSpeedTimeRef = useRef(performance.now());
  const receiverLastLoggedPctRef = useRef(-1);
  const receiverWriteQueueRef = useRef(Promise.resolve());

  const handleReceiveChunk = (data) => {
    receiverBytesRef.current += data.byteLength;
    receiverSpeedBytesRef.current += data.byteLength;
    const now = performance.now();
    if (now - receiverSpeedTimeRef.current >= 1000) {
      setReceiverTransferSpeed(((receiverSpeedBytesRef.current / (1024 * 1024)) / ((now - receiverSpeedTimeRef.current) / 1000)).toFixed(2));
      receiverSpeedBytesRef.current = 0;
      receiverSpeedTimeRef.current = now;
    }

    const meta = receiverFileMetaRef.current;
    if (!meta) return;
    const progressPct = Math.round((receiverBytesRef.current / meta.sizeBytes) * 100);
    setReceiverProgress(progressPct);

    if (progressPct % 10 === 0 && progressPct !== receiverLastLoggedPctRef.current) {
      addDevLog(`Received chunk: ${formatBytes(receiverBytesRef.current)} / ${formatBytes(meta.sizeBytes)} (${progressPct}%)`, 'stream');
      receiverLastLoggedPctRef.current = progressPct;
    }

    if (fileWritableRef.current) {
      const chunkData = data;
      receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
        try {
          await fileWritableRef.current.write(chunkData);
        } catch (err) {
          addDevLog('Failed direct disk write chunk: ' + err.message, 'error');
          console.error('Failed streaming chunk directly to disk path:', err);
        }
      });
    } else {
      receiverBufRef.current.push(data);
    }
  };

  const promptSaveLocation = async (fileName) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
        });
        fileWritableRef.current = await handle.createWritable();
      } catch (err) {
        console.warn('Save file picker cancelled or failed. Falling back to browser memory buffer.', err);
        fileWritableRef.current = null;
      }
    }
  };

  const finalizeReceivedFile = async () => {
    setIsDownloading(false);
    setReceiverProgress(100);
    setReceiverTransferSpeed(0);
    addDevLog('All file bytes received successfully. Saving file...', 'stream');

    const meta = receiverFileMetaRef.current;
    if (!meta) return;

    if (fileWritableRef.current) {
      receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
        try {
          await fileWritableRef.current.close();
          fileWritableRef.current = null;
          addDevLog('Direct disk file writer closed successfully.', 'stream');
          addNotification('File downloaded successfully!', 'success');
        } catch (err) {
          addDevLog('Error closing local file descriptor: ' + err.message, 'error');
          console.error('Failed to close local file descriptor:', err);
        }
      });
    } else {
      const url = URL.createObjectURL(new Blob(receiverBufRef.current));
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizeFileName(meta.fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addDevLog('Triggered standard browser blob download.', 'stream');
      addNotification('File downloaded successfully!', 'success');
    }

    // Reset receiver accumulators for next transfer
    receiverBufRef.current = [];
    receiverBytesRef.current = 0;
    receiverSpeedBytesRef.current = 0;
    receiverLastLoggedPctRef.current = -1;
  };

  // ── Sender: file selection & streaming ──
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];

      // Enforce client-side file size limits before registration
      if (file.size > 10 * 1024 * 1024 * 1024 * 1024) { // 10 Terabytes
        addNotification('File exceeds the 10TB safety limit.', 'error');
        return;
      }

      setSelectedFile(file);
      setSenderProgress(0);
      setIsUploading(false);
    }
  };

  const sendFile = () => {
    const dc = dataChannelRef.current;
    const file = selectedFileRef.current;
    if (!dc || dc.readyState !== 'open' || !file) {
      addNotification('No peer connection or file selected.', 'error');
      return;
    }
    addDevLog(`Offering file to peer: ${file.name} (${formatBytes(file.size)})`, 'stream');
    dc.send(JSON.stringify({ type: 'file_offer', name: file.name, size: file.size }));
    setFileOfferPending(true);
    setSenderProgress(0);
  };

  const acceptIncomingFile = async () => {
    const dc = dataChannelRef.current;
    const offer = incomingFileOffer;
    if (!dc || dc.readyState !== 'open' || !offer) {
      addNotification('No open data channel connection found.', 'error');
      return;
    }

    addDevLog(`Accepting incoming file: ${offer.name} (${formatBytes(offer.size)})`, 'stream');
    setReceiverFileMeta({ fileName: offer.name, sizeBytes: offer.size });
    setReceiverProgress(0);
    setIsDownloading(true);

    // Prompt save location using File System Access API if supported
    await promptSaveLocation(offer.name);

    addDevLog('Sending file_accept response to peer...', 'stream');
    dc.send(JSON.stringify({ type: 'file_accept' }));
    setIncomingFileOffer(null);
  };

  const rejectIncomingFile = () => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') return;

    addDevLog('Declining incoming file offer...', 'stream');
    dc.send(JSON.stringify({ type: 'file_reject' }));
    setIncomingFileOffer(null);
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

  const startFileStreaming = (dc) => {
    if (!selectedFileRef.current) return;
    const file = selectedFileRef.current;
    const chunkSize = 65536;
    let currentOffset = 0;
    let bytesSent = 0;
    let lastTime = performance.now();
    let lastLoggedPct = -1;

    addDevLog(`Starting file stream: ${file.name} (${formatBytes(file.size)})`, 'stream');

    const stream = () => {
      while (currentOffset < file.size) {
        if (dc.bufferedAmount > 8 * 1024 * 1024) { setTimeout(stream, 15); return; }
        const slice = file.slice(currentOffset, currentOffset + chunkSize);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (dc.readyState !== 'open') return;
          const chunk = event.target.result;
          try {
            dc.send(chunk);
          } catch (e) {
            addDevLog('Failed to send chunk via WebRTC: ' + e.message, 'error');
            console.error('Failed to send chunk via WebRTC:', e);
            cleanupWebRTC();
            setIsUploading(false);
            setSenderTransferSpeed(0);
            return;
          }
          currentOffset += chunk.byteLength;
          bytesSent += chunk.byteLength;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setSenderTransferSpeed(((bytesSent / (1024 * 1024)) / ((now - lastTime) / 1000)).toFixed(2));
            bytesSent = 0;
            lastTime = now;
          }
          const progressPct = Math.round((currentOffset / file.size) * 100);
          setSenderProgress(progressPct);

          if (progressPct % 10 === 0 && progressPct !== lastLoggedPct) {
            addDevLog(`Sent chunk: ${formatBytes(currentOffset)} / ${formatBytes(file.size)} (${progressPct}%)`, 'stream');
            lastLoggedPct = progressPct;
          }

          if (currentOffset >= file.size) {
            // All chunks sent, signal completion
            setSenderProgress(100);
            addDevLog('All file chunks pushed. Sending file_complete signal.', 'stream');
            try {
              dc.send(JSON.stringify({ type: 'file_complete' }));
            } catch {}
            setIsUploading(false);
            setSenderTransferSpeed(0);
            addNotification('File sent successfully!', 'success');
            return;
          }
          stream();
        };
        reader.readAsArrayBuffer(slice);
        return;
      }
    };
    stream();
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
    selectedFile,
    senderProgress,
    senderTransferSpeed,
    isUploading,
    receiverFileMeta,
    receiverProgress,
    receiverTransferSpeed,
    isDownloading,
    incomingFileOffer,
    fileOfferPending,
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
    handleFileChange,
    sendFile,
    acceptIncomingFile,
    rejectIncomingFile,
    chatMessages,
    sendChatMessage
  };
}
