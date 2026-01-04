/**
 * MobileHorizontalSection - Horizontal scroll section
 *
 * Features:
 * - Horizontal scrolling card list
 * - Snap-to-card behavior
 * - Momentum scrolling
 * - Track cards with artwork and play overlay
 * - Artist cards with circular images
 * - Album cards with square artwork
 * - Genre cards with colored backgrounds
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseMobileSection } from './BaseMobileSection';
import { SectionProps, SectionTrack, SectionArtist, SectionAlbum, SectionGenre } from './MobileSectionRegistry';
import { getArtworkUrl } from '../../utils/artwork';
import { triggerHaptic } from '../../utils/haptics';
import { MusicNoteIcon, PlayIcon } from '@audiio/icons';
import styles from './MobileHorizontalSection.module.css';

export function MobileHorizontalSection({
  section,
  index,
  onTrackPlay,
  onArtistClick,
  onAlbumClick,
}: SectionProps) {
  const navigate = useNavigate();
  const { title, subtitle, tracks, artists, albums, genres, isPluginPowered, pluginName, type } = section;

  const handleTrackClick = useCallback((track: SectionTrack) => {
    triggerHaptic('light');
    onTrackPlay?.(track, tracks || []);
  }, [tracks, onTrackPlay]);

  const handleArtistClick = useCallback((artist: SectionArtist) => {
    triggerHaptic('light');
    onArtistClick?.(artist);
  }, [onArtistClick]);

  const handleAlbumClick = useCallback((album: SectionAlbum) => {
    triggerHaptic('light');
    onAlbumClick?.(album);
  }, [onAlbumClick]);

  const handleGenreClick = useCallback((genre: SectionGenre) => {
    triggerHaptic('light');
    navigate(`/genre/${genre.id}?name=${encodeURIComponent(genre.name)}`);
  }, [navigate]);

  // Determine what content to render
  const hasContent = (tracks && tracks.length > 0) ||
                     (artists && artists.length > 0) ||
                     (albums && albums.length > 0) ||
                     (genres && genres.length > 0);

  if (!hasContent) {
    return null;
  }

  // Render genre cards
  if (type === 'genres' && genres && genres.length > 0) {
    return (
      <BaseMobileSection
        title={title}
        subtitle={subtitle}
        index={index}
        isPluginPowered={isPluginPowered}
        pluginName={pluginName}
      >
        <div className={styles.scrollContainer}>
          <div className={styles.genreGrid}>
            {genres.map((genre) => (
              <GenreCard
                key={genre.id}
                genre={genre}
                onClick={() => handleGenreClick(genre)}
              />
            ))}
          </div>
        </div>
      </BaseMobileSection>
    );
  }

  // Render artist cards
  if ((type === 'artists' || type === 'popular-artists') && artists && artists.length > 0) {
    return (
      <BaseMobileSection
        title={title}
        subtitle={subtitle}
        index={index}
        isPluginPowered={isPluginPowered}
        pluginName={pluginName}
      >
        <div className={styles.scrollContainer}>
          <div className={styles.scrollContent}>
            {artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={() => handleArtistClick(artist)}
              />
            ))}
          </div>
        </div>
      </BaseMobileSection>
    );
  }

  // Render album cards
  if ((type === 'new-releases' || type === 'top-albums') && albums && albums.length > 0) {
    return (
      <BaseMobileSection
        title={title}
        subtitle={subtitle}
        index={index}
        isPluginPowered={isPluginPowered}
        pluginName={pluginName}
      >
        <div className={styles.scrollContainer}>
          <div className={styles.scrollContent}>
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={() => handleAlbumClick(album)}
              />
            ))}
          </div>
        </div>
      </BaseMobileSection>
    );
  }

  // Default: render track cards
  if (!tracks || tracks.length === 0) {
    return null;
  }

  return (
    <BaseMobileSection
      title={title}
      subtitle={subtitle}
      index={index}
      isPluginPowered={isPluginPowered}
      pluginName={pluginName}
    >
      <div className={styles.scrollContainer}>
        <div className={styles.scrollContent}>
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track)}
            />
          ))}
        </div>
      </div>
    </BaseMobileSection>
  );
}

interface TrackCardProps {
  track: SectionTrack;
  onClick: () => void;
}

function TrackCard({ track, onClick }: TrackCardProps) {
  const artwork = getArtworkUrl(track.artwork || track.album?.artwork, 'medium');
  const artistName = track.artists?.[0]?.name || 'Unknown Artist';

  return (
    <button className={styles.trackCard} onClick={onClick}>
      <div className={styles.artworkContainer}>
        {artwork ? (
          <img src={artwork} alt={track.title} className={styles.artwork} />
        ) : (
          <div className={styles.artworkPlaceholder}>
            <MusicNoteIcon size={24} />
          </div>
        )}
        <div className={styles.playOverlay}>
          <div className={styles.playButton}>
            <PlayIcon size={20} />
          </div>
        </div>
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{track.title}</span>
        <span className={styles.artist}>{artistName}</span>
      </div>
    </button>
  );
}

interface ArtistCardProps {
  artist: SectionArtist;
  onClick: () => void;
}

function ArtistCard({ artist, onClick }: ArtistCardProps) {
  return (
    <button className={styles.artistCard} onClick={onClick}>
      <div className={styles.artistImageContainer}>
        {artist.image ? (
          <img src={artist.image} alt={artist.name} className={styles.artistImage} />
        ) : (
          <div className={styles.artistImagePlaceholder}>
            <MusicNoteIcon size={24} />
          </div>
        )}
      </div>
      <span className={styles.artistName}>{artist.name}</span>
    </button>
  );
}

interface AlbumCardProps {
  album: SectionAlbum;
  onClick: () => void;
}

function AlbumCard({ album, onClick }: AlbumCardProps) {
  const artwork = getArtworkUrl(album.artwork, 'medium');
  const albumName = album.title || album.name || '';
  const artistName = album.artists?.[0]?.name || '';

  return (
    <button className={styles.albumCard} onClick={onClick}>
      <div className={styles.artworkContainer}>
        {artwork ? (
          <img src={artwork} alt={albumName} className={styles.artwork} />
        ) : (
          <div className={styles.artworkPlaceholder}>
            <MusicNoteIcon size={24} />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{albumName}</span>
        {artistName && <span className={styles.artist}>{artistName}</span>}
      </div>
    </button>
  );
}

interface GenreCardProps {
  genre: SectionGenre;
  onClick: () => void;
}

function GenreCard({ genre, onClick }: GenreCardProps) {
  return (
    <button
      className={styles.genreCard}
      onClick={onClick}
      style={{ backgroundColor: genre.color || '#6366f1' }}
    >
      <span className={styles.genreName}>{genre.name}</span>
    </button>
  );
}

// Export getArtworkUrl helper for use in other sections
export { getArtworkUrl };
