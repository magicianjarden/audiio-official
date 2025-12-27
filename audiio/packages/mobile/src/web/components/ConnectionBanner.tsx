/**
 * ConnectionBanner - Shows connection status with auto-reconnect UI
 *
 * Inspired by Plex's seamless connection handling:
 * - Shows status during reconnection attempts
 * - Allows manual retry
 * - Animates smoothly in/out
 */

import React from 'react';
import { useConnectionStatus, usePlayerStore } from '../stores/player-store';
import { useAuthStore } from '../stores/auth-store';
import styles from './ConnectionBanner.module.css';

export function ConnectionBanner() {
  const { isConnected, connectionStatus, reconnectAttempts, lastError } = useConnectionStatus();
  const connectWebSocket = usePlayerStore((state) => state.connectWebSocket);
  const token = useAuthStore((state) => state.token);

  // Don't show if connected or never attempted connection
  if (connectionStatus === 'connected' || connectionStatus === 'disconnected') {
    return null;
  }

  const handleRetry = () => {
    if (token) {
      connectWebSocket(token);
    }
  };

  const getMessage = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting to server...';
      case 'reconnecting':
        return `Reconnecting... (attempt ${reconnectAttempts})`;
      default:
        return lastError || 'Connection lost';
    }
  };

  const showRetryButton = connectionStatus === 'disconnected' && lastError;

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

  return (
    <div
      className={`${styles.dot} ${isConnected ? styles.connected : styles.offline}`}
      title={connectionStatus === 'connected' ? 'Connected' : 'Offline'}
    />
  );
}
