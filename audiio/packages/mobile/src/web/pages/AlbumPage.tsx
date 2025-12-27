/**
 * AlbumPage - Album detail view for mobile
 *
 * Features:
 * - Hero header with artwork
 * - Album info (artist, year, track count)
 * - Full track list
 * - Play/Shuffle controls
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlaybackControls, useQueueControls } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { triggerHaptic } from '../utils/haptics';
import {
  ChevronLeftIcon,
  PlayIcon,
  ShuffleIcon,
  MusicNoteIcon,
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
  const { play } = usePlaybackControls();

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
      setQueue(album.tracks, 0);
      play(album.tracks[0]);
    }
  };

  const handleShuffle = () => {
    if (album?.tracks && album.tracks.length > 0) {
      triggerHaptic('medium');
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
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

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon size={24} />
        </button>
      </header>

      <PullToRefresh onRefresh={fetchAlbum} disabled={isLoading}>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <SpinnerIcon size={32} />
              <p>Loading album...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchAlbum}>Retry</button>
            </div>
          ) : album ? (
            <>
              {/* Hero Section */}
              <div className={styles.hero}>
                <div className={styles.artwork}>
                  {album.artwork ? (
                    <img src={album.artwork} alt={album.title} />
                  ) : (
                    <div className={styles.artworkPlaceholder}>
                      <MusicNoteIcon size={64} />
                    </div>
                  )}
                </div>

                <h1 className={styles.title}>{album.title}</h1>

                {/* Artist (clickable) */}
                <button
                  className={styles.artistLink}
                  onClick={handleArtistClick}
                  disabled={!album.artistId}
                >
                  {album.artist}
                </button>

                {/* Meta info */}
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
            </>
          ) : null}
        </div>
      </PullToRefresh>
    </div>
  );
}
