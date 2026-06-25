import React from 'react';
import { Activity, Cpu } from 'lucide-react';

export function TelemetryPanel({
  isTransferring,
  transferMode,
  fileName,
  progress,
  speed
}) {
  return (
    <div className="card w-full flex flex-col justify-between mt-6">
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-main)] mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Data Connection Telemetry
        </h3>

        {isTransferring ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between text-xs text-left">
              <span className="text-[var(--text-muted)] truncate max-w-[250px] md:max-w-md">
                {transferMode === 'upload' ? 'Sending: ' : 'Receiving: '} <strong>{fileName}</strong>
              </span>
              <span className="text-[var(--text-main)] font-mono font-bold">{progress}%</span>
            </div>
            
            {/* Minimal progress meter */}
            <div className="progress-container">
              <div className="progress-track">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>Transfer Rate: <span className="text-[var(--text-main)] font-mono font-semibold">{speed} MB/s</span></span>
              <span>Tunnel type: WebRTC SCTP Direct</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-[var(--text-muted)]">
            <p className="text-[11px]">No active transfer socket streams.</p>
          </div>
        )}
      </div>

      {isTransferring && (
        <div className="mt-4 p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)] text-[9px] text-[var(--text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-[var(--text-muted)]" /> SCTP congestion flow control active</span>
          <span className="text-[var(--text-main)] font-semibold font-mono animate-pulse">STREAMING P2P</span>
        </div>
      )}
    </div>
  );
}
