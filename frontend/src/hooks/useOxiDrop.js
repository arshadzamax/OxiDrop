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

  // Sender state
  const [selectedFile, setSelectedFile] = useState(null);
  const [registeredFileId, setRegisteredFileId] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('oxi_registeredFileId') || '';
    }
    return '';
  });
  const [copied, setCopied] = useState(false);
  const [senderRequests, setSenderRequests] = useState([]);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderTransferSpeed, setSenderTransferSpeed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Receiver state
  const [fileIdInput, setFileIdInput] = useState('');
  const [receiverFileMeta, setReceiverFileMeta] = useState(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [requestStatus, setRequestStatus] = useState('');
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverTransferSpeed, setReceiverTransferSpeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

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
  const registeredFileIdRef = useRef('');
  const fileWritableRef = useRef(null);
  const isReRegisteringRef = useRef(false);
  const connectionTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);
  useEffect(() => { 
    registeredFileIdRef.current = registeredFileId; 
    if (typeof window !== 'undefined') {
      if (registeredFileId) {
        sessionStorage.setItem('oxi_registeredFileId', registeredFileId);
      } else {
        sessionStorage.removeItem('oxi_registeredFileId');
      }
    }
  }, [registeredFileId]);

  // Host configuration resolution loaded automatically by Vite based on environment modes (.env.development / .env.production)
  const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:5000';
  const WS_HOST = import.meta.env.VITE_WS_HOST || 'ws://localhost:5000';

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
          setIceConfiguration({ iceServers: config.iceServers });
        }
      } catch (err) {
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
      
      // Auto-re-register files on WebSocket reconnect events
      if (selectedFileRef.current && registeredFileIdRef.current) {
        addDevLog('Auto-re-registering file ' + selectedFileRef.current.name + ' after reconnection.', 'signaling');
        reRegisterFile();
      }
    };
    ws.onmessage = async (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'new_access_request':
            addDevLog('Received download access request from peer: ' + data.receiverId, 'signaling');
            setSenderRequests(prev => prev.some(r => r.requestId === data.requestId) ? prev : [...prev, data]);
            break;
          case 'request_status_update':
            addDevLog('File request status updated to: ' + data.status, 'signaling');
            setRequestStatus(data.status);
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
          case 'transfer_completed':
            addDevLog('Received transfer_completed confirmation from receiver.', 'stream');
            addNotification('File transfer completed successfully!', 'success');
            cleanupWebRTC();
            setIsUploading(false);
            setSenderTransferSpeed(0);
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

  const reRegisterFile = async () => {
    if (!selectedFileRef.current || !registeredFileIdRef.current || isReRegisteringRef.current) return;
    isReRegisteringRef.current = true;
    try {
      const res = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: registeredFileIdRef.current,
          fileName: selectedFileRef.current.name,
          sizeBytes: selectedFileRef.current.size,
          senderId: userId,
          autoApprove: false
        })
      });
      if (res.ok) {
        addNotification('File Share ID verified and re-registered successfully.', 'info');
      }
    } catch (err) {
      console.error('Failed to re-register stale file mapping on reconnect:', err);
    } finally {
      isReRegisteringRef.current = false;
    }
  };

  const cleanupWebRTC = () => {
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
        setIsUploading(false);
        setIsDownloading(false);
        setSenderTransferSpeed(0);
        setReceiverTransferSpeed(0);
        addNotification('WebRTC connection setup timed out. The peer might be offline or behind an restrictive NAT/Firewall.', 'error');
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

  // ── Sender handlers ──
  const handleApproveRequest = async (request) => {
    try {
      addDevLog('Approving access request for fileId: ' + request.fileId, 'signaling');
      socketRef.current.send(JSON.stringify({ type: 'approve_request', data: { fileId: request.fileId, receiverId: request.receiverId } }));
      setSenderRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      cleanupWebRTC();
 
      addDevLog('Creating RTCPeerConnection for sender...', 'webrtc');
      const pc = new RTCPeerConnection(iceConfiguration);
      peerConnRef.current = pc;
      startConnectionTimeout();
      startStatsMonitoring(pc);
 
      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candType = event.candidate.candidate ? event.candidate.candidate.split(' ')[7] : 'unknown';
          addDevLog('Gathered local ICE candidate: type=' + candType, 'ice');
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'send_ice_candidate',
              data: { toUserId: request.receiverId, candidate: event.candidate }
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
          setIsUploading(false);
          setSenderTransferSpeed(0);
        }
      };
 
      addDevLog('Creating WebRTC Data Channel: file-transfer', 'webrtc');
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dataChannelRef.current = dc;
 
      dc.onopen = () => {
        addDevLog('WebRTC Data Channel is open. Waiting for chunk request...', 'webrtc');
        setIsUploading(true);
      };
      dc.onmessage = (e) => { 
        try { 
          const h = JSON.parse(e.data); 
          if (h.offset !== undefined) {
            addDevLog('Receiver requested file chunks starting from offset: ' + h.offset, 'stream');
            startFileStreaming(dc, h.offset); 
          }
        } catch {} 
      };
      dc.onclose = () => {
        addDevLog('WebRTC Data Channel closed.', 'webrtc');
        setIsUploading(false);
        setSenderTransferSpeed(0);
      };
 
      const offer = await pc.createOffer();
      addDevLog('Generated local WebRTC SDP Offer.', 'webrtc');
      await pc.setLocalDescription(offer);
 
      addDevLog('Sending SDP Offer to receiver via signaling server.', 'signaling');
      socketRef.current.send(JSON.stringify({
        type: 'send_offer',
        data: { toUserId: request.receiverId, offer: pc.localDescription.sdp }
      }));
    } catch (err) {
      addDevLog('Failed to establish WebRTC connection: ' + err.message, 'error');
      console.error('Error in handleApproveRequest:', err);
      clearConnectionTimeout();
      setIsUploading(false);
      setSenderTransferSpeed(0);
      addNotification('Failed to establish WebRTC connection: ' + err.message, 'error');
    }
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    try {
      await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
    } catch (err) {
      console.error('Error setting remote description:', err);
      clearConnectionTimeout();
      cleanupWebRTC();
      setIsUploading(false);
      setSenderTransferSpeed(0);
    }
  };

  const startFileStreaming = (dc, offset) => {
    if (!selectedFileRef.current) return;
    const file = selectedFileRef.current;
    const chunkSize = 65536;
    let currentOffset = offset;
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

          stream();
        };
        reader.readAsArrayBuffer(slice);
        return;
      }
      setSenderProgress(100);
      addDevLog('All file chunks pushed to WebRTC data channel buffer.', 'stream');
    };
    stream();
  };

  // ── Receiver handlers ──
  const handleFetchMetadata = async () => {
    if (!fileIdInput) return;
    setIsFetchingMeta(true);
    setReceiverFileMeta(null);
    setRequestStatus('');
    try {
      const res = await fetch(`${API_HOST}/api/files/${fileIdInput.trim()}`);
      if (!res.ok) throw new Error('File metadata lookup query failed');
      setReceiverFileMeta(await res.json());
    } catch (err) {
      addNotification('File ID lookup error: ' + err.message, 'error');
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!receiverFileMeta) return;

    // Use File System Access API streaming writer if supported to avoid tab crashes on large transfers
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: receiverFileMeta.fileName,
        });
        fileWritableRef.current = await handle.createWritable();
      } catch (err) {
        console.warn('Save file picker cancelled or failed. Falling back to browser memory buffer.', err);
        fileWritableRef.current = null;
      }
    }

    socketRef.current.send(JSON.stringify({ type: 'request_access', data: { fileId: receiverFileMeta.fileId, receiverId: userId } }));
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    try {
      cleanupWebRTC();
      addDevLog('Creating RTCPeerConnection for receiver...', 'webrtc');
      const pc = new RTCPeerConnection(iceConfiguration);
      peerConnRef.current = pc;
      startConnectionTimeout();
      startStatsMonitoring(pc);

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candType = event.candidate.candidate ? event.candidate.candidate.split(' ')[7] : 'unknown';
          addDevLog('Gathered local ICE candidate: type=' + candType, 'ice');
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
          setIsDownloading(false);
          setReceiverTransferSpeed(0);
        }
      };

      let buf = [], received = 0, bytesInSec = 0, lastTime = performance.now();
      let writeQueue = Promise.resolve();
      let lastLoggedPct = -1;

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;
        addDevLog('Received WebRTC Data Channel creation event: ' + dc.label, 'webrtc');

        const onOpen = () => { 
          setIsDownloading(true); 
          addDevLog('Data channel open! Sending offset:0 request to sender...', 'webrtc');
          dc.send(JSON.stringify({ offset: 0 })); 
        };
        if (dc.readyState === 'open') onOpen(); else dc.onopen = onOpen;

        dc.onmessage = async (e) => {
          received += e.data.byteLength;
          bytesInSec += e.data.byteLength;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setReceiverTransferSpeed(((bytesInSec / (1024 * 1024)) / ((now - lastTime) / 1000)).toFixed(2));
            bytesInSec = 0;
            lastTime = now;
          }
          const meta = receiverFileMetaRef.current;
          if (!meta) return;
          const progressPct = Math.round((received / meta.sizeBytes) * 100);
          setReceiverProgress(progressPct);

          if (progressPct % 10 === 0 && progressPct !== lastLoggedPct) {
            addDevLog(`Received chunk: ${formatBytes(received)} / ${formatBytes(meta.sizeBytes)} (${progressPct}%)`, 'stream');
            lastLoggedPct = progressPct;
          }

          if (fileWritableRef.current) {
            const dataToChunk = e.data;
            writeQueue = writeQueue.then(async () => {
              try {
                await fileWritableRef.current.write(dataToChunk);
              } catch (err) {
                addDevLog('Failed direct disk write chunk: ' + err.message, 'error');
                console.error('Failed streaming chunk directly to disk path:', err);
              }
            });
          } else {
            buf.push(e.data);
          }

          if (received >= meta.sizeBytes) {
            setIsDownloading(false);
            setReceiverProgress(100);
            setReceiverTransferSpeed(0);
            addDevLog('All file bytes received successfully. Saving file...', 'stream');

            if (fileWritableRef.current) {
              writeQueue = writeQueue.then(async () => {
                try {
                  await fileWritableRef.current.close();
                  fileWritableRef.current = null;
                  addDevLog('Direct disk file writer closed successfully.', 'stream');
                  socketRef.current.send(JSON.stringify({ type: 'transfer_completed', data: { fileId: meta.fileId, receiverId: userId } }));
                  addNotification('File downloaded successfully!', 'success');
                  cleanupWebRTC();
                } catch (err) {
                  addDevLog('Error closing local file descriptor: ' + err.message, 'error');
                  console.error('Failed to close local file descriptor:', err);
                }
              });
            } else {
              const url = URL.createObjectURL(new Blob(buf));
              const a = document.createElement('a');
              a.href = url;
              a.download = sanitizeFileName(meta.fileName);
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              addDevLog('Triggered standard browser blob download.', 'stream');
              socketRef.current.send(JSON.stringify({ type: 'transfer_completed', data: { fileId: meta.fileId, receiverId: userId } }));
              addNotification('File downloaded successfully!', 'success');
              cleanupWebRTC();
            }
          }
        };
        dc.onclose = () => {
          addDevLog('WebRTC Data Channel closed.', 'webrtc');
          setIsDownloading(false);
          setReceiverTransferSpeed(0);
        };
      };

      addDevLog('Setting remote WebRTC description (Offer)...', 'webrtc');
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
      
      addDevLog('Creating WebRTC SDP Answer...', 'webrtc');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      addDevLog('Sending SDP Answer to peer via signaling server.', 'signaling');
      socketRef.current.send(JSON.stringify({ type: 'send_answer', data: { toUserId: senderId, answer: pc.localDescription.sdp } }));
    } catch (err) {
      addDevLog('Error setting up receiver WebRTC connection: ' + err.message, 'error');
      console.error('Error in handleReceiveOffer:', err);
      clearConnectionTimeout();
      cleanupWebRTC();
      setIsDownloading(false);
      setReceiverTransferSpeed(0);
      addNotification('Failed to establish WebRTC download connection: ' + err.message, 'error');
    }
  };

  const handleReceiveIceCandidate = async (candidate) => {
    if (!peerConnRef.current) return;
    try {
      await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding remote ICE candidate:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Enforce client-side file size limits before registration
      if (file.size > 10 * 1024 * 1024 * 1024 * 1024) { // 10 Terabytes
        addNotification('File exceeds the 10TB safety registration limit.', 'error');
        return;
      }

      setSelectedFile(file);
      setRegisteredFileId('');
      setSenderRequests([]);
      setSenderProgress(0);
      setIsUploading(false);
    }
  };

  const handleRegisterFile = async () => {
    if (!selectedFile) return;
    const existingCode = sessionStorage.getItem('oxi_registeredFileId') || undefined;
    setRegisteredFileId('');
    try {
      const res = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          sizeBytes: selectedFile.size,
          senderId: userId,
          autoApprove: false, // Enabled manual approval flow
          existingFileId: existingCode
        })
      });
      if (!res.ok) throw new Error('Registration failed');
      setRegisteredFileId((await res.json()).fileId);
    } catch (err) {
      addNotification('Error registering file: ' + err.message, 'error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(registeredFileId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    userId,
    socketConnected,
    theme,
    toggleTheme,
    selectedFile,
    registeredFileId,
    copied,
    senderRequests,
    senderProgress,
    senderTransferSpeed,
    isUploading,
    fileIdInput,
    setFileIdInput,
    receiverFileMeta,
    isFetchingMeta,
    requestStatus,
    receiverProgress,
    receiverTransferSpeed,
    isDownloading,
    webrtcStats,
    devLogs,
    clearDevLogs,
    notifications,
    handleApproveRequest,
    handleFileChange,
    handleRegisterFile,
    copyToClipboard,
    handleFetchMetadata,
    handleRequestAccess
  };
}
