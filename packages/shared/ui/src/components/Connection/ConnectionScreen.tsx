/**
 * Connection Screen
 *
 * Shown when the app is in client mode and not connected to a server.
 * Allows users to enter a server URL and connect.
 */

import React, { useState, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import './ConnectionScreen.css';

interface DiscoveredServer {
  name: string;
  url: string;
  serverId: string;
}

export const ConnectionScreen: React.FC = () => {
  const { state, connect, isLoading } = useConnectionStore();
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(true);

  // Load saved server URL on mount
  useEffect(() => {
    const loadSavedServer = async () => {
      const api = (window as any).api;
      if (api?.connection?.getSavedServer) {
        const saved = await api.connection.getSavedServer();
        if (saved?.url) {
          setServerUrl(saved.url);
        }
      }
    };
    loadSavedServer();
  }, []);

  // Discover servers on local network
  useEffect(() => {
    const discoverServers = async () => {
      const api = (window as any).api;
      if (!api?.discovery?.getServers) {
        setIsDiscovering(false);
        return;
      }

      try {
        // Start discovery
        if (api.discovery.startBrowsing) {
          await api.discovery.startBrowsing();
        }

        // Get initial list
        const servers = await api.discovery.getServers();
        setDiscoveredServers(servers || []);

        // Subscribe to updates
        if (api.discovery.onServerFound) {
          api.discovery.onServerFound((server: DiscoveredServer) => {
            setDiscoveredServers(prev => {
              if (prev.some(s => s.serverId === server.serverId)) return prev;
              return [...prev, server];
            });
          });
        }

        if (api.discovery.onServerLost) {
          api.discovery.onServerLost((serverId: string) => {
            setDiscoveredServers(prev => prev.filter(s => s.serverId !== serverId));
          });
        }
      } catch (err) {
        console.error('[ConnectionScreen] Discovery error:', err);
      }

      // Hide discovering message after 3 seconds
      setTimeout(() => setIsDiscovering(false), 3000);
    };

    discoverServers();
  }, []);

  const handleConnect = async (url?: string) => {
    const targetUrl = url || serverUrl.trim();
    if (!targetUrl) {
      setError('Please enter a server URL');
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const success = await connect(targetUrl);
      if (!success) {
        setError(state.error || 'Failed to connect to server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  if (isLoading) {
    return (
      <div className="connection-screen">
        <div className="connection-loading">
          <div className="connection-spinner" />
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="connection-screen">
      <div className="connection-container">
        {/* Logo */}
        <div className="connection-logo">
          <span className="connection-logo-icon">🎵</span>
        </div>

        <h1 className="connection-title">Audiio</h1>
        <p className="connection-subtitle">Connect to a server to start listening</p>

        {/* Discovered Servers */}
        <div className="connection-section">
          <h2 className="connection-section-title">Discovered Servers</h2>
          <div className="connection-server-list">
            {isDiscovering && discoveredServers.length === 0 ? (
              <div className="connection-discovering">
                <div className="connection-spinner small" />
                <p>Looking for servers on your network...</p>
              </div>
            ) : discoveredServers.length > 0 ? (
              discoveredServers.map(server => (
                <button
                  key={server.serverId}
                  className="connection-server-item"
                  onClick={() => {
                    setServerUrl(server.url);
                    handleConnect(server.url);
                  }}
                  disabled={isConnecting}
                >
                  <div className="connection-server-icon">🎵</div>
                  <div className="connection-server-info">
                    <div className="connection-server-name">{server.name}</div>
                    <div className="connection-server-url">{server.url}</div>
                  </div>
                  <div className="connection-server-status" />
                </button>
              ))
            ) : (
              <div className="connection-empty">
                <p>No servers found on your network</p>
                <p className="connection-empty-hint">Make sure your Audiio server is running</p>
              </div>
            )}
          </div>
        </div>

        {/* Manual Input */}
        <div className="connection-section">
          <h2 className="connection-section-title">Or enter server address</h2>
          <div className="connection-input-group">
            <input
              type="text"
              className="connection-input"
              placeholder="http://192.168.1.100:8484"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isConnecting}
            />
            <button
              className="connection-button"
              onClick={() => handleConnect()}
              disabled={isConnecting || !serverUrl.trim()}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>

          {error && (
            <div className="connection-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
