/**
 * ArtistRadioSection - "More like [Artist Name]" based on user's top artist
 * Uses ML ranking for intelligent track ordering
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

export interface ArtistRadioSectionProps extends BaseSectionProps {
  artistName?: string;
  maxItems?: number;
}

export const ArtistRadioSection: React.FC<ArtistRadioSectionProps> = ({
  id,
  title,
  subtitle,
  context,
  onSeeAll,
  maxItems = 10,
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

  // Get top artist from context
  const topArtist = context?.topArtists?.[0];
  const artistId = topArtist?.toLowerCase().replace(/\s+/g, '-');
  const artistName = topArtist || '';

  // Use embedding-based generation only
  const tracks = useMemo(() => {
    if (!artistId) {
      return [];
    }

    if (!embeddingReady) {
      debugLog('[ArtistRadio]', 'Embedding not ready');
      return [];
    }

    if (tracksIndexed < 1) {
      debugLog('[ArtistRadio]', 'No tracks indexed');
      return [];
    }

    const playlist = generateArtistRadio(artistId, { limit: maxItems });
    if (!playlist || playlist.tracks.length === 0) {
      debugLog('[ArtistRadio]', `No tracks for artist "${topArtist}"`);
      return [];
    }

    debugLog(
      '[ArtistRadio]',
      `Generated "${topArtist}" radio: ${playlist.tracks.length} tracks (indexed: ${tracksIndexed})`
    );
    return getTracksFromPlaylist(playlist);
  }, [artistId, embeddingReady, tracksIndexed, maxItems, generateArtistRadio, getTracksFromPlaylist, topArtist]);

  const isLoading = artistId && !embeddingReady;

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide section if no top artist or no tracks
  if (!artistName || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `More like ${artistName}`;
  const sectionSubtitle = subtitle || 'Based on your listening';

  return (
    <section id={id} className="discover-horizontal-section discover-artist-radio-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
          <span className="discover-section-subtitle">{sectionSubtitle}</span>
          <span className="discover-section-personalized-tag">For You</span>
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5, 6].map(i => (
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

export default ArtistRadioSection;
