/**
 * TimeGreetingSection - "Good morning" / "Good afternoon" / "Late night"
 * Context-aware greeting with personalized tracks based on time of day
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles mood generation)
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

interface TimeConfig {
  greeting: string;
  mood: string;
  icon: string;
}

function getTimeConfig(hour: number): TimeConfig {
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', mood: 'uplifting', icon: '☀️' };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', mood: 'focus', icon: '🌤️' };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', mood: 'chill', icon: '🌅' };
  } else {
    return { greeting: 'Late night', mood: 'chill', icon: '🌙' };
  }
}

export interface TimeGreetingSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const TimeGreetingSection: React.FC<TimeGreetingSectionProps> = ({
  id,
  context,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const timeConfig = getTimeConfig(context?.hour ?? new Date().getHours());

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with mood-based generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'time-greeting',
    title: `${timeConfig.icon} ${timeConfig.greeting}`,
    subtitle: 'Music for right now',
    embedding: {
      method: 'mood',
      mood: timeConfig.mood,
      exploration: 0.2,
    },
    limit: maxItems,
  }), [timeConfig.greeting, timeConfig.mood, timeConfig.icon, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles mood generation
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
      type="time-greeting"
      title={`${timeConfig.icon} ${timeConfig.greeting}`}
      subtitle="Music for right now"
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="time-greeting-section"
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

export default TimeGreetingSection;
