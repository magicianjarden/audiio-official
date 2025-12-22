/**
 * ArtistSpotlightSection - Magazine-style deep dive on a single artist
 * Shows bio, image, top tracks, and related artists
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon, UserIcon } from '../../Icons/Icons';

export interface ArtistData {
  id: string;
  name: string;
  image?: string;
  bio?: string;
  monthlyListeners?: number;
  topTracks: UnifiedTrack[];
  relatedArtists?: Array<{ id: string; name: string; image?: string }>;
}

export interface ArtistSpotlightSectionProps extends BaseSectionProps {
  artist?: ArtistData;
  artistName?: string;
}

export const ArtistSpotlightSection: React.FC<ArtistSpotlightSectionProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  context,
  artist: propArtist,
  artistName,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { openArtist } = useNavigationStore();
  const { showContextMenu } = useTrackContextMenu();
  const { getTopArtists } = useRecommendationStore();

  const [artist, setArtist] = useState<ArtistData | null>(propArtist ?? null);
  const [isLoading, setIsLoading] = useState(!propArtist);
  const [error, setError] = useState<string | null>(null);

  // Get artist name from props or top artists
  const targetArtist = artistName ?? getTopArtists(1)[0];

  useEffect(() => {
    if (propArtist || !targetArtist) return;

    const fetchArtistData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Search for artist's tracks
        if (window.api) {
          const tracks = await window.api.search({
            query: targetArtist,
            type: 'track',
          });

          // Create artist data from search results
          const artistTracks = tracks.filter((t: UnifiedTrack) =>
            t.artists.some((a) => a.name.toLowerCase().includes(targetArtist.toLowerCase()))
          ).slice(0, 5);

          const firstTrack = artistTracks[0];
          if (firstTrack && artistTracks.length > 0) {
            const primaryArtist = firstTrack.artists[0];
            if (primaryArtist) {
              setArtist({
                id: primaryArtist.id || targetArtist.toLowerCase().replace(/\s+/g, '-'),
                name: primaryArtist.name,
                image: firstTrack.artwork?.large ?? firstTrack.artwork?.medium,
                topTracks: artistTracks,
                relatedArtists: [], // Would need additional API call
              });
            }
          }
        }
      } catch (err) {
        console.error('[ArtistSpotlight] Failed to fetch artist:', err);
        setError('Failed to load artist');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtistData();
  }, [propArtist, targetArtist]);

  const handleTrackClick = (track: UnifiedTrack) => {
    if (!artist) return;
    setQueue(artist.topTracks, artist.topTracks.indexOf(track));
    play(track);
  };

  const handlePlayAll = () => {
    const firstTrack = artist?.topTracks[0];
    if (!artist || !firstTrack) return;
    setQueue(artist.topTracks, 0);
    play(firstTrack);
  };

  const handleViewArtist = () => {
    if (!artist) return;
    openArtist(artist.id, {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      source: 'spotlight'
    });
  };

  if (!isLoading && !artist) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="artist-spotlight"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      showHeader={false}
      className="artist-spotlight-section"
    >
      {artist && (
        <div className="spotlight-container">
          {/* Artist hero */}
          <div className="spotlight-hero">
            <div className="spotlight-image">
              {artist.image ? (
                <img src={artist.image} alt={artist.name} />
              ) : (
                <div className="spotlight-image-placeholder">
                  <UserIcon size={64} />
                </div>
              )}
              <div className="spotlight-image-gradient" />
            </div>

            <div className="spotlight-info">
              <span className="spotlight-label">Artist Spotlight</span>
              <h2 className="spotlight-name">{artist.name}</h2>
              {artist.monthlyListeners && (
                <p className="spotlight-listeners">
                  {formatNumber(artist.monthlyListeners)} monthly listeners
                </p>
              )}
              {artist.bio && (
                <p className="spotlight-bio">{truncate(artist.bio, 150)}</p>
              )}

              <div className="spotlight-actions">
                <button className="spotlight-play" onClick={handlePlayAll}>
                  <PlayIcon size={20} />
                  <span>Play</span>
                </button>
                <button className="spotlight-view" onClick={handleViewArtist}>
                  View Artist
                </button>
              </div>
            </div>
          </div>

          {/* Top tracks */}
          <div className="spotlight-tracks">
            <h3 className="spotlight-tracks-title">Popular Tracks</h3>
            <div className="spotlight-tracks-list">
              {artist.topTracks.map((track, index) => (
                <SpotlightTrack
                  key={track.id}
                  track={track}
                  index={index}
                  isPlaying={currentTrack?.id === track.id && isPlaying}
                  onClick={() => handleTrackClick(track)}
                  onContextMenu={(e) => showContextMenu(e, track)}
                />
              ))}
            </div>
          </div>

          {/* Related artists */}
          {artist.relatedArtists && artist.relatedArtists.length > 0 && (
            <div className="spotlight-related">
              <h3 className="spotlight-related-title">Similar Artists</h3>
              <div className="spotlight-related-list">
                {artist.relatedArtists.slice(0, 4).map((related) => (
                  <div key={related.id} className="related-artist">
                    <div className="related-artist-image">
                      {related.image ? (
                        <img src={related.image} alt={related.name} />
                      ) : (
                        <UserIcon size={24} />
                      )}
                    </div>
                    <span className="related-artist-name">{related.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

interface SpotlightTrackProps {
  track: UnifiedTrack;
  index: number;
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SpotlightTrack: React.FC<SpotlightTrackProps> = ({
  track,
  index,
  isPlaying,
  onClick,
  onContextMenu,
}) => {
  const artwork = track.artwork?.small;

  return (
    <div
      className={`spotlight-track ${isPlaying ? 'playing' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="track-number">{index + 1}</span>

      <div className="track-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} />
        ) : (
          <MusicNoteIcon size={16} />
        )}
        {isPlaying && (
          <div className="track-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>

      <div className="track-info">
        <span className="track-title">{track.title}</span>
      </div>

      <span className="track-duration">{formatDuration(track.duration)}</span>
    </div>
  );
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export default ArtistSpotlightSection;
