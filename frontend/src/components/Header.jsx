import React from 'react';
import { Sun, Moon, Terminal } from 'lucide-react';

export function Header({ socketConnected, userId, theme, toggleTheme, showConsole, setShowConsole, onGoHome }) {
  return (
    <header className="header">
      <div className="header-left" onClick={onGoHome} style={{ cursor: 'pointer' }}>
        <span className="header-logo">OxiDrop</span>
      </div>

      <div className="header-right">
        {!window.__TAURI_INTERNALS__ && (
          <button 
            onClick={() => alert("OxiDrop Desktop Client Installer (.msi/.dmg) is ready for compilation!\nRun `npm run tauri build` in the frontend directory to produce your local installer binary.\n\nBenefits:\n- Native Iroh P2P protocol\n- Speeds up to 1+ Gbps\n- No browser timeouts or tab sleep issues")}
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', color: '#00f2fe', cursor: 'pointer', marginRight: '8px' }}
          >
            Get Desktop App
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
