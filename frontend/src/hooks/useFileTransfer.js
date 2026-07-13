import { useState, useEffect, useRef } from 'react';
import { sanitizeFileName, formatBytes } from '../utils/helpers';

/**
 * useFileTransfer — A custom hook to isolate WebRTC file transfer logic.
 * Handles sender file chunking, receiver file assembly, File System Access API writing,
 * backpressure flow control, progress states, and speed calculations.
 */
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

  // Refs for tracking mutable data across asynchronous stream events
  const selectedFileRef = useRef(null);
  const receiverFileMetaRef = useRef(null);
  const fileWritableRef = useRef(null);

  // Keep refs up-to-date with state values
  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { receiverFileMetaRef.current = receiverFileMeta; }, [receiverFileMeta]);

  // Receiver chunk buffering
  const receiverBufRef = useRef([]);
  const receiverBytesRef = useRef(0);
  const receiverSpeedBytesRef = useRef(0);
  const receiverSpeedTimeRef = useRef(performance.now());
  const receiverLastLoggedPctRef = useRef(-1);
  const receiverWriteQueueRef = useRef(Promise.resolve());

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
    receiverWriteQueueRef.current = Promise.resolve();
  };

  // ── Receiver: Chunk Accumulator & disk writer ──
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
    const meta = receiverFileMetaRef.current;
    if (!meta) return;
    receiverFileMetaRef.current = null; // Clear immediately to block duplicate execution

    setIsDownloading(false);
    setReceiverProgress(100);
    setReceiverTransferSpeed(0);
    addDevLog('All file bytes received successfully. Saving file...', 'stream');

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

  // ── Sender: Pipeline Stream Loops (Async Pipelined Chunking) ──
  const startFileStreaming = async (dc) => {
    if (!selectedFileRef.current) return;
    const file = selectedFileRef.current;
    const chunkSize = 65536; // 64KB
    let currentOffset = 0;
    let bytesSent = 0;
    let lastTime = performance.now();
    let lastLoggedPct = -1;

    addDevLog(`Starting file stream: ${file.name} (${formatBytes(file.size)})`, 'stream');

    // Configure WebRTC low buffer threshold to trigger native event-based resumes
    dc.bufferedAmountLowThreshold = 256 * 1024; // 256KB
    dc.onbufferedamountlow = () => {
      stream();
    };

    let isStreaming = false; // Thread-safe async execution lock to prevent parallel loop race conditions
    let isCompleted = false; // Thread-safe completion lock to prevent duplicate completions
    const stream = async () => {
      if (dc.readyState !== 'open') return;
      if (isCompleted) return;
      if (isStreaming) return;
      isStreaming = true;

      try {
        while (currentOffset < file.size) {
          // Flow control: WebRTC bufferedAmount check
          // Keep the buffer saturated to around 1MB (16 chunks of 64KB) for maximum network throughput
          if (dc.bufferedAmount > 1024 * 1024) {
            // Buffer is full. Exit and wait for onbufferedamountlow to fire.
            return;
          }

          const slice = file.slice(currentOffset, currentOffset + chunkSize);
          const chunk = await slice.arrayBuffer();

          if (dc.readyState !== 'open') return;
          dc.send(chunk);

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
        }

        // De-register the listener so the event doesn't fire again
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

    await promptSaveLocation(offer.name);

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
    handleDataChannelMessage
  };
}
