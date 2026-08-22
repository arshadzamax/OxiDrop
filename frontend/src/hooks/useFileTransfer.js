import { useState, useEffect, useRef } from 'react';
import { sanitizeFileName, formatBytes } from '../utils/helpers';
import { isOpfsSupported, createOpfsTempWriter, saveOpfsFileToDownloads } from '../utils/opfsStorage';

/**
 * useFileTransfer — A custom hook to isolate WebRTC file transfer logic.
 * Handles sender file chunking, receiver file assembly, File System Access API writing,
 * backpressure flow control, progress states, and speed calculations.
 */
const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
let invoke = () => Promise.reject("Not running inside Tauri context");
if (isTauri) {
  import('@tauri-apps/api/core').then(m => {
    invoke = m.invoke;
  }).catch(err => {
    console.error("Failed to load Tauri core invoke client:", err);
  });
}

export function useFileTransfer({ dataChannelRef, addDevLog, addNotification, cleanupWebRTC }) {
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

  // Connection metadata prompts
  const [incomingFileOffer, setIncomingFileOffer] = useState(null);
  const [fileOfferPending, setFileOfferPending] = useState(false);

  // Iroh Native P2P states (Tauri-only)
  const [irohTicket, setIrohTicket] = useState('');
  const [isIrohSharing, setIsIrohSharing] = useState(false);
  const [irohSharedFilePath, setIrohSharedFilePath] = useState('');
  const [irohSharedFileName, setIrohSharedFileName] = useState('');

  const [irohDownloadTicket, setIrohDownloadTicket] = useState('');
  const [isIrohDownloading, setIsIrohDownloading] = useState(false);
  const [irohDownloadProgress, setIrohDownloadProgress] = useState(0);
  const [irohSpeed, setIrohSpeed] = useState(0); // in bytes/sec
  const [irohTransferredBytes, setIrohTransferredBytes] = useState(0);
  const [irohTotalBytes, setIrohTotalBytes] = useState(0);
  const [irohTargetFileName, setIrohTargetFileName] = useState('');
  const [irohTelemetry, setIrohTelemetry] = useState({
    active: false,
    state: 'idle',
    nodeId: '',
    relayUrl: null,
    transport: 'None',
    latencyMs: null,
  });

  // Listen for real-time Iroh progress, log, and telemetry events from Tauri Rust backend
  useEffect(() => {
    if (!isTauri) return;
    let unlistenProgress = null;
    let unlistenLog = null;
    let unlistenTelemetry = null;
    import('@tauri-apps/api/event').then(m => {
      m.listen('iroh-progress', (event) => {
        const { bytes_transferred, total_bytes, speed_bytes_per_sec, percent, status } = event.payload || {};
        if (typeof percent === 'number') {
          setIrohDownloadProgress(Math.min(100, Math.max(0, Math.round(percent))));
        }
        if (typeof bytes_transferred === 'number') {
          setIrohTransferredBytes(bytes_transferred);
        }
        if (typeof total_bytes === 'number' && total_bytes > 0) {
          setIrohTotalBytes(total_bytes);
        }
        if (typeof speed_bytes_per_sec === 'number') {
          setIrohSpeed(speed_bytes_per_sec);
        }
      }).then(unlisten => {
        unlistenProgress = unlisten;
      });

      m.listen('iroh-log', (event) => {
        const logMsg = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
        if (logMsg && addDevLog) {
          addDevLog(`[Iroh] ${logMsg}`, 'stream');
        }
      }).then(unlisten => {
        unlistenLog = unlisten;
      });

      m.listen('iroh-telemetry', (event) => {
        const payload = event.payload || {};
        const isActive = payload.state !== 'idle' && payload.state !== 'completed' && payload.state !== 'failed';
        setIrohTelemetry({
          active: isActive,
          state: payload.state || 'active',
          nodeId: payload.node_id || '',
          relayUrl: payload.relay_url || null,
          transport: payload.transport || 'QUIC',
          latencyMs: payload.latency_ms || null,
        });
        if (payload.log && addDevLog) {
          addDevLog(`[Iroh Telemetry] ${payload.state.toUpperCase()}: ${payload.log}`, 'stream');
        }
      }).then(unlisten => {
        unlistenTelemetry = unlisten;
      });
    }).catch(err => console.error("Failed to setup Tauri event listener:", err));

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenLog) unlistenLog();
      if (unlistenTelemetry) unlistenTelemetry();
    };
  }, [addDevLog]);

  const handleSetIrohDownloadTicket = (val) => {
    setIrohDownloadTicket(val);
    if (val && val.includes('#')) {
      const parts = val.split('#');
      if (parts[1]) setIrohTargetFileName(parts[1].trim());
      if (parts[2]) {
        const size = parseInt(parts[2].trim(), 10);
        if (!isNaN(size) && size > 0) setIrohTotalBytes(size);
      }
    } else {
      setIrohTargetFileName('');
    }
  };

  const pickTauriFile = async () => {
    try {
      addDevLog('Opening native file dialog...', 'system');
      const path = await invoke('pick_file_dialog');
      if (path) {
        setIrohSharedFilePath(path);
        const filename = path.split(/[\\/]/).pop();
        setIrohSharedFileName(filename);
        setIrohTicket('');
        setIsIrohSharing(false);
        addDevLog(`Selected file for Iroh sharing: ${path}`, 'system');
      }
    } catch (err) {
      addDevLog('File dialog error: ' + err, 'error');
    }
  };

  const resetIrohShare = () => {
    setIrohSharedFilePath('');
    setIrohSharedFileName('');
    setIrohTicket('');
    setIsIrohSharing(false);
    addDevLog('Reset Iroh share state', 'system');
  };

  const resetIrohDownload = () => {
    setIrohDownloadTicket('');
    setIrohTargetFileName('');
    setIrohTotalBytes(0);
    setIrohDownloadProgress(0);
    setIrohSpeed(0);
    setIrohTransferredBytes(0);
    setIsIrohDownloading(false);
    addDevLog('Reset Iroh download state', 'system');
  };

  const startIrohShare = async () => {
    if (!irohSharedFilePath) {
      addNotification('Please select a file first.', 'error');
      return;
    }
    setIsIrohSharing(true);
    addDevLog(`Starting Iroh share for file: ${irohSharedFilePath}`, 'stream');
    try {
      const ticket = await invoke('start_iroh_share', { filePath: irohSharedFilePath });
      setIrohTicket(ticket);
      addDevLog('Iroh sharing active. Share Ticket generated with filename metadata!', 'stream');
      addNotification('Iroh transfer ticket generated successfully!', 'success');
    } catch (err) {
      addDevLog('Iroh share failed: ' + err, 'error');
      addNotification('Failed to generate Iroh ticket.', 'error');
    } finally {
      setIsIrohSharing(false);
    }
  };

  const downloadFromIroh = async () => {
    if (!irohDownloadTicket) {
      addNotification('Please paste an Iroh ticket.', 'error');
      return;
    }
    setIsIrohDownloading(true);
    setIrohDownloadProgress(0);
    setIrohSpeed(0);
    setIrohTransferredBytes(0);
    addDevLog('Pasting ticket and initiating Iroh download...', 'stream');
    try {
      addDevLog('Opening native save directory dialog...', 'system');
      const outputDir = await invoke('pick_folder_dialog');
      if (!outputDir) {
        addDevLog('Download cancelled: No save directory selected.', 'system');
        setIsIrohDownloading(false);
        return;
      }
      
      addDevLog(`Starting download. Storing in: ${outputDir}`, 'stream');
      const destFile = await invoke('download_from_iroh', { 
        ticketStr: irohDownloadTicket.trim(), 
        outputDir 
      });
      setIrohDownloadProgress(100);
      addDevLog(`Iroh download finished! File saved with original extension to: ${destFile}`, 'stream');
      addNotification('File downloaded successfully via Iroh!', 'success');
    } catch (err) {
      addDevLog('Iroh download failed: ' + err, 'error');
      addNotification('Failed to download from Iroh: ' + err, 'error');
    } finally {
      setIsIrohDownloading(false);
    }
  };

  // Refs for tracking mutable data across asynchronous stream events
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);
  const fileWritableRef = useRef(null);
  const opfsContextRef = useRef(null);

  // Keep refs up-to-date with state values
  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);

  // Receiver chunk buffering
  const receiverBufRef = useRef([]);
  const receiverBytesRef = useRef(0);
  const receiverSpeedBytesRef = useRef(0);
  const receiverSpeedTimeRef = useRef(performance.now());
  const receiverLastLoggedPctRef = useRef(-1);
  const receiverLastProgressTimeRef = useRef(0);
  const receiverWriteQueueRef = useRef(Promise.resolve());
  const receiverWriteBufferRef = useRef([]);
  const receiverWriteBufferSizeRef = useRef(0);

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

    fileWritableRef.current = null;
    receiverBufRef.current = [];
    receiverBytesRef.current = 0;
    receiverSpeedBytesRef.current = 0;
    receiverLastLoggedPctRef.current = -1;
    receiverLastProgressTimeRef.current = 0;
    receiverWriteBufferRef.current = [];
    receiverWriteBufferSizeRef.current = 0;
    receiverWriteQueueRef.current = Promise.resolve();
  };

  // ── Receiver: Chunk Accumulator & disk writer ──
  const handleReceiveChunk = (data) => {
    receiverBytesRef.current += data.byteLength;
    receiverSpeedBytesRef.current += data.byteLength;
    const now = performance.now();

    // Throttle speed calculation to once every 500ms
    if (now - receiverSpeedTimeRef.current >= 500) {
      const elapsed = (now - receiverSpeedTimeRef.current) / 1000;
      setReceiverTransferSpeed(((receiverSpeedBytesRef.current / (1024 * 1024)) / elapsed).toFixed(2));
      receiverSpeedBytesRef.current = 0;
      receiverSpeedTimeRef.current = now;
    }

    const meta = receiverFileMetaRef.current;
    if (!meta) return;

    // Throttle React progress state updates: update every 100ms or on completion
    if (now - receiverLastProgressTimeRef.current >= 100 || receiverBytesRef.current >= meta.sizeBytes) {
      const progressPct = Math.round((receiverBytesRef.current / meta.sizeBytes) * 100);
      setReceiverProgress(progressPct);
      receiverLastProgressTimeRef.current = now;

      if (progressPct % 10 === 0 && progressPct !== receiverLastLoggedPctRef.current) {
        addDevLog(`Received chunk: ${formatBytes(receiverBytesRef.current)} / ${formatBytes(meta.sizeBytes)} (${progressPct}%)`, 'stream');
        receiverLastLoggedPctRef.current = progressPct;
      }
    }

    if (fileWritableRef.current) {
      // Buffer chunks up to 2MB before flushing to disk stream to minimize disk IPC
      receiverWriteBufferRef.current.push(data);
      receiverWriteBufferSizeRef.current += data.byteLength;

      if (receiverWriteBufferSizeRef.current >= 2 * 1024 * 1024) {
        const chunksToWrite = receiverWriteBufferRef.current;
        receiverWriteBufferRef.current = [];
        receiverWriteBufferSizeRef.current = 0;

        const blob = new Blob(chunksToWrite);
        receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
          try {
            await fileWritableRef.current.write(blob);
          } catch (err) {
            addDevLog('Failed direct disk write chunk: ' + err.message, 'error');
            console.error('Failed streaming chunk directly to disk path:', err);
          }
        });
      }
    } else {
      receiverBufRef.current.push(data);
    }
  };

  const setupReceiverStorage = async (fileName) => {
    // Tier 1: Native File System Access API (Desktop Chromium)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
        });
        fileWritableRef.current = await handle.createWritable();
        opfsContextRef.current = null;
        addDevLog('Direct disk file stream initialized via showSaveFilePicker.', 'stream');
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          addDevLog('Save picker cancelled by user. Falling back to OPFS disk storage.', 'stream');
        } else {
          console.warn('showSaveFilePicker failed. Falling back to OPFS.', err);
        }
      }
    }

    // Tier 2: Origin Private File System (OPFS for Safari, Firefox, Mobile Chrome)
    if (isOpfsSupported()) {
      try {
        const opfsContext = await createOpfsTempWriter(fileName);
        fileWritableRef.current = opfsContext.writable;
        opfsContextRef.current = opfsContext;
        addDevLog(`OPFS sandboxed stream initialized (${opfsContext.tempFileName}). Zero RAM overhead mode active.`, 'stream');
        return;
      } catch (err) {
        console.warn('OPFS initialization failed. Falling back to in-memory buffering.', err);
        addDevLog('OPFS unavailable: ' + err.message + '. Falling back to in-memory buffer.', 'system');
      }
    }

    // Tier 3: In-Memory ArrayBuffer buffer fallback
    fileWritableRef.current = null;
    opfsContextRef.current = null;
    receiverBufRef.current = [];
    addDevLog('Using in-memory buffer fallback for incoming file.', 'system');
  };

  const finalizeReceivedFile = async () => {
    const meta = receiverFileMetaRef.current;
    if (!meta) return;
    receiverFileMetaRef.current = null; // Clear immediately to block duplicate execution

    setIsDownloading(false);
    setReceiverProgress(100);
    setReceiverTransferSpeed(0);
    addDevLog('All file bytes received successfully. Saving file...', 'stream');

    if (fileWritableRef.current) {
      // Flush any remaining buffered chunks
      if (receiverWriteBufferRef.current.length > 0) {
        const remainingBlob = new Blob(receiverWriteBufferRef.current);
        receiverWriteBufferRef.current = [];
        receiverWriteBufferSizeRef.current = 0;
        receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
          try {
            await fileWritableRef.current.write(remainingBlob);
          } catch (err) {
            console.error('Error writing final chunk:', err);
          }
        });
      }

      receiverWriteQueueRef.current = receiverWriteQueueRef.current.then(async () => {
        try {
          const currentWritable = fileWritableRef.current;
          if (currentWritable) {
            await currentWritable.close();
            fileWritableRef.current = null;
          }

          if (opfsContextRef.current) {
            const opfsCtx = opfsContextRef.current;
            opfsContextRef.current = null;
            addDevLog('Exporting OPFS sandboxed file to browser downloads...', 'stream');
            await saveOpfsFileToDownloads(opfsCtx, meta.fileName);
            addDevLog('Triggered browser download from OPFS disk-backed file and reclaimed sandboxed space.', 'stream');
          } else {
            addDevLog('Direct disk file writer closed successfully.', 'stream');
          }

          addNotification('File downloaded successfully!', 'success');
        } catch (err) {
          addDevLog('Error finalizing file download: ' + err.message, 'error');
          console.error('Failed to finalize file download:', err);
          addNotification('Failed to save file: ' + err.message, 'error');
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
    receiverLastProgressTimeRef.current = 0;
  };

  // ── Sender: Pipeline Stream Loops (Async Pipelined Chunking) ──
  const startFileStreaming = async (dc) => {
    if (!selectedFileRef.current) return;
    const file = selectedFileRef.current;
    const chunkSize = 65536; // 64KB (Optimal WebRTC packet)
    const readBatchSize = 1024 * 1024; // 1MB batch read from disk
    let currentOffset = 0;
    let bytesSent = 0;
    let lastTime = performance.now();
    let lastProgressTime = 0;
    let lastLoggedPct = -1;

    addDevLog(`Starting high-speed file stream: ${file.name} (${formatBytes(file.size)})`, 'stream');

    // High throughput WebRTC buffer settings
    // 2MB low threshold & 8MB high ceiling to prevent SCTP pipe starvation
    const BUFFER_LOW_THRESHOLD = 2 * 1024 * 1024; // 2MB
    const BUFFER_HIGH_CEILING = 8 * 1024 * 1024;   // 8MB

    dc.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;
    dc.onbufferedamountlow = () => {
      stream();
    };

    let isStreaming = false; // Thread-safe async execution lock
    let isCompleted = false; // Thread-safe completion lock

    const stream = async () => {
      if (dc.readyState !== 'open') return;
      if (isCompleted) return;
      if (isStreaming) return;
      isStreaming = true;

      try {
        while (currentOffset < file.size) {
          // Flow control: keep WebRTC buffer full up to 8MB without overflowing
          if (dc.bufferedAmount > BUFFER_HIGH_CEILING) {
            return; // Wait for onbufferedamountlow to fire
          }

          // Read a 1MB batch from disk in one async operation
          const batchEnd = Math.min(currentOffset + readBatchSize, file.size);
          const batchSlice = file.slice(currentOffset, batchEnd);
          const batchBuffer = await batchSlice.arrayBuffer();

          if (dc.readyState !== 'open') return;

          // Slice and send 64KB chunks from the in-memory batch buffer
          let batchOffset = 0;
          while (batchOffset < batchBuffer.byteLength) {
            if (dc.bufferedAmount > BUFFER_HIGH_CEILING) {
              break; // Yield and wait for onbufferedamountlow
            }

            const chunkEnd = Math.min(batchOffset + chunkSize, batchBuffer.byteLength);
            const chunk = batchBuffer.slice(batchOffset, chunkEnd);
            dc.send(chunk);

            const sentBytes = chunk.byteLength;
            batchOffset += sentBytes;
            currentOffset += sentBytes;
            bytesSent += sentBytes;

            const now = performance.now();
            if (now - lastTime >= 500) {
              const elapsed = (now - lastTime) / 1000;
              setSenderTransferSpeed(((bytesSent / (1024 * 1024)) / elapsed).toFixed(2));
              bytesSent = 0;
              lastTime = now;
            }

            // Throttle UI progress update to 100ms
            if (now - lastProgressTime >= 100 || currentOffset >= file.size) {
              const progressPct = Math.round((currentOffset / file.size) * 100);
              setSenderProgress(progressPct);
              lastProgressTime = now;

              if (progressPct % 10 === 0 && progressPct !== lastLoggedPct) {
                addDevLog(`Sent chunk: ${formatBytes(currentOffset)} / ${formatBytes(file.size)} (${progressPct}%)`, 'stream');
                lastLoggedPct = progressPct;
              }
            }
          }
        }

        if (currentOffset >= file.size) {
          // De-register listener
          dc.onbufferedamountlow = null;
          isCompleted = true;

          // All chunks sent, signal completion
          setSenderProgress(100);
          addDevLog('All file chunks pushed. Sending file_complete signal.', 'stream');
          try {
            dc.send(JSON.stringify({ type: 'file_complete' }));
          } catch {}
          setIsUploading(false);
          setSenderTransferSpeed(0);
          addNotification('File sent successfully!', 'success');
        }
      } catch (e) {
        addDevLog('Failed to send chunk via WebRTC: ' + e.message, 'error');
        console.error('Failed to send chunk via WebRTC:', e);
        cleanupWebRTC();
        setIsUploading(false);
        setSenderTransferSpeed(0);
      } finally {
        isStreaming = false;
      }
    };

    stream();
  };

  // ── Sender: File Selection & Offer triggers ──
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
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
      addNotification('No peer connection or active file offer found.', 'error');
      return;
    }
    addDevLog(`Accepting file offer: ${offer.name} (${formatBytes(offer.size)})`, 'stream');
    setIncomingFileOffer(null);
    setReceiverFileMeta({ fileName: offer.name, sizeBytes: offer.size });
    receiverBytesRef.current = 0;
    receiverSpeedBytesRef.current = 0;
    receiverSpeedTimeRef.current = performance.now();
    receiverLastLoggedPctRef.current = -1;
    setIsDownloading(true);
    setReceiverProgress(0);

    await setupReceiverStorage(offer.name);

    addDevLog('Sending file_accept response to peer.', 'stream');
    dc.send(JSON.stringify({ type: 'file_accept' }));
  };

  const rejectIncomingFile = () => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open' || !incomingFileOffer) return;
    addDevLog('Rejecting incoming file offer.', 'stream');
    dc.send(JSON.stringify({ type: 'file_reject' }));
    setIncomingFileOffer(null);
  };

  // ── DataChannel Router (relays chunk data and triggers UI states) ──
  const handleDataChannelMessage = (e, dc) => {
    if (e.data instanceof ArrayBuffer) {
      handleReceiveChunk(e.data);
      return;
    }

    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'file_offer':
          addDevLog(`Received file offer from peer: ${msg.name} (${formatBytes(msg.size)})`, 'stream');
          setIncomingFileOffer({ name: msg.name, size: msg.size });
          break;
        case 'file_accept':
          addDevLog('Peer accepted file offer. Starting file stream...', 'stream');
          setFileOfferPending(false);
          setIsUploading(true);
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
      // Catch other JSON strings (e.g. Chat messages handled in parent)
    }
  };

  return {
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
    resetTransferState,
    handleFileChange,
    sendFile,
    acceptIncomingFile,
    rejectIncomingFile,
    handleDataChannelMessage,
    
    // Iroh states
    irohTicket,
    isIrohSharing,
    irohSharedFilePath,
    irohSharedFileName,
    irohDownloadTicket,
    isIrohDownloading,
    irohDownloadProgress,
    irohSpeed,
    irohTransferredBytes,
    irohTotalBytes,
    irohTargetFileName,
    irohTelemetry,
    
    // Iroh triggers
    setIrohDownloadTicket: handleSetIrohDownloadTicket,
    pickTauriFile,
    startIrohShare,
    downloadFromIroh,
    resetIrohShare,
    resetIrohDownload
  };
}
