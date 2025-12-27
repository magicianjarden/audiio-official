/**
 * IsrcMatcherView Component
 * UI for matching local library tracks with Sposify database by ISRC/metadata
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSposifyStore } from '../stores';
import './IsrcMatcherView.css';

interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  spotifyId?: string;
}

interface MatchResult {
  localId: string;
  spotifyId: string | null;
  confidence: number;
  matchedBy: 'isrc' | 'exact' | 'normalized' | 'fuzzy' | 'none';
  spotifyTitle?: string;
  spotifyArtist?: string;
}

interface IsrcMatcherViewProps {
  tracks?: LocalTrack[];
  onMatchComplete?: (results: MatchResult[]) => void;
  onClose?: () => void;
}

export const IsrcMatcherView: React.FC<IsrcMatcherViewProps> = ({
  tracks = [],
  onMatchComplete,
  onClose,
}) => {
  const { databaseReady } = useSposifyStore();

  const [localTracks, setLocalTracks] = useState<LocalTrack[]>(tracks);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [minConfidence, setMinConfidence] = useState(0.7);

  // Group results by match type
  const matchStats = {
    isrc: matchResults.filter((r) => r.matchedBy === 'isrc').length,
    exact: matchResults.filter((r) => r.matchedBy === 'exact').length,
    normalized: matchResults.filter((r) => r.matchedBy === 'normalized').length,
    fuzzy: matchResults.filter((r) => r.matchedBy === 'fuzzy').length,
    none: matchResults.filter((r) => r.matchedBy === 'none').length,
    total: matchResults.length,
    matchRate:
      matchResults.length > 0
        ? ((matchResults.filter((r) => r.matchedBy !== 'none').length / matchResults.length) * 100).toFixed(1)
        : '0',
  };

  const startMatching = useCallback(async () => {
    if (!databaseReady || localTracks.length === 0) return;

    setIsMatching(true);
    setMatchProgress(0);
    setMatchResults([]);

    const results: MatchResult[] = [];
    const batchSize = 50;

    for (let i = 0; i < localTracks.length; i += batchSize) {
      const batch = localTracks.slice(i, i + batchSize);

      try {
        // Call IPC to match batch
        const batchResults = await window.api.sposify.matchByMetadata(
          batch.map((t) => ({
            id: t.id,
            trackName: t.title,
            artistName: t.artist,
            albumName: t.album,
            isrc: t.isrc,
          }))
        );

        results.push(...batchResults);
        setMatchProgress((i + batch.length) / localTracks.length);
      } catch (error) {
        console.error('[IsrcMatcher] Batch match error:', error);
        // Add failed tracks as unmatched
        batch.forEach((t) => {
          results.push({
            localId: t.id,
            spotifyId: null,
            confidence: 0,
            matchedBy: 'none',
          });
        });
      }
    }

    setMatchResults(results);
    setIsMatching(false);
    setMatchProgress(1);
    onMatchComplete?.(results);
  }, [databaseReady, localTracks, onMatchComplete]);

  const getTrackForResult = (result: MatchResult): LocalTrack | undefined => {
    return localTracks.find((t) => t.id === result.localId);
  };

  const filteredResults = matchResults.filter((result) => {
    if (filter === 'matched') return result.matchedBy !== 'none' && result.confidence >= minConfidence;
    if (filter === 'unmatched') return result.matchedBy === 'none' || result.confidence < minConfidence;
    return true;
  });

  const toggleTrackSelection = (id: string) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllMatched = () => {
    const matchedIds = matchResults
      .filter((r) => r.matchedBy !== 'none' && r.confidence >= minConfidence)
      .map((r) => r.localId);
    setSelectedTracks(new Set(matchedIds));
  };

  const applySelectedMatches = async () => {
    const toApply = matchResults.filter(
      (r) => selectedTracks.has(r.localId) && r.spotifyId && r.confidence >= minConfidence
    );

    for (const match of toApply) {
      try {
        await window.api.sposify.enrichTrack(match.localId, match.spotifyId!);
      } catch (error) {
        console.error('[IsrcMatcher] Failed to enrich track:', match.localId, error);
      }
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.95) return '#1db954';
    if (confidence >= 0.85) return '#4cd964';
    if (confidence >= 0.7) return '#feca57';
    return '#ff6b6b';
  };

  const getMatchTypeLabel = (type: MatchResult['matchedBy']): string => {
    switch (type) {
      case 'isrc':
        return 'ISRC';
      case 'exact':
        return 'Exact';
      case 'normalized':
        return 'Normalized';
      case 'fuzzy':
        return 'Fuzzy';
      default:
        return 'No Match';
    }
  };

  if (!databaseReady) {
    return (
      <div className="sposify-isrc-matcher">
        <div className="matcher-empty-state">
          <h3>Database Not Ready</h3>
          <p>Please wait for the Sposify database to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sposify-isrc-matcher">
      <header className="matcher-header">
        <div className="header-title">
          <h2>ISRC Matcher</h2>
          <span className="track-count">{localTracks.length} tracks</span>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </header>

      {/* Stats Bar */}
      {matchResults.length > 0 && (
        <div className="matcher-stats">
          <div className="stat-item highlight">
            <span className="stat-value">{matchStats.matchRate}%</span>
            <span className="stat-label">Match Rate</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item isrc">
            <span className="stat-value">{matchStats.isrc}</span>
            <span className="stat-label">ISRC</span>
          </div>
          <div className="stat-item exact">
            <span className="stat-value">{matchStats.exact}</span>
            <span className="stat-label">Exact</span>
          </div>
          <div className="stat-item normalized">
            <span className="stat-value">{matchStats.normalized}</span>
            <span className="stat-label">Normalized</span>
          </div>
          <div className="stat-item fuzzy">
            <span className="stat-value">{matchStats.fuzzy}</span>
            <span className="stat-label">Fuzzy</span>
          </div>
          <div className="stat-item none">
            <span className="stat-value">{matchStats.none}</span>
            <span className="stat-label">Unmatched</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="matcher-controls">
        {!isMatching && matchResults.length === 0 && (
          <button className="primary-btn" onClick={startMatching} disabled={localTracks.length === 0}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.5 3A6.5 6.5 0 0116 9.5c0 1.61-.59 3.09-1.57 4.23l.27.28v.79l5 4.99L18.49 21l-4.99-5h-.79l-.28-.27C11.41 16.59 10.11 17 9.5 17a6.5 6.5 0 110-13zm0 2C7.01 5 5 7.01 5 9.5S7.01 14 9.5 14 14 11.99 14 9.5 11.99 5 9.5 5z" />
            </svg>
            Start Matching
          </button>
        )}

        {isMatching && (
          <div className="matching-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${matchProgress * 100}%` }} />
            </div>
            <span className="progress-text">{Math.round(matchProgress * 100)}% complete</span>
          </div>
        )}

        {matchResults.length > 0 && !isMatching && (
          <>
            <div className="filter-controls">
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">All Tracks</option>
                <option value="matched">Matched Only</option>
                <option value="unmatched">Unmatched Only</option>
              </select>

              <div className="confidence-slider">
                <label>Min Confidence: {Math.round(minConfidence * 100)}%</label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="action-buttons">
              <button className="secondary-btn" onClick={selectAllMatched}>
                Select All Matched ({matchResults.filter((r) => r.matchedBy !== 'none' && r.confidence >= minConfidence).length})
              </button>
              <button className="primary-btn" onClick={applySelectedMatches} disabled={selectedTracks.size === 0}>
                Apply Selected ({selectedTracks.size})
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results List */}
      <div className="matcher-results">
        {filteredResults.length === 0 && matchResults.length > 0 && (
          <div className="matcher-empty-state">
            <p>No tracks match the current filter.</p>
          </div>
        )}

        {filteredResults.map((result) => {
          const track = getTrackForResult(result);
          if (!track) return null;

          const isSelected = selectedTracks.has(result.localId);
          const isMatched = result.matchedBy !== 'none' && result.confidence >= minConfidence;

          return (
            <div
              key={result.localId}
              className={`match-result-row ${isMatched ? 'matched' : 'unmatched'} ${isSelected ? 'selected' : ''}`}
              onClick={() => isMatched && toggleTrackSelection(result.localId)}
            >
              {isMatched && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTrackSelection(result.localId)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              <div className="track-info">
                <span className="track-title">{track.title}</span>
                <span className="track-artist">{track.artist}</span>
              </div>

              <div className="match-info">
                <span
                  className={`match-type ${result.matchedBy}`}
                  style={{ borderColor: getConfidenceColor(result.confidence) }}
                >
                  {getMatchTypeLabel(result.matchedBy)}
                </span>
                {isMatched && (
                  <span className="confidence" style={{ color: getConfidenceColor(result.confidence) }}>
                    {Math.round(result.confidence * 100)}%
                  </span>
                )}
              </div>

              {result.spotifyTitle && (
                <div className="spotify-match">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  <span>
                    {result.spotifyTitle} - {result.spotifyArtist}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Add window.api type extension
declare global {
  interface Window {
    api: {
      sposify: Window['api']['sposify'] & {
        matchByMetadata: (
          tracks: Array<{
            id: string;
            trackName: string;
            artistName: string;
            albumName?: string;
            isrc?: string;
          }>
        ) => Promise<MatchResult[]>;
        enrichTrack: (localId: string, spotifyId: string) => Promise<{ success: boolean }>;
      };
    };
  }
}

export default IsrcMatcherView;
