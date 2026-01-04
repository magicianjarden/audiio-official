/**
 * FreshFindsSection - ML-powered discovery of new music
 * Uses the plugin pipeline for data fetching and high exploration for variety
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface FreshFindsSectionProps extends BaseSectionProps {
  maxItems?: number;
  explorationLevel?: number; // 0-1, higher = more adventurous
}

export const FreshFindsSection: React.FC<FreshFindsSectionProps> = ({
  id,
  title = 'Fresh Finds',
  subtitle = 'Expand your horizons',
  onSeeAll,
  maxItems = 10,
  explorationLevel = 0.8, // High exploration by default
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'fresh-finds',
    title,
    subtitle,
    embedding: {
      method: 'discovery',
      exploration: explorationLevel,
      includeCollaborative: true,
    },
    limit: maxItems,
  };

  // Use plugin pipeline for data fetching
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide section when no data available
  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-fresh-finds-section">
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
          {[1, 2, 3, 4, 5, 6].map(i => (
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

export default FreshFindsSection;
