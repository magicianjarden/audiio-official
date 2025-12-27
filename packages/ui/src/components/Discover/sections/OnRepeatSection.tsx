/**
 * OnRepeatSection - Your most played tracks recently
 * Shows tracks you've been listening to on repeat
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

  const {
    generatePersonalizedPlaylist,
    getTracksFromPlaylist,
    getTasteStats,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    // Low exploration = more familiar tracks
    const playlist = generatePersonalizedPlaylist({
      limit: maxItems,
      exploration: 0.05, // Very low exploration for familiar tracks
    });

    if (!playlist) return [];

    debugLog('[OnRepeat]', `Generated playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, generatePersonalizedPlaylist, getTracksFromPlaylist]);

  const tasteStats = getTasteStats();

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Only show if user has some listening history
  if (!embeddingReady || tracks.length === 0 || !tasteStats.isValid) {
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
    </BaseSectionWrapper>
  );
};

export default OnRepeatSection;
