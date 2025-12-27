/**
 * BlindPicksSection - Random discovery to expand taste
 * High exploration playlist to discover new sounds
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { RefreshIcon } from '@audiio/icons';
import { debugLog } from '../../../utils/debug';

export interface BlindPicksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const BlindPicksSection: React.FC<BlindPicksSectionProps> = ({
  id,
  title = 'Blind Picks',
  subtitle = 'Expand your horizons',
  context,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [refreshKey, setRefreshKey] = useState(0);

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

    // High exploration for maximum discovery
    const playlist = generateDiscoveryPlaylist({
      limit: maxItems,
      exploration: 0.9, // 90% new/unfamiliar
    });

    if (!playlist) return [];

    debugLog('[BlindPicks]', `Generated playlist: ${playlist.tracks.length} tracks (refresh: ${refreshKey})`);
    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, refreshKey, generateDiscoveryPlaylist, getTracksFromPlaylist]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

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
      type="blind-picks"
      title={`🎲 ${title}`}
      subtitle={subtitle}
      context={context}
      onSeeAll={onSeeAll}
      className="blind-picks-section"
    >
      <div className="blind-picks-header">
        <button className="blind-picks-refresh" onClick={handleRefresh} title="Get new picks">
          <RefreshIcon size={16} />
          <span>Shuffle</span>
        </button>
      </div>

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

export default BlindPicksSection;
