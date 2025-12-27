/**
 * DiscoverWeeklySection - Mix of familiar and new music
 * Balanced exploration playlist updated weekly
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, ShuffleIcon } from '@audiio/icons';
import { debugLog } from '../../../utils/debug';

export interface DiscoverWeeklySectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const DiscoverWeeklySection: React.FC<DiscoverWeeklySectionProps> = ({
  id,
  title = 'Discover Weekly',
  subtitle = 'Your personalized mix of new and familiar',
  context,
  onSeeAll,
  maxItems = 20,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const {
    generateDiscoveryPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    // Balanced exploration for discover weekly
    const playlist = generateDiscoveryPlaylist({
      limit: maxItems,
      exploration: 0.5, // 50% familiar, 50% new
    });

    if (!playlist) return [];

    debugLog('[DiscoverWeekly]', `Generated playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, generateDiscoveryPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0 && tracks[0]) {
      setQueue(tracks, 0);
      play(tracks[0]);
    }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      if (shuffled[0]) {
        setQueue(shuffled, 0);
        play(shuffled[0]);
      }
    }
  };

  if (!embeddingReady || tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="discover-weekly"
      title={title}
      subtitle={subtitle}
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="discover-weekly-section"
    >
      <div className="discover-weekly-header">
        <div className="discover-weekly-info">
          <span className="discover-weekly-count">{tracks.length} tracks</span>
          <span className="discover-weekly-updated">Updated weekly</span>
        </div>
        <div className="discover-weekly-actions">
          <button className="discover-weekly-play" onClick={handlePlayAll}>
            <PlayIcon size={16} />
            <span>Play</span>
          </button>
          <button className="discover-weekly-shuffle" onClick={handleShuffle}>
            <ShuffleIcon size={16} />
          </button>
        </div>
      </div>

      <div className="discover-horizontal-scroll">
        {tracks.slice(0, 12).map((track, index) => (
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

export default DiscoverWeeklySection;
