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
      {/* Search and Metadata Lookup Card */}
      <div className="md:col-span-3 glass-panel p-6 flex flex-col justify-between min-h-[350px]">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" /> Retrieve Shared File
          </h3>
          <p className="text-xs text-slate-400 mb-6">Enter a File ID to lookup metadata and request secure direct download over WebRTC.</p>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter 12-character File ID"
              value={fileIdInput}
              onChange={(e) => setFileIdInput(e.target.value)}
              className="flex-1 px-4 py-3 text-sm"
            />
            <button 
              onClick={handleFetchMetadata}
              disabled={isFetchingMeta}
              className="secondary font-semibold"
            >
              {isFetchingMeta ? <Loader className="w-4 h-4 animate-spin" /> : 'Lookup'}
            </button>
          </div>

          {receiverFileMeta && (
            <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{receiverFileMeta.fileName}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(receiverFileMeta.sizeBytes)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-2 pt-4 border-t border-white/5">
                <span className="text-slate-400">Hosting Peer: <span className="text-indigo-300 font-mono">{receiverFileMeta.senderId}</span></span>
                
                {requestStatus === '' && (
                  <button 
                    className="primary py-2 px-4 text-xs pulse-glow-indigo"
                    onClick={handleRequestAccess}
                  >
                    Request File Access
                  </button>
                )}
                
                {requestStatus === 'PENDING' && (
                  <span className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                    <Loader className="w-3.5 h-3.5 animate-spin" /> Awaiting approval
                  </span>
                )}

                {requestStatus === 'APPROVED' && (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Approved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!receiverFileMeta && (
          <div className="mt-6 border border-white/5 bg-black/10 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-indigo-400/80" />
            <p className="text-xs text-slate-400 text-left">P2P downloads require the sender's daemon or web app to approve the connection.</p>
          </div>
        )}
      </div>
      
      {/* Visual Spacer / Context Cards */}
      <div className="md:col-span-2 glass-panel p-6 flex flex-col justify-between text-left text-xs text-slate-400 min-h-[350px]">
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Retrieve Protocol details</h4>
          <p className="mb-4">Downloads bypass server hosting entirely. Data streams directly from the sender's computer browser or daemon over UDP.</p>
          
          <ul className="flex flex-col gap-2 bg-white/5 border border-white/5 p-4 rounded-xl list-none font-mono text-[10px]">
            <li className="flex justify-between border-b border-white/5 pb-1">
              <span>NAT Traversal:</span>
              <span className="text-indigo-300">STUN Gathered</span>
            </li>
            <li className="flex justify-between border-b border-white/5 pb-1">
              <span>Negotiation:</span>
              <span className="text-indigo-300">Vanilla SDP</span>
            </li>
            <li className="flex justify-between">
              <span>Channel encryption:</span>
              <span className="text-indigo-300">DTLS / SCTP</span>
            </li>
          </ul>
        </div>

        <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl text-[10px]">
          <span className="text-indigo-300 font-semibold">Protip:</span> You can download files hosted from the Rust Daemon terminal client using the browser client seamlessly.
        </div>
      </div>
    </div>
  );
}
