/**
 * SimilarArtistsSection - Grid of artists similar to your favorites
 * Artist discovery based on your taste profile
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';

interface ArtistCard {
  id: string;
  name: string;
  artwork?: string;
  trackCount: number;
  tracks: UnifiedTrack[];
}

export interface SimilarArtistsSectionProps extends BaseSectionProps {
  maxArtists?: number;
}

export const SimilarArtistsSection: React.FC<SimilarArtistsSectionProps> = ({
  id,
  title = 'Artists For You',
  subtitle = 'Based on your listening',
  context,
  onSeeAll,
  maxArtists = 6,
}) => {
  const { play, setQueue } = usePlayerStore();

  const {
    generatePersonalizedPlaylist,
    getTracksFromPlaylist,
    getTasteStats,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const tasteStats = getTasteStats();

  // Get tracks and group by artist
  const artists = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const playlist = generatePersonalizedPlaylist({
      limit: 50, // Get more tracks to find diverse artists
      exploration: 0.3,
    });

    if (!playlist) return [];

    const tracks = getTracksFromPlaylist(playlist);

    // Group by artist
    const artistMap = new Map<string, ArtistCard>();

    for (const track of tracks) {
      const artist = track.artists[0];
      if (!artist) continue;

      const artistId = artist.id || artist.name.toLowerCase().replace(/\s+/g, '-');

      if (!artistMap.has(artistId)) {
        artistMap.set(artistId, {
          id: artistId,
          name: artist.name,
          artwork: artist.artwork?.medium || track.artwork?.medium,
          trackCount: 1,
          tracks: [track],
        });
      } else {
        const existing = artistMap.get(artistId)!;
        existing.trackCount++;
        existing.tracks.push(track);
        // Update artwork if we didn't have one
        if (!existing.artwork && (artist.artwork?.medium || track.artwork?.medium)) {
          existing.artwork = artist.artwork?.medium || track.artwork?.medium;
        }
      }
    }

    // Sort by track count and take top N
    return Array.from(artistMap.values())
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, maxArtists);
  }, [embeddingReady, tracksIndexed, maxArtists, generatePersonalizedPlaylist, getTracksFromPlaylist]);

  const handleArtistPlay = (artist: ArtistCard) => {
    if (artist.tracks.length > 0 && artist.tracks[0]) {
      setQueue(artist.tracks, 0);
      play(artist.tracks[0]);
    }
  };

  if (!embeddingReady || artists.length === 0 || !tasteStats.isValid) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="similar-artists"
      title={title}
      subtitle={subtitle}
      isPersonalized
      context={context}
      onSeeAll={onSeeAll}
      className="similar-artists-section"
    >
      <div className="similar-artists-grid">
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="similar-artist-card"
            onClick={() => handleArtistPlay(artist)}
          >
            <div className="similar-artist-artwork">
              {artist.artwork ? (
                <img src={artist.artwork} alt={artist.name} loading="lazy" />
              ) : (
                <div className="similar-artist-placeholder">
                  <MusicNoteIcon size={32} />
                </div>
              )}
              <div className="similar-artist-play-overlay">
                <PlayIcon size={24} />
              </div>
            </div>
            <div className="similar-artist-info">
              <span className="similar-artist-name">{artist.name}</span>
              <span className="similar-artist-tracks">{artist.trackCount} tracks</span>
            </div>
          </div>
        ))}
      </div>
    </BaseSectionWrapper>
  );
};

export default SimilarArtistsSection;
