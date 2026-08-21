import React, { useState } from 'react';

export function TelemetryPanel({
  isTransferring,
  transferMode,
  fileName,
  progress,
  speed,
  totalSize,
  webrtcStats,
  irohTelemetry,
  isIrohTransferring,
  irohFileName,
  irohProgress,
  irohSpeed,
  irohTotalSize,
  irohTransferred
}) {
  const [showDiag, setShowDiag] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
  };

  const isIrohActive = isIrohTransferring || (irohTelemetry && irohTelemetry.active);
  const active = isTransferring || (webrtcStats && webrtcStats.active) || isIrohActive;

  // Use Iroh metrics if Iroh is active, else WebRTC metrics
  const effectiveFileName = isIrohActive ? (irohFileName || 'Iroh QUIC File') : fileName;
  const effectiveProgress = isIrohActive ? irohProgress : progress;
  const effectiveSpeed = isIrohActive
    ? (irohSpeed > 0 ? (irohSpeed / (1024 * 1024)).toFixed(2) : '0.00')
    : speed;
  const effectiveTotalSize = isIrohActive ? irohTotalSize : totalSize;
  const effectiveTransferred = isIrohActive
    ? (irohTransferred || (effectiveTotalSize ? Math.min((effectiveProgress / 100) * effectiveTotalSize, effectiveTotalSize) : 0))
    : (totalSize ? Math.min((progress / 100) * totalSize, totalSize) : 0);

  const speedNum = parseFloat(effectiveSpeed);
  let eta = '—';
  if (speedNum > 0 && effectiveProgress > 0 && effectiveProgress < 100 && effectiveTotalSize) {
    const remaining = effectiveTotalSize - effectiveTransferred;
    const secs = Math.ceil(remaining / (speedNum * 1024 * 1024));
    eta = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  } else if (effectiveProgress === 100) {
    eta = 'Done';
  }

  // Get status color for the glowing dot indicator
  const getStatusColor = () => {
    if (isIrohActive) {
      if (irohTelemetry?.state === 'failed') return 'var(--red)';
      if (irohTelemetry?.state === 'completed') return 'var(--green)';
      if (irohTelemetry?.state === 'streaming') return '#00f2fe'; // Iroh Cyan
      return '#3b82f6';
    }
    if (!webrtcStats || !webrtcStats.active) return 'var(--text-3)';
    if (webrtcStats.connectionState === 'failed') return 'var(--red)';
    if (webrtcStats.connectionState !== 'connected') return 'var(--orange)'; // Connecting
    
    // Connected colors based on routing type
    const connType = webrtcStats.connectionType || '';
    if (typeof connType === 'string') {
      if (connType.includes('LAN')) return 'var(--green)'; // LAN direct
      if (connType.includes('STUN')) return '#3b82f6'; // Public P2P (blue)
      if (connType.includes('TURN')) return '#eab308'; // Relay (yellow)
    }
    return 'var(--green)';
  };

  const isActuallyTransferring = isIrohActive ? isIrohTransferring : isTransferring;

  return (
    <div className="telemetry">
      {active ? (
        <div className="telemetry-active">
          <div className="telemetry-top">
            <div className="telemetry-file">
              <span className="dot" style={{ backgroundColor: getStatusColor(), boxShadow: `0 0 8px ${getStatusColor()}` }} />
              {isActuallyTransferring ? (
                `${isIrohActive ? '[Iroh QUIC] ' : ''}${transferMode === 'upload' ? 'Sending' : 'Receiving'}: ${effectiveFileName}`
              ) : isIrohActive ? (
                `Iroh QUIC: ${irohTelemetry?.transport || 'Ready'} (${irohTelemetry?.state || 'active'})`
              ) : (
                `WebRTC Connecting... State: ${webrtcStats?.connectionState || 'new'}`
              )}
            </div>
            {isActuallyTransferring && <span className="telemetry-pct">{effectiveProgress}%</span>}
          </div>

          {isActuallyTransferring && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${effectiveProgress}%`, backgroundColor: isIrohActive ? '#00f2fe' : undefined }} />
            </div>
          )}

          <div className="telemetry-bottom-row">
            <div className="telemetry-stats">
              {isActuallyTransferring ? (
                <>
                  <span className="telemetry-stat">{formatBytes(effectiveTransferred)} / {formatBytes(effectiveTotalSize)}</span>
                  <span className="telemetry-stat"><span>{effectiveSpeed}</span> MB/s</span>
                  <span className="telemetry-stat">ETA <span>{eta}</span></span>
                </>
              ) : isIrohActive ? (
                <span className="telemetry-stat">Node: {irohTelemetry?.nodeId ? `${irohTelemetry.nodeId.slice(0, 12)}...` : 'Local Endpoint Ready'}</span>
              ) : (
                <span className="telemetry-stat">Negotiating P2P session channels...</span>
              )}
            </div>

            {(webrtcStats || isIrohActive) && (
              <button 
                className={`btn-diag ${showDiag ? 'active' : ''}`} 
                onClick={() => setShowDiag(!showDiag)}
              >
                {showDiag ? 'Hide Diagnostics' : 'Show Diagnostics'}
              </button>
            )}
          </div>

          {showDiag && (
            <div className="telemetry-diag-panel">
              <div className="diag-grid">
                {isIrohActive ? (
                  <>
                    <div className="diag-item">
                      <span className="diag-label">Protocol</span>
                      <span className="diag-value highlight" style={{ color: '#00f2fe' }}>Iroh QUIC 1.0</span>
                    </div>
                    <div className="diag-item">
                      <span className="diag-label">Transport Route</span>
                      <span className="diag-value">{irohTelemetry?.transport || 'QUIC Direct / Relay'}</span>
                    </div>
                    <div className="diag-item">
                      <span className="diag-label">State</span>
                      <span className="diag-value badge" data-state={irohTelemetry?.state || 'active'}>
                        {irohTelemetry?.state || 'active'}
                      </span>
                    </div>
                    <div className="diag-item">
                      <span className="diag-label">Relay Status</span>
                      <span className="diag-value">{irohTelemetry?.relayUrl ? 'n0 Relay Active' : 'Direct / Local'}</span>
                    </div>
                    <div className="diag-item">
                      <span className="diag-label">Node ID</span>
                      <span className="diag-value monospace">{irohTelemetry?.nodeId || '—'}</span>
                    </div>
                    <div className="diag-item">
                      <span className="diag-label">Bytes Transferred</span>
                      <span className="diag-value monospace">{formatBytes(effectiveTransferred)}</span>
                    </div>
                  </>
                ) : webrtcStats && (
                  <>
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
                  </>
                )}
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

