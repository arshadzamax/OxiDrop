import React from 'react';

export function TelemetryPanel({ isTransferring, transferMode, fileName, progress, speed, totalSize }) {
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
  };

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

  return (
    <div className="telemetry">
      {isTransferring ? (
        <div className="telemetry-active">
          <div className="telemetry-top">
            <div className="telemetry-file">
              <span className="dot" />
              {transferMode === 'upload' ? 'Sending' : 'Receiving'}: {fileName}
            </div>
            <span className="telemetry-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="telemetry-stats">
            <span className="telemetry-stat">{formatBytes(transferred)} / {formatBytes(totalSize)}</span>
            <span className="telemetry-stat"><span>{speed}</span> MB/s</span>
            <span className="telemetry-stat">ETA <span>{eta}</span></span>
          </div>
        </div>
      ) : (
        <div className="telemetry-idle">No active transfer</div>
      )}
    </div>
  );
}
