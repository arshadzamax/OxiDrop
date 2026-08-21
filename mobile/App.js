import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { getThemeColors } from './src/theme/colors';
import { useOxiDropMobile } from './src/hooks/useOxiDropMobile';
import { useIrohMobile } from './src/hooks/useIrohMobile';
import { Header } from './src/components/Header';
import { ConnectionPanel } from './src/components/ConnectionPanel';
import { FileTransferPanel } from './src/components/FileTransferPanel';
import { IrohTransferPanel } from './src/components/IrohTransferPanel';
import { DeveloperConsole } from './src/components/DeveloperConsole';
import { QRModal } from './src/components/QRModal';
import { QRScannerModal } from './src/components/QRScannerModal';
import { Pressable, Text } from 'react-native';
import { Shield, Cpu } from 'lucide-react-native';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [activeProtocol, setActiveProtocol] = useState('iroh');
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);

  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const {
    userId,
    socketConnected,
    devLogs,
    roomCode,
    isHost,
    peerConnected,
    peerId,
    chatMessages,

    // Multi-file selection & sender
    selectedFiles,
    selectedFile,
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
    removeSelectedFile,
    clearSelectedFiles,
    sendFileOffer,
    acceptFileOffer,
    rejectFileOffer,
    sendChatMessage,
    shareDownloadedFile,
    shareFile,
  } = useOxiDropMobile();

  // Native Iroh P2P state & actions
  const iroh = useIrohMobile();

  return (
    <View style={[styles.rootSafeArea, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      <View style={{ flex: 1 }}>
        <Header
          colors={colors}
          socketConnected={socketConnected}
          userId={userId}
          isDark={isDark}
          toggleTheme={toggleTheme}
          showDevConsole={showDevConsole}
          setShowDevConsole={setShowDevConsole}
        />

        {/* ─── Protocol Switcher Bar ─── */}
        <View style={[styles.protocolTabBar, { backgroundColor: colors.bgInset, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setActiveProtocol('iroh')}
            style={[
              styles.protocolTab,
              activeProtocol === 'iroh' && { backgroundColor: 'rgba(0, 242, 254, 0.12)', borderColor: 'rgba(0, 242, 254, 0.3)' },
            ]}
          >
            <Shield size={14} color={activeProtocol === 'iroh' ? '#00f2fe' : colors.textSecondary} />
            <Text
              style={[
                styles.protocolTabText,
                { color: activeProtocol === 'iroh' ? '#00f2fe' : colors.textSecondary, fontWeight: activeProtocol === 'iroh' ? '700' : '500' },
              ]}
            >
              Iroh P2P (Native)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveProtocol('webrtc')}
            style={[
              styles.protocolTab,
              activeProtocol === 'webrtc' && { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' },
            ]}
          >
            <Cpu size={14} color={activeProtocol === 'webrtc' ? '#fff' : colors.textSecondary} />
            <Text
              style={[
                styles.protocolTabText,
                { color: activeProtocol === 'webrtc' ? '#fff' : colors.textSecondary, fontWeight: activeProtocol === 'webrtc' ? '700' : '500' },
              ]}
            >
              WebRTC (Universal)
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.appContainer} keyboardShouldPersistTaps="handled">
            {activeProtocol === 'iroh' ? (
              <IrohTransferPanel
                colors={colors}
                selectedFile={iroh.selectedFile}
                irohTicket={iroh.irohTicket}
                isIrohSharing={iroh.isIrohSharing}
                onPickFile={iroh.pickFile}
                onStartShare={iroh.startShare}
                downloadTicket={iroh.downloadTicket}
                targetFileName={iroh.targetFileName}
                targetFileSize={iroh.targetFileSize}
                isIrohDownloading={iroh.isIrohDownloading}
                downloadProgress={iroh.downloadProgress}
                downloadSpeed={iroh.downloadSpeed}
                transferredBytes={iroh.transferredBytes}
                totalBytes={iroh.totalBytes}
                downloadedFilePath={iroh.downloadedFilePath}
                onSetDownloadTicket={iroh.setDownloadTicket}
                onDownloadFromIroh={iroh.downloadFromIroh}
                onShareDownloaded={iroh.shareDownloaded}
                onResetShare={iroh.resetShare}
                onResetDownload={iroh.resetDownload}
              />
            ) : (
              <>
                <ConnectionPanel
                  colors={colors}
                  socketConnected={socketConnected}
                  roomCode={roomCode}
                  isHost={isHost}
                  peerConnected={peerConnected}
                  peerId={peerId}
                  onCreateRoom={createRoom}
                  onJoinRoom={joinRoom}
                  onLeaveRoom={leaveRoom}
                  onShowQR={() => setShowQRModal(true)}
                  onShowQRScanner={() => setShowQRScannerModal(true)}
                />

                {peerConnected && (
                  <FileTransferPanel
                    colors={colors}
                    selectedFiles={selectedFiles}
                    selectedFile={selectedFile}
                    onPickFiles={pickFiles}
                    onRemoveSelectedFile={removeSelectedFile}
                    onClearSelectedFiles={clearSelectedFiles}
                    onSendFileOffer={sendFileOffer}
                    isUploading={isUploading}
                    senderProgress={senderProgress}
                    senderBatchProgress={senderBatchProgress}
                    senderCurrentFile={senderCurrentFile}
                    senderTransferSpeed={senderTransferSpeed}
                    incomingFileOffer={incomingFileOffer}
                    onAcceptFileOffer={acceptFileOffer}
                    onRejectFileOffer={rejectFileOffer}
                    isDownloading={isDownloading}
                    receiverProgress={receiverProgress}
                    receiverBatchProgress={receiverBatchProgress}
                    receiverTransferSpeed={receiverTransferSpeed}
                    receivedFiles={receivedFiles}
                    onShareFile={shareFile}
                    shareDownloadedFile={shareDownloadedFile}
                    receiverFileMeta={receiverFileMeta}
                    chatMessages={chatMessages}
                    onSendChatMessage={sendChatMessage}
                  />
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <QRModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        roomCode={roomCode}
        colors={colors}
      />

      <QRScannerModal
        visible={showQRScannerModal}
        onClose={() => setShowQRScannerModal(false)}
        onJoinRoom={joinRoom}
        colors={colors}
      />

      <DeveloperConsole
        visible={showDevConsole}
        onClose={() => setShowDevConsole(false)}
        colors={colors}
        socketConnected={socketConnected}
        roomCode={roomCode}
        isHost={isHost}
        peerId={peerId}
        peerConnected={peerConnected}
        isUploading={isUploading}
        isDownloading={isDownloading}
        devLogs={devLogs}
        webrtcStats={webrtcStats}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootSafeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0,
  },
  appContainer: {
    padding: 14,
    paddingBottom: 24,
  },
  protocolTabBar: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  protocolTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  protocolTabText: {
    fontSize: 12,
  },
});

