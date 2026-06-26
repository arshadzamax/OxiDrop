import { useState, useEffect, useRef } from 'react';
import { sanitizeFileName } from '../utils/helpers';

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

  // WebRTC & File streaming refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);
  const registeredFileIdRef = useRef('');
  const fileWritableRef = useRef(null);
  const isReRegisteringRef = useRef(false);
  const connectionTimeoutRef = useRef(null);

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
      cleanupWebRTC();
      clearConnectionTimeout();
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;
    ws.onopen = () => {
      setSocketConnected(true);
      ws.send(JSON.stringify({ type: 'register_user', data: { userId } }));
      
      // Auto-re-register files on WebSocket reconnect events
      if (selectedFileRef.current && registeredFileIdRef.current) {
        reRegisterFile();
      }
    };
    ws.onmessage = async (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case 'new_access_request':
            setSenderRequests(prev => prev.some(r => r.requestId === data.requestId) ? prev : [...prev, data]);
            break;
          case 'request_status_update':
            setRequestStatus(data.status);
            break;
          case 'receive_offer':
            handleReceiveOffer(data.offer, data.fromUserId);
            break;
          case 'receive_answer':
            handleReceiveAnswer(data.answer);
            break;
          case 'receive_ice_candidate':
            handleReceiveIceCandidate(data.candidate);
            break;
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };
    ws.onclose = () => {
      setSocketConnected(false);
      setTimeout(connectWebSocket, 3000);
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

  // ── Sender handlers ──
  const handleApproveRequest = async (request) => {
    try {
      socketRef.current.send(JSON.stringify({ type: 'approve_request', data: { fileId: request.fileId, receiverId: request.receiverId } }));
      setSenderRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      cleanupWebRTC();

      const pc = new RTCPeerConnection(iceConfiguration);
      peerConnRef.current = pc;
      startConnectionTimeout();

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'send_ice_candidate',
            data: { toUserId: request.receiverId, candidate: event.candidate }
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          clearConnectionTimeout();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          clearConnectionTimeout();
          cleanupWebRTC();
          setIsUploading(false);
          setSenderTransferSpeed(0);
        }
      };

      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dataChannelRef.current = dc;

      dc.onopen = () => setIsUploading(true);
      dc.onmessage = (e) => { try { const h = JSON.parse(e.data); if (h.offset !== undefined) startFileStreaming(dc, h.offset); } catch {} };
      dc.onclose = () => {
        setIsUploading(false);
        setSenderTransferSpeed(0);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.send(JSON.stringify({
        type: 'send_offer',
        data: { toUserId: request.receiverId, offer: pc.localDescription.sdp }
      }));
    } catch (err) {
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
          setSenderProgress(Math.round((currentOffset / file.size) * 100));
          stream();
        };
        reader.readAsArrayBuffer(slice);
        return;
      }
      setSenderProgress(100);
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
      const pc = new RTCPeerConnection(iceConfiguration);
      peerConnRef.current = pc;
      startConnectionTimeout();

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'send_ice_candidate',
            data: { toUserId: senderId, candidate: event.candidate }
          }));
        }
      };

      pc.onconnectionstatechange = () => {
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

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;

        const onOpen = () => { setIsDownloading(true); dc.send(JSON.stringify({ offset: 0 })); };
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
          setReceiverProgress(Math.round((received / meta.sizeBytes) * 100));

          if (fileWritableRef.current) {
            try {
              await fileWritableRef.current.write(e.data);
            } catch (err) {
              console.error('Failed streaming chunk directly to disk path:', err);
            }
          } else {
            buf.push(e.data);
          }

          if (received >= meta.sizeBytes) {
            setIsDownloading(false);
            setReceiverProgress(100);
            setReceiverTransferSpeed(0);

            if (fileWritableRef.current) {
              try {
                await fileWritableRef.current.close();
                fileWritableRef.current = null;
              } catch (err) {
                console.error('Failed to close local file descriptor:', err);
              }
            } else {
              const url = URL.createObjectURL(new Blob(buf));
              const a = document.createElement('a');
              a.href = url;
              a.download = sanitizeFileName(meta.fileName);
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }

            socketRef.current.send(JSON.stringify({ type: 'transfer_completed', data: { fileId: meta.fileId, receiverId: userId } }));
          }
        };
        dc.onclose = () => {
          setIsDownloading(false);
          setReceiverTransferSpeed(0);
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.send(JSON.stringify({ type: 'send_answer', data: { toUserId: senderId, answer: pc.localDescription.sdp } }));
    } catch (err) {
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
    notifications,
    handleApproveRequest,
    handleFileChange,
    handleRegisterFile,
    copyToClipboard,
    handleFetchMetadata,
    handleRequestAccess
  };
}
