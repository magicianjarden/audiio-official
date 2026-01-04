/**
 * RediscoverSection - Old favorites you haven't played in a while
 * Resurface tracks from your taste profile that got buried
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

export interface RediscoverSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const RediscoverSection: React.FC<RediscoverSectionProps> = ({
  id,
  title = 'Rediscover',
  subtitle = 'Tracks you might have forgotten',
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'rediscover',
    title,
    subtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.1, // Low exploration for familiar tracks
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
      type="rediscover"
      title={`🔄 ${title}`}
      subtitle={subtitle}
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="rediscover-section"
    >
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
    </BaseSectionWrapper>
  );
};

export default RediscoverSection;
