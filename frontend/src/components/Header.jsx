import React from 'react';
import { Shield, Sun, Moon } from 'lucide-react';

export function Header({ socketConnected, userId, theme, toggleTheme }) {
  return (
    <header className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-b border-[var(--border)] mb-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border)]">
          <Shield className="w-6 h-6 text-[var(--text-main)]" />
        </div>
        <div className="text-left">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            OxiDrop <span className="text-[10px] border border-[var(--border)] text-[var(--text-muted)] px-2 py-0.5 rounded-full font-medium">Desktop</span>
          </h1>
          <p className="text-[11px] text-[var(--text-muted)]">Secure Direct Peer Transfers</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Node status details */}
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] px-4 py-2 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-sm animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
            <span className="text-[var(--text-muted)] font-medium">Signaling: {socketConnected ? 'READY' : 'OFFLINE'}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)]" />
          <div className="text-[var(--text-muted)] font-mono text-[10px]">
            ID: <span className="text-[var(--text-main)]">{userId}</span>
          </div>
        </div>

        {/* Minimalist Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="icon-btn p-2"
          aria-label="Toggle interface theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
