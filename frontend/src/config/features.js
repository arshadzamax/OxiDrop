/**
 * OxiDrop Feature Flags
 * Modular configuration toggles for background file picker resilience,
 * connection self-healing, and mobile lifecycle stability.
 */
export const FEATURE_FLAGS = {
  // Preserves user's selected file in memory across transient connection drops & renegotiations
  PERSIST_SELECTED_FILE_ON_DISCONNECT: true,

  // Grace period (in ms) before treating WebRTC 'disconnected' state as a fatal connection drop
  WEBRTC_DISCONNECT_GRACE_PERIOD_MS: 7000,

  // Prevents mobile OS from sleeping or throttling background timers during active sessions
  ENABLE_SCREEN_WAKE_LOCK: true,

  // Attempts an automatic in-place ICE restart when WebRTC enters 'failed' before destroying connection
  ENABLE_ICE_RESTART_ON_FAILED: true,
};
