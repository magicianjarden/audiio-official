/**
 * OnRepeatSection - Your most played tracks recently
 * Shows tracks you've been listening to on repeat
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

export interface OnRepeatSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const OnRepeatSection: React.FC<OnRepeatSectionProps> = ({
  id,
  title = 'On Repeat',
  subtitle = 'Your heavy rotation',
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized ML generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'on-repeat',
    title,
    subtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.05, // Very low exploration for familiar tracks
    },
    limit: maxItems,
  }), [title, subtitle, maxItems]);

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

  // Only show if we have tracks
  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="on-repeat"
      title={title}
      subtitle={subtitle}
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="on-repeat-section"
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
              showPlayCount
            />
          ))}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default OnRepeatSection;
