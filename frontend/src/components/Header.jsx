import React from 'react';
import { Sun, Moon } from 'lucide-react';

export function Header({ socketConnected, userId, theme, toggleTheme }) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">OxiDrop</span>
      </div>

      <div className="header-right">
        <div className="status-chip">
          <span className={`status-dot ${socketConnected ? 'online' : 'offline'}`} />
          {socketConnected ? 'Connected' : 'Offline'}
        </div>
        <span className="node-id">{userId}</span>
        <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
