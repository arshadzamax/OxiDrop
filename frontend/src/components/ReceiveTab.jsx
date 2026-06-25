import React from 'react';
import { Download, Loader, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* File Lookup Card */}
      <div className="md:col-span-3 card flex flex-col justify-between min-h-[350px]">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-main)] mb-1 flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--text-muted)]" /> Retrieve Shared File
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] mb-5">Enter a File ID to lookup metadata and request secure direct download over WebRTC.</p>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter File ID"
              value={fileIdInput}
              onChange={(e) => setFileIdInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs"
            />
            <button 
              onClick={handleFetchMetadata}
              disabled={isFetchingMeta}
              className="secondary font-semibold py-2 px-4"
            >
              {isFetchingMeta ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
            </button>
          </div>

          {receiverFileMeta && (
            <div className="mt-6 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border)]">
                  <FileText className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h4 className="text-xs font-semibold text-[var(--text-main)] truncate">{receiverFileMeta.fileName}</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{formatBytes(receiverFileMeta.sizeBytes)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] mt-2 pt-3 border-t border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Hosting Peer: <span className="text-[var(--text-main)] font-mono">{receiverFileMeta.senderId}</span></span>
                
                {requestStatus === '' && (
                  <button 
                    className="primary py-1.5 px-3 text-xs"
                    onClick={handleRequestAccess}
                  >
                    Request Access
                  </button>
                )}
                
                {requestStatus === 'PENDING' && (
                  <span className="flex items-center gap-2 text-amber-500 font-semibold">
                    <Loader className="w-3 h-3 animate-spin" /> Awaiting approval
                  </span>
                )}

                {requestStatus === 'APPROVED' && (
                  <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Approved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!receiverFileMeta && (
          <div className="mt-5 border border-[var(--border)] bg-[var(--bg-input)] rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-[var(--text-muted)]" />
            <p className="text-[11px] text-[var(--text-muted)] text-left">P2P downloads require the sender's daemon or web app to approve the connection.</p>
          </div>
        )}
      </div>
      
      {/* Context Details Card */}
      <div className="md:col-span-2 card flex flex-col justify-between text-left text-xs text-[var(--text-muted)] min-h-[350px]">
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-main)] mb-2">Direct Peer Delivery</h4>
          <p className="mb-4 text-[11px]">Downloads bypass cloud hosting entirely. Data streams directly from the sender's device over UDP.</p>
          
          <ul className="flex flex-col gap-2 bg-[var(--bg-input)] border border-[var(--border)] p-4 rounded-xl list-none font-mono text-[9px] w-full">
            <li className="flex justify-between border-b border-[var(--border)] pb-1 w-full">
              <span>NAT Traversal:</span>
              <span className="text-[var(--text-main)]">STUN Server</span>
            </li>
            <li className="flex justify-between border-b border-[var(--border)] pb-1 w-full">
              <span>Negotiation:</span>
              <span className="text-[var(--text-main)]">Vanilla SDP</span>
            </li>
            <li className="flex justify-between w-full">
              <span>Encryption:</span>
              <span className="text-[var(--text-main)]">DTLS / SCTP</span>
            </li>
          </ul>
        </div>

        <div className="bg-[var(--bg-input)] border border-[var(--border)] p-3 rounded-lg text-[10px] text-center w-full">
          <span className="text-[var(--text-main)] font-semibold">Protip:</span> You can retrieve files hosted from the Rust Daemon terminal client.
        </div>
      </div>
    </div>
  );
}
