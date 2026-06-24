import React from 'react';
import { UploadCloud, FileText, Loader, Zap, CheckCircle, Copy, Check, Server } from 'lucide-react';

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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* File Select & Upload Card */}
      <div className="md:col-span-3 glass-panel p-6 flex flex-col justify-between min-h-[350px]">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-400" /> Share Local File
          </h3>
          <p className="text-xs text-slate-400 mb-6">Select a file to host. It will be streamed directly from your device memory to the receiver.</p>
          
          <div className="relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-black/20 hover:bg-black/30 transition group">
            <input 
              type="file" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-indigo-500/5 rounded-full border border-indigo-500/10 group-hover:scale-110 transition duration-300">
                <FileText className="w-8 h-8 text-indigo-400" />
              </div>
              {selectedFile ? (
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium text-white max-w-xs truncate mx-auto">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-200">Drag & drop files, or <span className="text-indigo-400 hover:underline">browse</span></p>
                  <p className="text-xs text-slate-500 mt-1">Supports any file format (unlimited size)</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedFile && !registeredFileId && (
          <button 
            className="primary w-full mt-6 pulse-glow-indigo"
            onClick={handleRegisterFile}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Registering...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" /> Register for Sharing
              </>
            )}
          </button>
        )}

        {registeredFileId && (
          <div className="mt-6 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle className="w-4 h-4" /> FILE IS READY FOR DOWNLOAD
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={registeredFileId}
                className="flex-1 bg-black/40 border border-white/10 px-3 py-2 rounded-lg text-sm text-indigo-300 font-mono text-center"
              />
              <button 
                onClick={copyToClipboard}
                className="secondary py-2 px-3 border-none bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center">Share this File ID with a browser recipient or standard Rust daemon</p>
          </div>
        )}
      </div>

      {/* Approvals Mailbox Card */}
      <div className="md:col-span-2 glass-panel p-6 flex flex-col justify-start max-h-[350px] overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" /> Request Mailbox ({senderRequests.length})
        </h3>

        {senderRequests.length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            {senderRequests.map((req) => (
              <div key={req.requestId} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 w-full">
                <div className="text-left text-[11px] min-w-0 flex-1 mr-2">
                  <p className="text-slate-300 font-semibold truncate max-w-[130px]">Peer: {req.receiverId}</p>
                  <p className="text-slate-500">{formatBytes(req.sizeBytes)}</p>
                </div>
                <button 
                  className="success py-1.5 px-3 text-xs shrink-0"
                  onClick={() => handleApproveRequest(req)}
                >
                  Approve P2P
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 text-center py-8 w-full">No pending requests. Share your ID to receive requests here.</p>
        )}
      </div>
    </div>
  );
}
