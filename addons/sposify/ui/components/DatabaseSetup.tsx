/**
 * DatabaseSetup Component
 * Shows database setup progress (download/build) on first run
 */

import React, { useEffect, useState } from 'react';
import { useSposifyStore } from '../stores';
import './DatabaseSetup.css';

interface SetupProgress {
  phase: 'checking' | 'downloading' | 'extracting' | 'building' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  speed?: number;
}

interface DatabaseSetupProps {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const PHASE_ICONS: Record<SetupProgress['phase'], JSX.Element> = {
  checking: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8z">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  ),
  downloading: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
    </svg>
  ),
  extracting: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  ),
  verifying: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  ),
  complete: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  ),
};

const PHASE_LABELS: Record<SetupProgress['phase'], string> = {
  checking: 'Checking database...',
  downloading: 'Downloading database...',
  extracting: 'Extracting files...',
  building: 'Building sample database...',
  verifying: 'Verifying integrity...',
  complete: 'Setup complete!',
  error: 'Setup failed',
};

export const DatabaseSetup: React.FC<DatabaseSetupProps> = ({ onComplete, onError }) => {
  const { initializeDatabase, databaseReady } = useSposifyStore();
  const [progress, setProgress] = useState<SetupProgress>({
    phase: 'checking',
    progress: 0,
    message: 'Initializing...',
  });
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    if (isStarted) return;
    setIsStarted(true);

    // Listen for setup progress events
    const unsubscribe = window.api.sposify.onSetupProgress((p: SetupProgress) => {
      setProgress(p);

      if (p.phase === 'complete') {
        onComplete?.();
      } else if (p.phase === 'error') {
        onError?.(p.message);
      }
    });

    // Start initialization
    initializeDatabase();

    return () => {
      unsubscribe();
    };
  }, [isStarted, initializeDatabase, onComplete, onError]);

  // If already ready, show complete immediately
  useEffect(() => {
    if (databaseReady && progress.phase !== 'complete') {
      setProgress({
        phase: 'complete',
        progress: 1,
        message: 'Database ready',
      });
      onComplete?.();
    }
  }, [databaseReady, progress.phase, onComplete]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <div className="sposify-database-setup">
      <div className="setup-icon-container">
        <div className={`setup-icon ${progress.phase}`}>
          {PHASE_ICONS[progress.phase]}
        </div>
      </div>

      <h3 className="setup-title">{PHASE_LABELS[progress.phase]}</h3>

      <p className="setup-message">{progress.message}</p>

      {(progress.phase === 'downloading' || progress.phase === 'extracting' || progress.phase === 'building') && (
        <div className="setup-progress-container">
          <div className="setup-progress-bar">
            <div
              className="setup-progress-fill"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
          <div className="setup-progress-stats">
            <span className="progress-percent">{Math.round(progress.progress * 100)}%</span>
            {progress.bytesDownloaded !== undefined && progress.totalBytes !== undefined && (
              <span className="progress-bytes">
                {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
              </span>
            )}
            {progress.speed !== undefined && (
              <span className="progress-speed">{formatSpeed(progress.speed)}</span>
            )}
          </div>
        </div>
      )}

      {progress.phase === 'complete' && (
        <div className="setup-complete-info">
          <p>Sposify database is ready to use.</p>
        </div>
      )}

      {progress.phase === 'error' && (
        <div className="setup-error-info">
          <p>There was a problem setting up the database.</p>
          <button
            className="retry-btn"
            onClick={() => {
              setProgress({ phase: 'checking', progress: 0, message: 'Retrying...' });
              setIsStarted(false);
            }}
          >
            Try Again
          </button>
        </div>
      )}

      <div className="setup-description">
        <p>
          {progress.phase === 'downloading'
            ? 'Downloading the Sposify database with 1M+ tracks, audio features, and playlist metadata.'
            : progress.phase === 'building'
            ? 'Building a sample database for testing. For full functionality, the complete database will be downloaded when available.'
            : 'The Sposify database enables matching your local music with Spotify metadata, audio features, and playlist discovery.'}
        </p>
      </div>
    </div>
  );
};

export default DatabaseSetup;
