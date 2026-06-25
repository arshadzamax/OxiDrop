import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download } from 'lucide-react';
import './App.css';

// Import our modular components
import { Header } from './components/Header';
import { ShareTab } from './components/ShareTab';
import { ReceiveTab } from './components/ReceiveTab';
import { TelemetryPanel } from './components/TelemetryPanel';

function App() {
  // Global States
  const [activeTab, setActiveTab] = useState('share'); // 'share' | 'receive'
  const [userId] = useState(() => 'web-' + Math.random().toString(36).substr(2, 6));
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Sender States
  const [selectedFile, setSelectedFile] = useState(null);
  const [registeredFileId, setRegisteredFileId] = useState('');
  const [copied, setCopied] = useState(false);
  const [senderRequests, setSenderRequests] = useState([]);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderTransferSpeed, setSenderTransferSpeed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Receiver States
  const [fileIdInput, setFileIdInput] = useState('');
  const [receiverFileMeta, setReceiverFileMeta] = useState(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [requestStatus, setRequestStatus] = useState('');
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverTransferSpeed, setReceiverTransferSpeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // WebRTC Refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);

  // Stale Closure Prevention Refs
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);

  // Synchronize state variables to refs to prevent stale closure reads in async WebRTC/WS handlers
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    receiverFileMetaRef.current = receiverFileMeta;
  }, [receiverFileMeta]);

  const API_HOST = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  const WS_HOST = window.location.hostname === 'localhost' ? 'ws://localhost:5000' : `ws://${window.location.host}`;

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      cleanupWebRTC();
    };
  }, []);

  const connectWebSocket = () => {
    console.log('Connecting to WS:', WS_HOST);
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketConnected(true);
      ws.send(JSON.stringify({
        type: 'register_user',
        data: { userId }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;

        switch (type) {
          case 'new_access_request':
            setSenderRequests(prev => {
              if (prev.some(r => r.requestId === data.requestId)) return prev;
              return [...prev, data];
            });
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
          default:
            break;
        }
      } catch (err) {
        console.error('Error on WS payload:', err);
      }
    };

    ws.onclose = () => {
      setSocketConnected(false);
      setTimeout(connectWebSocket, 3000); // Reconnect loop
    };
  };

  const cleanupWebRTC = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
  };

  // --- SENDER WebRTC HANDLERS ---

  const handleApproveRequest = async (request) => {
    socketRef.current.send(JSON.stringify({
      type: 'approve_request',
      data: { fileId: request.fileId, receiverId: request.receiverId }
    }));

    setSenderRequests(prev => prev.filter(r => r.requestId !== request.requestId));
    cleanupWebRTC();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnRef.current = pc;

    const dc = pc.createDataChannel('file-transfer', { ordered: true });
    dc.binaryType = 'arraybuffer'; // Force arraybuffer binary format
    dataChannelRef.current = dc;

    dc.onopen = () => {
      setIsUploading(true);
    };

    dc.onmessage = (e) => {
      try {
        const header = JSON.parse(e.data);
        if (header.offset !== undefined) {
          startFileStreaming(dc, header.offset);
        }
      } catch (err) {
        console.error(err);
      }
    };

    dc.onclose = () => setIsUploading(false);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE complete (Vanilla ICE)
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') resolve();
      else {
        const checkGathering = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkGathering);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkGathering);
      }
    });

    socketRef.current.send(JSON.stringify({
      type: 'send_offer',
      data: { toUserId: request.receiverId, offer: pc.localDescription.sdp }
    }));
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: sdpAnswer
    }));
  };

  const startFileStreaming = (dc, offset) => {
    if (!selectedFileRef.current) return;

    const file = selectedFileRef.current;
    const chunkSize = 65536; // 64KB
    let currentOffset = offset;
    let bytesSentInSecond = 0;
    let lastTime = performance.now();

    const streamChunk = () => {
      while (currentOffset < file.size) {
        // BACKPRESSURE
        if (dc.bufferedAmount > 8 * 1024 * 1024) {
          setTimeout(streamChunk, 15);
          return;
        }

        const slice = file.slice(currentOffset, currentOffset + chunkSize);
        const reader = new FileReader();
        
        reader.onload = (event) => {
          if (dc.readyState !== 'open') return;
          const chunkData = event.target.result;
          dc.send(chunkData);

          currentOffset += chunkData.byteLength;
          bytesSentInSecond += chunkData.byteLength;
          
          const now = performance.now();
          if (now - lastTime >= 1000) {
            const speed = (bytesSentInSecond / (1024 * 1024)) / ((now - lastTime) / 1000);
            setSenderTransferSpeed(speed.toFixed(2));
            bytesSentInSecond = 0;
            lastTime = now;
          }

          setSenderProgress(Math.round((currentOffset / file.size) * 100));
          streamChunk();
        };

        reader.readAsArrayBuffer(slice);
        return;
      }
      setSenderProgress(100);
    };

    streamChunk();
  };

  // --- RECEIVER WebRTC HANDLERS ---

  const handleFetchMetadata = async () => {
    if (!fileIdInput) return;
    setIsFetchingMeta(true);
    setReceiverFileMeta(null);
    setRequestStatus('');
    
    try {
      const response = await fetch(`${API_HOST}/api/files/${fileIdInput.trim()}`);
      if (!response.ok) throw new Error('File not found');
      const data = await response.json();
      setReceiverFileMeta(data);
    } catch (err) {
      console.error(err);
      alert('File ID not found.');
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleRequestAccess = () => {
    if (!receiverFileMeta) return;
    socketRef.current.send(JSON.stringify({
      type: 'request_access',
      data: { fileId: receiverFileMeta.fileId, receiverId: userId }
    }));
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    cleanupWebRTC();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnRef.current = pc;

    let receivedBuffer = [];
    let receivedBytes = 0;
    let bytesReceivedInSecond = 0;
    let lastTime = performance.now();

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer'; // Force arraybuffer binary format
      dataChannelRef.current = dc;

      const handleOpen = () => {
        setIsDownloading(true);
        dc.send(JSON.stringify({ offset: 0 }));
      };

      if (dc.readyState === 'open') {
        handleOpen();
      } else {
        dc.onopen = handleOpen;
      }

      dc.onmessage = (e) => {
        const chunk = e.data;
        receivedBuffer.push(chunk);
        receivedBytes += chunk.byteLength;
        bytesReceivedInSecond += chunk.byteLength;

        const now = performance.now();
        if (now - lastTime >= 1000) {
          const speed = (bytesReceivedInSecond / (1024 * 1024)) / ((now - lastTime) / 1000);
          setReceiverTransferSpeed(speed.toFixed(2));
          bytesReceivedInSecond = 0;
          lastTime = now;
        }

        const meta = receiverFileMetaRef.current;
        if (!meta) {
          console.error("Stale closure prevention: receiverFileMetaRef is null inside onmessage callback.");
          return;
        }

        const progress = Math.round((receivedBytes / meta.sizeBytes) * 100);
        setReceiverProgress(progress);

        if (receivedBytes >= meta.sizeBytes) {
          setIsDownloading(false);
          setReceiverProgress(100);

          const fileBlob = new Blob(receivedBuffer);
          const downloadUrl = URL.createObjectURL(fileBlob);
          
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = meta.fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          
          socketRef.current.send(JSON.stringify({
            type: 'transfer_completed',
            data: { fileId: meta.fileId, receiverId: userId }
          }));
        }
      };

      dc.onclose = () => setIsDownloading(false);
    };

    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: sdpOffer
    }));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') resolve();
      else {
        const checkGathering = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkGathering);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkGathering);
      }
    });

    socketRef.current.send(JSON.stringify({
      type: 'send_answer',
      data: { toUserId: senderId, answer: pc.localDescription.sdp }
    }));
  };

  // --- UI Utilities ---

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
      const response = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          sizeBytes: selectedFile.size,
          senderId: userId,
          autoApprove: true
        })
      });

      if (!response.ok) throw new Error('File registration failed');
      const data = await response.json();
      setRegisteredFileId(data.fileId);
    } catch (err) {
      console.error(err);
      alert('Error registering file.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(registeredFileId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 md:p-8">
      <Header socketConnected={socketConnected} userId={userId} />

      <main className="w-full max-w-4xl flex-grow flex flex-col gap-6">
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md max-w-md mx-auto w-full mb-4">
          <button 
            className={`flex-1 py-3 text-sm rounded-xl transition ${activeTab === 'share' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setActiveTab('share')}
          >
            <Share2 className="w-4 h-4 inline mr-2" /> Share Files
          </button>
          <button 
            className={`flex-1 py-3 text-sm rounded-xl transition ${activeTab === 'receive' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setActiveTab('receive')}
          >
            <Download className="w-4 h-4 inline mr-2" /> Retrieve Files
          </button>
        </div>

        {activeTab === 'share' ? (
          <ShareTab 
            selectedFile={selectedFile}
            handleFileChange={handleFileChange}
            registeredFileId={registeredFileId}
            isRegistering={false}
            handleRegisterFile={handleRegisterFile}
            copied={copied}
            copyToClipboard={copyToClipboard}
            senderRequests={senderRequests}
            handleApproveRequest={handleApproveRequest}
            formatBytes={formatBytes}
          />
        ) : (
          <ReceiveTab 
            fileIdInput={fileIdInput}
            setFileIdInput={setFileIdInput}
            receiverFileMeta={receiverFileMeta}
            isFetchingMeta={isFetchingMeta}
            handleFetchMetadata={handleFetchMetadata}
            requestStatus={requestStatus}
            handleRequestAccess={handleRequestAccess}
            formatBytes={formatBytes}
          />
        )}

        <TelemetryPanel 
          isTransferring={activeTab === 'share' ? isUploading : isDownloading}
          transferMode={activeTab === 'share' ? 'upload' : 'download'}
          fileName={activeTab === 'share' ? selectedFile?.name : receiverFileMeta?.fileName}
          progress={activeTab === 'share' ? senderProgress : receiverProgress}
          speed={activeTab === 'share' ? senderTransferSpeed : receiverTransferSpeed}
        />
      </main>

      <footer className="w-full max-w-4xl py-6 border-t border-white/5 text-center text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
        <p>© 2026 OxiDrop Platform. End-to-end encrypted direct peer transfer.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-indigo-400 transition">Security Protocol</a>
          <a href="#" className="hover:text-indigo-400 transition">System Architecture</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
