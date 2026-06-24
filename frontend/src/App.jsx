import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Share2, 
  Download, 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  Loader, 
  AlertTriangle, 
  Activity, 
  Copy, 
  Cpu, 
  Server, 
  Zap,
  Check,
  RefreshCw
} from 'lucide-react';
import './App.css'; // Importing App.css for simple custom components, but core styles are in index.css

function App() {
  // Global App States
  const [activeTab, setActiveTab] = useState('share'); // 'share' | 'receive'
  const [userId, setUserId] = useState(() => 'web-' + Math.random().toString(36).substr(2, 6));
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(false);
  
  // Sender (Share) States
  const [selectedFile, setSelectedFile] = useState(null);
  const [registeredFileId, setRegisteredFileId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [senderRequests, setSenderRequests] = useState([]);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderTransferSpeed, setSenderTransferSpeed] = useState(0); // MB/s
  const [isUploading, setIsUploading] = useState(false);

  // Receiver (Download) States
  const [fileIdInput, setFileIdInput] = useState('');
  const [receiverFileMeta, setReceiverFileMeta] = useState(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [requestStatus, setRequestStatus] = useState(''); // 'PENDING' | 'APPROVED' | 'COMPLETED'
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverTransferSpeed, setReceiverTransferSpeed] = useState(0); // MB/s
  const [isDownloading, setIsDownloading] = useState(false);

  // WebRTC & WebSockets Refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const senderIntervalRef = useRef(null);

  // Connection settings
  const API_HOST = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  const WS_HOST = window.location.hostname === 'localhost' ? 'ws://localhost:5000' : `ws://${window.location.host}`;

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      cleanupWebRTC();
    };
  }, []);

  const connectWebSocket = () => {
    console.log('Connecting to Signaling server at:', WS_HOST);
    setSocketError(false);
    
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setSocketConnected(true);
      
      // Register our userId with the signaling server
      ws.send(JSON.stringify({
        type: 'register_user',
        data: { userId }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;
        console.log('WS Message Received:', type, data);

        switch (type) {
          case 'pending_requests_alert':
            console.log('User has pending file requests:', data);
            break;
            
          case 'new_access_request':
            // Add to requests list (for Senders to approve)
            setSenderRequests(prev => {
              // Avoid duplicates
              if (prev.some(r => r.requestId === data.requestId)) return prev;
              return [...prev, data];
            });
            break;
            
          case 'request_status_update':
            // Receivers get updates on their requests
            setRequestStatus(data.status);
            if (data.status === 'APPROVED') {
              console.log('Request approved! Awaiting WebRTC Offer from sender...');
            }
            break;
            
          case 'receive_offer':
            // Receivers receive SDP Offer from Sender
            handleReceiveOffer(data.offer, data.fromUserId);
            break;
            
          case 'receive_answer':
            // Senders receive SDP Answer from Receiver
            handleReceiveAnswer(data.answer);
            break;
            
          default:
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setSocketConnected(false);
      // Attempt reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setSocketError(true);
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
    if (senderIntervalRef.current) {
      clearInterval(senderIntervalRef.current);
    }
  };

  // --- SENDER WebRTC Implementation ---
  
  const handleApproveRequest = async (request) => {
    // 1. Tell Signaling we are approving this receiver
    socketRef.current.send(JSON.stringify({
      type: 'approve_request',
      data: {
        fileId: request.fileId,
        receiverId: request.receiverId
      }
    }));

    // Remove from UI list
    setSenderRequests(prev => prev.filter(r => r.requestId !== request.requestId));

    // 2. Set up WebRTC PeerConnection (Phase 3: Handshake start)
    console.log('Setting up RTCPeerConnection for outgoing transfer...');
    cleanupWebRTC();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnRef.current = pc;

    // Create Data Channel
    // SCTP is the underlying transport mechanism which supports congestion control and reliability
    const dc = pc.createDataChannel('file-transfer', { ordered: true });
    dataChannelRef.current = dc;

    dc.onopen = () => {
      console.log('P2P WebRTC Data Channel OPEN!');
      setIsUploading(true);
      
      // We wait for the receiver to send their offset header
      dc.onmessage = (e) => {
        try {
          const header = JSON.parse(e.data);
          if (header.offset !== undefined) {
            console.log('Receiver requested start offset:', header.offset);
            startFileStreaming(dc, header.offset);
          }
        } catch (err) {
          console.error('Error parsing transfer header:', err);
        }
      };
    };

    dc.onclose = () => {
      console.log('Data Channel closed');
      setIsUploading(false);
    };

    // Log connection state shifts
    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
    };

    // Generate local SDP Offer and wait for local ICE gathering to complete (Vanilla ICE)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidate gathering to finish before sending the offer
    // This aggregates all candidates in one SDP block to bypass trickle-ICE complex signaling routing
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkGathering = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkGathering);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkGathering);
      }
    });

    // Send SDP Offer to Receiver via WebSockets Signaling
    console.log('Sending WebRTC SDP Offer...');
    socketRef.current.send(JSON.stringify({
      type: 'send_offer',
      data: {
        toUserId: request.receiverId,
        offer: pc.localDescription.sdp
      }
    }));
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    console.log('Received Answer SDP. Finalizing WebRTC connection...');
    await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: sdpAnswer
    }));
  };

  const startFileStreaming = (dc, offset) => {
    if (!selectedFile) return;

    const file = selectedFile;
    const chunkSize = 65536; // 64KB chunk sizes (WebRTC MTU friendly)
    let currentOffset = offset;
    const startTime = performance.now();
    let bytesSentInSecond = 0;
    let lastTime = performance.now();

    const streamChunk = () => {
      while (currentOffset < file.size) {
        // --- BACKPRESSURE FLOW CONTROL ---
        // Browser WebRTC data channels have internal buffer limit (typically 16MB).
        // Sending too fast causes bufferedAmount to overflow, crashing the channel.
        if (dc.bufferedAmount > 8 * 1024 * 1024) { // 8MB safety threshold
          // Buffer full, wait for it to drain before queuing more
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
          
          // Speed statistics
          const now = performance.now();
          if (now - lastTime >= 1000) {
            const speed = (bytesSentInSecond / (1024 * 1024)) / ((now - lastTime) / 1000);
            setSenderTransferSpeed(speed.toFixed(2));
            bytesSentInSecond = 0;
            lastTime = now;
          }

          setSenderProgress(Math.round((currentOffset / file.size) * 100));
          
          // Recursively request next chunk
          streamChunk();
        };

        reader.readAsArrayBuffer(slice);
        return; // Halt loop; onload will trigger next chunk loop
      }
      
      console.log('File streaming complete.');
      setSenderProgress(100);
    };

    streamChunk();
  };


  // --- RECEIVER WebRTC Implementation ---

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
      alert('Failed to retrieve file metadata. Please verify the File ID.');
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleRequestAccess = () => {
    if (!receiverFileMeta) return;

    // Send access request via WebSockets Signaling (Phase 2: Asynchronous Request)
    socketRef.current.send(JSON.stringify({
      type: 'request_access',
      data: {
        fileId: receiverFileMeta.fileId,
        receiverId: userId
      }
    }));
  };

  const handleReceiveOffer = async (sdpOffer, senderId) => {
    console.log('Received SDP Offer. Preparing answer connection...');
    cleanupWebRTC();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnRef.current = pc;

    let receivedBuffer = [];
    let receivedBytes = 0;
    const startTime = performance.now();
    let bytesReceivedInSecond = 0;
    let lastTime = performance.now();

    // Listen for incoming Data Channel configured by Sender
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('P2P WebRTC Data Channel ESTABLISHED!');
        setIsDownloading(true);
        
        // Send initial offset (0 for new, X for resume)
        dc.send(JSON.stringify({ offset: 0 }));
      };

      dc.onmessage = (e) => {
        const chunk = e.data;
        receivedBuffer.push(chunk);
        receivedBytes += chunk.byteLength;
        bytesReceivedInSecond += chunk.byteLength;

        // Speed statistics
        const now = performance.now();
        if (now - lastTime >= 1000) {
          const speed = (bytesReceivedInSecond / (1024 * 1024)) / ((now - lastTime) / 1000);
          setReceiverTransferSpeed(speed.toFixed(2));
          bytesReceivedInSecond = 0;
          lastTime = now;
        }

        const progress = Math.round((receivedBytes / receiverFileMeta.sizeBytes) * 100);
        setReceiverProgress(progress);

        if (receivedBytes >= receiverFileMeta.sizeBytes) {
          console.log('Finished downloading file. Assembling Blob...');
          setIsDownloading(false);
          setReceiverProgress(100);

          // Assemble received chunks into downloadable Blob
          const fileBlob = new Blob(receivedBuffer);
          const downloadUrl = URL.createObjectURL(fileBlob);
          
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = receiverFileMeta.fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          
          // Inform server the transfer is complete
          socketRef.current.send(JSON.stringify({
            type: 'transfer_completed',
            data: {
              fileId: receiverFileMeta.fileId,
              receiverId: userId
            }
          }));
        }
      };

      dc.onclose = () => {
        console.log('Data Channel closed');
        setIsDownloading(false);
      };
    };

    // Set SDP Offer
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: sdpOffer
    }));

    // Create SDP Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE candidates gathering to finish
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkGathering = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkGathering);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkGathering);
      }
    });

    // Send SDP Answer back to Sender via Signaling
    console.log('Sending WebRTC SDP Answer...');
    socketRef.current.send(JSON.stringify({
      type: 'send_answer',
      data: {
        toUserId: senderId,
        answer: pc.localDescription.sdp
      }
    }));
  };


  // --- Helper UI Handlers ---

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      // Reset upload cards
      setRegisteredFileId('');
      setSenderRequests([]);
      setSenderProgress(0);
      setIsUploading(false);
    }
  };

  const handleRegisterFile = async () => {
    if (!selectedFile) return;
    setIsRegistering(true);

    try {
      const response = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          sizeBytes: selectedFile.size,
          senderId: userId,
          autoApprove: true // Auto approve so daemon/receiver downloads immediately
        })
      });

      if (!response.ok) throw new Error('File registration failed');
      const data = await response.json();
      
      setRegisteredFileId(data.fileId);
      // Construct sharing link
      setShareLink(`${window.location.origin}/share/${data.fileId}`);
      console.log('Registered file ID:', data.fileId);
    } catch (err) {
      console.error(err);
      alert('Error registering file on signaling server.');
    } finally {
      setIsRegistering(false);
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
      {/* 🚀 Header & Connection Banner */}
      <header className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-b border-white/5 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-neon-indigo">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              OxiDrop <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">P2P v1.0</span>
            </h1>
            <p className="text-xs text-slate-400">Secure, Direct, Asynchronous File Transfers</p>
          </div>
        </div>

        {/* Server & Peer Connection Node Status */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-neon-emerald animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
            <span className="text-slate-300 font-medium">Signaling Node: {socketConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="text-slate-400">
            Node ID: <code className="text-indigo-300 font-mono">{userId}</code>
          </div>
        </div>
      </header>

      {/* 🧭 Tab Switcher */}
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

        {/* 📤 SHARE TAB PANELS */}
        {activeTab === 'share' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* File Drag Drop Upload UI */}
            <div className="md:col-span-3 glass-panel p-6 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-400" /> Share Local File
                </h3>
                <p className="text-xs text-slate-400 mb-6">Select a file to host. It will be streamed directly from your device memory to the receiver.</p>
                
                <div className="relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-black/20 hover:bg-black/30 transition group">
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-indigo-500/5 rounded-full border border-indigo-500/10 group-hover:scale-110 transition duration-300">
                      <FileText className="w-8 h-8 text-indigo-400" />
                    </div>
                    {selectedFile ? (
                      <div className="mt-2 text-center">
                        <p className="text-sm font-medium text-white max-w-xs truncate mx-auto">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatBytes(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-200">Drag & drop files, or <span className="text-indigo-400 hover:underline">browse</span></p>
                        <p className="text-xs text-slate-500 mt-1">Supports any file format (unlimited size)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedFile && !registeredFileId && (
                <button 
                  className="primary w-full mt-6 pulse-glow-indigo"
                  onClick={handleRegisterFile}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" /> Registering...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-white" /> Register for Sharing
                    </>
                  )}
                </button>
              )}

              {/* Upload Success Card */}
              {registeredFileId && (
                <div className="mt-6 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" /> FILE IS READY FOR DOWNLOAD
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={registeredFileId}
                      className="flex-1 bg-black/40 border border-white/10 px-3 py-2 rounded-lg text-sm text-indigo-300 font-mono text-center"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="secondary py-2 px-3 border-none bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">Share this File ID with a browser recipient or standard Rust daemon</p>
                </div>
              )}
            </div>

            {/* Transfer Metrics & Approvals */}
            <div className="md:col-span-2 flex flex-col gap-6">
              {/* Connection Progress */}
              <div className="glass-panel p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Live Telemetry
                  </h3>

                  {isUploading ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Uploading: {selectedFile?.name}</span>
                        <span className="text-emerald-400 font-mono">{senderProgress}%</span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${senderProgress}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Speed: <span className="text-emerald-400 font-mono">{senderTransferSpeed} MB/s</span></span>
                        <span>Direct P2P Link</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                      <Zap className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs">No active file stream</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>SCTP backpressure: enabled</span>
                </div>
              </div>

              {/* Asynchronous Request Mailbox */}
              <div className="glass-panel p-6 flex-1 max-h-[190px] overflow-y-auto">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" /> Request Mailbox ({senderRequests.length})
                </h3>

                {senderRequests.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {senderRequests.map((req) => (
                      <div key={req.requestId} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-[11px]">
                          <p className="text-slate-300 font-semibold truncate max-w-[130px]">Peer: {req.receiverId}</p>
                          <p className="text-slate-500">{formatBytes(req.sizeBytes)}</p>
                        </div>
                        <button 
                          className="success py-1.5 px-3 text-xs"
                          onClick={() => handleApproveRequest(req)}
                        >
                          Approve P2P
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-4">No pending requests</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 📥 RECEIVE TAB PANELS */}
        {activeTab === 'receive' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Download Interface */}
            <div className="md:col-span-3 glass-panel p-6 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-400" /> Retrieve Shared File
                </h3>
                <p className="text-xs text-slate-400 mb-6">Enter a File ID to lookup metadata and request secure direct download over WebRTC.</p>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter 12-character File ID"
                    value={fileIdInput}
                    onChange={(e) => setFileIdInput(e.target.value)}
                    className="flex-1 px-4 py-3 text-sm"
                  />
                  <button 
                    onClick={handleFetchMetadata}
                    disabled={isFetchingMeta}
                    className="secondary font-semibold"
                  >
                    {isFetchingMeta ? <Loader className="w-4 h-4 animate-spin" /> : 'Lookup'}
                  </button>
                </div>

                {/* File Details display */}
                {receiverFileMeta && (
                  <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <FileText className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">{receiverFileMeta.fileName}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(receiverFileMeta.sizeBytes)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2 pt-4 border-t border-white/5">
                      <span className="text-slate-400">Hosting Peer: <span className="text-indigo-300 font-mono">{receiverFileMeta.senderId}</span></span>
                      
                      {requestStatus === '' && (
                        <button 
                          className="primary py-2 px-4 text-xs pulse-glow-indigo"
                          onClick={handleRequestAccess}
                        >
                          Request File Access
                        </button>
                      )}
                      
                      {requestStatus === 'PENDING' && (
                        <span className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                          <Loader className="w-3.5 h-3.5 animate-spin" /> Awaiting approval
                        </span>
                      )}

                      {requestStatus === 'APPROVED' && (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Alert Banner */}
              {!receiverFileMeta && (
                <div className="mt-6 border border-white/5 bg-black/10 rounded-xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-indigo-400/80" />
                  <p className="text-xs text-slate-400 text-left">P2P downloads require the sender's daemon or web app to approve the connection.</p>
                </div>
              )}
            </div>

            {/* Metrics Panel */}
            <div className="md:col-span-2 glass-panel p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Connection Telemetry
                </h3>

                {isDownloading ? (
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Downloading...</span>
                      <span className="text-indigo-400 font-mono">{receiverProgress}%</span>
                    </div>

                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${receiverProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Speed: <span className="text-emerald-400 font-mono">{receiverTransferSpeed} MB/s</span></span>
                      <span>Direct WebRTC stream</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                    <Zap className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs">No active transfer stream</p>
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-[11px] text-slate-400">
                <p className="flex justify-between mb-1">
                  <span>Transport Protocol:</span>
                  <span className="text-white font-mono">SCTP over DTLS</span>
                </p>
                <p className="flex justify-between">
                  <span>Session Key Exchange:</span>
                  <span className="text-white font-mono">ECDSA / WebRTC</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
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
