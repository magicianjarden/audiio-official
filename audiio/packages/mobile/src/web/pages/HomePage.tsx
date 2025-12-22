/**
 * Home Page - Dashboard with recent/trending content
 */

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { getArtworkUrl } from '../utils/artwork';
import { MusicNoteIcon } from '../components/Icons';
import { TrackList } from '../components/TrackList';
import styles from './HomePage.module.css';

interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: { id: string; name: string; artwork?: unknown };
  artwork?: unknown;
  duration?: number;
}

interface TrendingData {
  tracks: Track[];
  artists: any[];
  albums: any[];
}

export function HomePage() {
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = usePlayerStore();

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const response = await tunnelFetch('/api/trending');
      const data = await response.json();
      setTrending(data);
    } catch (err) {
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Home</h1>
        <div className={`${styles.connectionStatus} ${isConnected ? styles.connected : ''}`}>
          <span className={styles.dot} />
          {isConnected ? 'Connected' : 'Offline'}
        </div>
      </header>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={fetchTrending}>Retry</button>
          </div>
        ) : (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Trending Tracks</h2>
              {trending?.tracks && trending.tracks.length > 0 ? (
                <TrackList tracks={trending.tracks} />
              ) : (
                <p className={styles.emptyMessage}>
                  No trending tracks available. Make sure your desktop app is running.
                </p>
              )}
            </section>

            {trending?.albums && trending.albums.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Popular Albums</h2>
                <div className={styles.albumGrid}>
                  {trending.albums.slice(0, 6).map((album: any) => {
                    const albumArtwork = getArtworkUrl(album.artwork, 'medium');
                    return (
                      <div key={album.id} className={styles.albumCard}>
                        <div className={styles.albumArtwork}>
                          {albumArtwork ? (
                            <img src={albumArtwork} alt={album.title || album.name} />
                          ) : (
                            <div className={styles.placeholder}>
                              <MusicNoteIcon size={24} />
                            </div>
                          )}
                        </div>
                        <p className={styles.albumName}>{album.title || album.name}</p>
                        <p className={styles.albumArtist}>{album.artists?.[0]?.name}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
