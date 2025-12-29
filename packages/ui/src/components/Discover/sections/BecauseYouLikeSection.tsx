/**
 * BecauseYouLikeSection - "Because you like [Artist]" personalized recommendations
 * Can have multiple instances, each based on a different top artist
 * Uses embedding-based artist radio with ML ranking fallback
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

export interface BecauseYouLikeSectionProps extends BaseSectionProps {
  artistIndex?: number; // Which top artist to use (0, 1, 2, etc.)
  maxItems?: number;
}

export const BecauseYouLikeSection: React.FC<BecauseYouLikeSectionProps> = ({
  id,
  title,
  context,
  onSeeAll,
  artistIndex = 0,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Embedding-based playlist generation
  const {
    generateArtistRadio,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Get target artist from context
  const targetArtist = context?.topArtists?.[artistIndex];
  const artistId = targetArtist?.toLowerCase().replace(/\s+/g, '-');
  const artistName = targetArtist || '';

  // Use embedding-based generation only
  const tracks = useMemo(() => {
    if (!artistId) {
      return [];
    }

    if (!embeddingReady) {
      debugLog('[BecauseYouLike]', 'Embedding not ready');
      return [];
    }

    if (tracksIndexed < 1) {
      debugLog('[BecauseYouLike]', 'No tracks indexed');
      return [];
    }

    const playlist = generateArtistRadio(artistId, { limit: maxItems });
    if (!playlist || playlist.tracks.length === 0) {
      debugLog('[BecauseYouLike]', `No tracks for artist "${targetArtist}"`);
      return [];
    }

    debugLog(
      '[BecauseYouLike]',
      `Generated "${targetArtist}" playlist: ${playlist.tracks.length} tracks (indexed: ${tracksIndexed})`
    );
    return getTracksFromPlaylist(playlist);
  }, [artistId, embeddingReady, tracksIndexed, maxItems, generateArtistRadio, getTracksFromPlaylist, targetArtist]);

  const isLoading = artistId && !embeddingReady;

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide section if no artist or no tracks
  if (!artistName || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `Because you like ${artistName}`;

  return (
    <section id={id} className="discover-horizontal-section discover-because-you-like-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
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

export default BecauseYouLikeSection;
