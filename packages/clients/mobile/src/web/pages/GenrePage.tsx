/**
 * Genre Page - Shows tracks for a specific genre
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { tunnelFetch } from '../stores/auth-store';
import { useQueueControls } from '../stores/player-store';
import { triggerHaptic } from '../utils/haptics';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { MusicNoteIcon, ArrowLeftIcon, PlayIcon, ShuffleIcon } from '@audiio/icons';
import styles from './GenrePage.module.css';

interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: { id: string; name: string; artwork?: unknown };
  artwork?: unknown;
  duration?: number;
  source?: string;
}

export function GenrePage() {
  const { genreId } = useParams<{ genreId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setQueue } = useQueueControls();

  const genreName = searchParams.get('name') || genreId?.replace(/-/g, ' ') || 'Genre';

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGenreTracks();
  }, [genreId]);

  const fetchGenreTracks = async () => {
    if (!genreId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await tunnelFetch(`/api/discover/genre/${encodeURIComponent(genreId)}?limit=50`);
      const data = await response.json();
      setTracks(data.tracks || []);
    } catch (err) {
      console.error('[GenrePage] Failed to fetch genre tracks:', err);
      setError('Failed to load tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    triggerHaptic('medium');
    setQueue(tracks as any[], 0);
  };

  const handleShuffle = () => {
    if (tracks.length === 0) return;
    triggerHaptic('medium');
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled as any[], 0);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ArrowLeftIcon size={24} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{genreName}</h1>
          {tracks.length > 0 && (
            <p className={styles.trackCount}>{tracks.length} tracks</p>
          )}
        </div>
      </header>

      {tracks.length > 0 && (
        <div className={styles.actions}>
          <button className={styles.playButton} onClick={handlePlayAll}>
            <PlayIcon size={20} />
            <span>Play All</span>
          </button>
          <button className={styles.shuffleButton} onClick={handleShuffle}>
            <ShuffleIcon size={20} />
            <span>Shuffle</span>
          </button>
        </div>
      )}

      <PullToRefresh onRefresh={fetchGenreTracks} disabled={isLoading}>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading tracks...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchGenreTracks}>Retry</button>
            </div>
          ) : tracks.length === 0 ? (
            <div className={styles.empty}>
              <MusicNoteIcon size={48} />
              <p>No tracks found for this genre</p>
            </div>
          ) : (
            <TrackList tracks={tracks} />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
