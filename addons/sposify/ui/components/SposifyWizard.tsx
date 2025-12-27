/**
 * Sposify Import Wizard
 * Multi-step wizard for importing Spotify data
 */

import React from 'react';
import { useSposifyStore } from '../stores/sposify-store';
import { FileDropZone } from './FileDropZone';
import { ImportProgress } from './ImportProgress';
import './SposifyWizard.css';

const WIZARD_STEPS = [
  { title: 'Welcome', description: 'Import your Spotify data' },
  { title: 'Select Files', description: 'Choose your export files' },
  { title: 'Options', description: 'Configure import settings' },
  { title: 'Preview', description: 'Review matched tracks' },
  { title: 'Import', description: 'Importing your data' },
  { title: 'Complete', description: 'Import finished' },
];

export const SposifyWizard: React.FC = () => {
  const {
    wizardOpen,
    wizardStep,
    importPhase,
    importProgress,
    importError,
    selectedFiles,
    selectedFolder,
    parsedData,
    matchedLikedTracks,
    unmatchedLikedTracks,
    matchStats,
    importOptions,
    lastImportStats,
    closeWizard,
    resetWizard,
    nextStep,
    prevStep,
    selectFiles,
    selectFolder,
    clearSelection,
    parseSelectedFiles,
    matchParsedData,
    executeImport,
    updateImportOptions,
    clearError,
  } = useSposifyStore();

  if (!wizardOpen) return null;

  const hasSelection = selectedFiles.length > 0 || selectedFolder !== null;
  const hasParsedData = parsedData !== null;
  const hasMatchedData = matchedLikedTracks.length > 0;

  const handleNext = async () => {
    switch (wizardStep) {
      case 1: // After file selection, parse
        if (hasSelection) {
          await parseSelectedFiles();
          nextStep();
        }
        break;
      case 2: // After options, match
        if (hasParsedData) {
          await matchParsedData();
          nextStep();
        }
        break;
      case 3: // After preview, import
        nextStep();
        await executeImport();
        nextStep();
        break;
      default:
        nextStep();
    }
  };

  const canProceed = () => {
    switch (wizardStep) {
      case 0: return true;
      case 1: return hasSelection;
      case 2: return hasParsedData;
      case 3: return hasMatchedData;
      case 4: return importPhase === 'complete';
      case 5: return true;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (wizardStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return (
          <FileSelectionStep
            selectedFiles={selectedFiles}
            selectedFolder={selectedFolder}
            onSelectFiles={selectFiles}
            onSelectFolder={selectFolder}
            onClear={clearSelection}
          />
        );
      case 2:
        return (
          <OptionsStep
            parsedData={parsedData}
            options={importOptions}
            onUpdateOptions={updateImportOptions}
          />
        );
      case 3:
        return (
          <PreviewStep
            matchedTracks={matchedLikedTracks}
            unmatchedTracks={unmatchedLikedTracks}
            matchStats={matchStats}
          />
        );
      case 4:
        return (
          <ImportProgress
            phase={importPhase}
            progress={importProgress}
            error={importError}
          />
        );
      case 5:
        return <CompleteStep stats={lastImportStats} />;
      default:
        return null;
    }
  };

  return (
    <div className="sposify-wizard-overlay" onClick={closeWizard}>
      <div className="sposify-wizard" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sposify-wizard-header">
          <div className="sposify-wizard-title">
            <span className="sposify-icon">🎵</span>
            <h2>Sposify Import</h2>
          </div>
          <button className="sposify-close-btn" onClick={closeWizard}>×</button>
        </div>

        {/* Progress Steps */}
        <div className="sposify-wizard-steps">
          {WIZARD_STEPS.map((step, index) => (
            <div
              key={index}
              className={`sposify-step ${index === wizardStep ? 'active' : ''} ${index < wizardStep ? 'completed' : ''}`}
            >
              <div className="sposify-step-number">{index < wizardStep ? '✓' : index + 1}</div>
              <div className="sposify-step-label">{step.title}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="sposify-wizard-content">
          {importError && (
            <div className="sposify-error-banner">
              <span>{importError}</span>
              <button onClick={clearError}>Dismiss</button>
            </div>
          )}
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="sposify-wizard-footer">
          <button
            className="sposify-btn secondary"
            onClick={wizardStep === 0 ? closeWizard : prevStep}
            disabled={wizardStep === 4 && importPhase === 'importing'}
          >
            {wizardStep === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            className="sposify-btn primary"
            onClick={wizardStep === 5 ? () => { resetWizard(); closeWizard(); } : handleNext}
            disabled={!canProceed() || (wizardStep === 4 && importPhase === 'importing')}
          >
            {wizardStep === 5 ? 'Done' : wizardStep === 3 ? 'Start Import' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Step Components
const WelcomeStep: React.FC = () => (
  <div className="sposify-step-content welcome">
    <div className="sposify-welcome-icon">🎧</div>
    <h3>Import Your Spotify Data</h3>
    <p>
      Sposify lets you import your Spotify listening history, liked songs, and playlists
      into Audiio. Your data will be matched against our database of 1 million tracks to
      enrich your library with audio features and personalize your recommendations.
    </p>
    <div className="sposify-features">
      <div className="sposify-feature">
        <span className="icon">📊</span>
        <span>Import streaming history</span>
      </div>
      <div className="sposify-feature">
        <span className="icon">❤️</span>
        <span>Import liked songs</span>
      </div>
      <div className="sposify-feature">
        <span className="icon">📝</span>
        <span>Import playlists</span>
      </div>
      <div className="sposify-feature">
        <span className="icon">🎵</span>
        <span>Audio features enrichment</span>
      </div>
    </div>
    <div className="sposify-info-box">
      <strong>How to get your Spotify data:</strong>
      <ol>
        <li>Go to <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener">Spotify Privacy Settings</a></li>
        <li>Request your data under "Download your data"</li>
        <li>Wait for Spotify to email you (can take a few days)</li>
        <li>Download and extract the ZIP file</li>
      </ol>
    </div>
  </div>
);

interface FileSelectionStepProps {
  selectedFiles: string[];
  selectedFolder: string | null;
  onSelectFiles: () => void;
  onSelectFolder: () => void;
  onClear: () => void;
}

const FileSelectionStep: React.FC<FileSelectionStepProps> = ({
  selectedFiles,
  selectedFolder,
  onSelectFiles,
  onSelectFolder,
  onClear,
}) => (
  <div className="sposify-step-content file-selection">
    <h3>Select Your Spotify Export</h3>
    <p>Choose either individual JSON files or the entire export folder.</p>

    <FileDropZone
      selectedFiles={selectedFiles}
      selectedFolder={selectedFolder}
      onSelectFiles={onSelectFiles}
      onSelectFolder={onSelectFolder}
      onClear={onClear}
    />

    <div className="sposify-file-types">
      <h4>Supported Files:</h4>
      <ul>
        <li><code>StreamingHistory*.json</code> - Your listening history</li>
        <li><code>YourLibrary.json</code> - Liked songs and saved albums</li>
        <li><code>Playlist*.json</code> - Your playlists</li>
      </ul>
    </div>
  </div>
);

interface OptionsStepProps {
  parsedData: any;
  options: any;
  onUpdateOptions: (options: any) => void;
}

const OptionsStep: React.FC<OptionsStepProps> = ({ parsedData, options, onUpdateOptions }) => (
  <div className="sposify-step-content options">
    <h3>Import Options</h3>

    {parsedData && (
      <div className="sposify-parsed-summary">
        <h4>Found in your export:</h4>
        <div className="sposify-stats-grid">
          <div className="stat">
            <span className="value">{parsedData.stats.totalHistoryEntries.toLocaleString()}</span>
            <span className="label">History entries</span>
          </div>
          <div className="stat">
            <span className="value">{parsedData.stats.likedTracksCount.toLocaleString()}</span>
            <span className="label">Liked tracks</span>
          </div>
          <div className="stat">
            <span className="value">{parsedData.stats.playlistsCount}</span>
            <span className="label">Playlists</span>
          </div>
          <div className="stat">
            <span className="value">{Math.round(parsedData.stats.totalPlaytimeMs / 3600000)}h</span>
            <span className="label">Total playtime</span>
          </div>
        </div>
      </div>
    )}

    <div className="sposify-options-form">
      <label className="sposify-checkbox">
        <input
          type="checkbox"
          checked={options.importHistory}
          onChange={(e) => onUpdateOptions({ importHistory: e.target.checked })}
        />
        <span>Import streaming history</span>
        <small>Use your listening history to improve recommendations</small>
      </label>

      <label className="sposify-checkbox">
        <input
          type="checkbox"
          checked={options.importLikedTracks}
          onChange={(e) => onUpdateOptions({ importLikedTracks: e.target.checked })}
        />
        <span>Import liked tracks</span>
        <small>Add liked songs to your Audiio library</small>
      </label>

      <label className="sposify-checkbox">
        <input
          type="checkbox"
          checked={options.importPlaylists}
          onChange={(e) => onUpdateOptions({ importPlaylists: e.target.checked })}
        />
        <span>Import playlists</span>
        <small>Recreate your Spotify playlists in Audiio</small>
      </label>

      <label className="sposify-checkbox">
        <input
          type="checkbox"
          checked={options.importBannedAsDisliked}
          onChange={(e) => onUpdateOptions({ importBannedAsDisliked: e.target.checked })}
        />
        <span>Import banned tracks as dislikes</span>
        <small>Add blocked tracks to your dislike list</small>
      </label>

      <div className="sposify-input-group">
        <label>Playlist name prefix</label>
        <input
          type="text"
          value={options.playlistPrefix}
          onChange={(e) => onUpdateOptions({ playlistPrefix: e.target.value })}
          placeholder="e.g., [Spotify] "
        />
      </div>

      <div className="sposify-input-group">
        <label>Minimum match confidence ({Math.round(options.minConfidence * 100)}%)</label>
        <input
          type="range"
          min="50"
          max="100"
          value={options.minConfidence * 100}
          onChange={(e) => onUpdateOptions({ minConfidence: parseInt(e.target.value) / 100 })}
        />
      </div>
    </div>
  </div>
);

interface PreviewStepProps {
  matchedTracks: any[];
  unmatchedTracks: any[];
  matchStats: any;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ matchedTracks, unmatchedTracks, matchStats }) => (
  <div className="sposify-step-content preview">
    <h3>Preview Import</h3>

    {matchStats && (
      <div className="sposify-match-summary">
        <div className="sposify-match-rate">
          <div className="rate-circle">
            <span className="percentage">{Math.round(matchStats.likedTracksMatchRate * 100)}%</span>
            <span className="label">Match Rate</span>
          </div>
        </div>
        <div className="sposify-match-counts">
          <div className="count matched">
            <span className="number">{matchedTracks.length}</span>
            <span className="label">Tracks matched</span>
          </div>
          <div className="count unmatched">
            <span className="number">{unmatchedTracks.length}</span>
            <span className="label">Not found</span>
          </div>
        </div>
      </div>
    )}

    <div className="sposify-preview-list">
      <h4>Matched Tracks</h4>
      <div className="sposify-track-list">
        {matchedTracks.slice(0, 20).map((track, i) => (
          <div key={i} className="sposify-track-item">
            <div className="track-info">
              <span className="title">{track.original.trackName}</span>
              <span className="artist">{track.original.artistName}</span>
            </div>
            <div className="match-info">
              <span className={`confidence ${track.confidence > 0.9 ? 'high' : track.confidence > 0.7 ? 'medium' : 'low'}`}>
                {Math.round(track.confidence * 100)}%
              </span>
              <span className="method">{track.matchedBy}</span>
            </div>
          </div>
        ))}
        {matchedTracks.length > 20 && (
          <div className="sposify-more-tracks">
            +{matchedTracks.length - 20} more tracks
          </div>
        )}
      </div>
    </div>

    {unmatchedTracks.length > 0 && (
      <details className="sposify-unmatched-section">
        <summary>Show unmatched tracks ({unmatchedTracks.length})</summary>
        <div className="sposify-track-list unmatched">
          {unmatchedTracks.slice(0, 10).map((track, i) => (
            <div key={i} className="sposify-track-item unmatched">
              <span className="title">{track.trackName}</span>
              <span className="artist">{track.artistName}</span>
            </div>
          ))}
        </div>
      </details>
    )}
  </div>
);

interface CompleteStepProps {
  stats: any;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ stats }) => (
  <div className="sposify-step-content complete">
    <div className="sposify-success-icon">✓</div>
    <h3>Import Complete!</h3>

    {stats && (
      <div className="sposify-import-results">
        <div className="result-item">
          <span className="value">{stats.historyImported.toLocaleString()}</span>
          <span className="label">History entries imported</span>
        </div>
        <div className="result-item">
          <span className="value">{stats.tracksLiked}</span>
          <span className="label">Tracks added to likes</span>
        </div>
        <div className="result-item">
          <span className="value">{stats.playlistsCreated}</span>
          <span className="label">Playlists created</span>
        </div>
        <div className="result-item">
          <span className="value">{(stats.duration / 1000).toFixed(1)}s</span>
          <span className="label">Time taken</span>
        </div>
      </div>
    )}

    <p className="sposify-next-steps">
      Your Spotify data has been imported! Your recommendations will now be
      personalized based on your listening history.
    </p>
  </div>
);

export default SposifyWizard;
