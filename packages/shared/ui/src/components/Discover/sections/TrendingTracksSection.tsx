/**
 * TrendingTracksSection - Horizontal scroll of trending/popular tracks
 * Uses the plugin pipeline for data fetching and ML ranking
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface TrendingTracksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const TrendingTracksSection: React.FC<TrendingTracksSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  onSeeAll,
  isPersonalized,
  maxItems = 12,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'trending-tracks',
    title: title || 'Trending Songs',
    subtitle,
    search: query ? { query } : undefined,
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

  // Don't hide section completely - show placeholder if empty
  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <section id={id} className="discover-horizontal-section discover-trending-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          {subtitle && <span className="discover-section-subtitle">{subtitle}</span>}
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
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Unable to load trending tracks</p>
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

export default TrendingTracksSection;
