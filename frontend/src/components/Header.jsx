import React from 'react';
import { Sun, Moon, Terminal } from 'lucide-react';

export function Header({ socketConnected, userId, theme, toggleTheme, showConsole, setShowConsole, onGoHome }) {
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

  return (
    <header className="header">
      <div 
        className="header-left" 
        onClick={() => { if (!isTauri && onGoHome) onGoHome(); }} 
        style={{ cursor: isTauri ? 'default' : 'pointer' }}
      >
        <span className="header-logo">OxiDrop</span>
      </div>

      <div className="header-right">
        {!isTauri && (
          <button 
            onClick={onGoHome}
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', color: '#00f2fe', cursor: 'pointer', marginRight: '8px' }}
          >
            Get Mobile & Desktop Apps
          </button>
        )}
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
