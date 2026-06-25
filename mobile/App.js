import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import {
  UploadCloud,
  Zap,
  CheckCircle,
  Copy,
  ArrowUpFromLine,
  ArrowDownToLine,
  FileText,
  Settings
} from 'lucide-react-native';

// --- Base64 Utilities for pure-JS stream chunk handling ---
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

const decodeBase64 = (base64) => {
  let bufferLength = base64.length * 0.75;
  const len = base64.length;
  let i, p = 0;
  if (base64[len - 1] === '=') {
    bufferLength--;
    if (base64[len - 2] === '=') {
      bufferLength--;
    }
  }
  const bytes = new Uint8Array(bufferLength);
  for (i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
};

const encodeBase64 = (bytes) => {
  let result = '';
  let i;
  const l = bytes.length;
  for (i = 0; i < l; i += 3) {
    const c1 = bytes[i];
    const c2 = i + 1 < l ? bytes[i + 1] : -1;
    const c3 = i + 2 < l ? bytes[i + 2] : -1;
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (c2 !== -1 ? c2 >> 4 : 0);
    const byte3 = c2 !== -1 ? ((c2 & 15) << 2) | (c3 !== -1 ? c3 >> 6 : 0) : -1;
    const byte4 = c3 !== -1 ? c3 & 63 : -1;
    result += chars[byte1] + chars[byte2] + (byte3 !== -1 ? chars[byte3] : '=') + (byte4 !== -1 ? chars[byte4] : '=');
  }
  return result;
};

const sanitizeFileName = (name) => {
  if (typeof name !== 'string') return 'download_file';
  const base = name.replace(/^.*[\\\/]/, '');
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

export default function App() {
  const [activeTab, setActiveTab] = useState('share');
  const [userId] = useState(() => 'mobile-' + Math.random().toString(36).substr(2, 6));
  const [serverAddress, setServerAddress] = useState('oxidrop-signaling-server.onrender.com'); // Defaulted to live server
  const [socketConnected, setSocketConnected] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(true);

  // Sender state
  const [selectedFile, setSelectedFile] = useState(null);
  const [registeredFileId, setRegisteredFileId] = useState('');
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
  const [downloadedFileUri, setDownloadedFileUri] = useState('');

  // WebRTC refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);
  const registeredFileIdRef = useRef('');
  const isReRegisteringRef = useRef(false);
  const connectionTimeoutRef = useRef(null);

  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);
  useEffect(() => { registeredFileIdRef.current = registeredFileId; }, [registeredFileId]);

  const API_HOST = `https://${serverAddress}`;
  const WS_HOST = `wss://${serverAddress}`;

  // Dynamic ICE server configurations
  const [iceConfiguration, setIceConfiguration] = useState({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

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

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    console.log(`Connecting to WS signaling at ${WS_HOST}`);
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketConnected(true);
      ws.send(JSON.stringify({ type: 'register_user', data: { userId } }));
      setIsConfiguring(false);
      fetchIceServers();

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
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setSocketConnected(false);
    };

    ws.onerror = (e) => {
      console.log('WS connection error:', e);
      Alert.alert('Connection Failed', `Could not connect to signaling server at ${serverAddress}. Please verify the address and status.`);
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
        console.log('File Share ID verified and re-registered successfully.');
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
  };

  const startConnectionTimeout = () => {
    clearConnectionTimeout();
    connectionTimeoutRef.current = setTimeout(() => {
      if (peerConnRef.current && peerConnRef.current.connectionState !== 'connected') {
        cleanupWebRTC();
        setIsUploading(false);
        setIsDownloading(false);
        setSenderTransferSpeed(0);
        setReceiverTransferSpeed(0);
        Alert.alert('Timeout', 'WebRTC connection setup timed out. The peer might be offline or blocked by a firewall.');
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
        if (event.candidate && socketRef.current) {
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
      dc.onmessage = (e) => {
        try {
          const h = JSON.parse(e.data);
          if (h.offset !== undefined) {
            startFileStreaming(dc, h.offset);
          }
        } catch {}
      };
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
      console.error('Approve WebRTC failure:', err);
      clearConnectionTimeout();
      setIsUploading(false);
      setSenderTransferSpeed(0);
      Alert.alert('Error', 'Failed to initialize transfer: ' + err.message);
    }
  };

  const handleReceiveAnswer = async (sdpAnswer) => {
    if (!peerConnRef.current) return;
    try {
      await peerConnRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
    } catch (err) {
      console.error('Set remote answer failure:', err);
      clearConnectionTimeout();
      cleanupWebRTC();
      setIsUploading(false);
      setSenderTransferSpeed(0);
    }
  };

  const startFileStreaming = async (dc, offset) => {
    if (!selectedFileRef.current) return;
    const file = selectedFileRef.current;
    const chunkSize = 65536; // 64KB chunks
    let currentOffset = offset;
    let bytesSent = 0;
    let lastTime = performance.now();

    try {
      while (currentOffset < file.size) {
        if (dc.bufferedAmount > 8 * 1024 * 1024) { // 8MB backpressure watermark
          setTimeout(() => startFileStreaming(dc, currentOffset), 15);
          return;
        }

        const lengthToRead = Math.min(chunkSize, file.size - currentOffset);
        
        const base64Chunk = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
          length: lengthToRead,
          position: currentOffset
        });

        const binaryChunk = decodeBase64(base64Chunk);
        
        if (dc.readyState !== 'open') return;
        
        try {
          dc.send(binaryChunk.buffer);
        } catch (e) {
          console.error('Failed to transmit binary buffer:', e);
          cleanupWebRTC();
          setIsUploading(false);
          setSenderTransferSpeed(0);
          return;
        }

        currentOffset += lengthToRead;
        bytesSent += lengthToRead;
        
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setSenderTransferSpeed(((bytesSent / (1024 * 1024)) / ((now - lastTime) / 1000)).toFixed(2));
          bytesSent = 0;
          lastTime = now;
        }
        setSenderProgress(Math.round((currentOffset / file.size) * 100));
      }
      setSenderProgress(100);
    } catch (err) {
      console.error('File streaming execution error:', err);
      Alert.alert('Error', 'Failed during file transfer: ' + err.message);
      setIsUploading(false);
      setSenderTransferSpeed(0);
    }
  };

  // ── Receiver handlers ──
  const handleFetchMetadata = async () => {
    if (!fileIdInput) return;
    setIsFetchingMeta(true);
    setReceiverFileMeta(null);
    setRequestStatus('');
    setDownloadedFileUri('');
    
    try {
      const res = await fetch(`${API_HOST}/api/files/${fileIdInput.trim()}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
      setReceiverFileMeta(data);
    } catch (err) {
      Alert.alert('Error', 'File share ID not found or server is unreachable.');
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
    try {
      cleanupWebRTC();
      const pc = new RTCPeerConnection(iceConfiguration);
      peerConnRef.current = pc;
      startConnectionTimeout();

      // Handle Trickle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
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

      let received = 0, bytesInSec = 0, lastTime = performance.now();
      const meta = receiverFileMetaRef.current;
      if (!meta) return;

      const tempFileUri = FileSystem.documentDirectory + sanitizeFileName(meta.fileName);
      
      // Initialize clean empty file on disk
      await FileSystem.writeAsStringAsync(tempFileUri, '', { encoding: FileSystem.EncodingType.Base64 });

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;

        const onOpen = () => {
          setIsDownloading(true);
          dc.send(JSON.stringify({ offset: 0 }));
        };
        if (dc.readyState === 'open') onOpen(); else dc.onopen = onOpen;

        dc.onmessage = async (e) => {
          const chunk = e.data; // ArrayBuffer
          const bytes = new Uint8Array(chunk);
          
          const base64Chunk = encodeBase64(bytes);
          await FileSystem.writeAsStringAsync(tempFileUri, base64Chunk, {
            encoding: FileSystem.EncodingType.Base64,
            append: true
          });

          received += bytes.byteLength;
          bytesInSec += bytes.byteLength;
          
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setReceiverTransferSpeed(((bytesInSec / (1024 * 1024)) / ((now - lastTime) / 1000)).toFixed(2));
            bytesInSec = 0;
            lastTime = now;
          }

          setReceiverProgress(Math.round((received / meta.sizeBytes) * 100));

          if (received >= meta.sizeBytes) {
            setIsDownloading(false);
            setReceiverProgress(100);
            setReceiverTransferSpeed(0);
            setDownloadedFileUri(tempFileUri);
            
            socketRef.current.send(JSON.stringify({
              type: 'transfer_completed',
              data: { fileId: meta.fileId, receiverId: userId }
            }));

            Alert.alert('Success', 'File downloaded successfully!', [
              { text: 'Share/Open', onPress: () => Sharing.shareAsync(tempFileUri) },
              { text: 'OK' }
            ]);
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

      socketRef.current.send(JSON.stringify({
        type: 'send_answer',
        data: { toUserId: senderId, answer: pc.localDescription.sdp }
      }));
    } catch (err) {
      console.error('Receive SDP Offer processing failed:', err);
      clearConnectionTimeout();
      cleanupWebRTC();
      setIsDownloading(false);
      setReceiverTransferSpeed(0);
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

  // ── UI / Document Selectors ──
  const selectDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled === false && res.assets && res.assets.length > 0) {
        const doc = res.assets[0];
        
        // Enforce client-side file size limits before registration
        if (doc.size > 10 * 1024 * 1024 * 1024 * 1024) { // 10 Terabytes
          Alert.alert('Error', 'File exceeds the 10TB safety registration limit.');
          return;
        }

        setSelectedFile({
          uri: doc.uri,
          name: doc.name,
          size: doc.size
        });
        setRegisteredFileId('');
        setSenderRequests([]);
        setSenderProgress(0);
        setIsUploading(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document: ' + err.message);
    }
  };

  const handleRegisterFile = async () => {
    if (!selectedFile) return;
    setRegisteredFileId('');
    try {
      const res = await fetch(`${API_HOST}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          sizeBytes: selectedFile.size,
          senderId: userId,
          autoApprove: false // Enabled manual approval flow
        })
      });
      if (!res.ok) throw new Error('Registration failed');
      const data = await res.json();
      setRegisteredFileId(data.fileId);
    } catch (err) {
      Alert.alert('Error', 'Failed to register file on server.');
    }
  };

  const shareFileId = () => {
    if (registeredFileId) {
      Share.share({
        message: registeredFileId,
        title: 'OxiDrop File Share ID'
      });
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
  };

  const isTransferring = activeTab === 'share' ? isUploading : isDownloading;
  const activeFileName = activeTab === 'share' ? selectedFile?.name : receiverFileMeta?.fileName;
  const activeProgress = activeTab === 'share' ? senderProgress : receiverProgress;
  const activeSpeed = activeTab === 'share' ? senderTransferSpeed : receiverTransferSpeed;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>OxiDrop</Text>
          <View style={[styles.statusChip, socketConnected ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, socketConnected ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.statusText}>{socketConnected ? 'Connected' : 'Offline'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setIsConfiguring(!isConfiguring)}>
          <Settings size={18} color="#fafafa" />
        </TouchableOpacity>
      </View>

      {/* --- SERVER CONFIG DRAWER --- */}
      {isConfiguring && (
        <View style={styles.configDrawer}>
          <Text style={styles.configLabel}>Signaling Server Host (IP:Port)</Text>
          <View style={styles.configRow}>
            <TextInput
              style={styles.configInput}
              value={serverAddress}
              onChangeText={setServerAddress}
              placeholder="e.g. 192.168.1.100:5000"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.configBtn} onPress={connectWebSocket}>
              <Text style={styles.configBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.configHint}>Node ID: {userId}</Text>
        </View>
      )}

      {/* --- MAIN NAVIGATION TABS --- */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'share' && styles.tabActive]}
          onPress={() => setActiveTab('share')}
        >
          <ArrowUpFromLine size={14} color={activeTab === 'share' ? '#fafafa' : '#a1a1aa'} />
          <Text style={[styles.tabText, activeTab === 'share' && styles.tabTextActive]}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'receive' && styles.tabActive]}
          onPress={() => setActiveTab('receive')}
        >
          <ArrowDownToLine size={14} color={activeTab === 'receive' ? '#fafafa' : '#a1a1aa'} />
          <Text style={[styles.tabText, activeTab === 'receive' && styles.tabTextActive]}>Receive</Text>
        </TouchableOpacity>
      </View>

      {/* --- CONTENT SCROLLVIEW --- */}
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* --- SEND VIEW --- */}
        {activeTab === 'share' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Share a file</Text>
            <Text style={styles.panelDesc}>Select any local file. It streams directly to the peer device.</Text>

            <TouchableOpacity style={[styles.dropzone, selectedFile && styles.dropzoneActive]} onPress={selectDocument}>
              <UploadCloud size={32} color={selectedFile ? '#6366f1' : '#71717a'} style={{ marginBottom: 8 }} />
              {selectedFile ? (
                <>
                  <Text style={styles.dropLabel} numberOfLines={1}>{selectedFile.name}</Text>
                  <Text style={styles.dropHint}>{formatBytes(selectedFile.size)}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.dropLabel}>Tap to browse files</Text>
                  <Text style={styles.dropHint}>Supports documents, videos, photos...</Text>
                </>
              )}
            </TouchableOpacity>

            {selectedFile && !registeredFileId && (
              <TouchableOpacity style={styles.btnPrimary} onPress={handleRegisterFile}>
                <Zap size={14} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.btnPrimaryText}>Create Share Link</Text>
              </TouchableOpacity>
            )}

            {registeredFileId !== '' && (
              <View style={styles.shareBox}>
                <View style={styles.shareHeader}>
                  <CheckCircle size={12} color="#10b981" />
                  <Text style={styles.shareLabel}>Ready to transfer</Text>
                </View>
                <View style={styles.shareRow}>
                  <Text style={styles.shareInput} selectable>{registeredFileId}</Text>
                  <TouchableOpacity style={styles.shareBtn} onPress={shareFileId}>
                    <Copy size={14} color="#fafafa" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.shareHint}>Share this ID with the recipient.</Text>
              </View>
            )}

            {/* SENDER MAILBOX REQUESTS */}
            <View style={styles.mailboxSection}>
              <Text style={styles.sectionTitle}>Incoming Requests ({senderRequests.length})</Text>
              {senderRequests.length > 0 ? (
                senderRequests.map((req) => (
                  <View key={req.requestId} style={styles.mailboxItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mailboxPeer} numberOfLines={1}>{req.receiverId}</Text>
                      <Text style={styles.mailboxMeta}>{formatBytes(req.sizeBytes)}</Text>
                    </View>
                    <TouchableOpacity style={styles.btnApprove} onPress={() => handleApproveRequest(req)}>
                      <Text style={styles.btnApproveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyState}>No pending requests</Text>
              )}
            </View>
          </View>
        )}

        {/* --- RECEIVE VIEW --- */}
        {activeTab === 'receive' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Receive a file</Text>
            <Text style={styles.panelDesc}>Enter the share ID to retrieve and download the direct stream.</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                value={fileIdInput}
                onChangeText={setFileIdInput}
                placeholder="Paste share ID"
                placeholderTextColor="#71717a"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.btnLookup, !fileIdInput && styles.btnDisabled]}
                disabled={isFetchingMeta || !fileIdInput}
                onPress={handleFetchMetadata}
              >
                {isFetchingMeta ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.btnLookupText}>Lookup</Text>
                )}
              </TouchableOpacity>
            </View>

            {receiverFileMeta && (
              <View style={styles.fileMetaCard}>
                <FileText size={20} color="#a1a1aa" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaFileName} numberOfLines={1}>{receiverFileMeta.fileName}</Text>
                  <Text style={styles.metaFileSize}>{formatBytes(receiverFileMeta.sizeBytes)}</Text>
                </View>

                {requestStatus === '' && (
                  <TouchableOpacity style={styles.btnRequest} onPress={handleRequestAccess}>
                    <Text style={styles.btnRequestText}>Request</Text>
                  </TouchableOpacity>
                )}

                {requestStatus === 'PENDING' && (
                  <View style={[styles.badge, styles.badgePending]}>
                    <ActivityIndicator size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                    <Text style={styles.badgePendingText}>Pending</Text>
                  </View>
                )}

                {requestStatus === 'APPROVED' && (
                  <View style={[styles.badge, styles.badgeApproved]}>
                    <CheckCircle size={10} color="#10b981" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeApprovedText}>Approved</Text>
                  </View>
                )}
              </View>
            )}

            {downloadedFileUri !== '' && (
              <TouchableOpacity
                style={styles.btnShareDownloaded}
                onPress={() => Sharing.shareAsync(downloadedFileUri)}
              >
                <Text style={styles.btnShareDownloadedText}>Open / Share Received File</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* --- TELEMETRY FOOTER --- */}
      {isTransferring && (
        <View style={styles.telemetryBar}>
          <View style={styles.telemetryInfo}>
            <Text style={styles.telemetryTitle} numberOfLines={1}>
              {activeTab === 'share' ? 'Uploading' : 'Downloading'}: {activeFileName}
            </Text>
            <Text style={styles.telemetryStats}>
              {activeSpeed} MB/s  •  {activeProgress}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${activeProgress}%` }]} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#0e0e10',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#18181b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fafafa',
    marginRight: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fafafa',
  },
  settingsBtn: {
    padding: 6,
  },
  configDrawer: {
    padding: 16,
    backgroundColor: '#111113',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  configLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 6,
  },
  configRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  configInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#fafafa',
    marginRight: 8,
    fontSize: 13,
  },
  configBtn: {
    height: 38,
    backgroundColor: '#3f3f46',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  configBtnText: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '500',
  },
  configHint: {
    fontSize: 10,
    color: '#71717a',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#27272a',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1aa',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#fafafa',
  },
  content: {
    padding: 16,
  },
  panel: {
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 4,
  },
  panelDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 16,
    lineHeight: 18,
  },
  dropzone: {
    borderWidth: 2,
    borderColor: '#27272a',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
    marginBottom: 16,
  },
  dropzoneActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  dropLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fafafa',
    marginBottom: 4,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  dropHint: {
    fontSize: 12,
    color: '#71717a',
  },
  btnPrimary: {
    height: 40,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  shareBox: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 6,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e0e10',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    height: 38,
    paddingLeft: 12,
    paddingRight: 6,
  },
  shareInput: {
    flex: 1,
    color: '#fafafa',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  shareBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHint: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 8,
  },
  mailboxSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 10,
  },
  mailboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  mailboxPeer: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fafafa',
  },
  mailboxMeta: {
    fontSize: 11,
    color: '#a1a1aa',
    marginTop: 2,
  },
  btnApprove: {
    backgroundColor: '#fafafa',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnApproveText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    fontSize: 12,
    color: '#71717a',
    fontStyle: 'italic',
  },
  inputGroup: {
    flexDirection: 'row',
    height: 40,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#fafafa',
    fontSize: 14,
    marginRight: 8,
  },
  btnLookup: {
    width: 80,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: '#27272a',
    opacity: 0.5,
  },
  btnLookupText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 13,
  },
  fileMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 12,
  },
  metaFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fafafa',
  },
  metaFileSize: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  btnRequest: {
    backgroundColor: '#fafafa',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnRequestText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  badgePendingText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '500',
  },
  badgeApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  badgeApprovedText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
  btnShareDownloaded: {
    height: 40,
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  btnShareDownloadedText: {
    color: '#fafafa',
    fontWeight: '600',
    fontSize: 13,
  },
  telemetryBar: {
    padding: 16,
    backgroundColor: '#18181b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  telemetryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  telemetryTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#fafafa',
    marginRight: 16,
  },
  telemetryStats: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
});
