/**
 * AlbumDetailView - Apple + Spotify hybrid design
 * Features: centered layout, ambient glow, clean borderless track list
 */

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useAlbumStore } from '../../stores/album-store';
import { useTrackContextMenu, useAlbumContextMenu } from '../../contexts/ContextMenuContext';
import { CreditsModal } from './CreditsModal';
import { MusicNoteIcon, PlayIcon, ShuffleIcon, MoreIcon, BackIcon } from '../Icons/Icons';
import { getColorsForArtwork, getDefaultColors, type ExtractedColors } from '../../utils/color-extraction';
import type { UnifiedTrack, AlbumCredits } from '@audiio/core';
import type { SearchAlbum } from '../../stores/search-store';

// Helper to check if credits object has any content
function hasCreditsContent(credits: AlbumCredits): boolean {
  return !!(
    (credits.producers && credits.producers.length > 0) ||
    (credits.writers && credits.writers.length > 0) ||
    (credits.engineers && credits.engineers.length > 0) ||
    credits.label ||
    credits.copyright
  );
}

export const AlbumDetailView: React.FC = () => {
  const { selectedAlbumId, selectedAlbumData, goBack, openArtist, openAlbum } = useNavigationStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { fetchAlbum, getAlbum, loadingAlbumId, error } = useAlbumStore();
  const { showContextMenu: showTrackContextMenu } = useTrackContextMenu();
  const { showContextMenu: showAlbumContextMenu } = useAlbumContextMenu();

  const [colors, setColors] = useState<ExtractedColors>(getDefaultColors());
  const [showCredits, setShowCredits] = useState(false);

  // Get album data
  const albumDetail = getAlbum(selectedAlbumId || '');
  const album = albumDetail || selectedAlbumData;
  const isLoading = loadingAlbumId === selectedAlbumId;

  // Extract colors from artwork
  useEffect(() => {
    if (album?.artwork) {
      getColorsForArtwork(album.artwork).then(setColors);
    }
  }, [album?.artwork]);

  // Fetch album data when ID changes
  useEffect(() => {
    if (selectedAlbumId && selectedAlbumData) {
      fetchAlbum(selectedAlbumId, selectedAlbumData);
    }
  }, [selectedAlbumId, selectedAlbumData?.title]);

  if (!selectedAlbumId) {
    return (
      <div className="album-detail-view">
        <div className="album-not-found">
          <p>Album not found</p>
          <button onClick={goBack}>Go Back</button>
        </div>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (albumDetail?.tracks && albumDetail.tracks.length > 0) {
      const firstTrack = albumDetail.tracks[0];
      setQueue(albumDetail.tracks, 0);
      if (firstTrack) play(firstTrack);
    }
  };

  const handleShufflePlay = () => {
    if (albumDetail?.tracks && albumDetail.tracks.length > 0) {
      const shuffled = [...albumDetail.tracks].sort(() => Math.random() - 0.5);
      const firstTrack = shuffled[0];
      setQueue(shuffled, 0);
      if (firstTrack) play(firstTrack);
    }
  };

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    if (albumDetail?.tracks) {
      setQueue(albumDetail.tracks, index);
      play(track);
    }
  };

  const handleGoToArtist = () => {
    if (album?.artist) {
      openArtist(`artist-${album.artist}`, {
        id: `artist-${album.artist}`,
        name: album.artist,
        image: album.artwork,
        source: album.source || 'unknown'
      });
    }
  };

  const handleMoreAlbumClick = (moreAlbum: SearchAlbum) => {
    openAlbum(moreAlbum.id, moreAlbum);
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getYear = (date?: string): string => {
    if (!date) return '';
    try {
      return new Date(date).getFullYear().toString();
    } catch {
      return date.substring(0, 4);
    }
  };

  const formatReleaseDate = (date?: string): string => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date.substring(0, 4);
    }
  };

  const getAlbumTypeLabel = (type?: string): string => {
    switch (type) {
      case 'album': return 'ALBUM';
      case 'single': return 'SINGLE';
      case 'ep': return 'EP';
      case 'compilation': return 'COMPILATION';
      default: return 'ALBUM';
    }
  };

  const year = albumDetail?.releaseDate ? getYear(albumDetail.releaseDate) : album?.year;
  const trackCount = albumDetail?.trackCount || albumDetail?.tracks?.length;

  return (
    <div
      className="album-detail-view album-detail-centered"
      style={{ '--ambient-color': colors.dominant } as React.CSSProperties}
    >
      {/* Ambient Background - soft blur */}
      {album?.artwork && (
        <div
          className="album-ambient-bg-centered"
          style={{ backgroundImage: `url(${album.artwork})` }}
        />
      )}

      {/* Back Button */}
      <button className="back-btn-round album-back-btn" onClick={goBack} aria-label="Go back">
        <BackIcon size={20} />
      </button>

      {/* Hero Section - Centered Layout (Apple-style) */}
      <div className="album-hero-centered">
        {/* Artwork with ambient glow */}
        <div className="album-artwork-centered">
          {album?.artwork ? (
            <img
              className="album-artwork-img-centered"
              src={album.artwork}
              alt={album.title}
            />
          ) : (
            <div className="album-artwork-placeholder-centered">
              <MusicNoteIcon size={80} />
            </div>
          )}
          {/* Soft glow shadow */}
          <div
            className="album-artwork-glow"
            style={{
              background: `radial-gradient(ellipse at center, ${colors.dominant}40 0%, transparent 70%)`
            }}
          />
        </div>

        {/* Album Info - Centered */}
        <div className="album-info-centered">
          {/* Type Badge */}
          <span className="album-type-badge-centered">
            {getAlbumTypeLabel(albumDetail?.albumType)}
          </span>

          {/* Title */}
          <h1 className="album-title-centered">{album?.title || 'Unknown Album'}</h1>

          {/* Meta: Artist . Year . Track count */}
          <div className="album-meta-centered">
            <span className="album-artist-link-centered" onClick={handleGoToArtist}>
              {album?.artist || 'Unknown Artist'}
            </span>
            {year && (
              <>
                <span className="album-meta-dot">&bull;</span>
                <span>{year}</span>
              </>
            )}
            {trackCount && (
              <>
                <span className="album-meta-dot">&bull;</span>
                <span>{trackCount} {trackCount === 1 ? 'song' : 'songs'}</span>
              </>
            )}
          </div>

          {/* Action Buttons - Pill shaped */}
          <div className="album-actions-centered">
            <button
              className="album-play-btn-pill"
              onClick={handlePlayAll}
              disabled={!albumDetail?.tracks?.length}
            >
              <PlayIcon size={20} />
              <span>Play</span>
            </button>
            <button
              className="album-shuffle-btn-pill"
              onClick={handleShufflePlay}
              disabled={!albumDetail?.tracks?.length}
            >
              <ShuffleIcon size={18} />
              <span>Shuffle</span>
            </button>
            <button
              className="album-more-btn-pill"
              onClick={(e) => album && showAlbumContextMenu(e, album as SearchAlbum)}
            >
              <MoreIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Track List - Clean, borderless */}
      <section className="album-tracks-clean">
        <div className="album-tracks-header-clean">
          <span className="track-col-num">#</span>
          <span className="track-col-title">Title</span>
          <span className="track-col-dur">Duration</span>
        </div>

        {isLoading ? (
          <div className="album-loading">
            <div className="album-loading-spinner" />
            <span>Loading tracks...</span>
          </div>
        ) : error ? (
          <div className="album-section-placeholder">{error}</div>
        ) : albumDetail?.tracks && albumDetail.tracks.length > 0 ? (
          <div className="album-tracks-list-clean">
            {albumDetail.tracks.map((track, index) => {
              const isPlaying = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`album-track-row-clean ${isPlaying ? 'playing' : ''}`}
                  onClick={() => handleTrackClick(track, index)}
                  onContextMenu={(e) => showTrackContextMenu(e, track)}
                >
                  {/* Playing indicator bar on left */}
                  {isPlaying && <div className="track-playing-bar" />}

                  <span className="album-track-num-clean">
                    {isPlaying ? (
                      <span className="track-playing-indicator">
                        <span className="bar"></span>
                        <span className="bar"></span>
                        <span className="bar"></span>
                      </span>
                    ) : (
                      (track as { trackNumber?: number }).trackNumber || index + 1
                    )}
                  </span>
                  <div className="album-track-info-clean">
                    <span className="album-track-title-clean">{track.title}</span>
                    {(track.artists.length > 1 || track.explicit) && (
                      <div className="album-track-subtitle-clean">
                        {track.explicit && <span className="explicit-badge-small">E</span>}
                        {track.artists.length > 1 && (
                          <span className="album-track-artists-clean">
                            {track.artists.map(a => a.name).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="album-track-dur-clean">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="album-section-placeholder">
            No tracks found for this album
          </div>
        )}
      </section>

      {/* Artist Card - Full artist display */}
      {albumDetail?.artistInfo && (
        <section className="album-artist-section">
          <h2 className="album-section-title">About the Artist</h2>
          <div
            className="album-artist-card"
            onClick={() => openArtist(albumDetail.artistInfo!.id, {
              id: albumDetail.artistInfo!.id,
              name: albumDetail.artistInfo!.name,
              image: albumDetail.artistInfo!.image,
              source: album?.source || 'addon'
            })}
          >
            <div className="album-artist-card-image">
              {albumDetail.artistInfo.image ? (
                <img src={albumDetail.artistInfo.image} alt={albumDetail.artistInfo.name} />
              ) : (
                <div className="album-artist-card-placeholder">
                  <MusicNoteIcon size={48} />
                </div>
              )}
            </div>
            <div className="album-artist-card-info">
              <h3 className="album-artist-card-name">{albumDetail.artistInfo.name}</h3>
              {albumDetail.artistInfo.followers && (
                <span className="album-artist-card-followers">
                  {albumDetail.artistInfo.followers.toLocaleString()} followers
                </span>
              )}
              {albumDetail.artistInfo.genres && albumDetail.artistInfo.genres.length > 0 && (
                <span className="album-artist-card-genres">
                  {albumDetail.artistInfo.genres.slice(0, 3).join(' • ')}
                </span>
              )}
              {albumDetail.artistInfo.bio && (
                <p className="album-artist-card-bio">
                  {albumDetail.artistInfo.bio.length > 200
                    ? `${albumDetail.artistInfo.bio.substring(0, 200)}...`
                    : albumDetail.artistInfo.bio}
                </p>
              )}
              <button className="album-artist-card-btn">View Artist</button>
            </div>
          </div>
        </section>
      )}

      {/* More by Artist - Horizontal scroll */}
      {albumDetail?.moreByArtist && albumDetail.moreByArtist.length > 0 && (
        <section className="album-more-section-clean">
          <h2 className="album-more-title">
            More by {album?.artist || 'Artist'}
          </h2>
          <div className="album-more-scroll-clean">
            {albumDetail.moreByArtist.map(moreAlbum => (
              <div
                key={moreAlbum.id}
                className="album-card-clean"
                onClick={() => handleMoreAlbumClick(moreAlbum)}
                onContextMenu={(e) => showAlbumContextMenu(e, moreAlbum)}
              >
                <div className="album-card-image-clean">
                  {moreAlbum.artwork ? (
                    <img src={moreAlbum.artwork} alt={moreAlbum.title} loading="lazy" />
                  ) : (
                    <div className="album-card-placeholder-clean">
                      <MusicNoteIcon size={32} />
                    </div>
                  )}
                  <div className="album-card-play-clean">
                    <PlayIcon size={24} />
                  </div>
                </div>
                <div className="album-card-info-clean">
                  <span className="album-card-title-clean">{moreAlbum.title}</span>
                  {moreAlbum.year && <span className="album-card-year-clean">{moreAlbum.year}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar Albums - "You Might Also Like" */}
      {albumDetail?.similarAlbums && albumDetail.similarAlbums.length > 0 && (
        <section className="album-more-section-clean album-similar-section">
          <h2 className="album-more-title">You Might Also Like</h2>
          <div className="album-more-scroll-clean">
            {albumDetail.similarAlbums.map(simAlbum => (
              <div
                key={simAlbum.id}
                className="album-card-clean"
                onClick={() => handleMoreAlbumClick(simAlbum)}
                onContextMenu={(e) => showAlbumContextMenu(e, simAlbum)}
              >
                <div className="album-card-image-clean">
                  {simAlbum.artwork ? (
                    <img src={simAlbum.artwork} alt={simAlbum.title} loading="lazy" />
                  ) : (
                    <div className="album-card-placeholder-clean">
                      <MusicNoteIcon size={32} />
                    </div>
                  )}
                  <div className="album-card-play-clean">
                    <PlayIcon size={24} />
                  </div>
                </div>
                <div className="album-card-info-clean">
                  <span className="album-card-title-clean">{simAlbum.title}</span>
                  <span className="album-card-artist-clean">{simAlbum.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer - Subtle divider, muted text */}
      <footer className="album-footer-clean">
        <div className="album-footer-divider" />
        <div className="album-footer-content">
          {albumDetail?.releaseDate && (
            <p className="album-footer-text">{formatReleaseDate(albumDetail.releaseDate)}</p>
          )}
          {albumDetail?.label && (
            <p className="album-footer-text">{albumDetail.label}</p>
          )}
          {albumDetail?.copyright && (
            <p className="album-footer-text album-footer-copyright">{albumDetail.copyright}</p>
          )}
          {albumDetail?.credits && hasCreditsContent(albumDetail.credits) && (
            <button
              className="album-credits-link"
              onClick={() => setShowCredits(true)}
            >
              Show Credits
            </button>
          )}
        </div>
      </footer>

      {/* Credits Modal */}
      {showCredits && albumDetail?.credits && (
        <CreditsModal
          credits={albumDetail.credits}
          albumTitle={album?.title || ''}
          onClose={() => setShowCredits(false)}
        />
      )}
    </div>
  );
};

export default AlbumDetailView;
