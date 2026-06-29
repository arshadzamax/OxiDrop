import React, { useState } from 'react';
import { ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import './App.css';

import { Header } from './components/Header';
import { ShareTab } from './components/ShareTab';
import { ReceiveTab } from './components/ReceiveTab';
import { TelemetryPanel } from './components/TelemetryPanel';
import { DeveloperConsole } from './components/DeveloperConsole';
import { useOxiDrop } from './hooks/useOxiDrop';
import { formatBytes } from './utils/helpers';

function App() {
  const [activeTab, setActiveTab] = useState('share');
  const [showConsole, setShowConsole] = useState(false);
  
  const {
    userId,
    socketConnected,
    theme,
    toggleTheme,
    selectedFile,
    registeredFileId,
    copied,
    senderRequests,
    senderProgress,
    senderTransferSpeed,
    isUploading,
    fileIdInput,
    setFileIdInput,
    receiverFileMeta,
    isFetchingMeta,
    requestStatus,
    receiverProgress,
    receiverTransferSpeed,
    isDownloading,
    webrtcStats,
    devLogs,
    clearDevLogs,
    handleApproveRequest,
    handleFileChange,
    handleRegisterFile,
    copyToClipboard,
    handleFetchMetadata,
    handleRequestAccess,
    notifications
  } = useOxiDrop();

  return (
    <div className={`app ${showConsole ? 'console-open' : ''}`}>
      <Header 
        socketConnected={socketConnected} 
        userId={userId} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        showConsole={showConsole} 
        setShowConsole={setShowConsole} 
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
        <div className="tabs">
          <button className={`tab ${activeTab === 'share' ? 'active' : ''}`} onClick={() => setActiveTab('share')}>
            <ArrowUpFromLine size={14} /> Send
          </button>
          <button className={`tab ${activeTab === 'receive' ? 'active' : ''}`} onClick={() => setActiveTab('receive')}>
            <ArrowDownToLine size={14} /> Receive
          </button>
        </div>

        <div className="content">
          {activeTab === 'share' ? (
            <ShareTab
              selectedFile={selectedFile} handleFileChange={handleFileChange}
              registeredFileId={registeredFileId} isRegistering={false}
              handleRegisterFile={handleRegisterFile} copied={copied}
              copyToClipboard={copyToClipboard} senderRequests={senderRequests}
              handleApproveRequest={handleApproveRequest} formatBytes={formatBytes}
            />
          ) : (
            <ReceiveTab
              fileIdInput={fileIdInput} setFileIdInput={setFileIdInput}
              receiverFileMeta={receiverFileMeta} isFetchingMeta={isFetchingMeta}
              handleFetchMetadata={handleFetchMetadata} requestStatus={requestStatus}
              handleRequestAccess={handleRequestAccess} formatBytes={formatBytes}
            />
          )}
        </div>
      </main>
      {showConsole && (
        <DeveloperConsole
          logs={devLogs}
          onClear={clearDevLogs}
          onClose={() => setShowConsole(false)}
          socketConnected={socketConnected}
          activeTab={activeTab}
          selectedFile={selectedFile}
          registeredFileId={registeredFileId}
          senderRequests={senderRequests}
          receiverFileMeta={receiverFileMeta}
          requestStatus={requestStatus}
          webrtcStats={webrtcStats}
          isUploading={isUploading}
          isDownloading={isDownloading}
          fileIdInput={fileIdInput}
        />
      )}

      <TelemetryPanel
        isTransferring={activeTab === 'share' ? isUploading : isDownloading}
        transferMode={activeTab === 'share' ? 'upload' : 'download'}
        fileName={activeTab === 'share' ? selectedFile?.name : receiverFileMeta?.fileName}
        progress={activeTab === 'share' ? senderProgress : receiverProgress}
        speed={activeTab === 'share' ? senderTransferSpeed : receiverTransferSpeed}
        totalSize={activeTab === 'share' ? selectedFile?.size : receiverFileMeta?.sizeBytes}
        webrtcStats={webrtcStats}
      />
    </div>
  );
}

export default App;
