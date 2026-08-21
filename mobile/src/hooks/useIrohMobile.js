import { useState, useEffect, useCallback } from 'react';
import { NativeModules, DeviceEventEmitter, Platform, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const { IrohModule } = NativeModules;

export function useIrohMobile({ addDevLog = () => {} } = {}) {
  // Sender state
  const [selectedFile, setSelectedFile] = useState(null);
  const [irohTicket, setIrohTicket] = useState('');
  const [isIrohSharing, setIsIrohSharing] = useState(false);

  // Receiver state
  const [downloadTicket, setDownloadTicket] = useState('');
  const [targetFileName, setTargetFileName] = useState('');
  const [targetFileSize, setTargetFileSize] = useState(0);
  const [isIrohDownloading, setIsIrohDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0); // in bytes/sec
  const [transferredBytes, setTransferredBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadedFilePath, setDownloadedFilePath] = useState('');

  // Subscribe to native Iroh progress and log events emitted by Kotlin IrohModule
  useEffect(() => {
    const subProgress = DeviceEventEmitter.addListener('iroh-progress', (event) => {
      if (!event) return;
      const { bytesTransferred, totalBytes: total, speedBytesPerSec, percent, status } = event;

      if (typeof percent === 'number') {
        setDownloadProgress(Math.min(100, Math.max(0, Math.round(percent))));
      }
      if (typeof bytesTransferred === 'number') {
        setTransferredBytes(bytesTransferred);
      }
      if (typeof total === 'number' && total > 0) {
        setTotalBytes(total);
      }
      if (typeof speedBytesPerSec === 'number') {
        setDownloadSpeed(speedBytesPerSec);
      }
    });

    const subLog = DeviceEventEmitter.addListener('iroh-log', (event) => {
      if (!event) return;
      const msg = typeof event === 'string' ? event : (event.log || JSON.stringify(event));
      if (msg && addDevLog) {
        addDevLog(`[Iroh] ${msg}`, 'stream');
      }
    });

    return () => {
      subProgress?.remove();
      subLog?.remove();
    };
  }, [addDevLog]);

  // Parse ticket string dynamically when user types/pastes ticket
  const handleSetDownloadTicket = useCallback((ticket) => {
    setDownloadTicket(ticket);
    if (ticket && ticket.includes('#')) {
      const parts = ticket.split('#');
      if (parts[1]) setTargetFileName(parts[1].trim());
      if (parts[2]) {
        const size = parseInt(parts[2].trim(), 10);
        if (!isNaN(size) && size > 0) setTargetFileSize(size);
      }
    } else {
      setTargetFileName('');
      setTargetFileSize(0);
    }
  }, []);

  // Native file picker for Iroh sharing
  const pickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType,
        });
        setIrohTicket('');
        addDevLog(`Selected file for Iroh P2P: ${asset.name} (${asset.size} bytes)`, 'system');
      }
    } catch (err) {
      console.error('File pick error:', err);
      Alert.alert('Error', 'Failed to pick file: ' + err.message);
    }
  }, [addDevLog]);

  // Generate native Iroh ticket
  const startShare = useCallback(async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file first.');
      return;
    }

    if (!IrohModule) {
      Alert.alert('Native Module Unavailable', 'IrohModule is not linked in this build.');
      return;
    }

    setIsIrohSharing(true);
    addDevLog(`Initiating Iroh share for file: ${selectedFile.name}`, 'stream');

    try {
      const ticket = await IrohModule.startShare(selectedFile.uri);
      setIrohTicket(ticket);
      addDevLog('Iroh sharing active. Share Ticket generated!', 'stream');
    } catch (err) {
      console.error('Iroh share error:', err);
      Alert.alert('Iroh Share Error', err.message || 'Failed to start Iroh share');
      addDevLog('Iroh share failed: ' + err.message, 'error');
    } finally {
      setIsIrohSharing(false);
    }
  }, [selectedFile, addDevLog]);

  // Download file natively via Iroh QUIC tunnel
  const downloadFromIroh = useCallback(async () => {
    if (!downloadTicket.trim()) {
      Alert.alert('Error', 'Please enter or paste an Iroh ticket.');
      return;
    }

    if (!IrohModule) {
      Alert.alert('Native Module Unavailable', 'IrohModule is not linked in this build.');
      return;
    }

    setIsIrohDownloading(true);
    setDownloadProgress(0);
    setDownloadSpeed(0);
    setTransferredBytes(0);
    setDownloadedFilePath('');
    addDevLog('Connecting to Iroh peer and downloading...', 'stream');

    try {
      const savedPath = await IrohModule.download(downloadTicket.trim(), null);

      setDownloadedFilePath(savedPath);
      setDownloadProgress(100);
      addDevLog(`Iroh download finished! File saved to: ${savedPath}`, 'stream');
      Alert.alert('Download Complete', `File saved to Downloads folder:\n${savedPath}`);
    } catch (err) {
      console.error('Iroh download error:', err);
      Alert.alert('Download Error', err.message || 'Failed to download from Iroh');
      addDevLog('Iroh download failed: ' + err.message, 'error');
    } finally {
      setIsIrohDownloading(false);
    }
  }, [downloadTicket, addDevLog]);

  // Share downloaded file with Android system intent
  const shareDownloaded = useCallback(async () => {
    if (!downloadedFilePath) return;
    try {
      const shareUri = downloadedFilePath.startsWith('file://') ? downloadedFilePath : `file://${downloadedFilePath}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri);
      } else {
        Alert.alert('Sharing', 'File saved at: ' + downloadedFilePath);
      }
    } catch (err) {
      console.error('Error sharing downloaded file:', err);
      Alert.alert('Open / Share Error', err.message || 'Could not share file');
    }
  }, [downloadedFilePath]);

  // Reset sender share state
  const resetShare = useCallback(() => {
    setSelectedFile(null);
    setIrohTicket('');
    setIsIrohSharing(false);
  }, []);

  // Reset receiver download state
  const resetDownload = useCallback(() => {
    setDownloadTicket('');
    setTargetFileName('');
    setTargetFileSize(0);
    setIsIrohDownloading(false);
    setDownloadProgress(0);
    setDownloadSpeed(0);
    setTransferredBytes(0);
    setTotalBytes(0);
    setDownloadedFilePath('');
  }, []);

  return {
    // Sender state & actions
    selectedFile,
    irohTicket,
    isIrohSharing,
    pickFile,
    startShare,
    resetShare,

    // Receiver state & actions
    downloadTicket,
    targetFileName,
    targetFileSize,
    isIrohDownloading,
    downloadProgress,
    downloadSpeed,
    transferredBytes,
    totalBytes,
    downloadedFilePath,
    setDownloadTicket: handleSetDownloadTicket,
    downloadFromIroh,
    shareDownloaded,
    resetDownload,
  };
}
