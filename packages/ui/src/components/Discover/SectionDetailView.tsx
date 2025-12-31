/**
 * SectionDetailView - Full page view for "See All" from Discover sections
 * Routes to EmbeddingSectionDetailView for structured queries or
 * LegacySectionDetailView for text-based queries
 */

import React, { useEffect, useState } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSearchStore } from '../../stores/search-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { BackIcon } from '@audiio/icons';
import { TrackCard } from './TrackCard';
import { EmbeddingSectionDetailView } from './EmbeddingSectionDetailView';

/**
 * Main router component - decides which detail view to render
 */
export const SectionDetailView: React.FC = () => {
  const { selectedSectionData } = useNavigationStore();

  // Route to EmbeddingSectionDetailView for structured queries
  if (selectedSectionData?.structuredQuery) {
    return <EmbeddingSectionDetailView />;
  }

  // Fall back to legacy view for text queries
  return <LegacySectionDetailView />;
};

/**
 * Legacy detail view - handles text-based queries
 * @deprecated Use structured queries with EmbeddingSectionDetailView
 */
const LegacySectionDetailView: React.FC = () => {
  const { selectedSectionData, goBack } = useNavigationStore();
  const { search, results, isSearching: isLoading } = useSearchStore();
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);

  useEffect(() => {
    if (selectedSectionData?.query) {
      // Search for more tracks using the section's query
      search(selectedSectionData.query);
    }
  }, [selectedSectionData?.query, search]);

  useEffect(() => {
    // Use search results when available
    if (results?.tracks) {
      setTracks(results.tracks);
    }
  }, [results?.tracks]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!selectedSectionData) {
    return (
      <div className="section-detail-view">
        <div className="section-detail-empty">
          <p>Section not found</p>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-detail-view">
      <header className="section-detail-header">
        <button className="back-btn-round" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
        <div className="section-detail-title-area">
          <h1 className="section-detail-title">{selectedSectionData.title}</h1>
          {selectedSectionData.subtitle && (
            <p className="section-detail-subtitle">{selectedSectionData.subtitle}</p>
          )}
        </div>
      </header>

      <div className="section-detail-content">
        {isLoading ? (
          <div className="section-detail-grid">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="discover-card-skeleton" />
            ))}
          </div>
        ) : tracks.length > 0 ? (
          <div className="section-detail-grid">
            {tracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={showContextMenu}
              />
            ))}
          </div>
        ) : (
          <div className="section-detail-empty">
            <p>No tracks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectionDetailView;
