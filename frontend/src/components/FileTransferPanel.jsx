import React, { useState } from 'react';
import { UploadCloud, Download, Zap, CheckCircle, Loader2 } from 'lucide-react';
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
  onSendChatMessage
}) {
  const [chatInput, setChatInput] = useState('');
  return (
    <div className="file-transfer-panel">
      <div className="file-transfer-header">
        <Zap size={16} />
        <span>File Transfer</span>
        <span className="file-transfer-badge">P2P Active</span>
      </div>

      <div className="file-transfer-body">
        {/* ─── Send Section ─── */}
        <div className="file-transfer-section">
          <div className="file-transfer-section-title">
            <UploadCloud size={14} />
            Send a File
          </div>

          <div className={`dropzone ${selectedFile ? 'has-file' : ''}`}>
            <input type="file" onChange={onFileChange} />
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
                <div className="dropzone-label">Drop file here or click to browse</div>
                <div className="dropzone-hint">Any file type, any size</div>
              </>
            )}
          </div>

          {selectedFile && !isUploading && !fileOfferPending && senderProgress < 100 && (
            <button className="btn btn-primary btn-full" onClick={onSendFile}>
              <Zap size={14} />
              Send to Peer
            </button>
          )}

          {selectedFile && fileOfferPending && (
            <div className="transfer-progress-box">
              <div className="transfer-progress-header" style={{ justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={14} className="spin" />
                <span>Waiting for peer to accept file...</span>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="transfer-progress-box">
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
            <div className="transfer-complete-box">
              <CheckCircle size={16} />
              <span>File sent successfully!</span>
            </div>
          )}
        </div>

        {/* ─── Receive Section (P2P Request Cards & Downloads) ─── */}
        {incomingFileOffer && (
          <div className="file-transfer-section">
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
          <div className="file-transfer-section">
            <div className="file-transfer-section-title">
              <Download size={14} />
              Receiving File
            </div>

            {receiverFileMeta && (
              <div className="file-info">
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
      </div>
    </div>
  );
}
