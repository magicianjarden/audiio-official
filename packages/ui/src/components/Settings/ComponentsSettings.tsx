/**
 * ComponentsSettings - Optional components installation (Demucs, etc.)
 *
 * Allows users to install/uninstall large optional components
 * similar to Xcode's optional components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import {
  DownloadIcon,
  TrashIcon,
  CheckIcon,
  RefreshIcon,
  AlertIcon,
} from '@audiio/icons';

// ========================================
// Types
// ========================================

interface DemucsStatus {
  installed: boolean;
  enabled: boolean;
  version: string | null;
  updateAvailable: string | null;
  serverRunning: boolean;
}

interface InstallProgress {
  phase: 'downloading' | 'extracting' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

// ========================================
// Component Card
// ========================================

interface ComponentCardProps {
  name: string;
  description: string;
  size: string;
  status: DemucsStatus | null;
  installProgress: InstallProgress | null;
  isInstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onCancel: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  name,
  description,
  size,
  status,
  installProgress,
  isInstalling,
  onInstall,
  onUninstall,
  onCancel,
  onToggleEnabled,
}) => {
  const installed = status?.installed || false;
  const enabled = status?.enabled ?? true;
  const version = status?.version;

  return (
    <div className={`component-card ${installed ? 'installed' : ''}`}>
      <div className="component-card-icon">
        <MicrophoneIcon size={32} />
      </div>

      <div className="component-card-content">
        <div className="component-card-header">
          <h4 className="component-card-name">{name}</h4>
          {installed && (
            <span className="component-card-badge">
              <CheckIcon size={12} />
              Installed
            </span>
          )}
        </div>

        <p className="component-card-description">{description}</p>

        <div className="component-card-meta">
          <span className="component-card-size">{size}</span>
          {version && <span className="component-card-version">v{version}</span>}
        </div>

        {/* Install Progress */}
        {isInstalling && installProgress && (
          <div className="component-card-progress">
            <div className="component-progress-bar">
              <div
                className="component-progress-fill"
                style={{ width: `${installProgress.progress}%` }}
              />
            </div>
            <div className="component-progress-info">
              <span className="component-progress-message">{installProgress.message}</span>
              <span className="component-progress-percent">{installProgress.progress}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="component-card-actions">
        {!installed && !isInstalling && (
          <button className="component-action-btn install" onClick={onInstall}>
            <DownloadIcon size={16} />
            Install
          </button>
        )}

        {isInstalling && (
          <button className="component-action-btn cancel" onClick={onCancel}>
            Cancel
          </button>
        )}

        {installed && !isInstalling && (
          <>
            <label className="toggle-switch component-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggleEnabled(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
            <button className="component-action-btn uninstall" onClick={onUninstall}>
              <TrashIcon size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ========================================
// Main Component
// ========================================

export const ComponentsSettings: React.FC = () => {
  const {
    demucsInstalled,
    demucsEnabled,
    demucsVersion,
    setDemucsInstalled,
    setDemucsEnabled,
    setDemucsVersion,
  } = useSettingsStore();

  const [status, setStatus] = useState<DemucsStatus | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      if (window.api?.components?.getDemucsStatus) {
        try {
          const result = await window.api.components.getDemucsStatus();
          if (result.success) {
            setStatus(result.status);
            // Sync with store
            setDemucsInstalled(result.status.installed);
            setDemucsEnabled(result.status.enabled);
            setDemucsVersion(result.status.version);
          }
        } catch (err) {
          console.error('[ComponentsSettings] Failed to fetch status:', err);
        }
      }
    };

    fetchStatus();
  }, [setDemucsInstalled, setDemucsEnabled, setDemucsVersion]);

  // Listen for install progress
  useEffect(() => {
    if (!window.api?.components?.onInstallProgress) return;

    const unsubscribe = window.api.components.onInstallProgress((progress) => {
      setInstallProgress(progress);

      if (progress.phase === 'complete') {
        setIsInstalling(false);
        setDemucsInstalled(true);
        // Refresh status
        window.api.components.getDemucsStatus().then((result: { success: boolean; status: DemucsStatus }) => {
          if (result.success) {
            setStatus(result.status);
            setDemucsVersion(result.status.version);
          }
        });
      } else if (progress.phase === 'error') {
        setIsInstalling(false);
        setError(progress.message);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [setDemucsInstalled, setDemucsVersion]);

  const handleInstall = useCallback(async () => {
    if (!window.api?.components?.installDemucs) return;

    setError(null);
    setIsInstalling(true);
    setInstallProgress({
      phase: 'downloading',
      progress: 0,
      message: 'Starting installation...',
    });

    try {
      const result = await window.api.components.installDemucs();
      if (!result.success) {
        setError(result.error || 'Installation failed');
        setIsInstalling(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setIsInstalling(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (window.api?.components?.cancelDemucsInstall) {
      window.api.components.cancelDemucsInstall();
    }
    setIsInstalling(false);
    setInstallProgress(null);
  }, []);

  const handleUninstall = useCallback(async () => {
    if (!window.api?.components?.uninstallDemucs) return;

    const confirmed = window.confirm(
      'Are you sure you want to uninstall AI Vocal Removal? You can reinstall it later.'
    );

    if (!confirmed) return;

    try {
      const result = await window.api.components.uninstallDemucs();
      if (result.success) {
        setDemucsInstalled(false);
        setDemucsVersion(null);
        setStatus((prev) => (prev ? { ...prev, installed: false, version: null } : null));
      } else {
        setError(result.error || 'Uninstall failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uninstall failed');
    }
  }, [setDemucsInstalled, setDemucsVersion]);

  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
      if (!window.api?.components?.setDemucsEnabled) return;

      try {
        const result = await window.api.components.setDemucsEnabled(enabled);
        if (result.success) {
          setDemucsEnabled(enabled);
          setStatus((prev) => (prev ? { ...prev, enabled } : null));
        }
      } catch (err) {
        console.error('[ComponentsSettings] Failed to toggle enabled:', err);
      }
    },
    [setDemucsEnabled]
  );

  return (
    <div className="components-settings">
      <p className="components-settings-description">
        Install optional features that enhance your Audiio experience. These components require additional storage and are downloaded separately.
      </p>

      {error && (
        <div className="components-error">
          <AlertIcon size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="components-list">
        <ComponentCard
          name="AI Vocal Removal"
          description="Remove vocals from any song for karaoke mode. Uses Demucs AI for high-quality stem separation."
          size="~1.5 GB"
          status={status}
          installProgress={installProgress}
          isInstalling={isInstalling}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onCancel={handleCancel}
          onToggleEnabled={handleToggleEnabled}
        />
      </div>

      <p className="components-note">
        Components are stored in your application data folder and can be uninstalled at any time to free up space.
      </p>
    </div>
  );
};

// ========================================
// Icons
// ========================================

const MicrophoneIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
  </svg>
);

export default ComponentsSettings;
