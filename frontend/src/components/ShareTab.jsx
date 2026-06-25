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
      {/* File Dropzone Panel */}
      <div className="md:col-span-3 card flex flex-col justify-between min-h-[350px]">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-main)] mb-1 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[var(--text-muted)]" /> Share Local File
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] mb-5">Select a file to host. It will be streamed directly from your device memory.</p>
          
          <div className="relative border border-[var(--border)] rounded-xl p-8 text-center bg-[var(--bg-input)] hover:bg-[var(--bg-card)] transition group">
            <input 
              type="file" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] group-hover:scale-105 transition duration-300">
                <FileText className="w-6 h-6 text-[var(--text-muted)]" />
              </div>
              {selectedFile ? (
                <div className="mt-1 text-center">
                  <p className="text-xs font-semibold text-[var(--text-main)] max-w-xs truncate mx-auto">{selectedFile.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-[var(--text-main)]">Drag & drop files here, or <span className="text-[var(--text-muted)] underline cursor-pointer">browse</span></p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Supports any file size</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedFile && !registeredFileId && (
          <button 
            className="primary w-full mt-5"
            onClick={handleRegisterFile}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Registering...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Register File
              </>
            )}
          </button>
        )}

        {registeredFileId && (
          <div className="mt-5 border border-[var(--border)] bg-[var(--bg-input)] p-4 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> FILE IS READY FOR P2P TRANSFER
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={registeredFileId}
                className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 rounded-lg text-xs text-[var(--text-main)] font-mono text-center"
              />
              <button 
                onClick={copyToClipboard}
                className="secondary py-2 px-3 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-card)]"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] text-center">Share this File ID with a recipient</p>
          </div>
        )}
      </div>

      {/* Connection Mailbox */}
      <div className="md:col-span-2 card flex flex-col justify-start max-h-[350px] overflow-y-auto">
        <h3 className="text-xs font-semibold text-[var(--text-main)] mb-3 flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Incoming Mailbox ({senderRequests.length})
        </h3>

        {senderRequests.length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            {senderRequests.map((req) => (
              <div key={req.requestId} className="flex items-center justify-between bg-[var(--bg-input)] p-3 rounded-lg border border-[var(--border)] w-full">
                <div className="text-left text-[10px] min-w-0 flex-1 mr-2">
                  <p className="text-[var(--text-main)] font-semibold truncate">Peer: {req.receiverId}</p>
                  <p className="text-[var(--text-muted)] mt-0.5">{formatBytes(req.sizeBytes)}</p>
                </div>
                <button 
                  className="primary py-1.5 px-3 text-[11px] shrink-0"
                  onClick={() => handleApproveRequest(req)}
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[var(--text-muted)] text-center py-8 w-full">No active file transfer requests.</p>
        )}
      </div>
    </div>
  );
}
