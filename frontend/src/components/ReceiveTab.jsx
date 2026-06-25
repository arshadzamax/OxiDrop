import React from 'react';
import { FileText, Loader2, CheckCircle, ArrowRight } from 'lucide-react';

export function ReceiveTab({
  fileIdInput,
  setFileIdInput,
  receiverFileMeta,
  isFetchingMeta,
  handleFetchMetadata,
  requestStatus,
  handleRequestAccess,
  formatBytes
}) {
  return (
    <>
      {/* ─── Main panel ─── */}
      <div className="panel panel-main">
        <h2 className="panel-title">Receive a file</h2>
        <p className="panel-desc">Enter the share ID to look up file details and request a direct transfer.</p>

        <div className="input-group">
          <input
            type="text"
            placeholder="Paste share ID"
            value={fileIdInput}
            onChange={(e) => setFileIdInput(e.target.value)}
            className="input"
            onKeyDown={(e) => e.key === 'Enter' && handleFetchMetadata()}
          />
          <button className="btn btn-primary" onClick={handleFetchMetadata} disabled={isFetchingMeta || !fileIdInput.trim()}>
            {isFetchingMeta ? <Loader2 size={14} className="spin" /> : 'Lookup'}
          </button>
        </div>

        {receiverFileMeta && (
          <div className="file-info" style={{ marginTop: '20px' }}>
            <FileText size={18} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            <div className="file-info-text">
              <div className="file-name">{receiverFileMeta.fileName}</div>
              <div className="file-size">{formatBytes(receiverFileMeta.sizeBytes)}</div>
            </div>

            {requestStatus === '' && (
              <button className="btn btn-primary" onClick={handleRequestAccess} style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                Request <ArrowRight size={12} />
              </button>
            )}

            {requestStatus === 'PENDING' && (
              <span className="badge badge-pending"><Loader2 size={12} className="spin" /> Pending</span>
            )}

            {requestStatus === 'APPROVED' && (
              <span className="badge badge-approved"><CheckCircle size={12} /> Approved</span>
            )}
          </div>
        )}

        {receiverFileMeta && (
          <div className="meta-card" style={{ marginTop: '12px' }}>
            <div className="meta-row">
              <span className="meta-key">Host</span>
              <span className="meta-val">{receiverFileMeta.senderId}</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">Auto-approve</span>
              <span className="meta-val">{receiverFileMeta.autoApprove ? 'Yes' : 'No'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Sidebar: Info ─── */}
      <div className="panel">
        <div className="sidebar-section">
          <div className="sidebar-title">How it works</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.7' }}>
            <p style={{ marginBottom: '10px' }}>
              OxiDrop uses WebRTC to stream files directly between devices. No cloud storage is involved.
            </p>
            <p>
              The sender must be online and approve your request. Once approved, a peer-to-peer tunnel is established automatically.
            </p>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">Connection details</div>
          <div className="meta-card">
            <div className="meta-row">
              <span className="meta-key">NAT</span>
              <span className="meta-val">STUN</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">Negotiation</span>
              <span className="meta-val">Vanilla SDP</span>
            </div>
            <div className="meta-row">
              <span className="meta-key">Encryption</span>
              <span className="meta-val">DTLS / SCTP</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
