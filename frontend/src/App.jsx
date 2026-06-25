import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import './App.css';

import { Header } from './components/Header';
import { ShareTab } from './components/ShareTab';
import { ReceiveTab } from './components/ReceiveTab';
import { TelemetryPanel } from './components/TelemetryPanel';

const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'download_file';
  const base = name.replace(/^.*[\\\/]/, '');
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

function App() {
  const [activeTab, setActiveTab] = useState('share');
  const [userId] = useState(() => 'web-' + Math.random().toString(36).substr(2, 6));
  const [socketConnected, setSocketConnected] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.className = theme + '-theme';
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  // Sender state
  const [selectedFile, setSelectedFile] = useState(null);
  const [registeredFileId, setRegisteredFileId] = useState('');
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

  // WebRTC refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);

  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);

  // Tauri v2 serves from tauri.localhost, not localhost — detect both
  const isTauri = '__TAURI_INTERNALS__' in window;
  const isLocal = window.location.hostname === 'localhost';
  const API_HOST = (isTauri || isLocal) ? 'http://localhost:5000' : '';
  const WS_HOST = (isTauri || isLocal) ? 'ws://localhost:5000' : `ws://${window.location.host}`;

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      cleanupWebRTC();
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;
    ws.onopen = () => {
      setSocketConnected(true);
      ws.send(JSON.stringify({ type: 'register_user', data: { userId } }));
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
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
    ws.onclose = () => {
      setSocketConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
  };

  const cleanupWebRTC = () => {
    if (dataChannelRef.current) { dataChannelRef.current.close(); dataChannelRef.current = null; }
    if (peerConnRef.current) { peerConnRef.current.close(); peerConnRef.current = null; }
  };

  // ── Sender handlers ──

  const handleApproveRequest = async (request) => {
    try {
      socketRef.current.send(JSON.stringify({ type: 'approve_request', data: { fileId: request.fileId, receiverId: request.receiverId } }));
      setSenderRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      cleanupWebRTC();

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
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

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') resolve();
        else {
          const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
          pc.addEventListener('icegatheringstatechange', check);
        }
      });

      socketRef.current.send(JSON.stringify({ type: 'send_offer', data: { toUserId: request.receiverId, offer: pc.localDescription.sdp } }));
    } catch (err) {
      console.error('Error in handleApproveRequest:', err);
      setIsUploading(false);
      setSenderTransferSpeed(0);
      alert('Failed to establish WebRTC connection: ' + err.message);
    }
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    try {
      await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
    } catch (err) {
      console.error('Error setting remote description:', err);
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
      if (!res.ok) throw new Error('Not found');
      setReceiverFileMeta(await res.json());
    } catch {
      alert('File ID not found.');
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleRequestAccess = () => {
    if (!receiverFileMeta) return;
    socketRef.current.send(JSON.stringify({ type: 'request_access', data: { fileId: receiverFileMeta.fileId, receiverId: userId } }));
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    try {
      cleanupWebRTC();
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
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

        dc.onmessage = (e) => {
          buf.push(e.data);
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
          if (received >= meta.sizeBytes) {
            setIsDownloading(false);
            setReceiverProgress(100);
            setReceiverTransferSpeed(0);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(buf));
            a.download = sanitizeFileName(meta.fileName);
            document.body.appendChild(a);
            a.click();
            a.remove();
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

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') resolve();
        else {
          const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
          pc.addEventListener('icegatheringstatechange', check);
        }
      });

      socketRef.current.send(JSON.stringify({ type: 'send_answer', data: { toUserId: senderId, answer: pc.localDescription.sdp } }));
    } catch (err) {
      console.error('Error in handleReceiveOffer:', err);
      cleanupWebRTC();
      setIsDownloading(false);
      setReceiverTransferSpeed(0);
    }
  };

  // ── UI helpers ──

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setRegisteredFileId('');
      setSenderRequests([]);
      setSenderProgress(0);
      setIsUploading(false);
    }
  };

  const handleRegisterFile = async () => {
    if (!selectedFile) return;
    setRegisteredFileId('');
    try {
      const res = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: selectedFile.name, sizeBytes: selectedFile.size, senderId: userId, autoApprove: true })
      });
      if (!res.ok) throw new Error('Failed');
      setRegisteredFileId((await res.json()).fileId);
    } catch {
      alert('Error registering file.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(registeredFileId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
  };

  return (
    <div className="app">
      <Header socketConnected={socketConnected} userId={userId} theme={theme} toggleTheme={toggleTheme} />

      <main className="main">
        <div className="tabs">
          <button className={`tab ${activeTab === 'share' ? 'active' : ''}`} onClick={() => setActiveTab('share')}>
            <ArrowUpFromLine size={14} /> Send
          </button>
          <button className={`tab ${activeTab === 'receive' ? 'active' : ''}`} onClick={() => setActiveTab('receive')}>
            <ArrowDownToLine size={14} /> Receive
          </button>
        </div>

        <div className="content">
          {activeTab === 'share' ? (
            <ShareTab
              selectedFile={selectedFile} handleFileChange={handleFileChange}
              registeredFileId={registeredFileId} isRegistering={false}
              handleRegisterFile={handleRegisterFile} copied={copied}
              copyToClipboard={copyToClipboard} senderRequests={senderRequests}
              handleApproveRequest={handleApproveRequest} formatBytes={formatBytes}
            />
          ) : (
            <ReceiveTab
              fileIdInput={fileIdInput} setFileIdInput={setFileIdInput}
              receiverFileMeta={receiverFileMeta} isFetchingMeta={isFetchingMeta}
              handleFetchMetadata={handleFetchMetadata} requestStatus={requestStatus}
              handleRequestAccess={handleRequestAccess} formatBytes={formatBytes}
            />
          )}
        </div>
      </main>

      <TelemetryPanel
        isTransferring={activeTab === 'share' ? isUploading : isDownloading}
        transferMode={activeTab === 'share' ? 'upload' : 'download'}
        fileName={activeTab === 'share' ? selectedFile?.name : receiverFileMeta?.fileName}
        progress={activeTab === 'share' ? senderProgress : receiverProgress}
        speed={activeTab === 'share' ? senderTransferSpeed : receiverTransferSpeed}
        totalSize={activeTab === 'share' ? selectedFile?.size : receiverFileMeta?.sizeBytes}
      />
    </div>
  );
}

export default App;
