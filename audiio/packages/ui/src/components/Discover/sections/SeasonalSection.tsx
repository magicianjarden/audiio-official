/**
 * SeasonalSection - Summer vibes, Winter warmers, Holiday music
 * Season and holiday-aware music recommendations
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

interface SeasonConfig {
  name: string;
  mood: string;
  icon: string;
  gradient: [string, string];
}

function getSeasonConfig(month: number): SeasonConfig {
  // December holidays
  if (month === 11) {
    return {
      name: 'Holiday Vibes',
      mood: 'uplifting',
      icon: '🎄',
      gradient: ['#c41e3a', '#228b22'],
    };
  }
  // Winter (Dec-Feb in Northern Hemisphere)
  if (month === 0 || month === 1) {
    return {
      name: 'Winter Warmers',
      mood: 'chill',
      icon: '❄️',
      gradient: ['#667eea', '#764ba2'],
    };
  }
  // Spring (Mar-May)
  if (month >= 2 && month <= 4) {
    return {
      name: 'Spring Awakening',
      mood: 'uplifting',
      icon: '🌸',
      gradient: ['#ffecd2', '#fcb69f'],
    };
  }
  // Summer (Jun-Aug)
  if (month >= 5 && month <= 7) {
    return {
      name: 'Summer Vibes',
      mood: 'energetic',
      icon: '☀️',
      gradient: ['#f12711', '#f5af19'],
    };
  }
  // Fall (Sep-Nov)
  return {
    name: 'Autumn Mood',
    mood: 'chill',
    icon: '🍂',
    gradient: ['#ff9966', '#ff5e62'],
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

  const {
    generateMoodPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const month = new Date().getMonth();
  const seasonConfig = getSeasonConfig(month);

  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const playlist = generateMoodPlaylist(seasonConfig.mood, { limit: maxItems });
    if (!playlist) return [];

    debugLog('[Seasonal]', `Generated "${seasonConfig.name}" playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, seasonConfig.mood, maxItems, generateMoodPlaylist, getTracksFromPlaylist, seasonConfig.name]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!embeddingReady || tracks.length === 0) {
    return null;
  }

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

export default SeasonalSection;
