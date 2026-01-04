/**
 * SimilarTracksSection - Similar track recommendations based on current/recent plays
 * Uses the plugin pipeline for data fetching and ML ranking
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface SimilarTracksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const SimilarTracksSection: React.FC<SimilarTracksSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue, currentTrack, queue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Get a seed track from current track or queue
  const seedTrack = useMemo(() => {
    if (currentTrack) return currentTrack;
    // Use queue as fallback
    if (queue && queue.length > 0) {
      const recentCount = Math.min(5, queue.length);
      return queue[Math.floor(Math.random() * recentCount)];
    }
    return null;
  }, [currentTrack, queue]);

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery | null = seedTrack
    ? {
        strategy: 'plugin',
        sectionType: 'similar-tracks',
        title: title || `More like "${seedTrack.title}"`,
        subtitle: subtitle || `Similar to ${seedTrack.artists?.[0]?.name || 'your recent plays'}`,
        embedding: {
          method: 'similar',
          seedTrackIds: [seedTrack.id],
          exploration: 0.3,
          includeCollaborative: true,
          excludeTrackIds: [seedTrack.id], // Exclude the seed track
        },
        limit: maxItems,
      }
    : null;

  // Use plugin pipeline for data fetching
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!seedTrack,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!seedTrack || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `More like "${seedTrack.title}"`;
  const sectionSubtitle = subtitle || `Similar to ${seedTrack.artists?.[0]?.name || 'your recent plays'}`;

  return (
    <section id={id} className="discover-horizontal-section discover-similar-tracks-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
          <span className="discover-section-subtitle">{sectionSubtitle}</span>
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

export default SimilarTracksSection;
