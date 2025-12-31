/**
 * WeeklyRotationSection - Your personalized weekly music rotation
 * Uses the plugin pipeline for data fetching and ML ranking
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface WeeklyRotationSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const WeeklyRotationSection: React.FC<WeeklyRotationSectionProps> = ({
  id,
  title = 'Weekly Rotation',
  subtitle = 'Your heavy rotation this week',
  isPersonalized = true,
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'weekly-rotation',
    title,
    subtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.2, // Mostly familiar tracks
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

  // Show empty state instead of hiding
  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <BaseSectionWrapper
      id={id}
      type="weekly-rotation"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      context={context}
      onSeeAll={onSeeAll}
      className="weekly-rotation-section"
    >
      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Building your weekly rotation...</p>
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

export default WeeklyRotationSection;
