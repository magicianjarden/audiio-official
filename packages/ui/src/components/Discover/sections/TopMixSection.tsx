/**
 * TopMixSection - Pure taste profile-based recommendations
 * Your personal mix based entirely on your taste profile
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles personalization)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface TopMixSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const TopMixSection: React.FC<TopMixSectionProps> = ({
  id,
  title = 'Your Top Mix',
  subtitle = 'Based on everything you love',
  context,
  onSeeAll,
  maxItems = 12,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build subtitle from context if available
  const dynamicSubtitle = useMemo(() => {
    if (context?.topGenres?.length) {
      const genreText = context.topGenres.slice(0, 2).join(', ');
      return genreText ? `${genreText} and more` : subtitle;
    }
    return subtitle;
  }, [context?.topGenres, subtitle]);

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized ML generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'top-mix',
    title,
    subtitle: dynamicSubtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.2, // Moderate exploration for balanced mix
    },
    limit: maxItems,
  }), [title, dynamicSubtitle, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles personalization
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

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="top-mix"
      title={title}
      subtitle={dynamicSubtitle}
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="top-mix-section"
    >
      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {Array.from({ length: 6 }).map((_, i) => (
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
    </BaseSectionWrapper>
  );
};

export default TopMixSection;
