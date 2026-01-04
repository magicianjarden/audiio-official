/**
 * SimilarArtistsSection - Grid of artists similar to your favorites
 * Uses the plugin pipeline to fetch tracks and groups by artist
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import { PlayIcon, MusicNoteIcon, RadioIcon } from '@audiio/icons';

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

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery = {
    strategy: 'plugin',
    sectionType: 'similar-artists',
    title,
    subtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.3,
      includeCollaborative: true,
    },
    limit: 50, // Get more tracks to find diverse artists
  };

  // Use plugin pipeline for data fetching
  const { tracks: rawTracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: 50,
  });

  // Group tracks by artist
  const artists = useMemo(() => {
    if (rawTracks.length === 0) {
      return [];
    }

    // Group by artist
    const artistMap = new Map<string, ArtistCard>();

    for (const track of rawTracks) {
      const artist = track.artists?.[0];
      if (!artist?.name) continue;

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
  }, [rawTracks, maxArtists]);

  const handleArtistPlay = (artist: ArtistCard) => {
    if (artist.tracks.length > 0 && artist.tracks[0]) {
      setQueue(artist.tracks, 0);
      play(artist.tracks[0]);
    }
  };

  // Show empty state instead of hiding
  const showEmptyState = !isLoading && artists.length === 0;

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
      {isLoading ? (
        <div className="similar-artists-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="similar-artist-card skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Discovering artists for you...</p>
        </div>
      ) : (
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
                {/* Radio indicator badge */}
                <div className="similar-artist-radio-badge" title="Plays artist radio">
                  <RadioIcon size={12} />
                </div>
              </div>
              <div className="similar-artist-info">
                <span className="similar-artist-name">{artist.name}</span>
                <span className="similar-artist-radio-label">Radio • {artist.trackCount} tracks</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default SimilarArtistsSection;
