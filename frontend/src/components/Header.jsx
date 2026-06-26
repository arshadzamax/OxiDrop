import React from 'react';
import { Sun, Moon, Terminal } from 'lucide-react';

export function Header({ socketConnected, userId, theme, toggleTheme, showConsole, setShowConsole }) {
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
        <button onClick={() => setShowConsole(!showConsole)} className={`icon-btn ${showConsole ? 'active' : ''}`} aria-label="Toggle developer console" title="Toggle Developer Console">
          <Terminal size={14} />
        </button>
        <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
