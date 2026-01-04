/**
 * BlindPicksSection - Random discovery to expand taste
 * Uses the plugin pipeline for data fetching with high exploration
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useLibraryStore } from '../../../stores/library-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import { RefreshIcon } from '@audiio/icons';

export interface BlindPicksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const BlindPicksSection: React.FC<BlindPicksSectionProps> = ({
  id,
  title = 'Blind Picks',
  subtitle = 'Songs you haven\'t heard yet',
  context,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue, history } = usePlayerStore();
  const { likedTracks, isLiked } = useLibraryStore();
  const { showContextMenu } = useTrackContextMenu();
  const [refreshKey, setRefreshKey] = useState(0);

  // Get set of recently played track IDs to exclude
  const recentlyPlayedIds = useMemo(() => {
    const ids = new Set<string>();
    if (history) {
      history.forEach(h => ids.add(h.trackId));
    }
    return ids;
  }, [history]);

  // Get set of liked track IDs to exclude
  // NOTE: likedTracks is LibraryTrack[] (wrapper objects), access t.track.id
  const likedTrackIds = useMemo(() => {
    const ids = new Set<string>();
    likedTracks.forEach(t => ids.add(t.track.id));
    return ids;
  }, [likedTracks]);

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'blind-picks',
    title,
    subtitle,
    embedding: {
      method: 'discovery',
      exploration: 0.95, // 95% new/unfamiliar
      includeCollaborative: false, // Pure discovery
      excludeTrackIds: [...recentlyPlayedIds, ...likedTrackIds],
    },
    limit: maxItems * 2, // Request more to filter
  };

  // Use plugin pipeline for data fetching
  const { tracks: rawTracks, isLoading, refetch } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems * 2,
    deps: [refreshKey], // Refresh when key changes
  });

  // Filter out liked and recently played tracks
  const tracks = useMemo(() => {
    return rawTracks
      .filter(track =>
        !likedTrackIds.has(track.id) &&
        !recentlyPlayedIds.has(track.id) &&
        !isLiked(track.id)
      )
      .slice(0, maxItems);
  }, [rawTracks, likedTrackIds, recentlyPlayedIds, isLiked, maxItems]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Show empty state instead of hiding
  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <BaseSectionWrapper
      id={id}
      type="blind-picks"
      title={title}
      subtitle={subtitle}
      context={context}
      onSeeAll={onSeeAll}
      className="blind-picks-section"
    >
      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Finding new music for you...</p>
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
          {/* Refresh button as last card */}
          <button
            className="blind-picks-refresh-card"
            onClick={handleRefresh}
            title="Get new picks"
          >
            <RefreshIcon size={24} />
            <span>More picks</span>
          </button>
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default BlindPicksSection;
