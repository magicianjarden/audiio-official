/**
 * DeepCutsSection - ML-powered deep cuts and hidden gems
 * Uses seed-based similarity to find lesser-known tracks similar to favorites
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useLibraryStore } from '../../../stores/library-store';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';

export interface DeepCutsSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const DeepCutsSection: React.FC<DeepCutsSectionProps> = ({
  id,
  title = 'Deep Cuts',
  subtitle = 'Hidden gems you might love',
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { likedTracks } = useLibraryStore();

  const {
    generateSeedPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Use liked tracks as seeds for finding similar deep cuts
  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    // Use up to 5 random liked tracks as seeds
    const seedIds = likedTracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map(t => t.id);

    if (seedIds.length === 0) {
      return [];
    }

    const playlist = generateSeedPlaylist(seedIds, {
      limit: maxItems,
      exploration: 0.6, // Moderate exploration for deep cuts
    });

    if (!playlist || playlist.tracks.length === 0) {
      return [];
    }

    // Filter out the seed tracks themselves
    const seedSet = new Set(seedIds);
    return getTracksFromPlaylist(playlist).filter(t => !seedSet.has(t.id));
  }, [embeddingReady, tracksIndexed, maxItems, likedTracks, generateSeedPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const isLoading = !embeddingReady;

  // Need liked tracks and embedding ready
  if (likedTracks.length === 0 || (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-deep-cuts-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
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
    </section>
  );
};

export default DeepCutsSection;
