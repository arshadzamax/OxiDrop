import React from 'react';
import { Activity, Zap, Cpu } from 'lucide-react';

export function TelemetryPanel({
  isTransferring,
  transferMode, // 'upload' | 'download'
  fileName,
  progress,
  speed
}) {
  return (
    <div className="glass-panel p-6 w-full flex flex-col justify-between mt-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" /> Live Data Stream Telemetry
        </h3>

        {isTransferring ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between text-xs text-left">
              <span className="text-slate-400 truncate max-w-[250px] md:max-w-md">
                {transferMode === 'upload' ? 'Sending: ' : 'Receiving: '} <strong>{fileName}</strong>
              </span>
              <span className="text-indigo-400 font-mono font-bold">{progress}%</span>
            </div>
            
            {/* Live Progress Bar */}
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Transfer Speed: <span className="text-emerald-400 font-mono font-bold">{speed} MB/s</span></span>
              <span>Link type: Direct P2P Tunnel</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <Zap className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs">No active transfer socket streams</p>
          </div>
        )}
      </div>

      {isTransferring && (
        <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> SCTP congestion window active</span>
          <span className="text-emerald-400 font-semibold font-mono animate-pulse">STREAMING DATA</span>
        </div>
      )}
    </div>
  );
}
