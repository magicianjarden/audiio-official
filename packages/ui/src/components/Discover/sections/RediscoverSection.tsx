/**
 * RediscoverSection - Old favorites you haven't played in a while
 * Resurface tracks from your taste profile that got buried
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

  const {
    generatePersonalizedPlaylist,
    getTracksFromPlaylist,
    getTasteStats,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const tasteStats = getTasteStats();

  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    // Low exploration to get familiar tracks, then we could filter for older ones
    // For now, we just get personalized tracks (in a real impl, we'd filter by last played)
    const playlist = generatePersonalizedPlaylist({
      limit: maxItems * 2, // Get extra to allow filtering
      exploration: 0.1,
    });

    if (!playlist) return [];

    const allTracks = getTracksFromPlaylist(playlist);

    // In a real implementation, we would filter by "last played" timestamp
    // For now, just return a shuffled subset to simulate variety
    const shuffled = [...allTracks].sort(() => Math.random() - 0.5);

    debugLog('[Rediscover]', `Generated playlist: ${shuffled.length} tracks`);
    return shuffled.slice(0, maxItems);
  }, [embeddingReady, tracksIndexed, maxItems, generatePersonalizedPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Only show for users with history
  if (!embeddingReady || tracks.length === 0 || !tasteStats.isValid) {
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
