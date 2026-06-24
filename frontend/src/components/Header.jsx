import React from 'react';
import { Shield } from 'lucide-react';

export function Header({ socketConnected, userId }) {
  return (
    <header className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-b border-white/5 mb-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-neon-indigo">
          <Shield className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="text-left">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            OxiDrop <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">P2P v1.0</span>
          </h1>
          <p className="text-xs text-slate-400">Secure, Direct, Asynchronous File Transfers</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-neon-emerald animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
          <span className="text-slate-300 font-medium">Signaling Node: {socketConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="text-slate-400">
          Node ID: <code className="text-indigo-300 font-mono">{userId}</code>
        </div>
      </div>
    </header>
  );
}
