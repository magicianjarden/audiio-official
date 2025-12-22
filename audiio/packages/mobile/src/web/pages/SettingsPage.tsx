/**
 * Settings Page - View connection info and host settings
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { usePlayerStore } from '../stores/player-store';
import styles from './SettingsPage.module.css';

interface AccessInfo {
  localUrl: string;
  tunnelUrl?: string;
  createdAt: number;
  hasRemoteAccess: boolean;
}

interface Addon {
  id: string;
  name: string;
  roles: string[];
  enabled: boolean;
}

export function SettingsPage() {
  const { logout } = useAuthStore();
  const { isConnected, disconnectWebSocket } = usePlayerStore();
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/access/info').then(r => r.json()),
      fetch('/api/addons').then(r => r.json())
    ]).then(([access, addonsData]) => {
      setAccessInfo(access);
      setAddons(addonsData.addons || []);
    }).catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

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

        {/* Active Plugins (read-only) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Host Plugins</h2>
          <p className={styles.sectionDesc}>
            These plugins are enabled on your desktop app
          </p>
          <div className={styles.card}>
            {isLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : addons.length > 0 ? (
              addons.map(addon => (
                <div key={addon.id} className={styles.addonRow}>
                  <div className={styles.addonInfo}>
                    <span className={styles.addonName}>{addon.name}</span>
                    <span className={styles.addonRoles}>
                      {addon.roles.join(', ')}
                    </span>
                  </div>
                  <span className={`${styles.addonStatus} ${addon.enabled ? styles.enabled : ''}`}>
                    {addon.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No plugins configured</div>
            )}
          </div>
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
