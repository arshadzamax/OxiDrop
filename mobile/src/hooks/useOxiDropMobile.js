import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decodeBase64, encodeBase64, sanitizeFileName, formatBytes } from '../utils/helpers';

let RTCPeerConnection = null;
let RTCIceCandidate = null;
let RTCSessionDescription = null;
let mediaDevices = null;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  mediaDevices = webrtc.mediaDevices;
} catch (e) {
  console.warn('WebRTC not available', e);
}

const SERVER_ADDRESS = 'oxidrop-signaling-server.onrender.com';
const HEARTBEAT_INTERVAL = 25000;
const RECONNECT_DELAY = 3000;
const CONNECTION_TIMEOUT = 25000;
const CHUNK_SIZE = 48 * 1024; // 48KB (exact multiple of 3 for clean Base64 encoding)
const BACKPRESSURE_HIGH = 4 * 1024 * 1024;
const BACKPRESSURE_LOW = 1 * 1024 * 1024;
const STATS_INTERVAL = 1000;

const isSecure = !SERVER_ADDRESS.startsWith('192.168.') && !SERVER_ADDRESS.includes('localhost') && !SERVER_ADDRESS.includes('127.0.0.1');
const API_HOST = isSecure ? `https://${SERVER_ADDRESS}` : `http://${SERVER_ADDRESS}`;
const WS_HOST = isSecure ? `wss://${SERVER_ADDRESS}` : `ws://${SERVER_ADDRESS}`;

