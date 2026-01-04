/**
 * ConnectionBanner - Shows connection status with auto-reconnect UI
 *
 * Inspired by Plex's seamless connection handling:
 * - Shows status during reconnection attempts
 * - Allows manual retry
 * - Animates smoothly in/out
 */

import { useConnectionStatus, usePlayerStore } from '../stores/player-store';
import { useAuthStore } from '../stores/auth-store';
import { useP2PStore } from '../stores/p2p-store';
import styles from './ConnectionBanner.module.css';

// Check if we're in remote mode (GitHub Pages, etc.)
function isRemoteMode(): boolean {
  const host = window.location.hostname;
  return host.includes('github.io') ||
         host.includes('netlify') ||
         host.includes('vercel') ||
         host.includes('pages.dev');
}

export function ConnectionBanner() {
  const { connectionStatus, reconnectAttempts, lastError } = useConnectionStatus();
  const connectWebSocket = usePlayerStore((state) => state.connectWebSocket);
  const deviceToken = useAuthStore((state) => state.deviceToken);
  const p2pStatus = useP2PStore((state) => state.status);
  const p2pConnect = useP2PStore((state) => state.connect);
  const savedRelayCode = useAuthStore((state) => state.relayCode);

  // In remote mode, use P2P status instead of WebSocket status
  const inRemoteMode = isRemoteMode();

  // Don't show banner if:
  // - WebSocket connected (local mode)
  // - P2P connected (remote mode)
  // - Never attempted connection
  if (inRemoteMode) {
    if (p2pStatus === 'connected' || p2pStatus === 'disconnected') {
      return null;
    }
  } else {
    if (connectionStatus === 'connected' || connectionStatus === 'disconnected') {
      return null;
    }
  }

  const handleRetry = () => {
    if (inRemoteMode) {
      // In remote mode, retry P2P connection
      if (savedRelayCode) {
        p2pConnect(savedRelayCode);
      }
    } else if (deviceToken) {
      connectWebSocket(deviceToken);
    }
  };

  const getMessage = () => {
    if (inRemoteMode) {
      switch (p2pStatus) {
        case 'connecting':
          return 'Connecting via relay...';
        case 'error':
          return 'Connection failed';
        default:
          return 'Connecting...';
      }
    }
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting to server...';
      case 'reconnecting':
        return `Reconnecting... (attempt ${reconnectAttempts})`;
      default:
        return lastError || 'Connection lost';
    }
  };

  const showRetryButton = inRemoteMode
    ? (p2pStatus === 'error' || p2pStatus === 'disconnected')
    : (connectionStatus === 'disconnected' && lastError);

  return (
    <div className={`${styles.banner} ${styles[connectionStatus]}`}>
      <div className={styles.content}>
        <div className={styles.indicator}>
          {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
            <div className={styles.spinner} />
          )}
        </div>
        <span className={styles.message}>{getMessage()}</span>
        {showRetryButton && (
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ConnectionDot - Small indicator for navbar or header
 */
export function ConnectionDot() {
  const { isConnected, connectionStatus } = useConnectionStatus();
  const p2pStatus = useP2PStore((state) => state.status);
  const inRemoteMode = isRemoteMode();

  // In remote mode, use P2P status
  const actuallyConnected = inRemoteMode ? p2pStatus === 'connected' : isConnected;
  const statusLabel = actuallyConnected ? 'Connected' : 'Offline';

  return (
    <div
      className={`${styles.dot} ${actuallyConnected ? styles.connected : styles.offline}`}
      title={statusLabel}
    />
  );
}
