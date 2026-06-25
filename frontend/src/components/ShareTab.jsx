import React from 'react';
import { UploadCloud, Zap, CheckCircle, Copy, Check, Loader2 } from 'lucide-react';

export function ShareTab({
  selectedFile,
  handleFileChange,
  registeredFileId,
  isRegistering,
  handleRegisterFile,
  copied,
  copyToClipboard,
  senderRequests,
  handleApproveRequest,
  formatBytes
}) {
  return (
    <>
      {/* ─── Main panel ─── */}
      <div className="panel panel-main">
        <h2 className="panel-title">Share a file</h2>
        <p className="panel-desc">Select a file. It streams directly from your device — nothing is uploaded.</p>

        <div className={`dropzone ${selectedFile ? 'has-file' : ''}`}>
          <input type="file" onChange={handleFileChange} />
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

        {selectedFile && !registeredFileId && (
          <button className="btn btn-primary btn-full" onClick={handleRegisterFile} disabled={isRegistering}>
            {isRegistering ? <><Loader2 size={14} className="spin" /> Registering…</> : <><Zap size={14} /> Create share link</>}
          </button>
        )}

        {registeredFileId && (
          <div className="share-id-box">
            <div className="share-id-label">
              <CheckCircle size={12} /> Ready to transfer
            </div>
            <div className="share-id-row">
              <input type="text" readOnly value={registeredFileId} className="share-id-input" />
              <button onClick={copyToClipboard} className="copy-btn">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="share-id-hint">Share this ID with the recipient</div>
          </div>
        )}
      </div>

      {/* ─── Sidebar: Incoming requests ─── */}
      <div className="panel">
        <div className="sidebar-section">
          <div className="sidebar-title">
            Requests
            <span className="sidebar-count">{senderRequests.length}</span>
          </div>

          {senderRequests.length > 0 ? (
            senderRequests.map((req) => (
              <div key={req.requestId} className="mailbox-item">
                <div>
                  <div className="mailbox-peer">{req.receiverId}</div>
                  <div className="mailbox-meta">{formatBytes(req.sizeBytes || 0)}</div>
                </div>
                <button className="btn btn-primary" onClick={() => handleApproveRequest(req)} style={{ padding: '5px 12px', fontSize: '12px' }}>
                  Approve
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">No pending requests</div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">Protocol</div>
          <div className="meta-card">
            <div className="meta-row">
              <span className="meta-key">Transport</span>
              <span className="meta-val">WebRTC SCTP</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">NAT</span>
              <span className="meta-val">STUN</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">Encryption</span>
              <span className="meta-val">DTLS 1.2</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
