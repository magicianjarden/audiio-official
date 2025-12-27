/**
 * TopMixSection - Pure taste profile-based recommendations
 * Your personal mix based entirely on your taste profile
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

    // Moderate exploration for balanced mix
    const playlist = generatePersonalizedPlaylist({
      limit: maxItems,
      exploration: 0.2,
    });

    if (!playlist) return [];

    debugLog('[TopMix]', `Generated playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, generatePersonalizedPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!embeddingReady || tracks.length === 0 || !tasteStats.isValid) {
    return null;
  }

  // Build subtitle with top genres
  const genreText = tasteStats.topGenres.slice(0, 2).join(', ');
  const dynamicSubtitle = genreText ? `${genreText} and more` : subtitle;

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

export default TopMixSection;
