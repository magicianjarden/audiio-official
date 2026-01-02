/**
 * Settings Page - View connection info and host settings
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, apiFetch } from '../stores/auth-store';
import { usePlayerStore } from '../stores/player-store';
import { usePluginStore } from '../stores/plugin-store';
import { PlugIcon, ChevronRightIcon } from '@audiio/icons';
import styles from './SettingsPage.module.css';

interface AccessInfo {
  localUrl: string;
  tunnelUrl?: string;
  createdAt: number;
  hasRemoteAccess: boolean;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { isConnected, disconnectWebSocket } = usePlayerStore();
  const { plugins, fetchPlugins } = usePluginStore();
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/access/info').then(r => r.json()),
      fetchPlugins()
    ]).then(([access]) => {
      setAccessInfo(access);
    }).catch(console.error)
      .finally(() => setIsLoading(false));
  }, [fetchPlugins]);

  const enabledCount = plugins.filter(p => p.enabled).length;

  const handleLogout = () => {
    disconnectWebSocket();
    logout();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.content}>
        {/* Connection Status */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Connection</h2>
          <div className={styles.card}>
            <div className={styles.statusRow}>
              <span>Status</span>
              <span className={`${styles.status} ${isConnected ? styles.connected : ''}`}>
                <span className={styles.dot} />
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {accessInfo && (
              <>
                <div className={styles.infoRow}>
                  <span>Session started</span>
                  <span>{formatDate(accessInfo.createdAt)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Remote access</span>
                  <span>{accessInfo.hasRemoteAccess ? 'Enabled' : 'Disabled'}</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Plugins */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Plugins</h2>
          <button
            className={styles.menuCard}
            onClick={() => navigate('/plugins')}
          >
            <div className={styles.menuLeft}>
              <div className={styles.menuIcon}>
                <PlugIcon />
              </div>
              <div className={styles.menuInfo}>
                <span className={styles.menuTitle}>Manage Plugins</span>
                <span className={styles.menuDesc}>
                  {isLoading ? 'Loading...' : `${enabledCount} of ${plugins.length} enabled`}
                </span>
              </div>
            </div>
            <ChevronRightIcon />
          </button>
        </section>

        {/* About */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <div className={styles.card}>
            <div className={styles.infoRow}>
              <span>Version</span>
              <span>Mobile Portal v0.1.0</span>
            </div>
            <div className={styles.infoRow}>
              <span>Mode</span>
              <span>Lite (Remote Client)</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className={styles.section}>
          <button className={styles.logoutButton} onClick={handleLogout}>
            Disconnect from Host
          </button>
          <p className={styles.logoutHint}>
            You'll need to re-enter your access token to reconnect
          </p>
        </section>
      </div>
    </div>
  );
}
