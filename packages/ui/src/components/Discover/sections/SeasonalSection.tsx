/**
 * SeasonalSection - Summer vibes, Winter warmers, Holiday music
 * Uses the plugin pipeline for season-aware recommendations
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

interface SeasonConfig {
  name: string;
  mood: string;
  icon: string;
  gradient: [string, string];
  searchTerms: string;
}

function getSeasonConfig(month: number): SeasonConfig {
  // Winter (Dec-Feb in Northern Hemisphere)
  if (month === 11 || month === 0 || month === 1) {
    return {
      name: 'Winter Warmers',
      mood: 'chill',
      icon: '❄️',
      gradient: ['#667eea', '#764ba2'],
      searchTerms: 'winter chill acoustic cozy',
    };
  }
  // Spring (Mar-May)
  if (month >= 2 && month <= 4) {
    return {
      name: 'Spring Awakening',
      mood: 'uplifting',
      icon: '🌸',
      gradient: ['#ffecd2', '#fcb69f'],
      searchTerms: 'spring uplifting fresh indie',
    };
  }
  // Summer (Jun-Aug)
  if (month >= 5 && month <= 7) {
    return {
      name: 'Summer Vibes',
      mood: 'energetic',
      icon: '☀️',
      gradient: ['#f12711', '#f5af19'],
      searchTerms: 'summer hits beach party dance',
    };
  }
  // Fall (Sep-Nov)
  return {
    name: 'Autumn Mood',
    mood: 'chill',
    icon: '🍂',
    gradient: ['#ff9966', '#ff5e62'],
    searchTerms: 'autumn fall chill acoustic',
  };
}

export interface SeasonalSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const SeasonalSection: React.FC<SeasonalSectionProps> = ({
  id,
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const month = new Date().getMonth();
  const seasonConfig = getSeasonConfig(month);

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'seasonal',
    title: `${seasonConfig.icon} ${seasonConfig.name}`,
    subtitle: 'Music for the season',
    search: { query: seasonConfig.searchTerms },
    embedding: {
      method: 'mood',
      mood: seasonConfig.mood,
      exploration: 0.4,
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
      type="seasonal"
      title={`${seasonConfig.icon} ${seasonConfig.name}`}
      subtitle="Music for the season"
      context={context}
      onSeeAll={onSeeAll}
      className="seasonal-section"
      style={{
        '--seasonal-gradient-start': seasonConfig.gradient[0],
        '--seasonal-gradient-end': seasonConfig.gradient[1],
      } as React.CSSProperties}
    >
      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Loading seasonal music...</p>
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

export default SeasonalSection;
