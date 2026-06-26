import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, X } from 'lucide-react';

export function DeveloperConsole({ logs, onClear, onClose }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Color code each category for premium terminal aesthetics
  const getCategoryColor = (category) => {
    switch (category) {
      case 'signaling': return '#3b82f6'; // blue
      case 'ice': return '#eab308'; // yellow
      case 'webrtc': return '#a855f7'; // purple
      case 'stream': return '#10b981'; // green
      case 'error': return '#ef4444'; // red
      default: return '#9ca3af'; // gray
    }
  };

  return (
    <div className="dev-console">
      <div className="dev-console-header">
        <div className="dev-console-title">
          <Terminal size={14} />
          <span>Developer Logs Console</span>
        </div>
        <div className="dev-console-actions">
          <button className="icon-btn-small" onClick={onClear} title="Clear logs">
            <Trash2 size={12} />
          </button>
          <button className="icon-btn-small" onClick={onClose} title="Close console">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="dev-console-logs" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="logs-empty">Console initialized. Ready to debug WebRTC connections...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-line">
              <span className="log-time">[{log.time}]</span>
              <span className="log-category" style={{ color: getCategoryColor(log.category) }}>
                [{log.category.toUpperCase()}]
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
