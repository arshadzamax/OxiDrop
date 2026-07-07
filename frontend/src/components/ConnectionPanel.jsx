import React, { useState } from 'react';
import { Link, Unlink, Copy, Check, Wifi, WifiOff, Loader2, Plus, LogOut, QrCode } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRScannerModal } from './QRScannerModal';

export function ConnectionPanel({
  socketConnected,
  roomCode,
  isHost,
  peerConnected,
  peerId,
  connectionError,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom
}) {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = () => {
    if (joinInput.trim()) {
      onJoinRoom(joinInput.trim());
      setJoinInput('');
    }
  };

  // Not in a room yet
  if (!roomCode) {
    return (
      <div className="connection-panel">
        <div className="connection-panel-header">
          <div className="connection-panel-title">
            {socketConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>Peer Connection</span>
          </div>
          <div className={`connection-status-badge ${socketConnected ? 'online' : 'offline'}`}>
            {socketConnected ? 'Server Connected' : 'Offline'}
          </div>
        </div>

        <div className="connection-panel-body">
          <div className="connection-actions">
            <button
              className="btn btn-primary connection-action-btn"
              onClick={onCreateRoom}
              disabled={!socketConnected}
            >
              <Plus size={14} />
              Create Room
            </button>
            <div className="connection-divider">
              <span>or</span>
            </div>
            <div className="connection-join-group">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="input"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                disabled={!socketConnected}
              />
              <button
                className="btn btn-secondary scan-btn"
                onClick={() => setScannerOpen(true)}
                disabled={!socketConnected}
                title="Scan QR Code"
                id="scan-qr-modal-trigger"
              >
                <QrCode size={14} />
                Scan QR
              </button>
              <button
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={!socketConnected || !joinInput.trim()}
              >
                <Link size={14} />
                Join
              </button>
            </div>
          </div>
        </div>

        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanSuccess={(code) => {
            onJoinRoom(code);
            setScannerOpen(false);
          }}
        />
      </div>
    );
  }

  // Helper to resolve current connection text and icons
  const getStatusDisplay = () => {
    if (peerConnected) {
      return {
        icon: <Wifi size={16} style={{ color: '#00ffbb' }} />,
        text: 'Peer Connected',
        class: 'connected'
      };
    }
    if (connectionError === 'timeout') {
      return {
        icon: <WifiOff size={16} style={{ color: '#ff4a5a' }} />,
        text: 'Connection Timed Out',
        class: 'error'
      };
    }
    if (connectionError === 'failed') {
      return {
        icon: <WifiOff size={16} style={{ color: '#ff4a5a' }} />,
        text: 'Connection Failed',
        class: 'error'
      };
    }
    if (peerId) {
      return {
        icon: <Loader2 size={16} className="spin" style={{ color: '#00d2ff' }} />,
        text: 'Connecting...',
        class: 'connecting'
      };
    }
    return {
      icon: <Loader2 size={16} className="spin" />,
      text: 'Waiting for peer...',
      class: 'waiting'
    };
  };

  const statusDisplay = getStatusDisplay();

  // In a room
  return (
    <div className="connection-panel">
      <div className="connection-panel-header">
        <div className={`connection-panel-title status-${statusDisplay.class}`}>
          {statusDisplay.icon}
          <span>{statusDisplay.text}</span>
        </div>
        <button className="btn btn-secondary connection-leave-btn" onClick={onLeaveRoom}>
          <LogOut size={12} />
          Disconnect
        </button>
      </div>

      <div className="connection-panel-body">
        <div className="room-code-box">
          <div className="room-code-label">
            {isHost ? 'Room Code — Share with your peer' : 'Joined Room'}
          </div>
          <div className="room-code-row">
            <input type="text" readOnly value={roomCode} className="room-code-input" />
            <button onClick={copyRoomCode} className="copy-btn" title="Copy room code">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {isHost && !peerConnected && (
          <div className="qr-code-section">
            <div className="qr-code-label">
              <QrCode size={14} />
              <span>Scan to join</span>
            </div>
            <div className="qr-code-wrapper">
              <QRCodeDisplay value={roomCode} size={180} />
            </div>
            <div className="qr-code-hint">Scan with OxiDrop Mobile to connect instantly</div>
          </div>
        )}

        <div className="connection-status-row">
          <div className="connection-status-item">
            <span className="connection-status-key">Role</span>
            <span className="connection-status-val">{isHost ? 'Host' : 'Guest'}</span>
          </div>
          <div className="connection-status-item">
            <span className="connection-status-key">Peer</span>
            <span className="connection-status-val">
              {peerConnected ? (
                <><span className="status-dot online" /> {peerId}</>
              ) : (
                <><span className="status-dot offline" /> Waiting...</>
              )}
            </span>
          </div>
          <div className="connection-status-item">
            <span className="connection-status-key">Data Channel</span>
            <span className="connection-status-val">
              {peerConnected ? (
                <><Wifi size={11} /> Open</>
              ) : (
                <><Unlink size={11} /> Closed</>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
