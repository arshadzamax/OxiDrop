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
import { Header } from './src/components/Header';
import { ConnectionPanel } from './src/components/ConnectionPanel';
import { FileTransferPanel } from './src/components/FileTransferPanel';
import { DeveloperConsole } from './src/components/DeveloperConsole';
import { QRModal } from './src/components/QRModal';
import { QRScannerModal } from './src/components/QRScannerModal';

export default function App() {
  const [theme, setTheme] = useState('dark');
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

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.appContainer} keyboardShouldPersistTaps="handled">
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
});
