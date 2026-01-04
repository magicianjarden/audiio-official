/**
 * Connection Settings
 *
 * Shows server connection status and allows disconnecting/reconnecting.
 * Only visible when running in client mode (thin client + remote server).
 */

import React, { useState, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connection-store';

interface DiscoveredServer {
  name: string;
  url: string;
  serverId: string;
}

export const ConnectionSettings: React.FC = () => {
  const { state, isClientMode, connect, disconnect } = useConnectionStore();
  const [serverUrl, setServerUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);

  // If not in client mode, don't show anything
  if (!isClientMode) {
    return (
      <div className="settings-connection-desktop">
        <p className="settings-info-text">
          Connection settings are not available in standalone mode.
          The server is running locally.
        </p>
      </div>
    );
  }

  // Load discovered servers
  useEffect(() => {
    const loadServers = async () => {
      const api = (window as any).api;
      if (api?.discovery?.getServers) {
        const servers = await api.discovery.getServers();
        setDiscoveredServers(servers || []);
      }
    };
    loadServers();
  }, []);

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleConnect = async (url?: string) => {
    const targetUrl = url || serverUrl.trim();
    if (!targetUrl) return;

    setError(null);
    setIsConnecting(true);

    try {
      const success = await connect(targetUrl);
      if (!success) {
        setError(state.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="settings-connection">
      {/* Current Connection Status */}
      <div className="settings-connection-status">
        <div className="settings-connection-indicator">
          <span className={`status-dot ${state.connected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {state.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {state.connected && (
          <div className="settings-connection-details">
            <div className="settings-connection-detail">
              <span className="detail-label">Server</span>
              <span className="detail-value">{state.serverName || 'Unknown'}</span>
            </div>
            <div className="settings-connection-detail">
              <span className="detail-label">URL</span>
              <span className="detail-value mono">{state.serverUrl}</span>
            </div>
            {state.serverVersion && (
              <div className="settings-connection-detail">
                <span className="detail-label">Version</span>
                <span className="detail-value">{state.serverVersion}</span>
              </div>
            )}
            {state.latency !== undefined && (
              <div className="settings-connection-detail">
                <span className="detail-label">Latency</span>
                <span className="detail-value">{state.latency}ms</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {state.connected ? (
        <div className="settings-connection-actions">
          <button
            className="settings-btn danger"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="settings-connection-reconnect">
          {/* Discovered Servers */}
          {discoveredServers.length > 0 && (
            <div className="settings-connection-discovered">
              <h4>Available Servers</h4>
              <div className="settings-server-list">
                {discoveredServers.map(server => (
                  <button
                    key={server.serverId}
                    className="settings-server-item"
                    onClick={() => handleConnect(server.url)}
                    disabled={isConnecting}
                  >
                    <div className="settings-server-info">
                      <span className="settings-server-name">{server.name}</span>
                      <span className="settings-server-url">{server.url}</span>
                    </div>
                    <span className="settings-server-status" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Input */}
          <div className="settings-connection-manual">
            <h4>Or enter server address</h4>
            <div className="settings-input-group">
              <input
                type="text"
                className="settings-input"
                placeholder="http://192.168.1.100:8484"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                disabled={isConnecting}
              />
              <button
                className="settings-btn primary"
                onClick={() => handleConnect()}
                disabled={isConnecting || !serverUrl.trim()}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
            {error && (
              <div className="settings-connection-error">{error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
