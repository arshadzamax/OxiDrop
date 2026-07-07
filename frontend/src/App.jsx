import React, { useState } from 'react';
import './App.css';

import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { ConnectionPanel } from './components/ConnectionPanel';
import { FileTransferPanel } from './components/FileTransferPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { DeveloperConsole } from './components/DeveloperConsole';
import { useOxiDrop } from './hooks/useOxiDrop';

function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'app'
  const [showConsole, setShowConsole] = useState(false);

  const {
    userId,
    socketConnected,
    theme,
    toggleTheme,
    roomCode,
    isHost,
    peerConnected,
    peerId,
    connectionError,
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
    webrtcStats,
    devLogs,
    clearDevLogs,
    notifications,
    createRoom,
    joinRoom,
    leaveRoom,
    handleFileChange,
    sendFile,
    acceptIncomingFile,
    rejectIncomingFile,
    chatMessages,
    sendChatMessage
  } = useOxiDrop();

  if (view === 'landing') {
    return <LandingPage onLaunch={() => setView('app')} />;
  }

  return (
    <div className={`app ${showConsole ? 'console-open' : ''}`}>
      <Header
        socketConnected={socketConnected}
        userId={userId}
        theme={theme}
        toggleTheme={toggleTheme}
        showConsole={showConsole}
        setShowConsole={setShowConsole}
        onGoHome={() => setView('landing')}
      />

      {/* Floating non-blocking custom SnackBar/Toast alerts */}
      <div className="toast-container">
        {notifications.map(n => (
          <div key={n.id} className={`toast toast-${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>

      <main className="main">
        <div className="content">
          <div className="content-inner">
            <ConnectionPanel
              socketConnected={socketConnected}
              roomCode={roomCode}
              isHost={isHost}
              peerConnected={peerConnected}
              peerId={peerId}
              connectionError={connectionError}
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
              onLeaveRoom={leaveRoom}
            />

            {peerConnected && (
              <FileTransferPanel
                selectedFile={selectedFile}
                onFileChange={handleFileChange}
                onSendFile={sendFile}
                senderProgress={senderProgress}
                senderTransferSpeed={senderTransferSpeed}
                isUploading={isUploading}
                receiverFileMeta={receiverFileMeta}
                receiverProgress={receiverProgress}
                receiverTransferSpeed={receiverTransferSpeed}
                isDownloading={isDownloading}
                fileOfferPending={fileOfferPending}
                incomingFileOffer={incomingFileOffer}
                onAcceptFile={acceptIncomingFile}
                onRejectFile={rejectIncomingFile}
                chatMessages={chatMessages}
                onSendChatMessage={sendChatMessage}
              />
            )}
          </div>
        </div>
      </main>

      {showConsole && (
        <DeveloperConsole
          logs={devLogs}
          onClear={clearDevLogs}
          onClose={() => setShowConsole(false)}
          socketConnected={socketConnected}
          roomCode={roomCode}
          isHost={isHost}
          peerId={peerId}
          peerConnected={peerConnected}
          webrtcStats={webrtcStats}
          isUploading={isUploading}
          isDownloading={isDownloading}
        />
      )}

      <TelemetryPanel
        isTransferring={isUploading || isDownloading}
        transferMode={isUploading ? 'upload' : 'download'}
        fileName={isUploading ? selectedFile?.name : receiverFileMeta?.fileName}
        progress={isUploading ? senderProgress : receiverProgress}
        speed={isUploading ? senderTransferSpeed : receiverTransferSpeed}
        totalSize={isUploading ? selectedFile?.size : receiverFileMeta?.sizeBytes}
        webrtcStats={webrtcStats}
      />
    </div>
  );
}

export default App;
