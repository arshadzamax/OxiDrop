import React, { useState } from 'react';

export function TelemetryPanel({ isTransferring, transferMode, fileName, progress, speed, totalSize, webrtcStats }) {
  const [showDiag, setShowDiag] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
  };

  const active = isTransferring || (webrtcStats && webrtcStats.active);

  const transferred = totalSize ? Math.min((progress / 100) * totalSize, totalSize) : 0;
  const speedNum = parseFloat(speed);
  let eta = '—';
  if (speedNum > 0 && progress > 0 && progress < 100 && totalSize) {
    const remaining = totalSize - transferred;
    const secs = Math.ceil(remaining / (speedNum * 1024 * 1024));
    eta = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  } else if (progress === 100) {
    eta = 'Done';
  }

  // Get status color for the glowing dot indicator
  const getStatusColor = () => {
    if (!webrtcStats || !webrtcStats.active) return 'var(--text-3)';
    if (webrtcStats.connectionState === 'failed') return 'var(--red)';
    if (webrtcStats.connectionState !== 'connected') return 'var(--orange)'; // Connecting
    
    // Connected colors based on routing type
    if (webrtcStats.connectionType.includes('LAN')) return 'var(--green)'; // LAN direct
    if (webrtcStats.connectionType.includes('STUN')) return '#3b82f6'; // Public P2P (blue)
    if (webrtcStats.connectionType.includes('TURN')) return '#eab308'; // Relay (yellow)
    return 'var(--green)';
  };

  return (
    <div className="telemetry">
      {active ? (
        <div className="telemetry-active">
          <div className="telemetry-top">
            <div className="telemetry-file">
              <span className="dot" style={{ backgroundColor: getStatusColor(), boxShadow: `0 0 8px ${getStatusColor()}` }} />
              {isTransferring ? (
                `${transferMode === 'upload' ? 'Sending' : 'Receiving'}: ${fileName}`
              ) : (
                `WebRTC Connecting... State: ${webrtcStats?.connectionState || 'new'}`
              )}
            </div>
            {isTransferring && <span className="telemetry-pct">{progress}%</span>}
          </div>

          {isTransferring && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="telemetry-bottom-row">
            <div className="telemetry-stats">
              {isTransferring ? (
                <>
                  <span className="telemetry-stat">{formatBytes(transferred)} / {formatBytes(totalSize)}</span>
                  <span className="telemetry-stat"><span>{speed}</span> MB/s</span>
                  <span className="telemetry-stat">ETA <span>{eta}</span></span>
                </>
              ) : (
                <span className="telemetry-stat">Negotiating P2P session channels...</span>
              )}
            </div>

            {webrtcStats && (
              <button 
                className={`btn-diag ${showDiag ? 'active' : ''}`} 
                onClick={() => setShowDiag(!showDiag)}
              >
                {showDiag ? 'Hide Diagnostics' : 'Show Diagnostics'}
              </button>
            )}
          </div>

          {showDiag && webrtcStats && (
            <div className="telemetry-diag-panel">
              <div className="diag-grid">
                <div className="diag-item">
                  <span className="diag-label">P2P Route</span>
                  <span className="diag-value highlight">{webrtcStats.connectionType}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Latency (RTT)</span>
                  <span className="diag-value">
                    {webrtcStats.rtt !== null ? `${webrtcStats.rtt} ms` : '—'}
                  </span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Connection State</span>
                  <span className="diag-value badge" data-state={webrtcStats.connectionState}>
                    {webrtcStats.connectionState}
                  </span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">ICE State</span>
                  <span className="diag-value">{webrtcStats.iceConnectionState}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Local Candidate</span>
                  <span className="diag-value monospace">{webrtcStats.localCandidateType}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Remote Candidate</span>
                  <span className="diag-value monospace">{webrtcStats.remoteCandidateType}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Link Bytes Sent</span>
                  <span className="diag-value monospace">{formatBytes(webrtcStats.bytesSent)}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Link Bytes Received</span>
                  <span className="diag-value monospace">{formatBytes(webrtcStats.bytesReceived)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="telemetry-idle">No active connection or transfer</div>
      )}
    </div>
  );
}
