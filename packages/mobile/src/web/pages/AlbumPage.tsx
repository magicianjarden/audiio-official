/**
 * AlbumPage - Album detail view for mobile
 *
 * Features:
 * - Parallax sticky header with artwork
 * - Album info (artist, year, track count)
 * - Full track list
 * - Play/Shuffle controls
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueueControls } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { TrackList } from '../components/TrackList';
import { StickyHeader } from '../components/StickyHeader';
import { triggerHaptic } from '../utils/haptics';
import {
  PlayIcon,
  ShuffleIcon,
  SpinnerIcon
} from '@audiio/icons';
import styles from './AlbumPage.module.css';

interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork?: string;
  year?: string;
  trackCount?: number;
  duration?: number;
  source: string;
  tracks: any[];
}

export function AlbumPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setQueue } = useQueueControls();

  // Get album name from search params (for initial display)
  const albumName = searchParams.get('name') || '';
  const source = searchParams.get('source') || 'spotify';

  const fetchAlbum = useCallback(async () => {
    if (!albumId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (source) params.set('source', source);

      const response = await tunnelFetch(`/api/album/${albumId}?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load album');
      }

      const data = await response.json();
      setAlbum(data);
    } catch (err) {
      setError('Could not load album details');
      console.error('Album fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [albumId, source]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  const handlePlayAll = () => {
    if (album?.tracks && album.tracks.length > 0) {
      triggerHaptic('medium');
      // setQueue already calls play() internally
      setQueue(album.tracks, 0);
    }
  };

  const handleShuffle = () => {
    if (album?.tracks && album.tracks.length > 0) {
      triggerHaptic('medium');
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
      // setQueue already calls play() internally
      setQueue(shuffled, 0);
    }
  };

  const handleArtistClick = () => {
    if (album?.artistId) {
      navigate(`/artist/${album.artistId}?name=${encodeURIComponent(album.artist)}&source=${album.source || source}`);
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Build subtitle from artist name
  const subtitle = album?.artist || '';

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <SpinnerIcon size={32} />
          <p>Loading album...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={fetchAlbum}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StickyHeader
        artwork={album?.artwork}
        title={album?.title || albumName}
        subtitle={subtitle}
        expandedHeight={340}
      >
        {album && (
          <div className={styles.content}>
            {/* Artist Link & Meta */}
            <div className={styles.metaSection}>
              <button
                className={styles.artistLink}
                onClick={handleArtistClick}
                disabled={!album.artistId}
              >
                {album.artist}
              </button>

              <div className={styles.meta}>
                {album.year && <span>{album.year}</span>}
                {album.trackCount && (
                  <>
                    <span className={styles.dot}>•</span>
                    <span>{album.trackCount} songs</span>
                  </>
                )}
                {album.duration && (
                  <>
                    <span className={styles.dot}>•</span>
                    <span>{formatDuration(album.duration)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.actions}>
              <button
                className={styles.playButton}
                onClick={handlePlayAll}
                disabled={!album.tracks?.length}
              >
                <PlayIcon size={20} />
                Play
              </button>
              <button
                className={styles.shuffleButton}
                onClick={handleShuffle}
                disabled={!album.tracks?.length}
              >
                <ShuffleIcon size={18} />
                Shuffle
              </button>
            </div>

            {/* Track List */}
            {album.tracks && album.tracks.length > 0 && (
              <section className={styles.section}>
                <TrackList tracks={album.tracks} showIndex />
              </section>
            )}

            {/* Album info footer */}
            <div className={styles.footer}>
              {album.year && (
                <p className={styles.releaseDate}>Released {album.year}</p>
              )}
              <p className={styles.source}>via {album.source}</p>
            </div>
          </div>
        )}
      </StickyHeader>
    </div>
  );
}
