/**
 * TimeGreetingSection - "Good morning" / "Good afternoon" / "Late night"
 * Context-aware greeting with personalized tracks based on time of day
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

  const {
    generateMoodPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const timeConfig = getTimeConfig(context?.hour ?? new Date().getHours());

  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const playlist = generateMoodPlaylist(timeConfig.mood, { limit: maxItems });
    if (!playlist) return [];

    debugLog(
      '[TimeGreeting]',
      `Generated "${timeConfig.greeting}" playlist: ${playlist.tracks.length} tracks`
    );
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, timeConfig.mood, maxItems, generateMoodPlaylist, getTracksFromPlaylist, timeConfig.greeting]);

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
      type="time-greeting"
      title={`${timeConfig.icon} ${timeConfig.greeting}`}
      subtitle="Music for right now"
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="time-greeting-section"
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

export default TimeGreetingSection;