export const useOxiDropMobile = () => {
  const [userId] = useState(() => 'mobile-' + Math.random().toString(36).substr(2, 6));
  const [socketConnected, setSocketConnected] = useState(false);
  const [devLogs, setDevLogs] = useState([]);
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerId, setPeerId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  // Multi-file selection & sender state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderBatchProgress, setSenderBatchProgress] = useState(0);
  const [senderCurrentFile, setSenderCurrentFile] = useState(null);
  const [senderTransferSpeed, setSenderTransferSpeed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Multi-file receiver state
  const [incomingFileOffer, setIncomingFileOffer] = useState(null);
  const [receiverFileMeta, setReceiverFileMeta] = useState(null);
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverBatchProgress, setReceiverBatchProgress] = useState(0);
  const [receiverTransferSpeed, setReceiverTransferSpeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState([]);

  // Telemetry
  const [webrtcStats, setWebrtcStats] = useState({
    connectionState: 'new',
    iceState: 'new',
    rtt: null,
    candidateType: null,
    localCandidateType: null,
    remoteCandidateType: null,
    bytesSent: 0,
    bytesReceived: 0,
  });

  // Native Refs
  const socketRef = useRef(null);
  const peerConnRef = useRef(null);
  const dataChannelRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const isHostRef = useRef(false);
  const peerIdRef = useRef(null);
  const iceConfigurationRef = useRef({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const remoteIceCandidatesQueueRef = useRef([]);
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const intentionalCloseRef = useRef(false);

  // Transfer engine refs
  const selectedFilesRef = useRef([]);
  const uploadQueueRef = useRef([]);
  const currentUploadIndexRef = useRef(0);
  const totalUploadBytesRef = useRef(0);
  const sentUploadBytesRef = useRef(0);

  const isBatchAcceptActiveRef = useRef(false);
  const receiverFileMetaRef = useRef(null);
  const receiverBatchTotalBytesRef = useRef(0);
  const receiverBatchReceivedBytesRef = useRef(0);
  const receiverBytesRef = useRef(0);
  const receiverSpeedBytesRef = useRef(0);
  const receiverSpeedTimeRef = useRef(Date.now());
  const receiverWriteQueueRef = useRef(Promise.resolve());
  const downloadedFileUriRef = useRef(null);

  // Ref synchronizations
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { selectedFilesRef.current = selectedFiles; }, [selectedFiles]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);

  const addDevLog = useCallback((msg, type = 'info') => {
    setDevLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [stopHeartbeat]);

  const stopStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const startStatsMonitoring = useCallback((pc) => {
    stopStatsMonitoring();
    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.connectionState === 'closed') {
        stopStatsMonitoring();
        return;
      }
      try {
        const stats = await pc.getStats();
        let rtt = null;
        let localCandidateType = null;
        let remoteCandidateType = null;
        let bytesSent = 0;
        let bytesReceived = 0;

        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime != null ? Math.round(report.currentRoundTripTime * 1000) : null;
            stats.forEach(r => {
              if (r.id === report.localCandidateId) localCandidateType = r.candidateType;
              if (r.id === report.remoteCandidateId) remoteCandidateType = r.candidateType;
            });
          }
          if (report.type === 'transport') {
            bytesSent = report.bytesSent || 0;
            bytesReceived = report.bytesReceived || 0;
          }
        });

        let candidateType = localCandidateType;
        if (candidateType === 'host') candidateType = 'Local (Host)';
        else if (candidateType === 'srflx') candidateType = 'P2P (STUN)';
        else if (candidateType === 'relay') candidateType = 'Relay (TURN)';
        else if (candidateType === 'prflx') candidateType = 'Peer Reflexive';

        setWebrtcStats({
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState,
          rtt,
          candidateType,
          localCandidateType,
          remoteCandidateType,
          bytesSent,
          bytesReceived,
        });
      } catch (err) {}
    }, STATS_INTERVAL);
  }, [stopStatsMonitoring]);

  const processQueuedIceCandidates = async () => {
    const pc = peerConnRef.current;
    if (!pc) return;
    const queue = remoteIceCandidatesQueueRef.current;
    remoteIceCandidatesQueueRef.current = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Queued ICE candidate error:', err);
      }
    }
    if (queue.length > 0) {
      addDevLog(`Processed ${queue.length} queued ICE candidates`);
    }
  };

  const handleReceiveIceCandidate = async (candidate) => {
    try {
      const pc = peerConnRef.current;
      if (!pc) return;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        remoteIceCandidatesQueueRef.current.push(candidate);
        addDevLog('ICE candidate queued (waiting for remote description)');
      }
    } catch (err) {
      console.warn('ICE candidate error:', err);
    }
  };

  const sendSignalingMessage = (msg) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const cleanupWebRTC = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    stopStatsMonitoring();
    remoteIceCandidatesQueueRef.current = [];
    setPeerConnected(false);
    setPeerId(null);
    setWebrtcStats({
      connectionState: 'new',
      iceState: 'new',
      rtt: null,
      candidateType: null,
      localCandidateType: null,
      remoteCandidateType: null,
      bytesSent: 0,
      bytesReceived: 0,
    });
    addDevLog('WebRTC connection closed');
  }, [stopStatsMonitoring, addDevLog]);

  // ── Multi-File Sender Streamer ──
  const streamCurrentQueueFile = async (dc) => {
    const queue = uploadQueueRef.current;
    const currentIndex = currentUploadIndexRef.current;
    if (!queue || currentIndex >= queue.length || !dc) return;

    const file = queue[currentIndex];
    const totalFiles = queue.length;
    const totalBytes = totalUploadBytesRef.current || file.size;

    setSenderCurrentFile({
      index: currentIndex,
      total: totalFiles,
      name: file.name,
      size: file.size,
    });

    try {
      addDevLog(`Reading file from device: ${file.name}...`);
      const fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      const fileBytes = decodeBase64(fileBase64);
      const actualSize = fileBytes.length;
      addDevLog(`Loaded ${file.name} (${formatBytes(actualSize)})`);

      let offset = 0;
      let fileSentBytes = 0;
      let speedBytes = sentUploadBytesRef.current;
      let speedTime = Date.now();

      dc.bufferedAmountLowThreshold = BACKPRESSURE_LOW;

      const stream = async () => {
        while (offset < actualSize) {
          if (dc.bufferedAmount > BACKPRESSURE_HIGH) {
            return; // Wait for onbufferedamountlow
          }

          const chunkEnd = Math.min(offset + CHUNK_SIZE, actualSize);
          const chunk = fileBytes.subarray(offset, chunkEnd);

          dc.send(chunk);

          offset = chunkEnd;
          fileSentBytes = chunkEnd;

          const now = Date.now();
          if (now - speedTime >= 500) {
            const timeDiffSec = (now - speedTime) / 1000;
            const overallSent = sentUploadBytesRef.current + fileSentBytes;
            const bytesDiff = overallSent - speedBytes;
            setSenderTransferSpeed(bytesDiff / timeDiffSec);
            speedBytes = overallSent;
            speedTime = now;

            const progressPercent = Math.min(100, Math.round((fileSentBytes / actualSize) * 100));
            setSenderProgress(progressPercent);

            const overallPercent = Math.min(100, Math.round((overallSent / totalBytes) * 100));
            setSenderBatchProgress(overallPercent);
          }
        }

        // Current file chunks pushed
        dc.onbufferedamountlow = null;
        sentUploadBytesRef.current += actualSize;

        const isLastFile = (currentIndex === totalFiles - 1);
        dc.send(JSON.stringify({
          type: 'file_complete',
          fileIndex: currentIndex,
          totalFiles,
          name: file.name,
          isLast: isLastFile
        }));

        if (!isLastFile) {
          // Advance to next file in queue and send offer
          currentUploadIndexRef.current += 1;
          const nextFile = queue[currentUploadIndexRef.current];
          addDevLog(`Sending file offer (${currentUploadIndexRef.current + 1}/${totalFiles}): ${nextFile.name}`);
          
          dc.send(JSON.stringify({
            type: 'file_offer',
            name: nextFile.name,
            size: nextFile.size,
            fileIndex: currentUploadIndexRef.current,
            totalFiles,
            batchTotalSize: totalBytes
          }));
        } else {
          // All files in batch sent
          setIsUploading(false);
          setSenderProgress(100);
          setSenderBatchProgress(100);
          setSenderCurrentFile(null);
          addDevLog(`All ${totalFiles} file(s) transferred successfully!`, 'success');
          Alert.alert('Transfer Complete', `Successfully sent ${totalFiles} file(s).`);
        }
      };

      dc.onbufferedamountlow = () => stream();
      await stream();
    } catch (err) {
      addDevLog(`File streaming error: ${err.message}`, 'error');
      setIsUploading(false);
      Alert.alert('Upload Error', 'Failed to stream file: ' + err.message);
    }
  };

  // ── DataChannel Message Dispatcher ──
  const handleDataChannelMessage = async (event) => {
    const { data } = event;
    if (typeof data === 'string') {
      try {
        const payload = JSON.parse(data);
        if (payload.type === 'chat') {
          setChatMessages(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: 'peer',
              text: payload.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          return;
        }

        if (payload.type === 'file_offer') {
          const { name, size, fileIndex = 0, totalFiles = 1, batchTotalSize = size, batchFiles } = payload;
          
          // Auto-accept subsequent files in a batch if user already accepted the batch
          if (isBatchAcceptActiveRef.current && totalFiles > 1) {
            const cleanName = sanitizeFileName(name);
            const targetUri = FileSystem.documentDirectory + cleanName;
            downloadedFileUriRef.current = targetUri;

            setReceiverFileMeta({
              fileName: name,
              sizeBytes: size,
              fileIndex,
              totalFiles,
            });
            setReceiverProgress(0);
            setIsDownloading(true);
            receiverBytesRef.current = 0;
            receiverSpeedBytesRef.current = 0;
            receiverSpeedTimeRef.current = Date.now();
            receiverWriteQueueRef.current = Promise.resolve();

            FileSystem.writeAsStringAsync(targetUri, '', { encoding: 'utf8' }).then(() => {
              dataChannelRef.current?.send(JSON.stringify({ type: 'file_accept' }));
              addDevLog(`Receiving file (${fileIndex + 1}/${totalFiles}): ${name}`);
            }).catch(err => {
              Alert.alert('Error', 'Could not initialize download file: ' + err.message);
              setIsDownloading(false);
            });
            return;
          }

          // Initial file offer prompt
          addDevLog(`File offer: ${totalFiles > 1 ? `${totalFiles} files (${formatBytes(batchTotalSize)})` : `${name} (${formatBytes(size)})`}`);
          setIncomingFileOffer({
            name,
            size,
            fileIndex,
            totalFiles,
            batchTotalSize,
            batchFiles,
          });
          return;
        }

        if (payload.type === 'file_accept') {
          addDevLog(`Peer accepted file offer, starting stream for file ${currentUploadIndexRef.current + 1}...`);
          setIsUploading(true);
          setSenderProgress(0);
          setSenderTransferSpeed(0);
          streamCurrentQueueFile(dataChannelRef.current);
          return;
        }

        if (payload.type === 'file_reject') {
          addDevLog('Peer rejected file offer');
          setIsUploading(false);
          setSenderCurrentFile(null);
          Alert.alert('File Rejected', 'The peer rejected the file transfer.');
          return;
        }

        if (payload.type === 'file_complete') {
          await receiverWriteQueueRef.current;
          
          const completedFileName = receiverFileMetaRef.current?.fileName || payload.name || 'download_file';
          const completedFileSize = receiverFileMetaRef.current?.sizeBytes || receiverBytesRef.current;
          const completedFileUri = downloadedFileUriRef.current;

          // Record in received files history
          const newReceivedFile = {
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            name: completedFileName,
            size: completedFileSize,
            uri: completedFileUri,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setReceivedFiles(prev => [newReceivedFile, ...prev]);

          const totalFiles = payload.totalFiles || 1;
          const fileIndex = payload.fileIndex !== undefined ? payload.fileIndex : 0;
          const isLastFile = payload.isLast || (fileIndex === totalFiles - 1);

          if (isLastFile) {
            isBatchAcceptActiveRef.current = false;
            setIsDownloading(false);
            setReceiverProgress(100);
            setReceiverBatchProgress(100);
            addDevLog(`All ${totalFiles} file(s) received successfully!`, 'success');
            Alert.alert('Download Complete', `Saved ${totalFiles} file(s) to device.`);
          } else {
            setReceiverProgress(100);
            addDevLog(`Received file (${fileIndex + 1}/${totalFiles}): ${completedFileName}`);
          }
          return;
        }
      } catch (e) {
        addDevLog('Unknown string message from data channel');
      }
    } else {
      // Binary ArrayBuffer Chunk
      let bytes = null;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      }

      if (bytes && downloadedFileUriRef.current && receiverFileMetaRef.current) {
        const chunkBase64 = encodeBase64(bytes);

        receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
          await FileSystem.writeAsStringAsync(downloadedFileUriRef.current, chunkBase64, {
            encoding: 'base64',
            append: true,
          });
        });

        receiverBytesRef.current += bytes.length;
        receiverBatchReceivedBytesRef.current += bytes.length;

        const now = Date.now();
        if (now - receiverSpeedTimeRef.current >= 500) {
          const timeDiffSec = (now - receiverSpeedTimeRef.current) / 1000;
          const bytesDiff = receiverBytesRef.current - receiverSpeedBytesRef.current;
          setReceiverTransferSpeed(bytesDiff / timeDiffSec);
          receiverSpeedBytesRef.current = receiverBytesRef.current;
          receiverSpeedTimeRef.current = now;

          const currentFileSize = receiverFileMetaRef.current.sizeBytes || 1;
          const progressPercent = Math.min(100, Math.round((receiverBytesRef.current / currentFileSize) * 100));
          setReceiverProgress(progressPercent);

          if (receiverBatchTotalBytesRef.current > 0) {
            const batchPercent = Math.min(100, Math.round((receiverBatchReceivedBytesRef.current / receiverBatchTotalBytesRef.current) * 100));
            setReceiverBatchProgress(batchPercent);
          }
        }
      }
    }
  };

  const setupDataChannel = (dc) => {
    dc.onopen = () => {
      addDevLog('DataChannel open');
    };
    dc.onclose = () => {
      addDevLog('DataChannel closed');
    };
    dc.onmessage = handleDataChannelMessage;
  };

  const initiateWebRTC = async () => {
    addDevLog('Initiating WebRTC...');
    if (!RTCPeerConnection) {
      addDevLog('WebRTC not supported on this device', 'error');
      return;
    }

    try {
      const pc = new RTCPeerConnection(iceConfigurationRef.current);
      peerConnRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        addDevLog(`ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setPeerConnected(true);
          startStatsMonitoring(pc);
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setPeerConnected(false);
          stopStatsMonitoring();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: 'send_ice_candidate',
            data: { toUserId: peerIdRef.current, candidate: event.candidate },
          });
        }
      };

      if (isHostRef.current) {
        const dc = pc.createDataChannel('file-transfer', { ordered: true });
        dataChannelRef.current = dc;
        setupDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignalingMessage({
          type: 'send_offer',
          data: { toUserId: peerIdRef.current, offer: offer.sdp },
        });
      } else {
        pc.ondatachannel = (event) => {
          dataChannelRef.current = event.channel;
          setupDataChannel(event.channel);
        };
      }

      connectionTimeoutRef.current = setTimeout(() => {
        if (
          peerConnRef.current &&
          peerConnRef.current.iceConnectionState !== 'connected' &&
          peerConnRef.current.iceConnectionState !== 'completed'
        ) {
          addDevLog('WebRTC connection timed out', 'error');
          cleanupWebRTC();
        }
      }, CONNECTION_TIMEOUT);
    } catch (err) {
      addDevLog(`WebRTC setup error: ${err.message}`, 'error');
    }
  };

  const handleReceiveOffer = async (offerSdp, fromUserId) => {
    addDevLog('Received offer, creating answer...');
    if (!peerConnRef.current) {
      await initiateWebRTC();
    }
    const pc = peerConnRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      await processQueuedIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignalingMessage({
        type: 'send_answer',
        data: { toUserId: fromUserId, answer: answer.sdp },
      });
    } catch (err) {
      addDevLog(`Offer handling error: ${err.message}`, 'error');
    }
  };

  const handleReceiveAnswer = async (answerSdp) => {
    addDevLog('Received answer, setting remote description...');
    const pc = peerConnRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      await processQueuedIceCandidates();
    } catch (err) {
      addDevLog(`Answer handling error: ${err.message}`, 'error');
    }
  };

  const connectWebSocket = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    addDevLog(`Connecting to WebSocket: ${WS_HOST}`);
    const ws = new WebSocket(WS_HOST);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketConnected(true);
      addDevLog('WebSocket connected');
      startHeartbeat();
      ws.send(JSON.stringify({ type: 'register_user', data: { userId } }));
      
      // Fetch dynamic STUN/TURN servers
      fetch(`${API_HOST}/api/webrtc/ice-servers`)
        .then(res => (res.ok ? res.json() : null))
        .then(config => {
          if (config?.iceServers) {
            iceConfigurationRef.current = { iceServers: config.iceServers };
            addDevLog('Fetched dynamic ICE servers');
          }
        })
        .catch(() => addDevLog('Using fallback STUN servers', 'warn'));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'registered':
            addDevLog('Registered on server');
            break;
          case 'room_created':
            setRoomCode(msg.data.roomCode);
            setIsHost(true);
            addDevLog(`Room created: ${msg.data.roomCode}`);
            break;
          case 'peer_joined':
            setPeerId(msg.data.peerId);
            peerIdRef.current = msg.data.peerId;
            addDevLog(`Peer joined room: ${msg.data.peerId}`);
            if (isHostRef.current) {
              initiateWebRTC();
            }
            break;
          case 'peer_left':
            addDevLog('Peer left the room');
            cleanupWebRTC();
            break;
          case 'receive_offer':
            setPeerId(msg.data.fromUserId);
            peerIdRef.current = msg.data.fromUserId;
            handleReceiveOffer(msg.data.offer, msg.data.fromUserId);
            break;
          case 'receive_answer':
            handleReceiveAnswer(msg.data.answer);
            break;
          case 'receive_ice_candidate':
            handleReceiveIceCandidate(msg.data.candidate);
            break;
          case 'error_message':
            addDevLog(`Server Error: ${msg.data.message}`, 'error');
            Alert.alert('Server Error', msg.data.message);
            break;
          case 'pong':
            break;
          default:
            addDevLog(`Unknown message: ${msg.type}`);
        }
      } catch (err) {
        addDevLog(`WS message parsing error: ${err.message}`, 'error');
      }
    };

    ws.onclose = () => {
      setSocketConnected(false);
      stopHeartbeat();
      addDevLog('WebSocket closed', 'warn');
      if (!intentionalCloseRef.current) {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      addDevLog('WebSocket error', 'error');
    };
  }, [userId, addDevLog, startHeartbeat, stopHeartbeat, cleanupWebRTC]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      intentionalCloseRef.current = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      cleanupWebRTC();
    };
  }, [connectWebSocket, stopHeartbeat, cleanupWebRTC]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          addDevLog('App foregrounded, reconnecting WebSocket...');
          connectWebSocket();
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [connectWebSocket, addDevLog]);

  const createRoom = useCallback(() => {
    sendSignalingMessage({ type: 'create_room', data: { userId } });
  }, [userId]);

  const joinRoom = useCallback((code) => {
    if (!code) return;
    const rc = code.toLowerCase();
    sendSignalingMessage({ type: 'join_room', data: { roomCode: rc, userId } });
    setRoomCode(rc);
    setIsHost(false);
  }, [userId]);

  const leaveRoom = useCallback(() => {
    if (roomCode) {
      sendSignalingMessage({ type: 'leave_room', data: { roomCode } });
      setRoomCode(null);
      cleanupWebRTC();
    }
  }, [roomCode, cleanupWebRTC]);

  // ── Multi-File Pickers & Selection Controls ──
  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const newFiles = res.assets.map(asset => ({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType,
      }));

      setSelectedFiles(prev => {
        const existingUris = new Set(prev.map(f => f.uri));
        const filtered = newFiles.filter(f => !existingUris.has(f.uri));
        const updated = [...prev, ...filtered];
        addDevLog(`Selected ${newFiles.length} file(s) (Total: ${updated.length} files)`);
        return updated;
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to pick files: ' + err.message);
    }
  };

  const removeSelectedFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
  };

  // ── Multi-File Send Offer ──
  const sendFileOffer = () => {
    const files = selectedFilesRef.current;
    if (!files || files.length === 0 || !dataChannelRef.current) {
      Alert.alert('Not ready', 'Please select file(s) and ensure peer is connected.');
      return;
    }

    uploadQueueRef.current = [...files];
    currentUploadIndexRef.current = 0;
    totalUploadBytesRef.current = files.reduce((acc, f) => acc + (f.size || 0), 0);
    sentUploadBytesRef.current = 0;

    const firstFile = files[0];
    const totalFiles = files.length;
    const batchTotalSize = totalUploadBytesRef.current;
    const batchFiles = files.map(f => ({ name: f.name, size: f.size }));

    dataChannelRef.current.send(JSON.stringify({
      type: 'file_offer',
      name: firstFile.name,
      size: firstFile.size,
      fileIndex: 0,
      totalFiles,
      batchTotalSize,
      batchFiles,
    }));

    addDevLog(`Sent file offer for ${totalFiles > 1 ? `${totalFiles} files (${formatBytes(batchTotalSize)})` : firstFile.name}`);
  };

  // ── Multi-File Accept / Reject ──
  const acceptFileOffer = () => {
    if (!incomingFileOffer || !dataChannelRef.current) return;
    const offer = incomingFileOffer;

    if (offer.totalFiles > 1) {
      isBatchAcceptActiveRef.current = true;
      receiverBatchTotalBytesRef.current = offer.batchTotalSize || offer.size;
      receiverBatchReceivedBytesRef.current = 0;
      setReceiverBatchProgress(0);
    } else {
      isBatchAcceptActiveRef.current = false;
      receiverBatchTotalBytesRef.current = offer.size;
      receiverBatchReceivedBytesRef.current = 0;
    }

    const cleanName = sanitizeFileName(offer.name);
    const targetUri = FileSystem.documentDirectory + cleanName;
    downloadedFileUriRef.current = targetUri;

    setReceiverFileMeta({
      fileName: offer.name,
      sizeBytes: offer.size,
      fileIndex: offer.fileIndex || 0,
      totalFiles: offer.totalFiles || 1,
    });
    setReceiverProgress(0);
    setIsDownloading(true);
    receiverBytesRef.current = 0;
    receiverSpeedBytesRef.current = 0;
    receiverSpeedTimeRef.current = Date.now();
    receiverWriteQueueRef.current = Promise.resolve();

    FileSystem.writeAsStringAsync(targetUri, '', { encoding: 'utf8' }).then(() => {
      dataChannelRef.current?.send(JSON.stringify({ type: 'file_accept' }));
      setIncomingFileOffer(null);
      addDevLog(`Accepted file offer (${(offer.fileIndex || 0) + 1}/${offer.totalFiles || 1}): ${offer.name}`);
    }).catch(err => {
      Alert.alert('Error', 'Could not initialize download file.');
      setIsDownloading(false);
    });
  };

  const rejectFileOffer = () => {
    if (!incomingFileOffer || !dataChannelRef.current) return;
    dataChannelRef.current.send(JSON.stringify({ type: 'file_reject' }));
    setIncomingFileOffer(null);
    isBatchAcceptActiveRef.current = false;
    addDevLog('Rejected file offer');
  };

  const sendChatMessage = (text) => {
    if (!text.trim() || !dataChannelRef.current) return;
    dataChannelRef.current.send(JSON.stringify({ type: 'chat', text }));
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'self',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const shareFile = async (uri) => {
    if (!uri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Sharing not available', 'Cannot share files on this device.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to share file: ' + err.message);
    }
  };

  const shareDownloadedFile = async () => {
    const uri = downloadedFileUriRef.current || (receivedFiles.length > 0 ? receivedFiles[0].uri : null);
    if (!uri) return;
    await shareFile(uri);
  };

  return {
    userId,
    serverAddress: SERVER_ADDRESS,
    socketConnected,
    devLogs,
    roomCode,
    isHost,
    peerConnected,
    peerId,
    chatMessages,

    // Multi-file selection & sender
    selectedFiles,
    selectedFile: selectedFiles[0] || null, // backward compatibility
    senderProgress,
    senderBatchProgress,
    senderCurrentFile,
    senderTransferSpeed,
    isUploading,

    // Multi-file receiver
    incomingFileOffer,
    receiverFileMeta,
    receiverProgress,
    receiverBatchProgress,
    receiverTransferSpeed,
    isDownloading,
    receivedFiles,

    webrtcStats,
    createRoom,
    joinRoom,
    leaveRoom,

    pickFiles,
    pickFile: pickFiles, // backward compatibility
    removeSelectedFile,
    clearSelectedFiles,
    sendFileOffer,
    acceptFileOffer,
    rejectFileOffer,
    sendChatMessage,
    shareDownloadedFile,
    shareFile,
  };
};
