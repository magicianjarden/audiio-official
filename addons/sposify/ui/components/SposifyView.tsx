/**
 * SposifyView - Main view for Sposify plugin
 * This is the primary UI component that users see when they navigate to Sposify
 */

import React, { useEffect, useState } from 'react';
import { useSposifyStore } from '../stores/sposify-store';
import { DatabaseSetup } from './DatabaseSetup';
import { SposifyWizard } from './SposifyWizard';
import { PlaylistBrowser } from './PlaylistBrowser';
import { AudioFeaturesPanel } from './AudioFeaturesPanel';
import { IsrcMatcherView } from './IsrcMatcherView';
import './SposifyView.css';

type SposifyTab = 'import' | 'playlists' | 'features' | 'matcher';

export const SposifyView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SposifyTab>('import');
  const {
    databaseReady,
    wizardOpen,
    openWizard,
    closeWizard,
    initializeDatabase,
  } = useSposifyStore();

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  // If database isn't ready, show setup
  if (!databaseReady) {
    return (
      <div className="sposify-view">
        <DatabaseSetup />
      </div>
    );
  }

  return (
    <div className="sposify-view">
      <header className="sposify-header">
        <div className="sposify-title">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <div>
            <h1>Sposify</h1>
            <p>Import your Spotify data and discover new music</p>
          </div>
        </div>
      </header>

      <div className="sposify-tabs">
        <button
          className={`sposify-tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Import
        </button>
        <button
          className={`sposify-tab ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          Playlists
        </button>
        <button
          className={`sposify-tab ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          Audio Features
        </button>
        <button
          className={`sposify-tab ${activeTab === 'matcher' ? 'active' : ''}`}
          onClick={() => setActiveTab('matcher')}
        >
          ISRC Matcher
        </button>
      </div>

      <div className="sposify-tab-content">
        {activeTab === 'import' && (
          <div className="sposify-import-section">
            <h3>Import Your Spotify Data</h3>
            <p>
              Import your listening history, liked songs, and playlists from Spotify's data export.
              Request your data at{' '}
              <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener noreferrer">
                spotify.com/account/privacy
              </a>
            </p>
            <button className="sposify-import-btn primary" onClick={openWizard}>
              Start Import Wizard
            </button>
          </div>
        )}

        {activeTab === 'playlists' && <PlaylistBrowser />}
        {activeTab === 'features' && <AudioFeaturesPanel />}
        {activeTab === 'matcher' && <IsrcMatcherView />}
      </div>

      {wizardOpen && <SposifyWizard onClose={closeWizard} />}
    </div>
  );
};

export default SposifyView;
