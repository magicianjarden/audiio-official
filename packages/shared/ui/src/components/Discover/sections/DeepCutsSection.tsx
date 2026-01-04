/**
 * DeepCutsSection - ML-powered deep cuts and hidden gems
 * Uses seed-based similarity to find lesser-known tracks similar to favorites
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles similar)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useLibraryStore } from '../../../stores/library-store';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface DeepCutsSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const DeepCutsSection: React.FC<DeepCutsSectionProps> = ({
  id,
  title = 'Deep Cuts',
  subtitle = 'Hidden gems you might love',
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { likedTracks } = useLibraryStore();

  // Get seed track IDs from liked tracks
  // NOTE: likedTracks is LibraryTrack[], extract the actual track.id
  const seedIds = useMemo(() => {
    return likedTracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map(lt => lt.track.id);
  }, [likedTracks]);

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with similar/seed-based generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'deep-cuts',
    title,
    subtitle,
    embedding: {
      method: 'similar',
      seedTrackIds: seedIds,
      exploration: 0.6, // Higher exploration for deep cuts
    },
    limit: maxItems,
  }), [title, subtitle, seedIds, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles similar
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: seedIds.length > 0,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Need liked tracks and tracks to show
  if (likedTracks.length === 0 || (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-deep-cuts-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showContextMenu}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default DeepCutsSection;
