import React, { useState } from 'react';
import { UploadCloud, Download, Zap, CheckCircle, Loader2, Copy, Shield, Cpu } from 'lucide-react';
import { formatBytes } from '../utils/helpers';

export function FileTransferPanel({
  selectedFile,
  onFileChange,
  onSendFile,
  senderProgress,
  senderTransferSpeed,
  isUploading,
  receiverFileMeta,
  receiverProgress,
  receiverTransferSpeed,
  isDownloading,
  fileOfferPending,
  incomingFileOffer,
  onAcceptFile,
  onRejectFile,
  chatMessages = [],
  onSendChatMessage,
  peerConnected = false,

  // Iroh Native P2P props
  irohTicket,
  isIrohSharing,
  irohSharedFilePath,
  irohSharedFileName,
  irohDownloadTicket,
  isIrohDownloading,
  irohDownloadProgress,
  irohSpeed = 0,
  irohTransferredBytes = 0,
  irohTotalBytes = 0,
  irohTargetFileName = '',
  onSetIrohDownloadTicket,
  onPickTauriFile,
  onStartIrohShare,
  onDownloadFromIroh
}) {
  const [chatInput, setChatInput] = useState('');
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  
  // Default to native Iroh transfers when inside the Tauri Desktop client!
  const [transferMode, setTransferMode] = useState(isTauri ? 'iroh' : 'webrtc');
  const [copied, setCopied] = useState(false);

  const handleCopyTicket = () => {
    if (!irohTicket) return;
    navigator.clipboard.writeText(irohTicket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="file-transfer-panel">
      <div className="file-transfer-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} style={{ color: 'var(--orange)' }} />
          <span>File Transfer Dashboard</span>
        </div>
        <span className="file-transfer-badge" style={{ background: transferMode === 'iroh' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: transferMode === 'iroh' ? '#00f2fe' : 'var(--green)', border: `1px solid ${transferMode === 'iroh' ? 'rgba(0, 242, 254, 0.25)' : 'rgba(16, 185, 129, 0.25)'}` }}>
          {transferMode === 'iroh' ? 'Iroh P2P Active' : 'WebRTC Connected'}
        </span>
      </div>

      {/* --- Native Client Switcher Tabs --- */}
      {isTauri && (
        <div className="transfer-tabs" style={{ display: 'flex', background: 'var(--bg-inset)', padding: '4px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTransferMode('iroh')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: transferMode === 'iroh' ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
              color: transferMode === 'iroh' ? '#00f2fe' : 'var(--text-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={13} />
            Iroh P2P Mode (Native)
          </button>
          <button
            onClick={() => setTransferMode('webrtc')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: transferMode === 'webrtc' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              color: transferMode === 'webrtc' ? '#fff' : 'var(--text-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Cpu size={13} />
            WebRTC Mode (Web)
          </button>
        </div>
      )}

      <div className="file-transfer-body">
        {/* ======================================================== */}
        {/* ==================== IROH TRANSFER MODE ================ */}
        {/* ======================================================== */}
        {transferMode === 'iroh' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Sender Section */}
            <div className="file-transfer-section">
              <div className="file-transfer-section-title">
                <UploadCloud size={14} />
                Natively Share a File (Iroh Protocol)
              </div>

              <div 
                className="dropzone has-file" 
                onClick={onPickTauriFile}
                style={{ cursor: 'pointer', borderStyle: irohSharedFilePath ? 'solid' : 'dashed', borderColor: irohSharedFilePath ? 'rgba(0, 242, 254, 0.3)' : 'var(--border)' }}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={28} style={{ color: irohSharedFilePath ? '#00f2fe' : 'var(--text-3)' }} />
                </div>
                {irohSharedFilePath ? (
                  <>
                    <div className="dropzone-label" style={{ wordBreak: 'break-all', padding: '0 10px' }}>{irohSharedFileName}</div>
                    <div className="dropzone-hint" style={{ fontSize: '10px', color: 'var(--text-3)' }}>{irohSharedFilePath}</div>
                  </>
                ) : (
                  <>
                    <div className="dropzone-label">Click to select file natively</div>
                    <div className="dropzone-hint">Iroh streams content securely directly from file path</div>
                  </>
                )}
              </div>

              {irohSharedFilePath && !isIrohSharing && !irohTicket && (
                <button className="btn btn-primary btn-full" onClick={onStartIrohShare} style={{ marginTop: '12px' }}>
                  <Zap size={14} />
                  Generate P2P Share Ticket
                </button>
              )}

              {isIrohSharing && !irohTicket && (
                <div className="transfer-progress-box" style={{ marginTop: '12px' }}>
                  <div className="transfer-progress-header" style={{ justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={14} className="spin" />
                    <span>Spawning Iroh Node & Encrypting...</span>
                  </div>
                </div>
              )}

              {irohTicket && (
                <div style={{ marginTop: '16px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#00f2fe' }}>Iroh Share Ticket:</span>
                    <button 
                      onClick={handleCopyTicket}
                      style={{ background: 'transparent', border: 'none', color: copied ? 'var(--green)' : 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
                    >
                      <Copy size={12} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={irohTicket}
                    style={{ width: '100%', height: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', color: 'var(--text-2)', fontSize: '10px', fontFamily: 'monospace', padding: '6px', resize: 'none' }}
                  />
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '6px', textAlign: 'center', fontStyle: 'italic' }}>
                    Send this ticket to another OxiDrop Desktop client to begin transfer.
                  </div>
                </div>
              )}
            </div>

            {/* Receiver Section */}
            <div className="file-transfer-section">
              <div className="file-transfer-section-title">
                <Download size={14} />
                Receive Natively (Iroh Protocol)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Paste Iroh Share Ticket here..."
                  value={irohDownloadTicket}
                  onChange={(e) => onSetIrohDownloadTicket(e.target.value)}
                  className="input"
                  disabled={isIrohDownloading}
                  style={{ fontSize: '12px', padding: '8px 12px' }}
                />

                {/* File Metadata Preview */}
                {irohTargetFileName && (
                  <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.15)', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      📄 {irohTargetFileName}
                    </span>
                    {irohTotalBytes > 0 && (
                      <span style={{ color: 'var(--text-3)' }}>
                        {formatBytes(irohTotalBytes)}
                      </span>
                    )}
                  </div>
                )}

                {!isIrohDownloading && (
                  <button 
                    className="btn btn-secondary btn-full" 
                    onClick={onDownloadFromIroh}
                    disabled={!irohDownloadTicket.trim()}
                  >
                    <Download size={14} />
                    Download File Natively
                  </button>
                )}

                {isIrohDownloading && (
                  <div className="transfer-progress-box">
                    <div className="transfer-progress-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Loader2 size={14} className="spin" style={{ color: '#00f2fe' }} />
                        <span style={{ fontWeight: '600', color: '#fff' }}>Downloading...</span>
                      </div>
                      <span className="transfer-progress-pct" style={{ color: '#00f2fe', fontWeight: '700' }}>
                        {irohDownloadProgress}%
                      </span>
                    </div>

                    <div className="progress-track">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${irohDownloadProgress}%`, 
                          background: 'linear-gradient(90deg, #00f2fe 0%, #0ea5e9 100%)' 
                        }} 
                      />
                    </div>

                    <div className="transfer-metrics" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-2)', marginTop: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00f2fe', fontWeight: '700' }}>
                        <Zap size={12} />
                        {irohSpeed > 0 ? `${(irohSpeed / (1024 * 1024)).toFixed(2)} MB/s` : 'Connecting...'}
                      </span>
                      <span>
                        {formatBytes(irohTransferredBytes)} {irohTotalBytes > 0 ? `/ ${formatBytes(irohTotalBytes)}` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* =================== WEBRTC TRANSFER MODE =============== */}
        {/* ======================================================== */}
        {transferMode === 'webrtc' && (
          <>
            {/* ─── Send Section ─── */}
            <div className="file-transfer-section">
              <div className="file-transfer-section-title">
                <UploadCloud size={14} />
                Send a File (WebRTC Tunnel)
              </div>

              <div className={`dropzone ${selectedFile ? 'has-file' : ''}`}>
                <input type="file" onChange={onFileChange} disabled={!peerConnected} />
                <div className="dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                {selectedFile ? (
                  <>
                    <div className="dropzone-label">{selectedFile.name}</div>
                    <div className="dropzone-hint">{formatBytes(selectedFile.size)}</div>
                  </>
                ) : (
                  <>
                    <div className="dropzone-label">
                      {peerConnected ? 'Drop file here or click to browse' : 'Please pair devices before sharing'}
                    </div>
                    <div className="dropzone-hint">
                      {peerConnected ? 'Any file type, any size' : 'Input a Room Code above to link device'}
                    </div>
                  </>
                )}
              </div>

              {selectedFile && !isUploading && !fileOfferPending && senderProgress < 100 && (
                <button className="btn btn-primary btn-full" onClick={onSendFile} style={{ marginTop: '12px' }}>
                  <Zap size={14} />
                  Send to Peer
                </button>
              )}

              {selectedFile && fileOfferPending && (
                <div className="transfer-progress-box" style={{ marginTop: '12px' }}>
                  <div className="transfer-progress-header" style={{ justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={14} className="spin" />
                    <span>Waiting for peer to accept file...</span>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="transfer-progress-box" style={{ marginTop: '12px' }}>
                  <div className="transfer-progress-header">
                    <Loader2 size={14} className="spin" />
                    <span>Sending... {senderProgress}%</span>
                    <span className="transfer-speed">{senderTransferSpeed} MB/s</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${senderProgress}%` }} />
                  </div>
                </div>
              )}

              {!isUploading && senderProgress === 100 && (
                <div className="transfer-complete-box" style={{ marginTop: '12px' }}>
                  <CheckCircle size={16} />
                  <span>File sent successfully!</span>
                </div>
              )}
            </div>

            {/* ─── Receive Section (P2P Request Cards & Downloads) ─── */}
            {incomingFileOffer && (
              <div className="file-transfer-section" style={{ marginTop: '16px' }}>
                <div className="file-transfer-section-title">
                  <Download size={14} />
                  Incoming File Request
                </div>
                <div className="file-info" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="file-info-text" style={{ marginBottom: '12px' }}>
                    <div className="file-name" style={{ fontSize: '14px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {incomingFileOffer.name}
                    </div>
                    <div className="file-size">{formatBytes(incomingFileOffer.size)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={onAcceptFile} style={{ flex: 1 }}>
                      Accept
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={onRejectFile} 
                      style={{ flex: 1, borderColor: 'var(--red)', color: 'var(--red)' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(isDownloading || (receiverFileMeta && receiverProgress > 0)) && (
              <div className="file-transfer-section" style={{ marginTop: '16px' }}>
                <div className="file-transfer-section-title">
                  <Download size={14} />
                  Receiving File
                </div>

                {receiverFileMeta && (
                  <div className="file-info" style={{ marginBottom: '12px' }}>
                    <div className="file-info-text">
                      <div className="file-name">{receiverFileMeta.fileName}</div>
                      <div className="file-size">{formatBytes(receiverFileMeta.sizeBytes)}</div>
                    </div>
                  </div>
                )}

                {isDownloading && (
                  <div className="transfer-progress-box">
                    <div className="transfer-progress-header">
                      <Loader2 size={14} className="spin" />
                      <span>Receiving... {receiverProgress}%</span>
                      <span className="transfer-speed">{receiverTransferSpeed} MB/s</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${receiverProgress}%` }} />
                    </div>
                  </div>
                )}

                {!isDownloading && receiverProgress === 100 && (
                  <div className="transfer-complete-box">
                    <CheckCircle size={16} />
                    <span>File received successfully!</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── P2P Diagnostics Chat (Real-time P2P Text Test) ─── */}
            {peerConnected && (
              <div className="file-transfer-section chat-section" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div className="file-transfer-section-title">
                  <Zap size={14} style={{ color: 'var(--orange)' }} />
                  P2P Connection Test (Real-time Chat)
                </div>
                
                <div className="chat-box" style={{ 
                  background: 'var(--bg-inset)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius)', 
                  padding: '12px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '10px'
                }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                      No messages yet. Send a test message to verify the P2P connection!
                    </div>
                  ) : (
                    chatMessages.map((m, idx) => (
                      <div key={idx} style={{ 
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: m.senderId === 'You' ? 'flex-end' : 'flex-start'
                      }}>
                        <div style={{ display: 'flex', gap: '6px', color: 'var(--text-3)', marginBottom: '2px', fontSize: '9px' }}>
                          <strong>{m.senderId}</strong>
                          <span>[{m.time}]</span>
                        </div>
                        <div style={{ 
                          background: m.senderId === 'You' ? 'var(--accent)' : 'var(--bg-hover)', 
                          color: m.senderId === 'You' ? '#fff' : 'var(--text)', 
                          padding: '6px 10px', 
                          borderRadius: 'var(--radius)',
                          maxWidth: '80%',
                          wordBreak: 'break-all'
                        }}>
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Type a test message..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatInput.trim()) {
                        onSendChatMessage(chatInput);
                        setChatInput('');
                      }
                    }}
                    className="input"
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (chatInput.trim()) {
                        onSendChatMessage(chatInput);
                        setChatInput('');
                      }
                    }}
                    disabled={!chatInput.trim()}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
