import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, X } from 'lucide-react';

export function DeveloperConsole({ 
  logs, 
  onClear, 
  onClose,
  socketConnected,
  activeTab,
  selectedFile,
  registeredFileId,
  senderRequests = [],
  receiverFileMeta,
  requestStatus,
  webrtcStats,
  isUploading,
  isDownloading,
  fileIdInput
}) {
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

  const steps = activeTab === 'share' ? [
    {
      label: 'Signaling WS',
      active: socketConnected,
      status: socketConnected ? 'connected' : 'disconnected'
    },
    {
      label: 'File Selected',
      active: !!selectedFile,
      status: selectedFile ? (selectedFile.name.length > 12 ? selectedFile.name.substring(0, 10) + '...' : selectedFile.name) : 'missing'
    },
    {
      label: 'Share Link',
      active: !!registeredFileId,
      status: registeredFileId ? 'active' : 'pending'
    },
    {
      label: 'Access Request',
      active: senderRequests.length > 0 || (webrtcStats && webrtcStats.connectionState !== 'closed' && webrtcStats.connectionState !== 'new'),
      status: senderRequests.length > 0 ? 'pending approval' : (webrtcStats && webrtcStats.connectionState !== 'closed' && webrtcStats.connectionState !== 'new' ? 'approved' : 'waiting')
    },
    {
      label: 'WebRTC State',
      active: webrtcStats && webrtcStats.connectionState === 'connected',
      status: webrtcStats ? webrtcStats.connectionState : 'closed',
      customDot: webrtcStats && webrtcStats.connectionState === 'failed' ? 'failed' : (webrtcStats && (webrtcStats.connectionState === 'connecting' || webrtcStats.connectionState === 'checking') ? 'checking' : null)
    },
    {
      label: 'Data Channel',
      active: isUploading,
      status: isUploading ? 'streaming' : 'idle'
    }
  ] : [
    {
      label: 'Signaling WS',
      active: socketConnected,
      status: socketConnected ? 'connected' : 'disconnected'
    },
    {
      label: 'Code Entered',
      active: !!fileIdInput,
      status: fileIdInput ? 'entered' : 'empty'
    },
    {
      label: 'Metadata Lookup',
      active: !!receiverFileMeta,
      status: receiverFileMeta ? 'found' : 'searching'
    },
    {
      label: 'Request Access',
      active: requestStatus === 'APPROVED' || (webrtcStats && webrtcStats.connectionState !== 'closed' && webrtcStats.connectionState !== 'new'),
      status: requestStatus || 'idle'
    },
    {
      label: 'WebRTC State',
      active: webrtcStats && webrtcStats.connectionState === 'connected',
      status: webrtcStats ? webrtcStats.connectionState : 'closed',
      customDot: webrtcStats && webrtcStats.connectionState === 'failed' ? 'failed' : (webrtcStats && (webrtcStats.connectionState === 'connecting' || webrtcStats.connectionState === 'checking') ? 'checking' : null)
    },
    {
      label: 'Data Channel',
      active: isDownloading,
      status: isDownloading ? 'streaming' : 'idle'
    }
  ];

  return (
    <div className="dev-console">
      <div className="dev-console-header">
        <div className="dev-console-title">
          <Terminal size={14} />
          <span>Developer Handshake & Logs Console</span>
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

      <div className="dev-console-checklist">
        {steps.map((step, idx) => (
          <div 
            key={idx} 
            className="checklist-item" 
            data-active={step.active} 
            data-status={step.customDot || (step.active ? 'active' : 'idle')}
          >
            <div className="checklist-dot" />
            <span className="checklist-label">{step.label}:</span>
            <span className="checklist-status">{step.status}</span>
          </div>
        ))}
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
